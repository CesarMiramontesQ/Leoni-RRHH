"""
Cliente de solo lectura hacia SQL Server ``datos-analisis``.

Coexiste con la conexión principal de la app (``app.core.database`` / ``DATABASE_URL``)
y con la de Bono; no comparte motor, pool ni sesión con ellas. Usa el dialecto
``mssql+aioodbc`` (ODBC Driver 18, instalado en la imagen del backend).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import settings
from app.core.db_engine_utils import build_mssql_aioodbc_url


class DatosAnalisisReadClient:
    """
    Segunda conexión SQL Server exclusiva para lectura sobre la BD configurada con
    ``DATOS_ANALISIS_DB_*``.
    """

    @staticmethod
    def build_async_database_url() -> str | None:
        return build_mssql_aioodbc_url(
            host=settings.DATOS_ANALISIS_DB_HOST,
            port=settings.DATOS_ANALISIS_DB_PORT,
            name=settings.DATOS_ANALISIS_DB_NAME,
            user=settings.DATOS_ANALISIS_DB_USER,
            password=settings.DATOS_ANALISIS_DB_PASSWORD,
            driver=settings.DATOS_ANALISIS_DB_DRIVER,
        )

    @staticmethod
    def create_read_engine() -> AsyncEngine | None:
        """Motor async dedicado; el llamador debe ``await engine.dispose()`` al terminar."""
        url = DatosAnalisisReadClient.build_async_database_url()
        if not url:
            return None
        return create_async_engine(url, pool_pre_ping=True)

    @staticmethod
    async def run_connection_self_test() -> tuple[bool, str]:
        """
        ``SELECT 1 AS connection_test`` y cierre del pool.

        Returns:
            Éxito: (True, "Conexión a SQL Server datos-analisis exitosa").
            Fallo: (False, mensaje con error real).
        """
        engine = DatosAnalisisReadClient.create_read_engine()
        if engine is None:
            return (
                False,
                "Configuración incompleta: DATOS_ANALISIS_DB_HOST, DATOS_ANALISIS_DB_NAME "
                "y DATOS_ANALISIS_DB_USER deben estar definidos (p. ej. en "
                "`docker-compose.yml` del servicio `backend`).",
            )
        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1 AS connection_test"))
                row = result.fetchone()
                if row is None or row[0] != 1:
                    return (False, f"Respuesta inesperada del servidor: {row!r}")
            return (True, "Conexión a SQL Server datos-analisis exitosa")
        except Exception as exc:
            return (False, f"{type(exc).__name__}: {exc}")
        finally:
            await engine.dispose()


# Alias explícito para quien prefiera nombre de “conexión” en singular
datos_analisis_read_client = DatosAnalisisReadClient
