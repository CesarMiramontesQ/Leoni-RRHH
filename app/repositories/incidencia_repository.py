# app/repositories/incidencia_repository.py
"""
Repositorio de Incidencias y Evidencias.
"""

from datetime import date

from sqlalchemy import and_, func, or_, select
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
        conds.append(Incidencia.area.ilike(f"%{area.strip()}%"))
    if subarea and subarea.strip():
        conds.append(Incidencia.subarea.ilike(f"%{subarea.strip()}%"))
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
