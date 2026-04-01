# app/api/v1/notificaciones/router.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.repositories.notificacion_repository import NotificacionRepository
from app.schemas import PaginatedResponse
from app.schemas.notificaciones import NotificacionResponse

router = APIRouter(prefix="/api/v1/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=PaginatedResponse[NotificacionResponse])
async def get_bandeja(
    cursor: int | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificacionRepository(db)
    items, next_cursor = await repo.list_paginated(
        cursor=cursor,
        limit=limit,
        filters={"destinatario_id": current_user.id},
    )
    no_leidas = sum(1 for n in items if not n.leida)
    return PaginatedResponse(
        items=[NotificacionResponse.model_validate(n) for n in items],
        next_cursor=next_cursor,
        total=len(items),
    )


@router.get("/no-leidas/count")
async def count_no_leidas(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificacionRepository(db)
    no_leidas = await repo.list_no_leidas(destinatario_id=current_user.id)
    return {"no_leidas": len(no_leidas)}


@router.put("/{notificacion_id}/leer", response_model=NotificacionResponse)
async def marcar_leida(
    notificacion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificacionRepository(db)
    notif = await repo.get(notificacion_id)
    if not notif:
        raise NotFoundError(entidad="Notificacion", id=notificacion_id)
    if notif.destinatario_id != current_user.id:
        raise ForbiddenError(detail="No puedes marcar como leida una notificacion de otro usuario")
    updated = await repo.marcar_leida(notificacion_id)
    return NotificacionResponse.model_validate(updated)


@router.put("/leer-todas")
async def marcar_todas_leidas(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificacionRepository(db)
    no_leidas = await repo.list_no_leidas(destinatario_id=current_user.id)
    for n in no_leidas:
        await repo.marcar_leida(n.id)
    return {"marcadas": len(no_leidas)}
