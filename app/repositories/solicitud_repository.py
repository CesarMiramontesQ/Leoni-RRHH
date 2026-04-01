# app/repositories/solicitud_repository.py
"""
Repositorios para el dominio solicitudes.
Solo contiene queries SQLAlchemy — sin logica de negocio.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.repositories.base import BaseRepository


class SolicitudRepository(BaseRepository[Solicitud]):
    def __init__(self, db: AsyncSession):
        super().__init__(Solicitud, db)

    async def get_with_empleado(self, solicitud_id: int) -> Solicitud | None:
        """Carga la solicitud con su empleado y aprobaciones para que el Service pueda
        operar sin lazy loading."""
        result = await self.db.execute(
            select(Solicitud)
            .options(
                selectinload(Solicitud.empleado),
                selectinload(Solicitud.aprobaciones),
            )
            .where(Solicitud.id == solicitud_id)
        )
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def list_by_equipo(
        self,
        empleado_ids: list[int],
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id.in_(empleado_ids)]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)


class SolicitudAprobacionRepository(BaseRepository[SolicitudAprobacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(SolicitudAprobacion, db)

    async def list_by_solicitud(
        self, solicitud_id: int
    ) -> list[SolicitudAprobacion]:
        result = await self.db.execute(
            select(SolicitudAprobacion)
            .where(SolicitudAprobacion.solicitud_id == solicitud_id)
            .order_by(SolicitudAprobacion.timestamp)
        )
        return list(result.scalars().all())
