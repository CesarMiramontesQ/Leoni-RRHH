# app/api/v1/usuarios/router.py
"""
Directorio administrativo de usuarios — solo RH.

Operaciones disponibles:
  - GET /roles           — catálogo de roles
  - GET /{id}            — detalle de un empleado
  - PATCH /{id}          — editar rol_id, comedor_id (y lider_id legacy)

Creación/desactivación de empleados: no disponible — los empleados
se sincronizan desde IT Mirror (BD del cliente, solo lectura).
"""

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.usuarios import (
    RolBrief,
    UsuarioAsignacionUpdate,
    UsuarioResponse,
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
    """Catálogo de roles para formularios de asignación (solo RH)."""
    return await svc.list_roles_rh(current_user=current_user)


@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: int,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_usuario(id=id, current_user=current_user)


@router.patch("/{id}", response_model=UsuarioResponse)
async def asignar_lider_y_rol(
    id: int,
    body: UsuarioAsignacionUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Edición restringida: rol_id, comedor en turnos (lider_id legacy)."""
    return await svc.asignar_supervisor_y_rol(
        id=id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )
