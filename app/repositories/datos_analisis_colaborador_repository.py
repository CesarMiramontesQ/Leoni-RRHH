"""
Repositorio de solo lectura sobre SQL Server datos-analisis (motor separado de la app).

Consulta datos del colaborador desde la tabla base ``dbo.COLABORA`` de TRESS. Por ahora
expone la fecha de ingreso (``CB_FEC_ING``). La consulta vive en
``sql/datos_analisis_fecha_ingreso.sql`` para facilitar ajustes de esquema.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "datos_analisis_fecha_ingreso.sql"


def load_fecha_ingreso_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class DatosAnalisisColaboradorRepository:
    """Lee datos de ``dbo.COLABORA`` con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_fecha_ingreso(self, *, cb_codigo: int) -> date | None:
        """``CB_FEC_ING`` filtrando por ``CB_CODIGO``; ``None`` si no hay registro."""
        sql = load_fecha_ingreso_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"cb_codigo": cb_codigo})
            row = result.mappings().first()
        val = row["fecha_ingreso"] if row else None
        if val is None:
            return None
        # CB_FEC_ING es datetime en TRESS; normalizar a date.
        return val.date() if isinstance(val, datetime) else val
