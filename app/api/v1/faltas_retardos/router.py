from __future__ import annotations

import asyncio
import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_rh_ui_mode, role_checker
from app.core.exceptions import ConflictError
from app.models.empleados import Empleado
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosEstadisticasResponse,
    FaltasRetardosPageResponse,
    FaltasRetardosSyncAusenciasResponse,
    FaltasRetardosTiposResponse,
)
from app.services.faltas_retardos_service import FaltasRetardosService
from app.services.sync_ausencias_fi_service import SyncAusenciasService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/faltas-retardos", tags=["Faltas y retardos"])

_sync_ausencias_lock = asyncio.Lock()


def _svc(db: AsyncSession = Depends(get_db)) -> FaltasRetardosService:
    return FaltasRetardosService(db)


@router.get("/")
async def health():
    return {"modulo": "faltas-retardos", "status": "activo", "version": "1.0.0"}


@router.get("", response_model=FaltasRetardosPageResponse)
async def list_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["operativo", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: FaltasRetardosService = Depends(_svc),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    empleado_id: int | None = Query(None),
    tipo: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    busqueda: str | None = Query(None, description="Nombre o número de empleado"),
):
    return await svc.list_eventos(
        current_user,
        page=page,
        page_size=page_size,
        rh_ui_mode=rh_ui_mode,
        empleado_id=empleado_id,
        tipo=tipo.strip() if tipo and tipo.strip() else None,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        busqueda=busqueda.strip() if busqueda and busqueda.strip() else None,
    )


@router.get("/tipos", response_model=FaltasRetardosTiposResponse)
async def list_tipos_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["operativo", "gerente", "supervisor", "director"])
    ),
    svc: FaltasRetardosService = Depends(_svc),
):
    return FaltasRetardosTiposResponse(items=svc.list_tipos())


@router.get("/estadisticas", response_model=FaltasRetardosEstadisticasResponse)
async def estadisticas_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["operativo", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: FaltasRetardosService = Depends(_svc),
    empleado_id: int | None = Query(None),
    tipo: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    busqueda: str | None = Query(None, description="Nombre o número de empleado"),
    area: str | None = Query(None, description="Nombre de área"),
    tendencia_agrupacion: str | None = Query(
        None,
        description="Granularidad de tendencia por tipo: dia, semana o mes",
    ),
):
    agr = (tendencia_agrupacion or "").strip().lower() or None
    return await svc.estadisticas_eventos(
        current_user,
        rh_ui_mode=rh_ui_mode,
        empleado_id=empleado_id,
        tipo=tipo.strip() if tipo and tipo.strip() else None,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        busqueda=busqueda.strip() if busqueda and busqueda.strip() else None,
        area=area.strip() if area and area.strip() else None,
        tendencia_agrupacion=agr,
    )


@router.post(
    "/sincronizar-ausencias",
    response_model=FaltasRetardosSyncAusenciasResponse,
    summary="Sincronizar faltas injustificadas y retardos (semana anterior)",
    description=(
        "Mirror sync de FI y RE desde dbo.AUSENCIA (DATOS_ANALISIS) hacia "
        "importadas_historico (Bono) para la semana inmediatamente anterior "
        "a la fecha actual (APP_TIMEZONE / semana_historico). "
        "Inserta, actualiza y elimina en una sola transacción. "
        "Rechaza ejecuciones concurrentes con 409."
    ),
)
async def sincronizar_ausencias_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["operativo", "gerente", "supervisor", "director"])
    ),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    if _sync_ausencias_lock.locked():
        raise ConflictError(
            "Ya hay una sincronización de faltas y retardos en curso. "
            "Espera a que termine e inténtalo de nuevo."
        )

    async with _sync_ausencias_lock:
        stats = await SyncAusenciasService(db).sincronizar_semana_anterior(execute=True)
        assert stats.fecha_inicio is not None and stats.fecha_fin is not None
        return FaltasRetardosSyncAusenciasResponse(
            fecha_inicio=stats.fecha_inicio,
            fecha_fin=stats.fecha_fin,
            id_semana=stats.id_semana,
            leidos=stats.leidos,
            insertados=stats.insertados,
            actualizados=stats.actualizados,
            eliminados=stats.eliminados,
            omitidos_sin_empleado=stats.omitidos_sin_empleado,
            omitidos_sin_semana=stats.omitidos_sin_semana,
            omitidos_incompletos=stats.omitidos_incompletos,
            omitidos_sin_cambio=stats.omitidos_sin_cambio,
        )


@router.post("", response_model=FaltaRetardoResponse, status_code=status.HTTP_201_CREATED)
async def create_falta_retardo(
    body: FaltaRetardoCreateRequest,
    current_user: Empleado = Depends(
        role_checker(["operativo", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: FaltasRetardosService = Depends(_svc),
):
    return await svc.crear_evento(body, current_user, rh_ui_mode=rh_ui_mode)
