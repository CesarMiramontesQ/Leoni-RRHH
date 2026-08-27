"""Configuración laborales (`/api/v1/laborales-config`).

Vive fuera de `/api/v1/solicitudes` a propósito: ese prefijo está exento como
self-service y el middleware de módulos RH no lo bloquearía. Aquí manda el módulo
`laborales-configuracion` (Permisos RH) vía `role_checker(["operativo"])`.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.laborales_config import (
    HomeOfficeReglaAreaItem,
    HomeOfficeReglaAreaUpdate,
    HomeOfficeReglasAreaListResponse,
)
from app.services.laborales_config_service import LaboralesConfigService

router = APIRouter(prefix="/api/v1/laborales-config", tags=["Configuración laborales"])


def _svc(db: AsyncSession = Depends(get_db)) -> LaboralesConfigService:
    return LaboralesConfigService(db)


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/home-office/areas", response_model=HomeOfficeReglasAreaListResponse)
async def list_home_office_reglas_area(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: LaboralesConfigService = Depends(_svc),
):
    """Todas las áreas activas con su regla de home office (o sin ella)."""
    return await svc.listar_reglas_home_office()


@router.put("/home-office/areas/{area_id}", response_model=HomeOfficeReglaAreaItem)
async def update_home_office_regla_area(
    area_id: int,
    body: HomeOfficeReglaAreaUpdate,
    request: Request,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: LaboralesConfigService = Depends(_svc),
):
    return await svc.actualizar_regla_home_office(
        area_id, body, current_user, ip_address=_client_ip(request)
    )
