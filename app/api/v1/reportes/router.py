# app/api/v1/reportes/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.services.reporte_service import ReporteService

router = APIRouter(prefix="/api/v1/reportes", tags=["Reportes y Exportacion"])


@router.get("/dashboard/kpis")
async def get_kpis(
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.get_kpis(current_user=current_user)


@router.get("/{modulo}/pdf")
async def export_pdf(
    modulo: str,
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.exportar_pdf(modulo=modulo, current_user=current_user)


@router.get("/{modulo}/excel")
async def export_excel(
    modulo: str,
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
    db: AsyncSession = Depends(get_db),
):
    service = ReporteService(db)
    return await service.exportar_excel(modulo=modulo, current_user=current_user)
