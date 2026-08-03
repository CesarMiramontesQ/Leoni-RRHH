from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin_user
from app.models.empleados import Empleado
from app.repositories.vistas_rol_repository import VistasRolRepository
from app.schemas.vistas_rol import (
    VistaRolCatalogItem,
    VistaRolConfigResponse,
    VistaRolConfigUpdate,
    VistaRolMeResponse,
)
from app.services.vistas_rol_service import VistasRolService

router = APIRouter(prefix="/api/v1/vistas-rol", tags=["Vistas por rol"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _repo(db: AsyncSession = Depends(get_db)) -> VistasRolRepository:
    return VistasRolRepository(db)


def _svc(repo: VistasRolRepository = Depends(_repo)) -> VistasRolService:
    return VistasRolService(repo)


@router.get("/me", response_model=VistaRolMeResponse)
async def get_mis_vistas(
    current_user: Empleado = Depends(get_current_user),
    svc: VistasRolService = Depends(_svc),
):
    """Vistas habilitadas para el rol del usuario autenticado."""
    return await svc.get_me(current_user)


@router.get("/catalogo", response_model=list[VistaRolCatalogItem])
async def list_catalogo(
    current_user: Empleado = Depends(require_admin_user),
    svc: VistasRolService = Depends(_svc),
):
    return svc.list_catalogo(current_user)


@router.get("/config", response_model=VistaRolConfigResponse)
async def get_config(
    current_user: Empleado = Depends(require_admin_user),
    svc: VistasRolService = Depends(_svc),
):
    return await svc.get_config(current_user)


@router.put("/config", response_model=VistaRolConfigResponse)
async def update_config(
    body: VistaRolConfigUpdate,
    request: Request,
    current_user: Empleado = Depends(require_admin_user),
    svc: VistasRolService = Depends(_svc),
):
    """Aplica los cambios de la matriz (rol × vista). Solo admin RH."""
    return await svc.update_config(body, current_user, ip_address=_client_ip(request))


@router.post("/config/restaurar", response_model=VistaRolConfigResponse)
async def restaurar_defaults(
    request: Request,
    current_user: Empleado = Depends(require_admin_user),
    svc: VistasRolService = Depends(_svc),
):
    """Restaura la configuración inicial (el acceso original de cada rol)."""
    return await svc.restaurar_defaults(current_user, ip_address=_client_ip(request))
