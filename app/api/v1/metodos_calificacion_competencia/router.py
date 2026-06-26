# app/api/v1/metodos_calificacion_competencia/router.py
"""
Router de Metodos de Calificacion de Competencias — catalogo configurable.

Endpoints:
  GET    /api/v1/metodos-calificacion-competencia          — Listar
  POST   /api/v1/metodos-calificacion-competencia          — Crear (RH)
  GET    /api/v1/metodos-calificacion-competencia/{id}     — Detalle
  PATCH  /api/v1/metodos-calificacion-competencia/{id}     — Actualizar (RH)
  DELETE /api/v1/metodos-calificacion-competencia/{id}     — Desactivar (RH)
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.metodos_calificacion_competencia import (
    MetodoCalificacionCompetenciaCreate,
    MetodoCalificacionCompetenciaListResponse,
    MetodoCalificacionCompetenciaResponse,
    MetodoCalificacionCompetenciaUpdate,
)
from app.services.metodo_calificacion_competencia_service import (
    MetodoCalificacionCompetenciaService,
)

router = APIRouter(
    prefix="/api/v1/metodos-calificacion-competencia",
    tags=["Metodos Calificacion Competencia"],
)


@router.get("", response_model=MetodoCalificacionCompetenciaListResponse)
async def listar_metodos_calificacion_competencia(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista metodos de calificacion activos para competencias."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.listar()


@router.post(
    "",
    response_model=MetodoCalificacionCompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_metodo_calificacion_competencia(
    body: MetodoCalificacionCompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un nuevo nivel de competencia en el catalogo. Solo RH."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=MetodoCalificacionCompetenciaResponse)
async def obtener_metodo_calificacion_competencia(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de un metodo de calificacion de competencias."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.obtener(id=id)


@router.patch("/{id}", response_model=MetodoCalificacionCompetenciaResponse)
async def actualizar_metodo_calificacion_competencia(
    id: int,
    body: MetodoCalificacionCompetenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza nombre, orden o estado activo de un metodo. Solo RH."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_metodo_calificacion_competencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un metodo de calificacion si no esta en uso. Solo RH."""
    service = MetodoCalificacionCompetenciaService(db)
    await service.desactivar(id=id, current_user=current_user)
