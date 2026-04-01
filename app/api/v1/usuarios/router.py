# app/api/v1/usuarios/router.py
"""
CRUD administrativo de usuarios — solo RH.

Listado, KPIs de plantilla, catálogo y vista 360 / métricas están en /api/v1/empleados.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.usuarios import (
    RolBrief,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/api/v1/usuarios", tags=["Usuarios"])

_RH = ["rh"]


def _svc(db: AsyncSession = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


@router.get("/roles", response_model=list[RolBrief])
async def list_roles(
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Catálogo de roles para alta de empleados (formulario RH)."""
    return await svc.list_roles_rh(current_user=current_user)


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    body: UsuarioCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.crear_usuario(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: int,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_usuario(id=id, current_user=current_user)


@router.put("/{id}", response_model=UsuarioResponse)
async def actualizar_usuario(
    id: int,
    body: UsuarioUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.actualizar_usuario(
        id=id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_usuario(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    await svc.desactivar_usuario(
        id=id,
        current_user=current_user,
        background_tasks=background_tasks,
    )
