# app/api/v1/grados_puesto/router.py
"""
Router de Grados de Puesto — CRUD del catalogo global de grados.

Endpoints:
  GET    /api/v1/grados-puesto          — Listar (paginado, filtros)
  POST   /api/v1/grados-puesto          — Crear (RH)
  GET    /api/v1/grados-puesto/{id}     — Detalle
  PATCH  /api/v1/grados-puesto/{id}     — Actualizar (RH)
  DELETE /api/v1/grados-puesto/{id}     — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.grados_puesto import (
    GradoPuestoCreate,
    GradoPuestoListResponse,
    GradoPuestoResponse,
    GradoPuestoUpdate,
)
from app.services.grado_puesto_service import GradoPuestoService

router = APIRouter(prefix="/api/v1/grados-puesto", tags=["Grados Puesto"])


@router.get("", response_model=GradoPuestoListResponse)
async def listar_grados_puesto(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(50, ge=1, le=200, description="Items por pagina"),
    busqueda: str | None = Query(None, description="Buscar por nombre o codigo"),
    career_path_id: int | None = Query(
        None, gt=0, description="Filtrar por career path"
    ),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los global levels del catalogo con paginacion y filtros."""
    service = GradoPuestoService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        busqueda=busqueda,
        career_path_id=career_path_id,
    )


@router.post(
    "",
    response_model=GradoPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_grado_puesto(
    body: GradoPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo grado en el catalogo. Solo RH."""
    service = GradoPuestoService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=GradoPuestoResponse)
async def obtener_grado_puesto(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un grado del catalogo."""
    service = GradoPuestoService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=GradoPuestoResponse)
async def actualizar_grado_puesto(
    id: int,
    body: GradoPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un grado del catalogo. Solo RH."""
    service = GradoPuestoService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_grado_puesto(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un grado del catalogo (soft delete). Solo RH."""
    service = GradoPuestoService(db)
    await service.eliminar(id=id, current_user=current_user)
