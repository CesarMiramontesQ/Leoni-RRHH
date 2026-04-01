from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class EmpleadoRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_by_email(self, email: str) -> Empleado | None:
        # No filtra por activo — auth_service decide si rechazar empleados inactivos (403)
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_num_empleado(self, num_empleado: str) -> Empleado | None:
        # No filtra por activo — TRESS sync necesita encontrar empleados inactivos para actualizar, no duplicar
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.num_empleado == num_empleado)
        )
        return result.scalar_one_or_none()

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_subordinados(self, supervisor_id: int) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado)
            .where(Empleado.supervisor_id == supervisor_id, Empleado.activo == True)
        )
        return list(result.scalars().all())
