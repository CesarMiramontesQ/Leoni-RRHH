# app/api/v1/reportes/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.services.reporte_service import ReporteService

router = APIRouter(prefix="/api/v1/reportes", tags=["Reportes y Exportacion"])


@router.get("/dashboard/kpis")
async def get_kpis(
    current_user: Empleado = Depends(role_checker(["operativo", "gerente", "director"])),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.get_kpis(current_user=current_user, rh_ui_mode=rh_ui_mode)


@router.get("/{modulo}/pdf")
async def export_pdf(
    modulo: str,
    current_user: Empleado = Depends(role_checker(["operativo", "gerente", "director"])),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.exportar_pdf(
        modulo=modulo, current_user=current_user, rh_ui_mode=rh_ui_mode
    )


@router.get("/{modulo}/excel")
async def export_excel(
    modulo: str,
    current_user: Empleado = Depends(role_checker(["operativo", "gerente", "director"])),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.exportar_excel(
        modulo=modulo, current_user=current_user, rh_ui_mode=rh_ui_mode
    )
