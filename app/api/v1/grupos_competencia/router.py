# app/api/v1/grupos_competencia/router.py
"""
Router de Grupos de Competencia — CRUD del catalogo.

Endpoints:
  GET    /api/v1/grupos-competencia          — Listar (paginado, filtros)
  POST   /api/v1/grupos-competencia          — Crear (RH)
  GET    /api/v1/grupos-competencia/{id}     — Detalle
  PATCH  /api/v1/grupos-competencia/{id}     — Actualizar (RH)
  DELETE /api/v1/grupos-competencia/{id}     — Eliminar soft (RH)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.grupos_competencia import (
    GrupoCompetenciaCreate,
    GrupoCompetenciaListResponse,
    GrupoCompetenciaResponse,
    GrupoCompetenciaUpdate,
)
from app.services.grupo_competencia_service import GrupoCompetenciaService

router = APIRouter(prefix="/api/v1/grupos-competencia", tags=["Grupos Competencia"])


@router.get("", response_model=GrupoCompetenciaListResponse)
async def listar_grupos_competencia(
    page: int = Query(1, ge=1, description="Numero de pagina"),
    page_size: int = Query(50, ge=1, le=200, description="Items por pagina"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista grupos del catalogo con paginacion y filtros."""
    service = GrupoCompetenciaService(db)
    return await service.listar(page=page, page_size=page_size, busqueda=busqueda)


@router.post(
    "",
    response_model=GrupoCompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_grupo_competencia(
    body: GrupoCompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo grupo en el catalogo. Solo RH."""
    service = GrupoCompetenciaService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=GrupoCompetenciaResponse)
async def obtener_grupo_competencia(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un grupo del catalogo."""
    service = GrupoCompetenciaService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=GrupoCompetenciaResponse)
async def actualizar_grupo_competencia(
    id: int,
    body: GrupoCompetenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un grupo del catalogo. Solo RH."""
    service = GrupoCompetenciaService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_grupo_competencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un grupo del catalogo (soft delete). Solo RH."""
    service = GrupoCompetenciaService(db)
    await service.eliminar(id=id, current_user=current_user)
