# app/api/v1/auditoria/router.py
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.auditoria import AuditLogResponse
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/api/v1/auditoria", tags=["Auditoria"])


@router.get("/logs", response_model=PaginatedResponse[AuditLogResponse])
async def get_logs(
    cursor: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    modulo: str | None = Query(None),
    usuario_id: int | None = Query(None),
    accion: str | None = Query(None),
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = AuditoriaService(db)
    return await service.list_logs(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
        modulo=modulo,
        usuario_id=usuario_id,
        accion=accion,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_log(
    log_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = AuditoriaService(db)
    return await service.get_log(log_id=log_id, current_user=current_user)
