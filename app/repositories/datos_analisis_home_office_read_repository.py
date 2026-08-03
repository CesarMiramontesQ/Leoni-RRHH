"""
Lectura de días de home office desde SQL Server datos-analisis (motor separado).

Complementa a ``datos_analisis_home_office_write_repository`` (que inserta en
``dbo.PERMISO`` al aprobar una solicitud): aquí solo se consulta lo ya registrado.
La consulta vive en ``sql/datos_analisis_home_office_dias.sql``.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "datos_analisis_home_office_dias.sql"


def load_home_office_dias_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class DatosAnalisisHomeOfficeReadRepository:
    """Ejecuta el conteo de días con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_dias_en_rango(
        self, *, cb_codigo: int, desde: date, hasta: date
    ) -> int:
        """Días de home office con ``PM_FEC_INI`` en ``[desde, hasta)``.

        ``hasta`` es exclusiva: para el año en curso se pasa el 1 de enero del siguiente.
        """
        sql = load_home_office_dias_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(sql), {"cb_codigo": cb_codigo, "desde": desde, "hasta": hasta}
            )
            row = result.mappings().first()
        val = row["dias_home_office"] if row else None
        return int(val) if val is not None else 0
