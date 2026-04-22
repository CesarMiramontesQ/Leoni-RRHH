from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.notificaciones import NotificacionResponse
from app.services.notificacion_service import NotificacionService

router = APIRouter(prefix="/api/v1/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=PaginatedResponse[NotificacionResponse])
async def get_bandeja(
    cursor: int | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificacionService(db)
    return await service.list_notificaciones(
        user_id=current_user.id,
        cursor=cursor,
        limit=limit,
    )


@router.get("/recientes", response_model=list[NotificacionResponse])
async def get_recientes(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificacionService(db)
    return await service.list_recientes(user_id=current_user.id, limit=5)


@router.get("/no-leidas/count")
@router.get("/unread-count")
async def count_no_leidas(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificacionService(db)
    no_leidas = await service.count_no_leidas(user_id=current_user.id)
    return {"no_leidas": no_leidas}


@router.put("/{notificacion_id}/leer", response_model=NotificacionResponse)
@router.put("/{notificacion_id}/read", response_model=NotificacionResponse)
async def marcar_leida(
    notificacion_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificacionService(db)
    return await service.marcar_leida(
        notificacion_id=notificacion_id,
        user_id=current_user.id,
        background_tasks=background_tasks,
    )


@router.put("/leer-todas")
@router.put("/read-all")
async def marcar_todas_leidas(
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificacionService(db)
    marcadas = await service.marcar_todas_leidas(
        user_id=current_user.id,
        background_tasks=background_tasks,
    )
    return {"marcadas": marcadas}
