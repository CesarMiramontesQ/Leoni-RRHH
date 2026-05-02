# app/repositories/acta_repository.py
"""
Repositorio de Actas Administrativas y sus Aprobaciones.
"""

from sqlalchemy import select
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
