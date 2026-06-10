from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.horas_extra import HorasExtraListResponse, HorasExtraTabFiltro
from app.services.horas_extra_service import HorasExtraService

router = APIRouter(prefix="/api/v1/nominas", tags=["Nóminas"])

_ROLES_HORAS_EXTRA = ["rh", "director", "gerente"]


def _svc(db: AsyncSession = Depends(get_db)) -> HorasExtraService:
    return HorasExtraService(db)


@router.get("/horas-extra", response_model=HorasExtraListResponse)
async def list_horas_extra(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    tab: HorasExtraTabFiltro = Query("todos"),
    q: str | None = Query(None),
    centrocosto_id: int | None = Query(None),
    lider_empleado_id: int | None = Query(None),
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
        centrocosto_id=centrocosto_id,
        lider_empleado_id=lider_empleado_id,
    )
