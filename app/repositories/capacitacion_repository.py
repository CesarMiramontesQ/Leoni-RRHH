# app/repositories/capacitacion_repository.py
"""
Repositorio de Capacitaciones e Inscripciones — acceso a datos async.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import Capacitacion, Inscripcion
from app.repositories.base import BaseRepository


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class CapacitacionRepository(BaseRepository[Capacitacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(Capacitacion, db)

    async def get_with_relations(self, id: int) -> Capacitacion | None:
        result = await self.db.execute(
            select(Capacitacion)
            .options(
                selectinload(Capacitacion.area),
                selectinload(Capacitacion.inscripciones),
            )
            .where(Capacitacion.id == id, Capacitacion.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def get_for_update(self, id: int) -> Capacitacion | None:
        result = await self.db.execute(
            select(Capacitacion)
            .options(selectinload(Capacitacion.inscripciones))
            .where(Capacitacion.id == id, Capacitacion.activo.is_(True))
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        area_id: int | None = None,
        modalidad: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Capacitacion], int]:
        query = (
            select(Capacitacion)
            .options(selectinload(Capacitacion.area))
            .where(Capacitacion.activo.is_(True))
        )

        if area_id is not None:
            query = query.where(Capacitacion.area_id == area_id)
        if modalidad:
            query = query.where(Capacitacion.modalidad == modalidad)
        if estado:
            query = query.where(Capacitacion.estado == estado)
        if busqueda:
            query = query.where(Capacitacion.nombre.ilike(f"%{_escape_like(busqueda)}%", escape="\\"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(Capacitacion.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().unique().all())

        return items, total or 0

    async def count_inscritos_batch(self, capacitacion_ids: list[int]) -> dict[int, int]:
        if not capacitacion_ids:
            return {}
        query = (
            select(Inscripcion.capacitacion_id, func.count())
            .where(
                Inscripcion.capacitacion_id.in_(capacitacion_ids),
                Inscripcion.estado != "cancelado",
            )
            .group_by(Inscripcion.capacitacion_id)
        )
        result = await self.db.execute(query)
        return dict(result.all())


class InscripcionRepository(BaseRepository[Inscripcion]):
    def __init__(self, db: AsyncSession):
        super().__init__(Inscripcion, db)

    async def get_with_relations(self, id: int) -> Inscripcion | None:
        result = await self.db.execute(
            select(Inscripcion)
            .options(
                selectinload(Inscripcion.capacitacion),
                selectinload(Inscripcion.empleado),
            )
            .where(Inscripcion.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_pair(
        self, capacitacion_id: int, empleado_id: int
    ) -> Inscripcion | None:
        result = await self.db.execute(
            select(Inscripcion).where(
                Inscripcion.capacitacion_id == capacitacion_id,
                Inscripcion.empleado_id == empleado_id,
            )
        )
        return result.scalar_one_or_none()

    async def count_by_capacitacion(self, capacitacion_id: int) -> int:
        query = (
            select(func.count())
            .select_from(Inscripcion)
            .where(
                Inscripcion.capacitacion_id == capacitacion_id,
                Inscripcion.estado != "cancelado",
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one() or 0

    async def list_by_capacitacion(
        self, capacitacion_id: int, offset: int, limit: int
    ) -> tuple[list[Inscripcion], int]:
        base_query = (
            select(Inscripcion)
            .options(
                selectinload(Inscripcion.empleado),
                selectinload(Inscripcion.capacitacion),
            )
            .where(Inscripcion.capacitacion_id == capacitacion_id)
        )

        count_query = select(func.count()).select_from(base_query.subquery())
        total = await self.db.scalar(count_query)

        query = base_query.order_by(Inscripcion.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def list_by_empleado(
        self, empleado_id: int, offset: int, limit: int
    ) -> tuple[list[Inscripcion], int]:
        base_query = (
            select(Inscripcion)
            .options(
                selectinload(Inscripcion.capacitacion),
                selectinload(Inscripcion.empleado),
            )
            .where(Inscripcion.empleado_id == empleado_id)
        )

        count_query = select(func.count()).select_from(base_query.subquery())
        total = await self.db.scalar(count_query)

        query = base_query.order_by(Inscripcion.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0
