from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.horas_extra_solicitud import (
    HorasExtraSolicitudCreate,
    HorasExtraSolicitudEstadisticasResponse,
    HorasExtraSolicitudListResponse,
    HorasExtraSolicitudOpcionesResponse,
    HorasExtraSolicitudResponse,
)
from app.services.horas_extra_solicitud_service import HorasExtraSolicitudService

router = APIRouter(prefix="/api/v1/horas-extra", tags=["Horas Extra"])


def _svc(db: AsyncSession = Depends(get_db)) -> HorasExtraSolicitudService:
    return HorasExtraSolicitudService(db)


@router.get("/solicitudes/opciones", response_model=HorasExtraSolicitudOpcionesResponse)
async def horas_extra_solicitud_opciones(
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    svc: HorasExtraSolicitudService = Depends(_svc),
):
    return await svc.obtener_opciones(current_user)


@router.get(
    "/solicitudes/estadisticas",
    response_model=HorasExtraSolicitudEstadisticasResponse,
)
async def horas_extra_solicitud_estadisticas(
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    svc: HorasExtraSolicitudService = Depends(_svc),
):
    return await svc.obtener_estadisticas(current_user)


@router.get("/solicitudes", response_model=HorasExtraSolicitudListResponse)
async def horas_extra_solicitud_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    svc: HorasExtraSolicitudService = Depends(_svc),
):
    return await svc.listar_mis_solicitudes(
        current_user, page=page, page_size=page_size
    )


@router.post(
    "/solicitudes",
    response_model=HorasExtraSolicitudResponse,
    status_code=201,
)
async def horas_extra_solicitud_create(
    body: HorasExtraSolicitudCreate,
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    svc: HorasExtraSolicitudService = Depends(_svc),
):
    return await svc.crear(body, current_user)


@router.get("/solicitudes/{solicitud_id}", response_model=HorasExtraSolicitudResponse)
async def horas_extra_solicitud_detalle(
    solicitud_id: int,
    current_user: Empleado = Depends(role_checker(["supervisor"])),
    svc: HorasExtraSolicitudService = Depends(_svc),
):
    return await svc.obtener_detalle(solicitud_id, current_user)
