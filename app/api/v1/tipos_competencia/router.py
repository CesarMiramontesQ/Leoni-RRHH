# app/api/v1/tipos_competencia/router.py
"""
Router de Tipos de Competencia — CRUD del catalogo.

Endpoints:
  GET    /api/v1/tipos-competencia          — Listar (paginado, filtros)
  POST   /api/v1/tipos-competencia          — Crear (RH)
  GET    /api/v1/tipos-competencia/{id}     — Detalle
  PATCH  /api/v1/tipos-competencia/{id}     — Actualizar (RH)
  DELETE /api/v1/tipos-competencia/{id}     — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.tipos_competencia import (
    TipoCompetenciaCreate,
    TipoCompetenciaListResponse,
    TipoCompetenciaResponse,
    TipoCompetenciaUpdate,
)
from app.services.tipo_competencia_service import TipoCompetenciaService

router = APIRouter(prefix="/api/v1/tipos-competencia", tags=["Tipos Competencia"])


@router.get("", response_model=TipoCompetenciaListResponse)
async def listar_tipos_competencia(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(50, ge=1, le=200, description="Items por pagina"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista tipos del catalogo con paginacion y filtros."""
    service = TipoCompetenciaService(db)
    return await service.listar(page=page, page_size=page_size, busqueda=busqueda)


@router.post(
    "",
    response_model=TipoCompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_tipo_competencia(
    body: TipoCompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo tipo en el catalogo. Solo RH."""
    service = TipoCompetenciaService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=TipoCompetenciaResponse)
async def obtener_tipo_competencia(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un tipo del catalogo."""
    service = TipoCompetenciaService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=TipoCompetenciaResponse)
async def actualizar_tipo_competencia(
    id: int,
    body: TipoCompetenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un tipo del catalogo. Solo RH."""
    service = TipoCompetenciaService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tipo_competencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un tipo del catalogo (soft delete). Solo RH."""
    service = TipoCompetenciaService(db)
    await service.eliminar(id=id, current_user=current_user)
