"""Repositorio de conteo de semanas sin bono (progresivo) sobre la BD de bono.

La consulta base vive en ``sql/bono_progresivo_semanas_sin_bono.sql``. El WHERE
se construye dinamicamente (patron de BonoHistoricoIncidenciasRepository).
Solo lectura sobre la BD externa de bono (SELECT).
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "bono_progresivo_semanas_sin_bono.sql"
)


def load_bono_progresivo_semanas_sin_bono_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class BonoProgresivoRepository:
    """Conteo de semanas con pierde_bono=1 por empleado (vigente + historico)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._base_sql = load_bono_progresivo_semanas_sin_bono_sql()

    def _build_where(
        self,
        *,
        empleado_id: int | None = None,
        empleado_ids_scope: list[int] | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> tuple[str, dict[str, Any]]:
        # Scope vacio explicito -> ningun resultado (no confundir con "todos").
        if empleado_ids_scope is not None and not empleado_ids_scope:
            return "WHERE 1=0", {}

        clauses: list[str] = [
            "pierde_bono = 1",
            "fecha_ini IS NOT NULL",
            "EXTRACT(YEAR FROM fecha_ini) BETWEEN 1900 AND 2100",
        ]
        params: dict[str, Any] = {}

        if empleado_ids_scope is not None:
            clauses.append("empleado_id = ANY(:f_empleado_ids_scope)")
            params["f_empleado_ids_scope"] = empleado_ids_scope
        if empleado_id is not None:
            clauses.append("empleado_id = :f_empleado_id")
            params["f_empleado_id"] = empleado_id
        if fecha_inicio is not None:
            clauses.append("fecha_ini >= :f_fecha_inicio")
            params["f_fecha_inicio"] = fecha_inicio
        if fecha_fin is not None:
            clauses.append("fecha_ini <= :f_fecha_fin")
            params["f_fecha_fin"] = fecha_fin

        return "WHERE " + " AND ".join(clauses), params

    async def aggregate_semanas_sin_bono_por_empleado(
        self,
        *,
        empleado_id: int | None = None,
        empleado_ids_scope: list[int] | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> dict[int, int]:
        """{empleado_id: n_semanas_sin_bono}; empleados sin semanas perdidas no
        aparecen. Solo lectura sobre la BD de bono."""
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            empleado_ids_scope=empleado_ids_scope,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        sql = self._base_sql.replace("{where}", where_sql)
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            rows = result.mappings().all()
        return {int(r["empleado_id"]): int(r["semanas"]) for r in rows}
