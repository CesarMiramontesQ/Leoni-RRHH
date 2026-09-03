"""
Cliente de solo lectura hacia PostgreSQL ``bono_productividad``.

Coexiste con la conexión principal de la app (``app.core.database`` / ``DATABASE_URL``);
no comparte motor, pool ni sesión con esa base.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import settings
from app.core.db_engine_utils import build_asyncpg_url, normalizar_url_y_connect_args


class BonoProductividadReadClient:
    """
    Segunda conexión PostgreSQL exclusiva para lectura sobre la BD configurada con ``BONO_DB_*``.
    """

    @staticmethod
    def build_async_database_url() -> str | None:
        return build_asyncpg_url(
            host=settings.BONO_DB_HOST,
            port=settings.BONO_DB_PORT,
            name=settings.BONO_DB_NAME,
            user=settings.BONO_DB_USER,
            password=settings.BONO_DB_PASSWORD,
            engine=settings.BONO_DB_ENGINE,
        )

    @staticmethod
    def build_mirror_async_database_url() -> str | None:
        """URL del mirror FI/RE. ``BONO_MIRROR_DB_NAME`` si está definida; si no, ``BONO_DB_NAME``."""
        name = (settings.BONO_MIRROR_DB_NAME or "").strip() or settings.BONO_DB_NAME
        return build_asyncpg_url(
            host=settings.BONO_DB_HOST,
            port=settings.BONO_DB_PORT,
            name=name,
            user=settings.BONO_DB_USER,
            password=settings.BONO_DB_PASSWORD,
            engine=settings.BONO_DB_ENGINE,
        )

    @staticmethod
    def _engine_from_url(url: str | None) -> AsyncEngine | None:
        if not url:
            return None
        db_url, connect_args = normalizar_url_y_connect_args(url)
        return create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args=connect_args,
        )

    @staticmethod
    def create_read_engine() -> AsyncEngine | None:
        """Motor async dedicado; el llamador debe ``await engine.dispose()`` al terminar."""
        return BonoProductividadReadClient._engine_from_url(
            BonoProductividadReadClient.build_async_database_url()
        )

    @staticmethod
    def create_mirror_engine() -> AsyncEngine | None:
        """Motor del sync ``importadas_historico`` (job 08:30 y CLI). Respeta ``BONO_MIRROR_DB_NAME``."""
        return BonoProductividadReadClient._engine_from_url(
            BonoProductividadReadClient.build_mirror_async_database_url()
        )

    @staticmethod
    async def run_connection_self_test() -> tuple[bool, str]:
        """
        ``SELECT 1 AS connection_test`` y cierre del pool.

        Returns:
            Éxito: (True, "Conexión a PostgreSQL bono_productividad exitosa").
            Fallo: (False, mensaje con error real).
        """
        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            return (
                False,
                "Configuración incompleta: BONO_DB_HOST, BONO_DB_NAME y BONO_DB_USER deben "
                "estar definidos (p. ej. en `docker-compose.yml` del servicio `backend`).",
            )
        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1 AS connection_test"))
                row = result.fetchone()
                if row is None or row[0] != 1:
                    return (False, f"Respuesta inesperada del servidor: {row!r}")
            return (True, "Conexión a PostgreSQL bono_productividad exitosa")
        except Exception as exc:
            return (False, f"{type(exc).__name__}: {exc}")
        finally:
            await engine.dispose()


# Alias explícito para quien prefiera nombre de “conexión” en singular
bono_productividad_read_client = BonoProductividadReadClient
