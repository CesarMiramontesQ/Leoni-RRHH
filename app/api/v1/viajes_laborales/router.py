from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.viajes_laborales import (
    ViajeLaboralCreate,
    ViajeLaboralRechazarRequest,
    ViajeLaboralResponse,
    ViajeLaboralUpdate,
    ViajesLaboralesEstadisticasResponse,
    ViajesLaboralesEstadosResponse,
    ViajesLaboralesPageResponse,
)
from app.services.viajes_laborales_service import ViajesLaboralesService

router = APIRouter(prefix="/api/v1/viajes-laborales", tags=["Viajes laborales"])


def _svc(db: AsyncSession = Depends(get_db)) -> ViajesLaboralesService:
    return ViajesLaboralesService(db)


@router.get("/")
async def health():
    return {"modulo": "viajes-laborales", "status": "activo", "version": "1.0.0"}


@router.get("", response_model=ViajesLaboralesPageResponse)
async def list_viajes_laborales(
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    empleado_id: int | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    destino: str | None = Query(None, description="Filtro por lugar de destino"),
    estado: str | None = Query(None),
    busqueda: str | None = Query(None, description="Nombre o número de empleado"),
):
    return await svc.list_viajes(
        current_user,
        page=page,
        page_size=page_size,
        rh_ui_mode=rh_ui_mode,
        empleado_id=empleado_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        destino=destino.strip() if destino and destino.strip() else None,
        estado=estado.strip() if estado and estado.strip() else None,
        busqueda=busqueda.strip() if busqueda and busqueda.strip() else None,
    )


@router.get("/estados", response_model=ViajesLaboralesEstadosResponse)
async def list_estados_viajes_laborales(
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return ViajesLaboralesEstadosResponse(items=svc.list_estados())


@router.get("/estadisticas", response_model=ViajesLaboralesEstadisticasResponse)
async def estadisticas_viajes_laborales(
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
    empleado_id: int | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    destino: str | None = Query(None),
    estado: str | None = Query(None),
    busqueda: str | None = Query(None),
):
    return await svc.estadisticas(
        current_user,
        rh_ui_mode=rh_ui_mode,
        empleado_id=empleado_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        destino=destino.strip() if destino and destino.strip() else None,
        estado=estado.strip() if estado and estado.strip() else None,
        busqueda=busqueda.strip() if busqueda and busqueda.strip() else None,
    )


@router.get("/{id}", response_model=ViajeLaboralResponse)
async def get_viaje_laboral(
    id: int,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.obtener(id, current_user, rh_ui_mode=rh_ui_mode)


@router.post("", response_model=ViajeLaboralResponse, status_code=status.HTTP_201_CREATED)
async def create_viaje_laboral(
    body: ViajeLaboralCreate,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.crear(body, current_user, rh_ui_mode=rh_ui_mode)


@router.patch("/{id}", response_model=ViajeLaboralResponse)
async def update_viaje_laboral(
    id: int,
    body: ViajeLaboralUpdate,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.actualizar(id, body, current_user, rh_ui_mode=rh_ui_mode)


@router.put("/{id}/enviar", response_model=ViajeLaboralResponse)
async def enviar_viaje_laboral(
    id: int,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.enviar(id, current_user, rh_ui_mode=rh_ui_mode)


@router.put("/{id}/aprobar", response_model=ViajeLaboralResponse)
async def aprobar_viaje_laboral(
    id: int,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.aprobar(id, current_user, rh_ui_mode=rh_ui_mode)


@router.put("/{id}/rechazar", response_model=ViajeLaboralResponse)
async def rechazar_viaje_laboral(
    id: int,
    body: ViajeLaboralRechazarRequest,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.rechazar(id, body, current_user, rh_ui_mode=rh_ui_mode)


@router.put("/{id}/cancelar", response_model=ViajeLaboralResponse)
async def cancelar_viaje_laboral(
    id: int,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    return await svc.cancelar(id, current_user, rh_ui_mode=rh_ui_mode)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_viaje_laboral(
    id: int,
    current_user: Empleado = Depends(
        role_checker(["operativo"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: ViajesLaboralesService = Depends(_svc),
):
    await svc.eliminar(id, current_user, rh_ui_mode=rh_ui_mode)
