"""
Repositorio de solo lectura sobre SQL Server datos-analisis.

Lee ausencias (FI, RE, …) desde ``dbo.AUSENCIA``. La consulta vive en
``sql/datos_analisis_ausencias_por_tipo.sql``.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "datos_analisis_ausencias_por_tipo.sql"
)


def load_ausencias_por_tipo_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


def load_ausencias_fi_sql() -> str:
    """Compat: SQL parametrizado (mismo archivo; el bind tipo_inc lo fija el caller)."""
    return load_ausencias_por_tipo_sql()


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


class DatosAnalisisAusenciasRepository:
    """Lee ausencias de ``dbo.AUSENCIA`` con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._sql = load_ausencias_por_tipo_sql()

    async def list_ausencias(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        tipo_inc: str,
    ) -> list[dict[str, Any]]:
        tipo = str(tipo_inc).strip().upper()
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._sql),
                {
                    "fecha_inicio": fecha_inicio,
                    "fecha_fin": fecha_fin,
                    "tipo_inc": tipo,
                },
            )
            rows = result.mappings().all()

        out: list[dict[str, Any]] = []
        for row in rows:
            no_empleado = row.get("no_empleado")
            try:
                no_empleado_int = int(no_empleado) if no_empleado is not None else None
            except (TypeError, ValueError):
                no_empleado_int = None
            fecha = _as_date(row.get("fecha_incidencia"))
            # inc_id del SELECT suele ser NULL; el servicio fija 6 (FI) / 8 (RE) al insertar.
            raw_inc = row.get("inc_id")
            try:
                inc_id = int(raw_inc) if raw_inc is not None else None
            except (TypeError, ValueError):
                inc_id = None
            out.append(
                {
                    "no_empleado": no_empleado_int,
                    "tipo_inc": str(row.get("tipo_inc") or tipo).strip().upper() or tipo,
                    "inc_id": inc_id,
                    "fecha_incidencia": fecha,
                    "ausencia_llave": row.get("ausencia_llave"),
                }
            )
        return out

    async def list_faltas_injustificadas(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> list[dict[str, Any]]:
        return await self.list_ausencias(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            tipo_inc="FI",
        )
