from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.core.config import settings
from app.core.db_engine_utils import normalizar_url_y_connect_args

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
