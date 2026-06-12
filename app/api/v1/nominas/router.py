from fastapi import APIRouter, Depends, Query
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.horas_extra import HorasExtraListResponse, HorasExtraTabFiltro
from app.schemas.horas_extra_solicitud import HorasExtraSolicitudResponse
from app.schemas.nominas_ajustes import (
    HorasExtraAprobadoresCreate,
    HorasExtraAprobadoresListResponse,
    HorasExtraAprobadorUpdate,
    HorasExtraAutorizacionUpdate,
    HorasExtraAutorizacionUpdateResponse,
    HorasExtraAutorizadosFiltro,
    HorasExtraAutorizadosListResponse,
)
from app.services.horas_extra_service import HorasExtraService
from app.services.nominas_ajustes_service import NominasAjustesService

router = APIRouter(prefix="/api/v1/nominas", tags=["Nóminas"])

_ROLES_HORAS_EXTRA = ["rh", "director", "gerente"]


def _svc(db: AsyncSession = Depends(get_db)) -> HorasExtraService:
    return HorasExtraService(db)


def _ajustes_svc(db: AsyncSession = Depends(get_db)) -> NominasAjustesService:
    return NominasAjustesService(db)


@router.get("/horas-extra", response_model=HorasExtraListResponse)
async def list_horas_extra(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    tab: HorasExtraTabFiltro = Query("todos"),
    q: str | None = Query(None),
    area_id: int | None = Query(None),
    centrocosto_id: int | None = Query(None),
    lider_empleado_id: int | None = Query(None),
    semana_inicio: date | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user: Empleado = Depends(role_checker(_ROLES_HORAS_EXTRA)),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: HorasExtraService = Depends(_svc),
):
    return await svc.listar(
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
        page=page,
        page_size=page_size,
        tab=tab,
        q=q,
        area_id=area_id,
        centrocosto_id=centrocosto_id,
        lider_empleado_id=lider_empleado_id,
        semana_inicio=semana_inicio,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )


@router.get(
    "/horas-extra/{solicitud_id}",
    response_model=HorasExtraSolicitudResponse,
)
async def get_horas_extra_detalle(
    solicitud_id: int,
    current_user: Empleado = Depends(role_checker(_ROLES_HORAS_EXTRA)),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: HorasExtraService = Depends(_svc),
):
    return await svc.obtener_detalle(
        solicitud_id,
        current_user=current_user,
        rh_ui_mode=rh_ui_mode,
    )


@router.get(
    "/ajustes/horas-extra/autorizados",
    response_model=HorasExtraAutorizadosListResponse,
)
async def list_horas_extra_autorizados(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None),
    filtro: HorasExtraAutorizadosFiltro = Query("todos"),
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.listar_autorizados(
        q=q, filtro=filtro, page=page, page_size=page_size
    )


@router.put(
    "/ajustes/horas-extra/autorizados",
    response_model=HorasExtraAutorizacionUpdateResponse,
)
async def update_horas_extra_autorizados(
    body: HorasExtraAutorizacionUpdate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.actualizar_autorizacion(body, current_user)


@router.get(
    "/ajustes/horas-extra/aprobadores",
    response_model=HorasExtraAprobadoresListResponse,
)
async def list_horas_extra_aprobadores(
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.listar_aprobadores()


@router.post(
    "/ajustes/horas-extra/aprobadores",
    response_model=HorasExtraAprobadoresListResponse,
    status_code=201,
)
async def create_horas_extra_aprobadores(
    body: HorasExtraAprobadoresCreate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.crear_aprobadores(body, current_user)


@router.patch(
    "/ajustes/horas-extra/aprobadores/{aprobador_id}",
    response_model=HorasExtraAprobadoresListResponse,
)
async def update_horas_extra_aprobador(
    aprobador_id: int,
    body: HorasExtraAprobadorUpdate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.actualizar_aprobador(aprobador_id, body)


@router.delete(
    "/ajustes/horas-extra/aprobadores/{aprobador_id}",
    response_model=HorasExtraAprobadoresListResponse,
)
async def delete_horas_extra_aprobador(
    aprobador_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    svc: NominasAjustesService = Depends(_ajustes_svc),
):
    return await svc.eliminar_aprobador(aprobador_id)
