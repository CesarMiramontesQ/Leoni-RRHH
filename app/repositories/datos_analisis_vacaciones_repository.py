"""
Repositorio de solo lectura sobre SQL Server datos-analisis (motor separado de la app).

Consulta el saldo de gozo de vacaciones desde la vista ``dbo.V_SALD_VAC``. La consulta vive
en ``sql/datos_analisis_saldo_vacaciones.sql`` para facilitar ajustes de esquema.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "datos_analisis_saldo_vacaciones.sql"


def load_saldo_vacaciones_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class DatosAnalisisVacacionesRepository:
    """Ejecuta el saldo de gozo con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_saldo_gozo_total(self, *, cb_codigo: int) -> float | None:
        """Suma de ``VS_S_GOZO`` filtrando por ``CB_CODIGO``; ``None`` si no hay registros."""
        sql = load_saldo_vacaciones_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"cb_codigo": cb_codigo})
            row = result.mappings().first()
        val = row["saldo_gozo_total"] if row else None
        return float(val) if val is not None else None
