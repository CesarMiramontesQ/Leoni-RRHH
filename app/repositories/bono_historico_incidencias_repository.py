"""
Repositorio unificado de incidencias históricas (calidad_historico + seguridad_historico).

La consulta base vive en ``sql/incidencias_historico_unificado_base.sql``.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)
from app.services.incidencia_fuentes.types import IncidenciaFuenteFilters

_SQL_BASE_FILE = (
    Path(__file__).resolve().parent / "sql" / "incidencias_historico_unificado_base.sql"
)
_SIN_AREA = "(sin área)"
_SIN_SUBAREA = "(sin subárea)"


def load_incidencias_historico_unificado_base_sql() -> str:
    return _SQL_BASE_FILE.read_text(encoding="utf-8")


def _tipos_incluidos(tipo: str | None) -> set[str] | None:
    """None = ambos tipos; set vacío = ningún resultado."""
    if not tipo or not tipo.strip():
        return None
    t = tipo.strip().lower()
    if t in ("calidad", TIPO_INCIDENCIA_CALIDAD.lower()):
        return {TIPO_INCIDENCIA_CALIDAD}
    if t in ("seguridad", TIPO_INCIDENCIA_SEGURIDAD.lower()):
        return {TIPO_INCIDENCIA_SEGURIDAD}
    return set()


class BonoHistoricoIncidenciasRepository:
    """Listados y agregados sobre fuentes históricas de bono con filtros compartidos."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._base_sql = load_incidencias_historico_unificado_base_sql()

    def _build_where(self, filters: IncidenciaFuenteFilters) -> tuple[str, dict[str, Any]]:
        tipos = _tipos_incluidos(filters.tipo)
        if tipos is not None and not tipos:
            return "WHERE 1=0", {}

        clauses: list[str] = []
        params: dict[str, Any] = {}

        if tipos is not None:
            clauses.append("tipo_incidencia = ANY(:f_tipos_incidencia)")
            params["f_tipos_incidencia"] = list(tipos)

        if filters.empleado_ids_scope is not None:
            if not filters.empleado_ids_scope:
                return "WHERE 1=0", {}
            clauses.append("empleado_id = ANY(:f_empleado_ids_scope)")
            params["f_empleado_ids_scope"] = filters.empleado_ids_scope

        if filters.empleado_id is not None:
            clauses.append("empleado_id = :f_empleado_id")
            params["f_empleado_id"] = filters.empleado_id

        if filters.no_empleado and filters.no_empleado.strip():
            clauses.append("no_empleado ILIKE :f_no_empleado")
            params["f_no_empleado"] = f"%{filters.no_empleado.strip()}%"

        if filters.nombre and filters.nombre.strip():
            clauses.append("nombre ILIKE :f_nombre")
            params["f_nombre"] = f"%{filters.nombre.strip()}%"

        if filters.fecha is not None:
            clauses.append("fecha = :f_fecha")
            params["f_fecha"] = filters.fecha

        if filters.categoria and filters.categoria.strip():
            clauses.append("categoria ILIKE :f_categoria")
            params["f_categoria"] = f"%{filters.categoria.strip()}%"

        if filters.area and filters.area.strip():
            clauses.append(
                "COALESCE(NULLIF(TRIM(area), ''), :f_sin_area) = :f_area"
            )
            params["f_sin_area"] = _SIN_AREA
            params["f_area"] = filters.area.strip()

        if filters.subarea and filters.subarea.strip():
            clauses.append(
                "COALESCE(NULLIF(TRIM(subarea), ''), :f_sin_subarea) = :f_subarea"
            )
            params["f_sin_subarea"] = _SIN_SUBAREA
            params["f_subarea"] = filters.subarea.strip()

        if filters.fecha_inicio is not None:
            clauses.append("fecha >= :f_fecha_inicio")
            params["f_fecha_inicio"] = filters.fecha_inicio

        if filters.fecha_fin is not None:
            clauses.append("fecha <= :f_fecha_fin")
            params["f_fecha_fin"] = filters.fecha_fin

        if not clauses:
            return "", params
        return "WHERE " + " AND ".join(clauses), params

    def _from_sql(self, where_sql: str) -> str:
        base = f"SELECT * FROM ({self._base_sql}) AS historico"
        if where_sql:
            return f"{base}\n{where_sql}"
        return base

    async def count(self, filters: IncidenciaFuenteFilters) -> int:
        where_sql, params = self._build_where(filters)
        sql = f"SELECT COUNT(*) AS cnt FROM ({self._from_sql(where_sql)}) AS sub"
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            row = result.mappings().first()
            return int(row["cnt"]) if row else 0

    async def count_por_tipo_incidencia(
        self, filters: IncidenciaFuenteFilters
    ) -> dict[str, int]:
        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT tipo_incidencia, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY tipo_incidencia"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out = {TIPO_INCIDENCIA_CALIDAD: 0, TIPO_INCIDENCIA_SEGURIDAD: 0}
            for row in result.mappings().all():
                t = str(row["tipo_incidencia"])
                out[t] = int(row["cnt"])
            return out

    async def list_offset(
        self,
        offset: int,
        limit: int,
        filters: IncidenciaFuenteFilters,
    ) -> list[dict[str, Any]]:
        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT * FROM ({self._from_sql(where_sql)}) AS sub "
            "ORDER BY fecha DESC NULLS LAST, origen ASC, origen_id DESC "
            "OFFSET :f_offset LIMIT :f_limit"
        )
        params = {**params, "f_offset": max(0, offset), "f_limit": limit}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [dict(row) for row in result.mappings().all()]

    async def distinct_areas(self, filters: IncidenciaFuenteFilters) -> list[str]:
        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT DISTINCT COALESCE(NULLIF(TRIM(area), ''), :f_sin_area) AS label "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "ORDER BY label ASC"
        )
        params = {**params, "f_sin_area": _SIN_AREA}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [str(r["label"]) for r in result.mappings().all()]

    async def distinct_subareas(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        area: str | None = None,
    ) -> list[str]:
        where_sql, params = self._build_where(filters)
        extra = ""
        if area and area.strip():
            extra = " AND COALESCE(NULLIF(TRIM(area), ''), :f_sin_area) = :f_area_filter"
            params = {**params, "f_sin_area": _SIN_AREA, "f_area_filter": area.strip()}
        sql = (
            f"SELECT DISTINCT COALESCE(NULLIF(TRIM(subarea), ''), :f_sin_subarea) AS label "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            f"WHERE 1=1{extra} "
            "ORDER BY label ASC"
        )
        params = {**params, "f_sin_subarea": _SIN_SUBAREA}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [str(r["label"]) for r in result.mappings().all()]

    async def aggregate_areas_top(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        limit: int = 10,
    ) -> list[tuple[str, int]]:
        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT COALESCE(NULLIF(TRIM(area), ''), :f_sin_area) AS label, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY label ORDER BY cnt DESC LIMIT :f_limit"
        )
        params = {**params, "f_sin_area": _SIN_AREA, "f_limit": limit}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [(str(r["label"]), int(r["cnt"])) for r in result.mappings().all()]

    async def aggregate_subareas_top_with_area(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        limit: int = 10,
    ) -> list[tuple[str, str, int]]:
        where_sql, params = self._build_where(filters)
        sql = (
            "SELECT "
            "COALESCE(NULLIF(TRIM(subarea), ''), :f_sin_subarea) AS sub, "
            "COALESCE(NULLIF(TRIM(area), ''), :f_sin_area) AS ar, "
            "COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY sub, ar ORDER BY cnt DESC"
        )
        params = {**params, "f_sin_subarea": _SIN_SUBAREA, "f_sin_area": _SIN_AREA}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            rows = [(str(r["sub"]), str(r["ar"]), int(r["cnt"])) for r in result.mappings().all()]
        by_sub: dict[str, dict[str, int]] = {}
        for sub, ar, c in rows:
            m = by_sub.setdefault(sub, {})
            m[ar] = m.get(ar, 0) + c
        ranked = sorted(by_sub.keys(), key=lambda s: -sum(by_sub[s].values()))[:limit]
        out: list[tuple[str, str, int]] = []
        for sub in ranked:
            areas_map = by_sub[sub]
            total = sum(areas_map.values())
            best_area = max(areas_map, key=lambda a: areas_map[a])
            out.append((sub, best_area, total))
        return out

    async def aggregate_empleados_top(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        limit: int = 10,
    ) -> list[tuple[int, str | None, str | None, int]]:
        where_sql, params = self._build_where(filters)
        sql = (
            "SELECT empleado_id, "
            "MAX(no_empleado) AS no_empleado, "
            "MAX(nombre) AS nombre, "
            "COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY empleado_id ORDER BY cnt DESC LIMIT :f_limit"
        )
        params = {**params, "f_limit": limit}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[int, str | None, str | None, int]] = []
            for r in result.mappings().all():
                no = r["no_empleado"]
                nom = r["nombre"]
                out.append(
                    (
                        int(r["empleado_id"]),
                        str(no).strip() if no is not None and str(no).strip() else None,
                        str(nom).strip() if nom is not None and str(nom).strip() else None,
                        int(r["cnt"]),
                    )
                )
            return out

    async def aggregate_tipos_con_totales(
        self, filters: IncidenciaFuenteFilters
    ) -> list[tuple[str, int]]:
        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT tipo_incidencia AS tipo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY tipo_incidencia ORDER BY cnt DESC"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [(str(r["tipo"]), int(r["cnt"])) for r in result.mappings().all()]

    async def aggregate_totales_por_mes(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        max_points: int = 18,
    ) -> list[tuple[str, int]]:
        hoy = date.today()
        periodo_max = f"{hoy.year:04d}-{hoy.month:02d}"
        where_sql, params = self._build_where(filters)
        sql = (
            "SELECT to_char(fecha, 'YYYY-MM') AS periodo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "WHERE fecha IS NOT NULL AND fecha <= :f_hoy "
            "GROUP BY periodo ORDER BY periodo ASC"
        )
        params = {**params, "f_hoy": hoy}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            rows: list[tuple[str, int]] = []
            for r in result.mappings().all():
                p = r["periodo"]
                if p is None:
                    continue
                ps = str(p).strip()
                if len(ps) != 7 or ps[4] != "-" or ps > periodo_max:
                    continue
                rows.append((ps, int(r["cnt"])))
        if len(rows) > max_points:
            rows = rows[-max_points:]
        return rows

    async def aggregate_totales_por_mes_y_tipo(
        self,
        filters: IncidenciaFuenteFilters,
    ) -> list[tuple[str, str, int]]:
        hoy = date.today()
        periodo_max = f"{hoy.year:04d}-{hoy.month:02d}"
        where_sql, params = self._build_where(filters)
        sql = (
            "SELECT to_char(fecha, 'YYYY-MM') AS periodo, "
            "tipo_incidencia AS tipo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "WHERE fecha IS NOT NULL AND fecha <= :f_hoy "
            "GROUP BY periodo, tipo_incidencia ORDER BY periodo ASC"
        )
        params = {**params, "f_hoy": hoy}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[str, str, int]] = []
            for r in result.mappings().all():
                p = r["periodo"]
                if p is None:
                    continue
                ps = str(p).strip()
                if len(ps) != 7 or ps[4] != "-" or ps > periodo_max:
                    continue
                out.append((ps, str(r["tipo"]), int(r["cnt"])))
            return out

    async def aggregate_totales_por_periodo_y_tipo(
        self,
        filters: IncidenciaFuenteFilters,
        *,
        agrupacion: str,
    ) -> list[tuple[str, str, int]]:
        if agrupacion == "dia":
            period_expr = "to_char(fecha, 'YYYY-MM-DD')"
        elif agrupacion == "semana":
            period_expr = "to_char(CAST(date_trunc('week', fecha) AS date), 'YYYY-MM-DD')"
        else:
            period_expr = "to_char(fecha, 'YYYY-MM')"

        where_sql, params = self._build_where(filters)
        sql = (
            f"SELECT {period_expr} AS periodo, "
            "tipo_incidencia AS tipo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "WHERE fecha IS NOT NULL "
            "GROUP BY periodo, tipo_incidencia ORDER BY periodo ASC"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[str, str, int]] = []
            for r in result.mappings().all():
                p = r["periodo"]
                if p is None:
                    continue
                ps = str(p).strip()
                if not ps:
                    continue
                out.append((ps, str(r["tipo"]), int(r["cnt"])))
            return out
