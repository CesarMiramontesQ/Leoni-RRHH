"""Configuración laborales: reglas de home office por área."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.catalogos import Area
from app.models.empleados import Empleado
from app.models.homeoffice_reglas_area import HomeOfficeReglaArea
from app.repositories.homeoffice_reglas_area_repository import (
    AREA_ESTATUS_ACTIVO,
    HomeOfficeReglasAreaRepository,
)
from app.schemas.laborales_config import (
    HomeOfficeReglaAreaItem,
    HomeOfficeReglaAreaUpdate,
    HomeOfficeReglasAreaListResponse,
)
from app.utils.audit_logger import log_action

AUDIT_MODULO = "laborales_config"
AUDIT_ACCION_REGLA_HO = "LABORALES_CONFIG_HO_REGLA_AREA_UPDATED"


class LaboralesConfigService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HomeOfficeReglasAreaRepository(db)

    @staticmethod
    def _to_item(area: Area, regla: HomeOfficeReglaArea | None) -> HomeOfficeReglaAreaItem:
        if regla is None:
            return HomeOfficeReglaAreaItem(
                area_id=area.area_id, area_descripcion=area.descripcion
            )
        return HomeOfficeReglaAreaItem(
            area_id=area.area_id,
            area_descripcion=area.descripcion,
            dias_permitidos=regla.dias_permitidos,
            periodo_semanas=regla.periodo_semanas,
            activo=regla.activo,
            actualizado_en=regla.updated_at,
            actualizado_por=regla.actualizado_por.nombre if regla.actualizado_por else None,
        )

    async def listar_reglas_home_office(self) -> HomeOfficeReglasAreaListResponse:
        """Todas las áreas activas de Bono, con su regla si la tienen. Las áreas
        inactivas no se listan: su regla, si existía, queda huérfana e inofensiva."""
        areas = await self.repo.list_areas_activas()
        reglas = {r.area_id: r for r in await self.repo.list_reglas()}
        items = [self._to_item(a, reglas.get(a.area_id)) for a in areas]
        return HomeOfficeReglasAreaListResponse(items=items, total=len(items))

    async def actualizar_regla_home_office(
        self,
        area_id: int,
        data: HomeOfficeReglaAreaUpdate,
        current_user: Empleado,
        ip_address: str | None = None,
    ) -> HomeOfficeReglaAreaItem:
        area = await self.repo.get_area(area_id)
        if area is None or area.estatus_id != AREA_ESTATUS_ACTIVO:
            raise NotFoundError("Área", area_id)

        anterior = await self.repo.get_by_area(area_id)
        datos_antes = (
            {
                "dias_permitidos": anterior.dias_permitidos,
                "periodo_semanas": anterior.periodo_semanas,
                "activo": anterior.activo,
            }
            if anterior is not None
            else None
        )
        regla = await self.repo.upsert(
            area_id=area_id,
            dias_permitidos=data.dias_permitidos,
            periodo_semanas=data.periodo_semanas,
            activo=data.activo,
            actualizado_por_empleado_id=current_user.empleado_id,
        )
        await log_action(
            self.db,
            accion=AUDIT_ACCION_REGLA_HO,
            modulo=AUDIT_MODULO,
            usuario_id=current_user.empleado_id,
            entidad_id=area_id,
            datos_antes=datos_antes,
            datos_despues={
                "dias_permitidos": regla.dias_permitidos,
                "periodo_semanas": regla.periodo_semanas,
                "activo": regla.activo,
            },
            ip_address=ip_address,
        )
        return self._to_item(area, regla)
