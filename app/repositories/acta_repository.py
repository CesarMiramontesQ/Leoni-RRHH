# app/repositories/acta_repository.py
"""
Repositorio de Actas Administrativas y sus Aprobaciones.
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class ActaRepository(BaseRepository[ActaAdministrativa]):
    def __init__(self, db: AsyncSession):
        super().__init__(ActaAdministrativa, db)

    async def get_with_aprobaciones(self, id: int) -> ActaAdministrativa | None:
        result = await self.db.execute(
            select(ActaAdministrativa)
            .options(
                selectinload(ActaAdministrativa.aprobaciones),
                selectinload(ActaAdministrativa.empleado).selectinload(Empleado.puesto),
                selectinload(ActaAdministrativa.generador),
                selectinload(ActaAdministrativa.incidencia),
            )
            .where(ActaAdministrativa.id == id)
        )
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[ActaAdministrativa], int | None]:
        filters = [ActaAdministrativa.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def list_by_empleado_page(
        self,
        empleado_id: int,
        page: int,
        page_size: int,
    ) -> tuple[list[ActaAdministrativa], int]:
        """Listado offset por empleado (Vista 360), ordenado por id descendente."""
        total = await self.count(filters=[ActaAdministrativa.empleado_id == empleado_id])
        offset = max(0, (page - 1) * page_size)
        result = await self.db.execute(
            select(ActaAdministrativa)
            .options(
                selectinload(ActaAdministrativa.empleado).selectinload(Empleado.puesto),
            )
            .where(ActaAdministrativa.empleado_id == empleado_id)
            .order_by(ActaAdministrativa.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def count_por_empleado_por_estado(
        self,
        empleado_ids: list[int] | None,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> dict[int, dict[str, int]]:
        """Conteo de actas por empleado y estado (usado por el índice de Historial Objetivo).

        Devuelve ``{empleado_id: {estado: conteo}}``. Un empleado sin actas en el
        rango/filtro simplemente no aparece como llave del dict (el llamador debe
        usar ``.get(empleado_id, {})``).

        El rango de fechas se evalúa sobre ``COALESCE(fecha_evento, created_at)``:
        ``fecha_evento`` es nullable (el acta puede no registrar la fecha del
        evento), así que se usa la fecha de creación del registro como respaldo
        para no perder actas del rango. ``created_at`` es DateTime y se reduce a
        su fecha (``func.date``, función de conversión portable entre PostgreSQL
        y SQLite) para comparar consistentemente contra ``fecha_evento``; nótese
        que ``CAST(created_at AS DATE)`` no es portable: en SQLite el CAST a un
        tipo no reconocido aplica afinidad NUMERIC en vez de truncar la fecha.
        """
        fecha_ref = func.coalesce(
            ActaAdministrativa.fecha_evento,
            func.date(ActaAdministrativa.created_at),
        )

        filters = []
        if empleado_ids is not None:
            filters.append(ActaAdministrativa.empleado_id.in_(empleado_ids))
        if fecha_inicio is not None:
            filters.append(fecha_ref >= fecha_inicio)
        if fecha_fin is not None:
            filters.append(fecha_ref <= fecha_fin)

        stmt = select(
            ActaAdministrativa.empleado_id,
            ActaAdministrativa.estado,
            func.count().label("cnt"),
        ).select_from(ActaAdministrativa)
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.group_by(ActaAdministrativa.empleado_id, ActaAdministrativa.estado)

        result = await self.db.execute(stmt)
        counts: dict[int, dict[str, int]] = {}
        for empleado_id, estado, cnt in result.all():
            counts.setdefault(empleado_id, {})[estado] = int(cnt)
        return counts

    async def get_aprobacion_by_firmante(
        self,
        acta_id: int,
        firmante_id: int,
    ) -> ActaAprobacion | None:
        result = await self.db.execute(
            select(ActaAprobacion)
            .where(
                ActaAprobacion.acta_id == acta_id,
                ActaAprobacion.firmante_id == firmante_id,
            )
        )
        return result.scalar_one_or_none()


class ActaAprobacionRepository(BaseRepository[ActaAprobacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(ActaAprobacion, db)

    async def list_by_acta(self, acta_id: int) -> list[ActaAprobacion]:
        result = await self.db.execute(
            select(ActaAprobacion)
            .where(ActaAprobacion.acta_id == acta_id)
            .order_by(ActaAprobacion.id)
        )
        return list(result.scalars().all())

    async def count_firmadas(self, acta_id: int) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.count())
            .select_from(ActaAprobacion)
            .where(
                ActaAprobacion.acta_id == acta_id,
                ActaAprobacion.firma_timestamp.isnot(None),
            )
        )
        return result.scalar_one()
