"""Repository para Plan de Desarrollo Individual."""

from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import PlanDesarrolloIndividual


class PDIRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, pdi_id: int) -> Optional[PlanDesarrolloIndividual]:
        result = await self.db.execute(
            select(PlanDesarrolloIndividual).where(PlanDesarrolloIndividual.id == pdi_id)
        )
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> tuple[list[PlanDesarrolloIndividual], int]:
        q = select(PlanDesarrolloIndividual).where(
            PlanDesarrolloIndividual.empleado_id == empleado_id
        )
        count_q = select(func.count()).select_from(PlanDesarrolloIndividual).where(
            PlanDesarrolloIndividual.empleado_id == empleado_id
        )

        if estado:
            q = q.where(PlanDesarrolloIndividual.estado == estado)
            count_q = count_q.where(PlanDesarrolloIndividual.estado == estado)
        if competencia_id:
            q = q.where(PlanDesarrolloIndividual.competencia_id == competencia_id)
            count_q = count_q.where(PlanDesarrolloIndividual.competencia_id == competencia_id)

        q = q.order_by(PlanDesarrolloIndividual.fecha_inicio)

        result = await self.db.execute(q)
        items = list(result.scalars().all())

        total_result = await self.db.execute(count_q)
        total = total_result.scalar() or 0

        return items, total

    async def create(self, instance: PlanDesarrolloIndividual) -> PlanDesarrolloIndividual:
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def delete(self, pdi_id: int) -> bool:
        item = await self.get(pdi_id)
        if not item:
            return False
        await self.db.delete(item)
        await self.db.flush()
        return True
