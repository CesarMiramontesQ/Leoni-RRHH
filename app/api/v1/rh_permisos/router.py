from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_rh_permisos_admin
from app.models.empleados import Empleado
from app.repositories.rh_permisos_repository import RhPermisosRepository
from app.schemas.rh_permisos import (
    RhEmpleadoBusquedaItem,
    RhModuloCatalogItem,
    RhPermisosMeResponse,
    RhPermisosUpdate,
    RhUsuarioPermisosItem,
)
from app.services.rh_permisos_service import RhPermisosService

router = APIRouter(prefix="/api/v1/rh-permisos", tags=["RH Permisos"])


def _repo(db: AsyncSession = Depends(get_db)) -> RhPermisosRepository:
    return RhPermisosRepository(db)


def _svc(repo: RhPermisosRepository = Depends(_repo)) -> RhPermisosService:
    return RhPermisosService(repo)


@router.get("/me", response_model=RhPermisosMeResponse)
async def get_mis_permisos_modulos(
    current_user: Empleado = Depends(get_current_user),
    svc: RhPermisosService = Depends(_svc),
):
    """Permisos efectivos del usuario autenticado (cualquier rol inscrito)."""
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
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.agregar_empleado_permisos(
        empleado_id=empleado_id,
        current_user=current_user,
    )


@router.put("/usuarios/{empleado_id}", response_model=RhUsuarioPermisosItem)
async def actualizar_permisos_usuario(
    empleado_id: int,
    body: RhPermisosUpdate,
    current_user: Empleado = Depends(require_rh_permisos_admin),
    svc: RhPermisosService = Depends(_svc),
):
    return await svc.update_usuario_permisos(
        empleado_id=empleado_id,
        body=body,
        current_user=current_user,
    )
