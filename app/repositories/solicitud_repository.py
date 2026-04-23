# app/repositories/solicitud_repository.py
"""
Repositorios para el dominio solicitudes.
Solo contiene queries SQLAlchemy — sin logica de negocio.
"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.repositories.base import BaseRepository
from app.schemas.solicitudes import ESTADO_SOLICITUD_APROBADA


class SolicitudRepository(BaseRepository[Solicitud]):
    def __init__(self, db: AsyncSession):
        super().__init__(Solicitud, db)

    async def list_paginated(
        self,
        cursor: int | None = None,
        limit: int = 20,
        filters: list | None = None,
    ) -> tuple[list[Solicitud], int | None]:
        """Lista con empleado, area y lider precargados para respuestas enriquecidas."""
        query = (
            select(Solicitud)
            .options(
                selectinload(Solicitud.empleado).selectinload(Empleado.area),
                selectinload(Solicitud.empleado).selectinload(Empleado.lider),
            )
        )
        if filters:
            for condition in filters:
                query = query.where(condition)
        if cursor is not None:
            query = query.where(Solicitud.id > cursor)
        query = query.order_by(Solicitud.id).limit(limit + 1)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].id
        return items, next_cursor

    async def get_with_empleado(self, solicitud_id: int) -> Solicitud | None:
        """Carga la solicitud con su empleado y aprobaciones para que el Service pueda
        operar sin lazy loading."""
        result = await self.db.execute(
            select(Solicitud)
            .options(
                selectinload(Solicitud.empleado).selectinload(Empleado.area),
                selectinload(Solicitud.empleado).selectinload(Empleado.lider),
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

    async def marcar_estado_aprobada_si_pending(self, solicitud_id: int) -> bool:
        """
        Pasa la solicitud a estado aprobado solo si sigue en pending (una sola fila).
        Evita doble aprobacion concurrente y mantiene coherencia con notificacion en la misma transaccion.
        """
        result = await self.db.execute(
            update(Solicitud)
            .where(Solicitud.id == solicitud_id, Solicitud.estado == "pending")
            .values(estado=ESTADO_SOLICITUD_APROBADA, nivel_actual=1)
            .execution_options(synchronize_session=False)
        )
        return (result.rowcount or 0) > 0


class SolicitudAprobacionRepository(BaseRepository[SolicitudAprobacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(SolicitudAprobacion, db)

    async def list_by_solicitud(
        self, solicitud_id: int
    ) -> list[SolicitudAprobacion]:
        result = await self.db.execute(
            select(SolicitudAprobacion)
            .options(selectinload(SolicitudAprobacion.aprobador))
            .where(SolicitudAprobacion.solicitud_id == solicitud_id)
            .order_by(SolicitudAprobacion.timestamp)
        )
        return list(result.scalars().all())
