"""
Repositorio de solo lectura sobre SQL Server datos-analisis.

Lee de ``dbo.AUSENCIA`` y ``dbo.PERMISO`` las incidencias con las que
``sync_incidencias_tress_service`` llena la caché ``levelup_incidencias_tress``.
La página "Incidencias" (módulo ``faltas-retardos``) ya no pasa por aquí: lee esa
caché. La consulta vive en ``sql/datos_analisis_faltas_retardos_base.sql`` y ya
emite los tipos de la API (``falta_injustificada``, ``retardo``, …), no los
códigos de TRESS.

El filtro por empleado viaja como un único bind con los ``CB_CODIGO`` separados
por coma (``STRING_SPLIT`` del lado del servidor): pasar una lista expandida
reventaría el tope de ~2100 parámetros de SQL Server. El sync no lo usa (barre
sin filtro de empleado), pero el bind sigue en el SQL base.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "datos_analisis_faltas_retardos_base.sql"
)


def load_faltas_retardos_datos_analisis_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def cb_codigos_a_csv(cb_codigos: list[int] | None) -> str | None:
    """Lista de números de empleado → CSV ordenado y sin repetidos (None = sin filtro)."""
    if cb_codigos is None:
        return None
    limpios = sorted({int(c) for c in cb_codigos if c is not None})
    return ",".join(str(c) for c in limpios)


class DatosAnalisisFaltasRetardosRepository:
    """Lee incidencias de TRESS con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._base_sql = load_faltas_retardos_datos_analisis_sql()

    def _params(
        self,
        *,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        cb_codigos: list[int] | None,
        tipo: str | None,
    ) -> dict[str, Any]:
        return {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "cb_codigos_csv": cb_codigos_a_csv(cb_codigos),
            "tipo": tipo.strip() if tipo and tipo.strip() else None,
        }

    def _filtrado(self) -> str:
        """Base envuelta con el filtro por tipo (un solo bind, el SQL ya emite tipos de API)."""
        return (
            f"SELECT * FROM ({self._base_sql}) AS eventos "
            "WHERE (CAST(:tipo AS varchar(40)) IS NULL OR eventos.tipo = :tipo)"
        )

    async def list_todos(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[dict[str, Any]]:
        """Todas las filas del rango, sin OFFSET.

        El sync recorre la historia en tramos anuales: con OFFSET profundo SQL Server
        vuelve a recorrer todo lo anterior en cada página, y el barrido completo se
        vuelve cuadrático.
        """
        sql = f"SELECT * FROM ({self._filtrado()}) AS sub"
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [self._normalizar(dict(row)) for row in result.mappings().all()]

    def _normalizar(self, row: dict[str, Any]) -> dict[str, Any]:
        no_empleado = row.get("no_empleado")
        try:
            no_empleado_int = int(no_empleado) if no_empleado is not None else None
        except (TypeError, ValueError):
            no_empleado_int = None
        obs = row.get("observaciones")
        return {
            "origen": str(row.get("origen") or "").strip(),
            "origen_id": row.get("origen_id"),
            "no_empleado": no_empleado_int,
            "tipo": str(row.get("tipo") or "").strip(),
            "fecha_evento": _as_date(row.get("fecha_evento")),
            "fecha_fin": _as_date(row.get("fecha_fin")),
            "observaciones": str(obs).strip() if obs and str(obs).strip() else None,
            "fecha_registro": _as_date(row.get("fecha_registro")),
        }
