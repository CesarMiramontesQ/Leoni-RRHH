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
        empleado_ids_scope: list[int] | None = None,
    ) -> int:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
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
        empleado_ids_scope: list[int] | None = None,
    ) -> list[dict[str, Any]]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
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
        empleado_ids_scope: list[int] | None = None,
    ) -> dict[str, int]:
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
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
