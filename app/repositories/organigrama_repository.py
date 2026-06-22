from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class OrganigramaRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def list_empleados_para_organigrama(
        self,
        estados_activos: list[int],
    ) -> list[Empleado]:
        query = select(Empleado).options(
            selectinload(Empleado.area),
            selectinload(Empleado.puesto),
            selectinload(Empleado.estado),
            selectinload(Empleado.lider),
            selectinload(Empleado.categoria),
            selectinload(Empleado.core),
        )

        if estados_activos:
            query = query.where(Empleado.estado_id.in_(estados_activos))

        query = query.order_by(Empleado.lider_id.nullsfirst(), Empleado.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())
