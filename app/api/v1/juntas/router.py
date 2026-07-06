# app/api/v1/juntas/router.py
"""
Router del modulo Juntas (Level Up / Cursos).

Convenciones:
  - Gestion (listado, alta, detalle) exige rol RH via `role_checker(["operativo"])`
    o acceso al modulo `juntas` (resuelto por ruta en rh_module_registry).
  - El router instancia el service y delega toda la logica.
  - Preparado para futuras fases (edicion, cancelacion, adjuntos, control de
    asistencia): agregar aqui los endpoints PUT/DELETE/... sobre el mismo service.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.juntas import (
    JuntaCreate,
    JuntaDetalleResponse,
    JuntaListResponse,
)
from app.services.junta_service import JuntaService

router = APIRouter(prefix="/api/v1/juntas", tags=["Juntas"])


def _svc(db: AsyncSession = Depends(get_db)) -> JuntaService:
    return JuntaService(db)


@router.get("", response_model=JuntaListResponse)
async def list_juntas(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None),
    categoria: str | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: JuntaService = Depends(_svc),
):
    return await svc.list_juntas(
        page=page, page_size=page_size, search=q, categoria=categoria
    )


@router.post("", response_model=JuntaDetalleResponse, status_code=status.HTTP_201_CREATED)
async def create_junta(
    data: JuntaCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: JuntaService = Depends(_svc),
):
    return await svc.create_junta(data, current_user, background_tasks)


@router.get("/{junta_id}", response_model=JuntaDetalleResponse)
async def get_junta(
    junta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: JuntaService = Depends(_svc),
):
    return await svc.get_junta(junta_id)
