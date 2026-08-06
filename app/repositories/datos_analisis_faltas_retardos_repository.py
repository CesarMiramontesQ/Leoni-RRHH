"""
Repositorio de solo lectura sobre SQL Server datos-analisis.

Lee las incidencias que alimentan la página "Incidencias" (módulo
``faltas-retardos``) desde ``dbo.AUSENCIA`` y ``dbo.PERMISO``. La consulta vive
en ``sql/datos_analisis_faltas_retardos_base.sql`` y ya emite los tipos de la
API (``falta_injustificada``, ``retardo``, …), no los códigos de TRESS.

El filtro por empleado viaja como un único bind con los ``CB_CODIGO`` separados
por coma (``STRING_SPLIT`` del lado del servidor): pasar una lista expandida
reventaría el tope de ~2100 parámetros de SQL Server.
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

_AGRUPACION_PERIODO_SQL: dict[str, str] = {
    "dia": "CONVERT(char(10), fecha_evento, 126)",
    "mes": "CONVERT(char(7), fecha_evento, 126)",
    # Lunes de la semana, independiente de la configuración de DATEFIRST.
    "semana": (
        "CONVERT(char(10), DATEADD(day, "
        "-((DATEPART(weekday, fecha_evento) + @@DATEFIRST - 2) % 7), fecha_evento), 126)"
    ),
}


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

    async def count(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> int:
        sql = f"SELECT COUNT_BIG(*) AS cnt FROM ({self._filtrado()}) AS sub"
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            row = result.mappings().first()
            return int(row["cnt"]) if row else 0

    async def list_offset(
        self,
        offset: int,
        limit: int,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[dict[str, Any]]:
        # SQL Server exige ORDER BY para OFFSET/FETCH; la terna es determinista.
        sql = (
            f"SELECT * FROM ({self._filtrado()}) AS sub "
            "ORDER BY sub.fecha_evento DESC, sub.origen ASC, sub.origen_id DESC "
            "OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY"
        )
        params = {
            **self._params(
                fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
            ),
            "offset": max(0, int(offset)),
            "limit": max(0, int(limit)),
        }
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

    async def list_claves_permisos_goce(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
    ) -> set[tuple[int, date, str]]:
        """Claves (no_empleado, fecha_inicio, tipo) de los permisos con goce de TRESS.

        Se usa para saber qué eventos con goce de la tabla local ya vienen de TRESS
        y no deben contarse dos veces.
        """
        sql = (
            "SELECT sub.no_empleado, sub.fecha_evento, sub.tipo "
            f"FROM ({self._base_sql}) AS sub "
            "WHERE sub.origen = 'permiso'"
        )
        params = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "cb_codigos_csv": cb_codigos_a_csv(cb_codigos),
        }
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            claves: set[tuple[int, date, str]] = set()
            for row in result.mappings().all():
                no_empleado = row.get("no_empleado")
                fecha = _as_date(row.get("fecha_evento"))
                tipo = str(row.get("tipo") or "").strip()
                if no_empleado is None or fecha is None or not tipo:
                    continue
                claves.add((int(no_empleado), fecha, tipo))
            return claves

    async def aggregate_por_tipo(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> dict[str, int]:
        sql = (
            "SELECT sub.tipo, COUNT_BIG(*) AS cnt "
            f"FROM ({self._filtrado()}) AS sub "
            "GROUP BY sub.tipo"
        )
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: dict[str, int] = {}
            for row in result.mappings().all():
                clave = str(row["tipo"] or "").strip()
                if clave:
                    out[clave] = out.get(clave, 0) + int(row["cnt"])
            return out

    async def aggregate_por_periodo_y_tipo(
        self,
        *,
        agrupacion: str,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, str, int]]:
        period_expr = _AGRUPACION_PERIODO_SQL.get(agrupacion, _AGRUPACION_PERIODO_SQL["mes"])
        sql = (
            f"SELECT {period_expr.replace('fecha_evento', 'sub.fecha_evento')} AS periodo, "
            "sub.tipo, COUNT_BIG(*) AS cnt "
            f"FROM ({self._filtrado()}) AS sub "
            "WHERE sub.fecha_evento IS NOT NULL "
            "GROUP BY "
            f"{period_expr.replace('fecha_evento', 'sub.fecha_evento')}, sub.tipo "
            "ORDER BY periodo ASC"
        )
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[str, str, int]] = []
            for row in result.mappings().all():
                periodo = str(row["periodo"] or "").strip()
                clave = str(row["tipo"] or "").strip()
                if periodo and clave:
                    out.append((periodo, clave, int(row["cnt"])))
            return out

    async def aggregate_por_mes(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, int]]:
        rows = await self.aggregate_por_periodo_y_tipo(
            agrupacion="mes",
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            cb_codigos=cb_codigos,
            tipo=tipo,
        )
        merged: dict[str, int] = {}
        for periodo, _clave, count in rows:
            merged[periodo] = merged.get(periodo, 0) + count
        return sorted(merged.items())

    async def aggregate_empleados_top(
        self,
        *,
        limit: int = 10,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[int, int, dict[str, int]]]:
        """(no_empleado, total, {tipo: total}) de los empleados con más eventos."""
        sql = (
            "SELECT sub.no_empleado, sub.tipo, COUNT_BIG(*) AS cnt "
            f"FROM ({self._filtrado()}) AS sub "
            "WHERE sub.no_empleado IS NOT NULL "
            "GROUP BY sub.no_empleado, sub.tipo"
        )
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            por_empleado: dict[int, dict[str, int]] = {}
            for row in result.mappings().all():
                no_empleado = row["no_empleado"]
                clave = str(row["tipo"] or "").strip()
                if no_empleado is None or not clave:
                    continue
                destino = por_empleado.setdefault(int(no_empleado), {})
                destino[clave] = destino.get(clave, 0) + int(row["cnt"])

        totales = [
            (no_empleado, sum(por_tipo.values()), por_tipo)
            for no_empleado, por_tipo in por_empleado.items()
        ]
        totales.sort(key=lambda item: (-item[1], item[0]))
        return totales[: max(0, int(limit))]
