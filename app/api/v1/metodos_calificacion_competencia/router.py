# app/api/v1/metodos_calificacion_competencia/router.py
"""
Router de Metodos de Calificacion de Competencias — catalogo editable (niveles 1-4).

Endpoints:
  GET   /api/v1/metodos-calificacion-competencia          — Listar
  GET   /api/v1/metodos-calificacion-competencia/{id}     — Detalle
  PATCH /api/v1/metodos-calificacion-competencia/{id}     — Actualizar (RH)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.metodos_calificacion_competencia import (
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
    """Lista metodos de calificacion para competencias (Planeado a Experto)."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.listar()


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
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza nombre u orden de un metodo de calificacion. Solo RH."""
    service = MetodoCalificacionCompetenciaService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)
