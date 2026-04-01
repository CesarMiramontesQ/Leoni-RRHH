# app/api/v1/solicitudes/router.py
"""
Router del dominio solicitudes.

Responsabilidades exclusivas:
  - Declarar endpoints (metodo, path, response_model, status_code)
  - Inyectar dependencias via Depends
  - Delegar al SolicitudService
  - Pasar BackgroundTasks al Service en endpoints que mutan estado

Lo que NO hace este router:
  - Logica de negocio
  - Queries a la DB
  - Llamadas directas a repositories o integraciones
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudResponse,
)
from app.services.solicitud_service import SolicitudService

router = APIRouter(prefix="/api/v1/solicitudes", tags=["Solicitudes"])


@router.get("", response_model=PaginatedResponse[SolicitudResponse])
async def list_solicitudes(
    cursor: int | None = Query(None, description="ID del ultimo item recibido. Omitir para primera pagina."),
    limit: int = Query(20, ge=1, le=100, description="Items por pagina. Maximo 100."),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.list_solicitudes(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
    )


@router.post("", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
async def create_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["empleado", "supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.crear_solicitud(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.get("/{solicitud_id}", response_model=SolicitudResponse)
async def get_solicitud(
    solicitud_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_solicitud(
        solicitud_id=solicitud_id,
        current_user=current_user,
    )


@router.get("/{solicitud_id}/aprobaciones", response_model=list[SolicitudAprobacionResponse])
async def get_aprobaciones(
    solicitud_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_aprobaciones(
        solicitud_id=solicitud_id,
        current_user=current_user,
    )


@router.put("/{solicitud_id}/approve", response_model=SolicitudResponse)
async def approve_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.aprobar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/reject", response_model=SolicitudResponse)
async def reject_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.rechazar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/override", response_model=SolicitudResponse)
async def override_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["director", "rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.override_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/cancel", response_model=SolicitudResponse)
async def cancel_solicitud(
    solicitud_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.cancelar_solicitud(
        solicitud_id=solicitud_id,
        current_user=current_user,
        background_tasks=background_tasks,
    )
