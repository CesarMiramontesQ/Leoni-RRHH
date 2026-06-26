# app/api/v1/tareas_catalogo/router.py
"""
Router de Tareas Catalogo — CRUD del catalogo centralizado de tareas.

Endpoints:
  GET    /api/v1/tareas-catalogo          — Listar (paginado, filtros)
  POST   /api/v1/tareas-catalogo          — Crear (RH)
  GET    /api/v1/tareas-catalogo/{id}     — Detalle
  PATCH  /api/v1/tareas-catalogo/{id}     — Actualizar (RH)
  DELETE /api/v1/tareas-catalogo/{id}     — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.tareas_catalogo import (
    TareaCatalogoCreate,
    TareaCatalogoListResponse,
    TareaCatalogoResponse,
    TareaCatalogoUpdate,
)
from app.services.tarea_catalogo_service import TareaCatalogoService

router = APIRouter(prefix="/api/v1/tareas-catalogo", tags=["Tareas Catalogo"])


@router.get("", response_model=TareaCatalogoListResponse)
async def listar_tareas_catalogo(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(50, ge=1, le=200, description="Items por pagina"),
    categoria: str | None = Query(None, description="Filtrar por categoria"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista tareas del catalogo con paginacion y filtros."""
    service = TareaCatalogoService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        categoria=categoria,
        busqueda=busqueda,
    )


@router.post(
    "",
    response_model=TareaCatalogoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_tarea_catalogo(
    body: TareaCatalogoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una nueva tarea en el catalogo. Solo RH."""
    service = TareaCatalogoService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=TareaCatalogoResponse)
async def obtener_tarea_catalogo(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de una tarea del catalogo."""
    service = TareaCatalogoService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=TareaCatalogoResponse)
async def actualizar_tarea_catalogo(
    id: int,
    body: TareaCatalogoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una tarea del catalogo. Solo RH."""
    service = TareaCatalogoService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tarea_catalogo(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una tarea del catalogo (soft delete). Solo RH."""
    service = TareaCatalogoService(db)
    await service.eliminar(id=id, current_user=current_user)
