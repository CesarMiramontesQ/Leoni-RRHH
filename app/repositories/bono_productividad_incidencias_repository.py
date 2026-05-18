"""
Repositorio de solo lectura sobre PostgreSQL bono_productividad (motor separado de la app).

La consulta vive en ``sql/bono_incidencias_consolidado.sql`` para facilitar ajustes de esquema.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "bono_incidencias_consolidado.sql"


def load_bono_incidencias_consolidado_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class BonoProductividadIncidenciasRepository:
    """Ejecuta el consolidado de incidencias con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def list_incidencias_consolidadas(
        self,
        *,
        empleado_id: int | None,
        no_empleado: str | None,
        tipo: str | None,
        semana_id: int | None,
    ) -> list[dict]:
        sql = load_bono_incidencias_consolidado_sql()
        params = {
            "f_empleado_id": empleado_id,
            "f_no_empleado": no_empleado,
            "f_tipo": tipo,
            "f_semana_id": semana_id,
        }
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [dict(row) for row in result.mappings().all()]
