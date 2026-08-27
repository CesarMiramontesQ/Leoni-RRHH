"""Acceso a `levelup_homeoffice_reglas_area` y al catálogo de áreas activas de Bono."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area
from app.models.homeoffice_reglas_area import HomeOfficeReglaArea

AREA_ESTATUS_ACTIVO = 1


class HomeOfficeReglasAreaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_areas_activas(self) -> list[Area]:
        result = await self.db.execute(
            select(Area)
            .where(Area.estatus_id == AREA_ESTATUS_ACTIVO)
            .order_by(Area.descripcion, Area.area_id)
        )
        return list(result.scalars().all())

    async def get_area(self, area_id: int) -> Area | None:
        result = await self.db.execute(select(Area).where(Area.area_id == area_id))
        return result.scalar_one_or_none()

    async def list_reglas(self) -> list[HomeOfficeReglaArea]:
        result = await self.db.execute(
            select(HomeOfficeReglaArea).options(
                selectinload(HomeOfficeReglaArea.actualizado_por)
            )
        )
        return list(result.scalars().all())

    async def get_by_area(self, area_id: int) -> HomeOfficeReglaArea | None:
        result = await self.db.execute(
            select(HomeOfficeReglaArea)
            .options(selectinload(HomeOfficeReglaArea.actualizado_por))
            .where(HomeOfficeReglaArea.area_id == area_id)
        )
        return result.scalar_one_or_none()

    async def get_regla_vigente(self, area_id: int) -> HomeOfficeReglaArea | None:
        """Regla activa del área, o None si no hay o está apagada."""
        result = await self.db.execute(
            select(HomeOfficeReglaArea).where(
                HomeOfficeReglaArea.area_id == area_id,
                HomeOfficeReglaArea.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        area_id: int,
        dias_permitidos: int,
        periodo_semanas: int,
        activo: bool,
        actualizado_por_empleado_id: int | None,
    ) -> HomeOfficeReglaArea:
        regla = await self.get_by_area(area_id)
        if regla is None:
            regla = HomeOfficeReglaArea(area_id=area_id)
            self.db.add(regla)
        regla.dias_permitidos = dias_permitidos
        regla.periodo_semanas = periodo_semanas
        regla.activo = activo
        regla.actualizado_por_empleado_id = actualizado_por_empleado_id
        await self.db.flush()
        await self.db.refresh(regla, attribute_names=["actualizado_por", "updated_at"])
        return regla
