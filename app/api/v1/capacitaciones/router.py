# app/api/v1/capacitaciones/router.py
"""
Router de Capacitaciones — Modulo Talento Fase 3.

Endpoints:
  GET    /api/v1/capacitaciones/                          — Listar (paginado, filtros)
  POST   /api/v1/capacitaciones/                          — Crear (RH)
  GET    /api/v1/capacitaciones/mis-inscripciones         — Mis inscripciones
  GET    /api/v1/capacitaciones/{id}                      — Detalle
  PUT    /api/v1/capacitaciones/{id}                      — Actualizar (RH)
  DELETE /api/v1/capacitaciones/{id}                      — Soft-delete (RH)
  POST   /api/v1/capacitaciones/{id}/inscripciones        — Inscribir empleado
  GET    /api/v1/capacitaciones/{id}/inscripciones        — Listar inscripciones
  PUT    /api/v1/capacitaciones/inscripciones/{id}        — Actualizar inscripcion (RH)
  DELETE /api/v1/capacitaciones/inscripciones/{id}        — Cancelar inscripcion
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.core.data_scope import effective_data_scope_for_module
from app.models.empleados import Empleado
from app.schemas.capacitaciones import (
    CapacitacionCreate,
    CapacitacionListResponse,
    CapacitacionResponse,
    CapacitacionUpdate,
    InscripcionCreate,
    InscripcionListResponse,
    InscripcionResponse,
    InscripcionUpdate,
)
from app.services.capacitacion_service import CapacitacionService

router = APIRouter(prefix="/api/v1/capacitaciones", tags=["Capacitaciones"])


# ── Endpoints especiales (antes de /{id} para evitar conflicto de path) ──────


@router.get("/mis-inscripciones", response_model=InscripcionListResponse)
async def mis_inscripciones(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=100, description="Items por pagina"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las inscripciones del usuario autenticado."""
    service = CapacitacionService(db)
    return await service.mis_inscripciones(
        empleado_id=current_user.id,
        page=page,
        page_size=page_size,
    )


@router.put(
    "/inscripciones/{inscripcion_id}",
    response_model=InscripcionResponse,
)
async def actualizar_inscripcion(
    inscripcion_id: int,
    body: InscripcionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza estado/calificacion de una inscripcion. Solo RH."""
    service = CapacitacionService(db)
    return await service.actualizar_inscripcion(
        id=inscripcion_id, data=body, current_user=current_user
    )


@router.delete(
    "/inscripciones/{inscripcion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancelar_inscripcion(
    inscripcion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancela una inscripcion. RH puede cancelar cualquiera, empleado solo la suya."""
    service = CapacitacionService(db)
    await service.cancelar_inscripcion(id=inscripcion_id, current_user=current_user)


# ── CRUD basico ──────────────────────────────────────────────────────────────


@router.get("", response_model=CapacitacionListResponse)
async def listar_capacitaciones(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=100, description="Items por pagina"),
    area_id: int | None = Query(None, description="Filtrar por area"),
    modalidad: Literal["presencial", "online", "mixta"] | None = Query(None, description="Filtrar por modalidad"),
    estado: Literal["activa", "cancelada", "finalizada"] | None = Query(None, description="Filtrar por estado"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista capacitaciones con paginacion y filtros."""
    service = CapacitacionService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        area_id=area_id,
        modalidad=modalidad,
        estado=estado,
        busqueda=busqueda,
    )


@router.post(
    "",
    response_model=CapacitacionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_capacitacion(
    body: CapacitacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una nueva capacitacion. Solo RH."""
    service = CapacitacionService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=CapacitacionResponse)
async def obtener_capacitacion(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de una capacitacion."""
    service = CapacitacionService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=CapacitacionResponse)
async def actualizar_capacitacion(
    id: int,
    body: CapacitacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una capacitacion. Solo RH."""
    service = CapacitacionService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_capacitacion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) una capacitacion. Solo RH."""
    service = CapacitacionService(db)
    await service.eliminar(id=id, current_user=current_user)


# ── Inscripciones por capacitacion ───────────────────────────────────────────


@router.post(
    "/{id}/inscripciones",
    response_model=InscripcionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def inscribir_empleado(
    id: int,
    body: InscripcionCreate,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Inscribe un empleado en una capacitacion.
    RH puede inscribir a cualquiera, empleado solo a si mismo.
    """
    service = CapacitacionService(db)
    return await service.inscribir(
        capacitacion_id=id,
        empleado_id=body.empleado_id,
        current_user=current_user,
    )


@router.get("/{id}/inscripciones", response_model=InscripcionListResponse)
async def listar_inscripciones_capacitacion(
    id: int,
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(10, ge=1, le=100, description="Items por pagina"),
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    """Lista inscripciones de una capacitacion. RH operativo, supervisores, gerentes y directores."""
    from fastapi import HTTPException

    scope = effective_data_scope_for_module(current_user, "capacitaciones", rh_ui_mode)
    if scope not in ("rh", "supervisor", "gerente", "director"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes para ver inscripciones",
        )

    service = CapacitacionService(db)
    return await service.listar_inscripciones(
        capacitacion_id=id,
        page=page,
        page_size=page_size,
    )
