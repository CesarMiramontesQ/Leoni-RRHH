"""Historial de corridas del scheduler. Página oculta `#/ajustes/scheduler-logs`.

Solo admin (`require_admin_user`). No hay endpoint para ejecutar ni relanzar un job:
eso sigue siendo por CLI.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin_user
from app.models.empleados import Empleado
from app.repositories.scheduler_job_log_repository import SchedulerJobLogRepository
from app.schemas.scheduler_logs import (
    SchedulerJobsResponse,
    SchedulerLogDetalle,
    SchedulerLogPage,
)

router = APIRouter(prefix="/api/v1/scheduler-logs", tags=["Scheduler"])


@router.get("", response_model=SchedulerLogPage, summary="Historial de corridas")
async def listar_corridas(
    job_id: str | None = Query(None),
    resultado: str | None = Query(
        None, description="en_curso | ok | advertencia | error"
    ),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    items, total = await SchedulerJobLogRepository(db).listar(
        job_id=job_id,
        resultado=resultado,
        desde=desde,
        hasta=hasta,
        page=page,
        page_size=page_size,
    )
    return SchedulerLogPage(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/jobs",
    response_model=SchedulerJobsResponse,
    summary="Ids de los jobs registrados",
)
async def listar_jobs(
    current_user: Empleado = Depends(require_admin_user),
):
    """Ids que registra `registrar_jobs_programados`.

    Se calculan sobre un scheduler efímero en vez de leer el vivo: el listado no depende
    de que el scheduler esté corriendo (en tests no lo está) y da el mismo resultado. Un
    job recién agregado aparece en el filtro aunque todavía no haya corrido nunca.
    """
    _ = current_user
    from zoneinfo import ZoneInfo

    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    from app.core.config import settings
    from app.main import registrar_jobs_programados

    temporal = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    registrar_jobs_programados(temporal)
    return SchedulerJobsResponse(items=sorted(j.id for j in temporal.get_jobs()))


@router.get("/{log_id}", response_model=SchedulerLogDetalle, summary="Detalle")
async def obtener_corrida(
    log_id: int,
    current_user: Empleado = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    fila = await SchedulerJobLogRepository(db).obtener(log_id)
    if fila is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Corrida no encontrada."
        )
    return fila
