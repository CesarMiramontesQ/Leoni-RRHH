# app/api/v1/proveedores_externos/router.py
"""
Router del modulo de Capacitacion de Personal Externo (Cursos).

Cubre las tres subpaginas del menu Cursos:
  - Proveedores (empresa/marca) y sus personas externas.
  - Cursos externos (catalogo con periodicidad).
  - Vencimientos (registros de curso por persona con estado calculado).

Gestion (todo el modulo) exige rol RH via `role_checker(["operativo"])` o acceso
al modulo resuelto por ruta en rh_module_registry. El router instancia el service
y delega toda la logica.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.proveedores_externos import (
    CursoExternoCreate,
    CursoExternoListResponse,
    CursoExternoResponse,
    CursoExternoUpdate,
    PersonaCreate,
    PersonaResponse,
    PersonaUpdate,
    ProveedorCreate,
    ProveedorDetalleResponse,
    ProveedorListResponse,
    ProveedorUpdate,
    RegistroCursoCreate,
    RegistroCursoResponse,
    RegistroCursoUpdate,
    VencimientoListResponse,
)
from app.services.proveedor_externo_service import ProveedorExternoService

router = APIRouter(
    prefix="/api/v1/proveedores-externos", tags=["Proveedores externos"]
)


def _svc(db: AsyncSession = Depends(get_db)) -> ProveedorExternoService:
    return ProveedorExternoService(db)


# ══ Proveedores ═══════════════════════════════════════════════════════════════
@router.get("/proveedores", response_model=ProveedorListResponse)
async def list_proveedores(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    activo: bool | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.list_proveedores(
        page=page, page_size=page_size, search=q, activo=activo
    )


@router.post(
    "/proveedores",
    response_model=ProveedorDetalleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_proveedor(
    data: ProveedorCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.create_proveedor(data, current_user, background_tasks)


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorDetalleResponse)
async def get_proveedor(
    proveedor_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.get_proveedor(proveedor_id)


@router.put("/proveedores/{proveedor_id}", response_model=ProveedorDetalleResponse)
async def update_proveedor(
    proveedor_id: int,
    data: ProveedorUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.update_proveedor(proveedor_id, data, current_user)


@router.delete("/proveedores/{proveedor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_proveedor(
    proveedor_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    await svc.delete_proveedor(proveedor_id)


# ══ Personas ══════════════════════════════════════════════════════════════════
@router.get(
    "/proveedores/{proveedor_id}/personas", response_model=list[PersonaResponse]
)
async def list_personas(
    proveedor_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.list_personas(proveedor_id)


@router.post(
    "/proveedores/{proveedor_id}/personas",
    response_model=PersonaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_persona(
    proveedor_id: int,
    data: PersonaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.create_persona(proveedor_id, data)


@router.put("/personas/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: int,
    data: PersonaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.update_persona(persona_id, data)


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    await svc.delete_persona(persona_id)


# ══ Cursos externos ═══════════════════════════════════════════════════════════
@router.get("/cursos-externos", response_model=CursoExternoListResponse)
async def list_cursos_externos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    activo: bool | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.list_cursos_externos(
        page=page, page_size=page_size, search=q, activo=activo
    )


@router.post(
    "/cursos-externos",
    response_model=CursoExternoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_curso_externo(
    data: CursoExternoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.create_curso_externo(data)


@router.get("/cursos-externos/{curso_id}", response_model=CursoExternoResponse)
async def get_curso_externo(
    curso_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.get_curso_externo(curso_id)


@router.put("/cursos-externos/{curso_id}", response_model=CursoExternoResponse)
async def update_curso_externo(
    curso_id: int,
    data: CursoExternoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.update_curso_externo(curso_id, data)


@router.delete("/cursos-externos/{curso_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_curso_externo(
    curso_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    await svc.delete_curso_externo(curso_id)


# ══ Registros / Vencimientos ══════════════════════════════════════════════════
@router.get("/vencimientos", response_model=VencimientoListResponse)
async def list_vencimientos(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    estado: str | None = Query(None),
    proveedor_id: int | None = Query(None),
    curso_externo_id: int | None = Query(None),
    incluir_historico: bool = Query(False),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.list_vencimientos(
        page=page,
        page_size=page_size,
        estado=estado,
        proveedor_id=proveedor_id,
        curso_externo_id=curso_externo_id,
        incluir_historico=incluir_historico,
    )


@router.post(
    "/registros",
    response_model=RegistroCursoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_registro(
    data: RegistroCursoCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.create_registro(data, current_user, background_tasks)


@router.put("/registros/{registro_id}", response_model=RegistroCursoResponse)
async def update_registro(
    registro_id: int,
    data: RegistroCursoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    return await svc.update_registro(registro_id, data, current_user)


@router.delete("/registros/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_registro(
    registro_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ProveedorExternoService = Depends(_svc),
):
    await svc.delete_registro(registro_id)
