# app/api/v1/empleados/router.py
"""
Directorio y consulta de empleados — RH, gerente, director y supervisor.

- RH: listado completo (activos / inactivos / filtros), KPIs de plantilla, catálogo global.
- Resto: solo empleados activos y catálogo derivado de activos.

CRUD de cuentas: /api/v1/usuarios (solo RH).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.usuarios import (
    CatalogoFiltrosResponse,
    MetricasUsuarioResponse,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioVista360Response,
)
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/api/v1/empleados", tags=["Empleados - Directorio"])

_ROLES_DIRECTORIO = ["rh", "gerente", "director", "supervisor"]


def _svc(db: AsyncSession = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


def _rol_nombre(u: Empleado) -> str:
    return u.rol.nombre if u.rol else "empleado"


@router.get("/resumen", response_model=UsuarioResumenResponse)
async def resumen_empleados(
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    svc: UsuarioService = Depends(_svc),
):
    if _rol_nombre(current_user) == "rh":
        return await svc.resumen_plantilla(current_user)
    return await svc.resumen_directorio(current_user)


@router.get("/catalogo-filtros", response_model=CatalogoFiltrosResponse)
async def catalogo_empleados(
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    svc: UsuarioService = Depends(_svc),
):
    if _rol_nombre(current_user) == "rh":
        return await svc.catalogo_filtros(current_user)
    return await svc.catalogo_directorio(current_user)


@router.get("", response_model=UsuarioPageResponse)
async def list_empleados(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None),
    departamento: str | None = Query(None),
    puesto: str | None = Query(None),
    activo: bool | None = Query(
        None,
        description="Solo RH puede filtrar por inactivos; omitir = todos (RH) o solo activos (otros roles).",
    ),
    current_user: Empleado = Depends(role_checker(_ROLES_DIRECTORIO)),
    svc: UsuarioService = Depends(_svc),
):
    r = _rol_nombre(current_user)
    if r == "rh":
        return await svc.list_usuarios_page(
            page=page,
            page_size=page_size,
            q=q,
            departamento=departamento,
            puesto=puesto,
            activo=activo,
            current_user=current_user,
        )
    return await svc.list_directorio_empleados_page(
        page=page,
        page_size=page_size,
        q=q,
        departamento=departamento,
        puesto=puesto,
        current_user=current_user,
    )


@router.get("/{empleado_id}/vista360", response_model=UsuarioVista360Response)
async def get_vista360(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_vista360(id=empleado_id, current_user=current_user)


@router.get("/{empleado_id}/metricas", response_model=MetricasUsuarioResponse)
async def get_metricas(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_metricas(id=empleado_id, current_user=current_user)
