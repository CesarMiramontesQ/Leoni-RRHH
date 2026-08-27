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
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    AlcanceEquipoResponse,
    AlcanceEquipoUpdate,
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudRequisitorRevision,
    SolicitudResponse,
    SolicitudSolicitarCambiosBody,
)
from app.services.solicitud_service import SolicitudService

router = APIRouter(prefix="/api/v1/solicitudes", tags=["Solicitudes"])


@router.get("", response_model=PaginatedResponse[SolicitudResponse])
async def list_solicitudes(
    cursor: int | None = Query(None, description="ID del ultimo item recibido. Omitir para primera pagina."),
    limit: int = Query(20, ge=1, le=100, description="Items por pagina. Maximo 100."),
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.list_solicitudes(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
        rh_ui_mode=rh_ui_mode,
    )


@router.post("", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
async def create_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["empleado", "supervisor", "gerente", "director", "operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.crear_solicitud(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
    )


# Preferencia self-service del gerente: cuántos niveles baja el listado de su
# equipo. Vive bajo /solicitudes (prefijo self-service) y va antes de /{solicitud_id}
# para que "me" no se lea como id.
@router.get("/me/alcance-equipo", response_model=AlcanceEquipoResponse)
async def get_alcance_equipo(
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_alcance_equipo(current_user=current_user, rh_ui_mode=rh_ui_mode)


@router.put("/me/alcance-equipo", response_model=AlcanceEquipoResponse)
async def set_alcance_equipo(
    body: AlcanceEquipoUpdate,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.set_alcance_equipo(
        current_user=current_user, body=body, rh_ui_mode=rh_ui_mode
    )


@router.get("/{solicitud_id}", response_model=SolicitudResponse)
async def get_solicitud(
    solicitud_id: int,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_solicitud(
        solicitud_id=solicitud_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
    )


@router.get("/{solicitud_id}/aprobaciones", response_model=list[SolicitudAprobacionResponse])
async def get_aprobaciones(
    solicitud_id: int,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_aprobaciones(
        solicitud_id=solicitud_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
    )


@router.put("/{solicitud_id}/approve", response_model=SolicitudResponse)
async def approve_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.aprobar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
    )


@router.put("/{solicitud_id}/reject", response_model=SolicitudResponse)
async def reject_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.rechazar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
    )


@router.put("/{solicitud_id}/request-changes", response_model=SolicitudResponse)
async def request_changes_solicitud(
    solicitud_id: int,
    body: SolicitudSolicitarCambiosBody,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.solicitar_cambios_solicitud(
        solicitud_id=solicitud_id,
        body=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
    )


@router.patch("/{solicitud_id}/revision", response_model=SolicitudResponse)
async def patch_solicitud_revision(
    solicitud_id: int,
    body: SolicitudRequisitorRevision,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    """Solo el creador de la solicitud, solo en `changes_requested`: actualiza fechas/comentarios, auditoría y vuelve a `pending` con notificación al supervisor."""
    service = SolicitudService(db)
    return await service.requisitor_actualizar_y_reenviar(
        solicitud_id=solicitud_id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
    )


@router.put("/{solicitud_id}/override", response_model=SolicitudResponse)
async def override_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["director", "operativo"])),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.override_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
        rh_ui_mode=rh_ui_mode,
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
