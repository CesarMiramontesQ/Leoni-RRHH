# app/repositories/incidencia_repository.py
"""
Repositorio de Incidencias y Evidencias.
"""

from datetime import date
from typing import Any

from sqlalchemy import String, and_, cast, func, literal, or_, select
from sqlalchemy.types import Date
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incidencias import Evidencia, Incidencia
from app.repositories.base import BaseRepository

# Tipos internos que no deben aparecer en listados ni en el selector de filtros (vista RH).
TIPOS_INCIDENCIA_EXCLUIDOS_DE_LISTADOS = frozenset({"progresivo", "progresivo_historico"})


def filtro_tipos_visibles_en_listados() -> object:
    """Condición AND para excluir tipos internos de tablas y agregados de listado."""
    return Incidencia.tipo.notin_(tuple(TIPOS_INCIDENCIA_EXCLUIDOS_DE_LISTADOS))


def build_incidencia_query_filters(
    *,
    tipo: str | None = None,
    empleado_id: int | None = None,
    no_empleado: str | None = None,
    nombre: str | None = None,
    fecha: date | None = None,
    semana_id: int | None = None,
    numero_semana: int | None = None,
    categoria: str | None = None,
    estatus_id: int | None = None,
    area: str | None = None,
    subarea: str | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
) -> list:
    """Condiciones AND opcionales para listados y agregados (no incluye alcance por rol)."""
    conds: list = []
    if tipo and tipo.strip():
        conds.append(Incidencia.tipo == tipo.strip())
    if empleado_id is not None:
        conds.append(Incidencia.empleado_id == empleado_id)
    if no_empleado and no_empleado.strip():
        conds.append(Incidencia.no_empleado.ilike(f"%{no_empleado.strip()}%"))
    if nombre and nombre.strip():
        conds.append(Incidencia.nombre.ilike(f"%{nombre.strip()}%"))
    if fecha is not None:
        conds.append(Incidencia.fecha == fecha)
    if semana_id is not None:
        conds.append(Incidencia.semana_id == semana_id)
    if numero_semana is not None:
        conds.append(Incidencia.numero_semana == numero_semana)
    if categoria and categoria.strip():
        conds.append(Incidencia.categoria.ilike(f"%{categoria.strip()}%"))
    if estatus_id is not None:
        conds.append(Incidencia.estatus_id == estatus_id)
    if area and area.strip():
        sin_ar = literal("(sin área)", type_=String)
        area_key = func.coalesce(func.nullif(func.trim(Incidencia.area), ""), sin_ar)
        conds.append(area_key == area.strip())
    if subarea and subarea.strip():
        sin_sub = literal("(sin subárea)", type_=String)
        sub_key = func.coalesce(func.nullif(func.trim(Incidencia.subarea), ""), sin_sub)
        conds.append(sub_key == subarea.strip())
    if fecha_inicio is not None:
        conds.append(
            and_(Incidencia.fecha.isnot(None), Incidencia.fecha >= fecha_inicio)
        )
    if fecha_fin is not None:
        conds.append(
            and_(Incidencia.fecha.isnot(None), Incidencia.fecha <= fecha_fin)
        )
    return conds


class IncidenciaRepository(BaseRepository[Incidencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(Incidencia, db)

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Incidencia], int | None]:
        filters = [Incidencia.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def get_with_evidencias(self, id: int) -> Incidencia | None:
        result = await self.db.execute(
            select(Incidencia)
            .options(
                selectinload(Incidencia.empleado),
            )
            .where(Incidencia.id == id)
        )
        return result.scalar_one_or_none()

    async def distinct_tipos(self, filters: list | None = None) -> list[str]:
        stmt = select(Incidencia.tipo).distinct().order_by(Incidencia.tipo.asc())
        if filters:
            for condition in filters:
                stmt = stmt.where(condition)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def distinct_areas(self, filters: list | None = None) -> list[str]:
        sin = literal("(sin área)", type_=String)
        area_key = func.coalesce(func.nullif(func.trim(Incidencia.area), ""), sin)
        stmt = select(area_key).select_from(Incidencia).distinct().order_by(area_key.asc())
        if filters:
            for condition in filters:
                stmt = stmt.where(condition)
        result = await self.db.execute(stmt)
        return [str(r[0]) for r in result.all()]

    async def distinct_subareas(
        self,
        filters: list | None = None,
        *,
        area: str | None = None,
    ) -> list[str]:
        sin_sub = literal("(sin subárea)", type_=String)
        sub_key = func.coalesce(func.nullif(func.trim(Incidencia.subarea), ""), sin_sub)
        stmt = select(sub_key).select_from(Incidencia).distinct().order_by(sub_key.asc())
        if filters:
            for condition in filters:
                stmt = stmt.where(condition)
        if area and area.strip():
            sin_ar = literal("(sin área)", type_=String)
            area_key = func.coalesce(func.nullif(func.trim(Incidencia.area), ""), sin_ar)
            stmt = stmt.where(area_key == area.strip())
        result = await self.db.execute(stmt)
        return [str(r[0]) for r in result.all()]

    async def list_offset(
        self,
        offset: int,
        limit: int,
        filters: list | None = None,
    ) -> list[Incidencia]:
        query = select(Incidencia)
        if filters:
            for condition in filters:
                query = query.where(condition)
        query = (
            query.order_by(Incidencia.id.desc())
            .offset(max(0, offset))
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def aggregate_kpis(self, filters: list | None = None) -> tuple[int, int, int, int]:
        """
        Totales para tarjetas resumen (misma semántica aproximada que la UI previa).
        abiertas: sin estatus o estatus 1
        en_investigacion: estatus 2
        resueltas: cualquier otro estatus definido
        criticas: descuento >= 25 %
        """
        stmt = (
            select(
                func.count()
                .filter(or_(Incidencia.estatus_id.is_(None), Incidencia.estatus_id == 1))
                .label("abiertas"),
                func.count()
                .filter(Incidencia.estatus_id == 2)
                .label("en_investigacion"),
                func.count()
                .filter(
                    and_(
                        Incidencia.estatus_id.isnot(None),
                        Incidencia.estatus_id != 1,
                        Incidencia.estatus_id != 2,
                    )
                )
                .label("resueltas"),
                func.count()
                .filter(Incidencia.descuento_porcentaje >= 25)
                .label("criticas"),
            )
            .select_from(Incidencia)
        )
        if filters:
            for condition in filters:
                stmt = stmt.where(condition)
        result = await self.db.execute(stmt)
        row = result.one()
        return int(row.abiertas), int(row.en_investigacion), int(row.resueltas), int(row.criticas)

    def _apply_filters(self, stmt: Any, filters: list | None) -> Any:
        if filters:
            for condition in filters:
                stmt = stmt.where(condition)
        return stmt

    async def aggregate_areas_top(
        self, filters: list | None, *, limit: int = 10
    ) -> list[tuple[str, int]]:
        sin = literal("(sin área)", type_=String)
        area_key = func.coalesce(func.nullif(func.trim(Incidencia.area), ""), sin)
        stmt = (
            select(area_key.label("label"), func.count().label("cnt"))
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(area_key).order_by(func.count().desc()).limit(limit)
        result = await self.db.execute(stmt)
        return [(str(r.label), int(r.cnt)) for r in result.all()]

    async def aggregate_subareas_top(
        self, filters: list | None, *, limit: int = 10
    ) -> list[tuple[str, int]]:
        sin = literal("(sin subárea)", type_=String)
        sub_key = func.coalesce(func.nullif(func.trim(Incidencia.subarea), ""), sin)
        stmt = (
            select(sub_key.label("label"), func.count().label("cnt"))
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(sub_key).order_by(func.count().desc()).limit(limit)
        result = await self.db.execute(stmt)
        return [(str(r.label), int(r.cnt)) for r in result.all()]

    async def aggregate_subareas_top_with_area(
        self, filters: list | None, *, limit: int = 10
    ) -> list[tuple[str, str, int]]:
        """
        Top subáreas por volumen; `area` es la más frecuente junto a esa subárea en el filtro.
        """
        sin_sub = literal("(sin subárea)", type_=String)
        sin_ar = literal("(sin área)", type_=String)
        sub_key = func.coalesce(func.nullif(func.trim(Incidencia.subarea), ""), sin_sub)
        area_key = func.coalesce(func.nullif(func.trim(Incidencia.area), ""), sin_ar)
        stmt = (
            select(sub_key.label("sub"), area_key.label("ar"), func.count().label("cnt"))
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(sub_key, area_key).order_by(func.count().desc())
        result = await self.db.execute(stmt)
        rows = [(str(r.sub), str(r.ar), int(r.cnt)) for r in result.all()]
        by_sub: dict[str, dict[str, int]] = {}
        for sub, ar, c in rows:
            m = by_sub.setdefault(sub, {})
            m[ar] = m.get(ar, 0) + c
        ranked_subs = sorted(by_sub.keys(), key=lambda s: -sum(by_sub[s].values()))[:limit]
        out: list[tuple[str, str, int]] = []
        for sub in ranked_subs:
            areas_map = by_sub[sub]
            total = sum(areas_map.values())
            best_area = max(areas_map, key=lambda a: areas_map[a])
            out.append((sub, best_area, total))
        return out

    async def aggregate_total_y_seguridad_calidad(
        self, filters: list | None,
    ) -> tuple[int, int, int]:
        seg = or_(
            func.lower(func.coalesce(Incidencia.categoria, "")).like("%seguridad%"),
            func.lower(Incidencia.tipo).like("%seguridad%"),
        )
        cal = or_(
            func.lower(func.coalesce(Incidencia.categoria, "")).like("%calidad%"),
            func.lower(Incidencia.tipo).like("%calidad%"),
        )
        stmt = (
            select(
                func.count().label("total"),
                func.count().filter(seg).label("nseg"),
                func.count().filter(cal).label("ncal"),
            )
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        result = await self.db.execute(stmt)
        row = result.one()
        return int(row.total), int(row.nseg), int(row.ncal)

    async def aggregate_empleados_top(
        self, filters: list | None, *, limit: int = 10
    ) -> list[tuple[int, str | None, str | None, int]]:
        stmt = (
            select(
                Incidencia.empleado_id.label("eid"),
                func.max(Incidencia.no_empleado).label("no_empleado"),
                func.max(Incidencia.nombre).label("nombre"),
                func.count().label("cnt"),
            )
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = (
            stmt.group_by(Incidencia.empleado_id)
            .order_by(func.count().desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        out: list[tuple[int, str | None, str | None, int]] = []
        for r in result.all():
            no = r.no_empleado
            nom = r.nombre
            out.append(
                (
                    int(r.eid),
                    str(no).strip() if no is not None and str(no).strip() else None,
                    str(nom).strip() if nom is not None and str(nom).strip() else None,
                    int(r.cnt),
                )
            )
        return out

    async def aggregate_tipos_con_totales(
        self, filters: list | None
    ) -> list[tuple[str, int]]:
        stmt = (
            select(Incidencia.tipo.label("tipo"), func.count().label("cnt"))
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(Incidencia.tipo).order_by(func.count().desc())
        result = await self.db.execute(stmt)
        return [(str(r.tipo), int(r.cnt)) for r in result.all()]

    async def count_incidencias(self, filters: list | None) -> int:
        stmt = select(func.count()).select_from(Incidencia)
        stmt = self._apply_filters(stmt, filters)
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def aggregate_totales_por_mes(
        self,
        filters: list | None,
        *,
        max_points: int = 18,
    ) -> list[tuple[str, int]]:
        """
        Serie temporal por mes natural (YYYY-MM).
        Usa `fecha` de negocio si existe; si no, la parte fecha de `created_at`.
        Compatible con PostgreSQL (producción) y SQLite (tests).
        """
        date_col = func.coalesce(Incidencia.fecha, cast(Incidencia.created_at, Date))
        bind = self.db.get_bind()
        dialect_name = bind.dialect.name if bind is not None else "sqlite"
        if dialect_name == "postgresql":
            period_key = func.to_char(date_col, "YYYY-MM")
        else:
            period_key = func.strftime("%Y-%m", date_col)
        stmt = (
            select(period_key.label("periodo"), func.count().label("cnt"))
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(period_key).order_by(period_key.asc())
        result = await self.db.execute(stmt)
        rows: list[tuple[str, int]] = []
        for r in result.all():
            p = r.periodo
            if p is None:
                continue
            ps = str(p).strip()
            if len(ps) != 7 or ps[4] != "-":
                continue
            rows.append((ps, int(r.cnt)))
        if len(rows) > max_points:
            rows = rows[-max_points:]
        return rows

    def _incidencia_date_col(self):
        return func.coalesce(Incidencia.fecha, cast(Incidencia.created_at, Date))

    def _period_key_expr(self, date_col, *, agrupacion: str):
        bind = self.db.get_bind()
        dialect_name = bind.dialect.name if bind is not None else "sqlite"
        if agrupacion == "dia":
            if dialect_name == "postgresql":
                return func.to_char(date_col, "YYYY-MM-DD")
            return func.strftime("%Y-%m-%d", date_col)
        if agrupacion == "semana":
            if dialect_name == "postgresql":
                monday = cast(func.date_trunc("week", date_col), Date)
                return func.to_char(monday, "YYYY-MM-DD")
            return func.strftime("%Y-%m-%d", func.date(date_col, "weekday 1", "-6 days"))
        if dialect_name == "postgresql":
            return func.to_char(date_col, "YYYY-MM")
        return func.strftime("%Y-%m", date_col)

    async def aggregate_totales_por_periodo_y_tipo(
        self,
        filters: list | None,
        *,
        agrupacion: str,
    ) -> list[tuple[str, str, int]]:
        """
        Conteo por periodo y tipo. `agrupacion`: dia (YYYY-MM-DD), semana (lunes YYYY-MM-DD), mes (YYYY-MM).
        """
        date_col = self._incidencia_date_col()
        period_key = self._period_key_expr(date_col, agrupacion=agrupacion)
        stmt = (
            select(
                period_key.label("periodo"),
                Incidencia.tipo.label("tipo"),
                func.count().label("cnt"),
            )
            .select_from(Incidencia)
        )
        stmt = self._apply_filters(stmt, filters)
        stmt = stmt.group_by(period_key, Incidencia.tipo).order_by(
            period_key.asc(), Incidencia.tipo.asc()
        )
        result = await self.db.execute(stmt)
        out: list[tuple[str, str, int]] = []
        for r in result.all():
            p = r.periodo
            t = r.tipo
            if p is None or t is None:
                continue
            ps = str(p).strip()
            ts = str(t).strip()
            if not ps or not ts:
                continue
            out.append((ps, ts, int(r.cnt)))
        return out

    async def aggregate_totales_por_mes_y_tipo(
        self,
        filters: list | None,
    ) -> list[tuple[str, str, int]]:
        return await self.aggregate_totales_por_periodo_y_tipo(filters, agrupacion="mes")

    async def count_evidencias(self, incidencia_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Evidencia)
            .where(
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
        )
        return result.scalar_one()


class EvidenciaRepository(BaseRepository[Evidencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(Evidencia, db)

    async def list_by_incidencia(self, incidencia_id: int) -> list[Evidencia]:
        result = await self.db.execute(
            select(Evidencia)
            .where(
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
            .order_by(Evidencia.id)
        )
        return list(result.scalars().all())

    async def get_by_id_and_incidencia(
        self, evidencia_id: int, incidencia_id: int
    ) -> Evidencia | None:
        result = await self.db.execute(
            select(Evidencia)
            .where(
                Evidencia.id == evidencia_id,
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()
