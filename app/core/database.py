from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.db_engine_utils import normalizar_url_y_connect_args

# La conexión se obtiene EXCLUSIVAMENTE de `.env` (DATABASE_URL o BONO_DB_*). No hay
# fallback a localhost/credenciales: si falta configuración, el arranque falla con un
# mensaje claro. En tests (APP_ENV=test) se usa SQLite en memoria como motor de módulo;
# la suite crea su propio engine en tests/conftest.py.
if not settings.DATABASE_URL:
    if settings.APP_ENV == "test":
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        raise RuntimeError(
            "No hay conexión a base de datos configurada. Define BONO_DB_HOST, "
            "BONO_DB_NAME, BONO_DB_USER y BONO_DB_PASSWORD (o DATABASE_URL) en `.env`."
        )
else:
    db_url, db_connect_args = normalizar_url_y_connect_args(settings.DATABASE_URL)
    engine = create_async_engine(
        db_url,
        echo=settings.APP_ENV == "development",
        pool_size=10,
        max_overflow=20,
        connect_args=db_connect_args,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
