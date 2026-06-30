"""Repositorio de lectura de faltas y retardos en bono_productividad."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "faltas_retardos_bono_unificado.sql"


def load_faltas_retardos_bono_unificado_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class BonoFaltasRetardosRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._base_sql = load_faltas_retardos_bono_unificado_sql()

    def _build_where(
        self,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> tuple[str, dict[str, Any]]:
        clauses: list[str] = []
        params: dict[str, Any] = {}

        if empleado_ids_scope is not None:
            if not empleado_ids_scope:
                return "WHERE 1=0", {}
            clauses.append("empleado_id = ANY(:f_empleado_ids_scope)")
            params["f_empleado_ids_scope"] = empleado_ids_scope

        if empleado_id is not None:
            clauses.append("empleado_id = :f_empleado_id")
            params["f_empleado_id"] = empleado_id

        if tipo and tipo.strip():
            clauses.append("tipo_codigo = ANY(:f_tipo_codigos)")
            from app.services.faltas_retardos.constants import CODIGO_PONDERACION_A_TIPO

            codigos = [
                codigo
                for codigo, api_tipo in CODIGO_PONDERACION_A_TIPO.items()
                if api_tipo == tipo.strip()
            ]
            if not codigos:
                return "WHERE 1=0", {}
            params["f_tipo_codigos"] = codigos

        if fecha_inicio is not None:
            clauses.append(
                "(fecha_evento IS NULL OR fecha_evento >= :f_fecha_inicio)"
            )
            params["f_fecha_inicio"] = fecha_inicio

        if fecha_fin is not None:
            clauses.append(
                "(fecha_evento IS NULL OR fecha_evento <= :f_fecha_fin)"
            )
            params["f_fecha_fin"] = fecha_fin

        if busqueda and busqueda.strip():
            term = f"%{busqueda.strip()}%"
            clauses.append(
                "(nombre ILIKE :f_busqueda OR CAST(no_empleado AS text) ILIKE :f_busqueda)"
            )
            params["f_busqueda"] = term

        if area and area.strip():
            clauses.append("area = :f_area")
            params["f_area"] = area.strip()

        if not clauses:
            return "", params
        return "WHERE " + " AND ".join(clauses), params

    def _from_sql(self, where_sql: str) -> str:
        base = f"SELECT * FROM ({self._base_sql}) AS eventos"
        if where_sql:
            return f"{base}\n{where_sql}"
        return base

    async def count(
        self,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> int:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = f"SELECT COUNT(*) AS cnt FROM ({self._from_sql(where_sql)}) AS sub"
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            row = result.mappings().first()
            return int(row["cnt"]) if row else 0

    async def list_offset(
        self,
        offset: int,
        limit: int,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> list[dict[str, Any]]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = (
            f"SELECT * FROM ({self._from_sql(where_sql)}) AS sub "
            "ORDER BY fecha_evento DESC NULLS LAST, origen ASC, origen_id DESC "
            "OFFSET :f_offset LIMIT :f_limit"
        )
        params = {**params, "f_offset": max(0, offset), "f_limit": limit}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [dict(row) for row in result.mappings().all()]

    async def aggregate_por_tipo_codigo(
        self,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> dict[str, int]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = (
            "SELECT tipo_codigo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "GROUP BY tipo_codigo"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: dict[str, int] = {}
            for row in result.mappings().all():
                codigo = str(row["tipo_codigo"] or "").strip().upper()
                if codigo:
                    out[codigo] = int(row["cnt"])
            return out

    async def aggregate_por_mes(
        self,
        *,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> list[tuple[str, int]]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = (
            "SELECT to_char(fecha_evento, 'YYYY-MM') AS periodo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "WHERE fecha_evento IS NOT NULL "
            "GROUP BY periodo ORDER BY periodo ASC"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[str, int]] = []
            for row in result.mappings().all():
                periodo = row["periodo"]
                if periodo is None:
                    continue
                ps = str(periodo).strip()
                if len(ps) == 7 and ps[4] == "-":
                    out.append((ps, int(row["cnt"])))
            return out

    async def aggregate_por_periodo_y_tipo(
        self,
        *,
        agrupacion: str,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> list[tuple[str, str, int]]:
        if agrupacion == "dia":
            period_expr = "to_char(fecha_evento, 'YYYY-MM-DD')"
        elif agrupacion == "semana":
            period_expr = (
                "to_char(CAST(date_trunc('week', fecha_evento) AS date), 'YYYY-MM-DD')"
            )
        else:
            period_expr = "to_char(fecha_evento, 'YYYY-MM')"

        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = (
            f"SELECT {period_expr} AS periodo, tipo_codigo, COUNT(*) AS cnt "
            f"FROM ({self._from_sql(where_sql)}) AS sub "
            "WHERE fecha_evento IS NOT NULL "
            "GROUP BY periodo, tipo_codigo ORDER BY periodo ASC"
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            out: list[tuple[str, str, int]] = []
            for row in result.mappings().all():
                periodo = row["periodo"]
                codigo = row["tipo_codigo"]
                if periodo is None or codigo is None:
                    continue
                ps = str(periodo).strip()
                code = str(codigo).strip().upper()
                if not ps or not code:
                    continue
                out.append((ps, code, int(row["cnt"])))
            return out

    async def aggregate_empleados_top_por_tipo(
        self,
        *,
        limit: int = 10,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> list[tuple[int, str | None, str | None, int, dict[str, int]]]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            area=area,
            empleado_ids_scope=empleado_ids_scope,
        )
        sql = (
            "WITH base AS ("
            f"  SELECT empleado_id, no_empleado, nombre, tipo_codigo "
            f"  FROM ({self._from_sql(where_sql)}) AS sub"
            "), totals AS ("
            "  SELECT empleado_id, "
            "  MAX(no_empleado) AS no_empleado, "
            "  MAX(nombre) AS nombre, "
            "  COUNT(*) AS cnt "
            "  FROM base GROUP BY empleado_id "
            "  ORDER BY cnt DESC LIMIT :f_limit"
            "), by_tipo AS ("
            "  SELECT b.empleado_id, b.tipo_codigo, COUNT(*) AS tipo_cnt "
            "  FROM base b "
            "  INNER JOIN totals t ON t.empleado_id = b.empleado_id "
            "  GROUP BY b.empleado_id, b.tipo_codigo"
            ") "
            "SELECT t.empleado_id, t.no_empleado, t.nombre, t.cnt, "
            "bt.tipo_codigo, bt.tipo_cnt "
            "FROM totals t "
            "LEFT JOIN by_tipo bt ON bt.empleado_id = t.empleado_id "
            "ORDER BY t.cnt DESC, t.empleado_id"
        )
        params = {**params, "f_limit": limit}
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            grouped: dict[int, tuple[str | None, str | None, int, dict[str, int]]] = {}
            order: list[int] = []
            for row in result.mappings().all():
                emp_id = int(row["empleado_id"])
                if emp_id not in grouped:
                    no = row["no_empleado"]
                    nom = row["nombre"]
                    grouped[emp_id] = (
                        str(no).strip() if no is not None and str(no).strip() else None,
                        str(nom).strip() if nom is not None and str(nom).strip() else None,
                        int(row["cnt"]),
                        {},
                    )
                    order.append(emp_id)
                codigo = row["tipo_codigo"]
                tipo_cnt = row["tipo_cnt"]
                if codigo is not None and tipo_cnt is not None:
                    code = str(codigo).strip().upper()
                    if code:
                        _, _, _, por_codigo = grouped[emp_id]
                        por_codigo[code] = por_codigo.get(code, 0) + int(tipo_cnt)
            return [
                (emp_id, grouped[emp_id][0], grouped[emp_id][1], grouped[emp_id][2], grouped[emp_id][3])
                for emp_id in order
            ]
