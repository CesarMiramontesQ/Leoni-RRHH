from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosEstadisticasResponse,
    FaltasRetardosPageResponse,
    FaltasRetardosTiposResponse,
)
from app.services.faltas_retardos_service import FaltasRetardosService

router = APIRouter(prefix="/api/v1/faltas-retardos", tags=["Faltas y retardos"])


def _svc(db: AsyncSession = Depends(get_db)) -> FaltasRetardosService:
    return FaltasRetardosService(db)


@router.get("/")
async def health():
    return {"modulo": "faltas-retardos", "status": "activo", "version": "1.0.0"}


@router.get("", response_model=FaltasRetardosPageResponse)
async def list_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
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
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    svc: FaltasRetardosService = Depends(_svc),
):
    return FaltasRetardosTiposResponse(items=svc.list_tipos())


@router.get("/estadisticas", response_model=FaltasRetardosEstadisticasResponse)
async def estadisticas_faltas_retardos(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: FaltasRetardosService = Depends(_svc),
    empleado_id: int | None = Query(None),
    tipo: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    busqueda: str | None = Query(None, description="Nombre o número de empleado"),
):
    return await svc.estadisticas_eventos(
        current_user,
        rh_ui_mode=rh_ui_mode,
        empleado_id=empleado_id,
        tipo=tipo.strip() if tipo and tipo.strip() else None,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        busqueda=busqueda.strip() if busqueda and busqueda.strip() else None,
    )


@router.post("", response_model=FaltaRetardoResponse, status_code=status.HTTP_201_CREATED)
async def create_falta_retardo(
    body: FaltaRetardoCreateRequest,
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: FaltasRetardosService = Depends(_svc),
):
    return await svc.crear_evento(body, current_user, rh_ui_mode=rh_ui_mode)
