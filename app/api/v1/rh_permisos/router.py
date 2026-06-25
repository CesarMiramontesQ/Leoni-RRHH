from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_rh_permisos_admin
from app.models.empleados import Empleado
from app.repositories.rh_permisos_repository import RhPermisosRepository
from app.schemas.rh_permisos import (
    RhAdminPermisosUpdate,
    RhEmpleadoBusquedaItem,
    RhModuloCatalogItem,
    RhPermisosMeResponse,
    RhPermisosUpdate,
    RhUsuarioPermisosItem,
)
from app.services.rh_permisos_service import RhPermisosService

router = APIRouter(prefix="/api/v1/rh-permisos", tags=["RH Permisos"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _repo(db: AsyncSession = Depends(get_db)) -> RhPermisosRepository:
    return RhPermisosRepository(db)


def _svc(repo: RhPermisosRepository = Depends(_repo)) -> RhPermisosService:
    return RhPermisosService(repo)


@router.get("/me", response_model=RhPermisosMeResponse)
async def get_mis_permisos_modulos(
    current_user: Empleado = Depends(get_current_user),
    svc: RhPermisosService = Depends(_svc),
):
    """Permisos efectivos del usuario autenticado (rol RH)."""
    return svc.get_me(current_user)


@router.get("/modulos", response_model=list[RhModuloCatalogItem])
async def list_modulos_catalogo(
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return svc.list_modulos_catalog(current_user)


@router.get("/usuarios", response_model=list[RhUsuarioPermisosItem])
async def list_usuarios_permisos(
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.list_usuarios_permisos(current_user)


@router.get("/empleados-buscar", response_model=list[RhEmpleadoBusquedaItem])
async def buscar_empleados_para_permisos(
    q: str = Query(..., min_length=2),
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.buscar_empleados_disponibles(q=q, current_user=current_user)


@router.post("/usuarios/{empleado_id}", response_model=RhUsuarioPermisosItem, status_code=201)
async def agregar_empleado_permisos(
    empleado_id: int,
    request: Request,
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.agregar_empleado_permisos(
        empleado_id=empleado_id,
        current_user=current_user,
        ip_address=_client_ip(request),
    )


@router.put("/usuarios/{empleado_id}", response_model=RhUsuarioPermisosItem)
async def actualizar_permisos_usuario(
    empleado_id: int,
    body: RhPermisosUpdate,
    request: Request,
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.update_usuario_permisos(
        empleado_id=empleado_id,
        body=body,
        current_user=current_user,
        ip_address=_client_ip(request),
    )


@router.put("/usuarios/{empleado_id}/admin", response_model=RhUsuarioPermisosItem)
async def set_admin_permisos_usuario(
    empleado_id: int,
    body: RhAdminPermisosUpdate,
    request: Request,
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    """Otorga/revoca `puede_administrar_permisos_rh` a un empleado (fuente: BD)."""
    return await svc.set_admin_permisos(
        empleado_id=empleado_id,
        conceder=body.conceder,
        current_user=current_user,
        ip_address=_client_ip(request),
    )


@router.delete("/usuarios/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_usuario_permisos(
    empleado_id: int,
    request: Request,
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    """Quita a un usuario (de rol distinto a RH) de la administración de permisos."""
    await svc.remove_usuario_permisos(
        empleado_id=empleado_id,
        current_user=current_user,
        ip_address=_client_ip(request),
    )
