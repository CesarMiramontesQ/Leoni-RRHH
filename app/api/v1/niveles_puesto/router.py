# app/api/v1/niveles_puesto/router.py
"""
Router de Niveles de Puesto — CRUD del catalogo de niveles organizacionales.

Endpoints:
  GET    /api/v1/niveles-puesto          — Listar (paginado, filtros)
  POST   /api/v1/niveles-puesto          — Crear (RH)
  GET    /api/v1/niveles-puesto/{id}     — Detalle
  PATCH  /api/v1/niveles-puesto/{id}     — Actualizar (RH)
  DELETE /api/v1/niveles-puesto/{id}     — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.niveles_puesto import (
    NivelPuestoCreate,
    NivelPuestoListResponse,
    NivelPuestoResponse,
    NivelPuestoUpdate,
)
from app.services.nivel_puesto_service import NivelPuestoService

router = APIRouter(prefix="/api/v1/niveles-puesto", tags=["Niveles Puesto"])


@router.get("", response_model=NivelPuestoListResponse)
async def listar_niveles_puesto(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(50, ge=1, le=200, description="Items por pagina"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista niveles del catalogo con paginacion y filtros."""
    service = NivelPuestoService(db)
    return await service.listar(page=page, page_size=page_size, busqueda=busqueda)


@router.post(
    "",
    response_model=NivelPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_nivel_puesto(
    body: NivelPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo nivel en el catalogo. Solo RH."""
    service = NivelPuestoService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=NivelPuestoResponse)
async def obtener_nivel_puesto(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un nivel del catalogo."""
    service = NivelPuestoService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=NivelPuestoResponse)
async def actualizar_nivel_puesto(
    id: int,
    body: NivelPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un nivel del catalogo. Solo RH."""
    service = NivelPuestoService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_nivel_puesto(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un nivel del catalogo (soft delete). Solo RH."""
    service = NivelPuestoService(db)
    await service.eliminar(id=id, current_user=current_user)
