"""KPIs personales de nómina para el dashboard (empleado, supervisor y gerente)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.empleados import Empleado
from app.schemas.dashboard_kpis import DashboardKpisResponse
from app.services.dashboard_kpis_service import obtener_kpis_dashboard

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/mis-kpis", response_model=DashboardKpisResponse)
async def get_mis_kpis(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardKpisResponse:
    """Vacaciones (disponibles y tomadas del ciclo) y home office del año.

    Las vacaciones salen de `levelup_vacaciones_disponibles` (Bono), sincronizada desde
    TRESS; solo el home office consulta datos-analisis.

    Autoservicio: siempre son los del usuario autenticado — no recibe `empleado_id`, así
    que no hay forma de pedir los de otra persona.

    Responde 200 aunque falte el dato; en ese caso `disponible=false` y los valores vienen
    en `null` (ver `dashboard_kpis_service`).
    """
    return await obtener_kpis_dashboard(db, no_empleado=current_user.no_empleado)
