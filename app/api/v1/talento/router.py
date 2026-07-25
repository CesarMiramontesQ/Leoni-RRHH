"""Router del Dashboard de Talento (consolidacion por area, solo lectura).

Acceso combinado, mismo patron que Operaciones (`_gestion_or_equipo`): RH con el
modulo 'dashboard-talento' en modo operativo, O jefe con scoping de equipo. No es
self-service. El scope real lo resuelve `TalentoService` con SU module_key.

Un endpoint por bloque a proposito: el bloque de historial objetivo consulta
DATOS_ANALISIS y, si esa BD no responde, solo esa llamada falla.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_rh_ui_mode,
    gestor_team_role_checker,
    role_checker,
)
from app.models.empleados import Empleado
from app.schemas.talento import (
    BloqueCapacitacionResponse,
    BloqueDesempenoResponse,
    BloqueObjetivoResponse,
    BloquePdiResponse,
    BloquePolivalenciaResponse,
    DetalleAreaResponse,
)
from app.services.talento_service import TalentoService

router = APIRouter(prefix="/api/v1/talento", tags=["talento"])


def _gestion_or_equipo():
    """RH con el modulo O jefe con scoping de equipo. Copia deliberada del
    patron de `app/api/v1/operaciones/router.py`: si el primero rechaza (RH sin
    modulo / no admin operativo), se intenta el segundo."""
    rh_dep = role_checker(["operativo"])
    equipo_dep = gestor_team_role_checker(["supervisor", "gerente"])

    async def check(
        request: Request,
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    ) -> Empleado:
        try:
            return await rh_dep(
                request=request, current_user=current_user, db=db, rh_ui_mode=rh_ui_mode
            )
        except HTTPException:
            return await equipo_dep(current_user=current_user, rh_ui_mode=rh_ui_mode)

    return check


@router.get("/desempeno", response_model=BloqueDesempenoResponse)
async def bloque_desempeno(
    ciclo_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_desempeno(current_user, rh_ui_mode, ciclo_id)


@router.get("/polivalencia", response_model=BloquePolivalenciaResponse)
async def bloque_polivalencia(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_polivalencia(current_user, rh_ui_mode)


@router.get("/capacitacion", response_model=BloqueCapacitacionResponse)
async def bloque_capacitacion(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_capacitacion(current_user, rh_ui_mode)


@router.get("/pdi", response_model=BloquePdiResponse)
async def bloque_pdi(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_pdi(current_user, rh_ui_mode)


@router.get("/objetivo", response_model=BloqueObjetivoResponse)
async def bloque_objetivo(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    area_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_objetivo(
        current_user, rh_ui_mode, desde, hasta, area_id
    )


@router.get("/areas/{area_id}/detalle", response_model=DetalleAreaResponse)
async def detalle_area(
    area_id: int,
    ciclo_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).detalle_area(current_user, rh_ui_mode, area_id, ciclo_id)
