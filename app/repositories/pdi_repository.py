"""Repository para Plan de Desarrollo Individual (PDI)."""

from typing import Optional

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import PlanDesarrolloIndividual


class PDIRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, pdi_id: int) -> Optional[PlanDesarrolloIndividual]:
        stmt = (
            select(PlanDesarrolloIndividual)
            .options(selectinload(PlanDesarrolloIndividual.competencia))
            .where(PlanDesarrolloIndividual.id == pdi_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> list[PlanDesarrolloIndividual]:
        stmt = (
            select(PlanDesarrolloIndividual)
            .options(selectinload(PlanDesarrolloIndividual.competencia))
            .where(PlanDesarrolloIndividual.empleado_id == empleado_id)
            .order_by(PlanDesarrolloIndividual.fecha_inicio)
        )
        if estado:
            stmt = stmt.where(PlanDesarrolloIndividual.estado == estado)
        if competencia_id:
            stmt = stmt.where(PlanDesarrolloIndividual.competencia_id == competencia_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_empleado(
        self,
        empleado_id: int,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(PlanDesarrolloIndividual)
            .where(PlanDesarrolloIndividual.empleado_id == empleado_id)
        )
        if estado:
            stmt = stmt.where(PlanDesarrolloIndividual.estado == estado)
        if competencia_id:
            stmt = stmt.where(PlanDesarrolloIndividual.competencia_id == competencia_id)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def create(self, instance: PlanDesarrolloIndividual) -> PlanDesarrolloIndividual:
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance, attribute_names=["competencia"])
        return instance

    async def delete(self, pdi_id: int) -> None:
        stmt = delete(PlanDesarrolloIndividual).where(PlanDesarrolloIndividual.id == pdi_id)
        await self.db.execute(stmt)
        await self.db.flush()
