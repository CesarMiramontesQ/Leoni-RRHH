"""Router del modulo Operaciones (analitica de cobertura y polivalencia).

Gestion RH/jefatura, solo lectura. Acceso combinado (patron real de
`app/api/v1/metas/router.py`, `_gestion_or_equipo`): RH con modulo
'operaciones' en modo operativo (sin scoping, `role_checker(["operativo"])`)
O jefe (supervisor/gerente nativo, o admin/RH legacy en Modo lider/gerente)
con scoping de equipo (`gestor_team_role_checker`). No es self-service. El
scope real por rol lo resuelve el service via `empleado_ids_scope_por_modulo`.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_rh_ui_mode,
    gestor_team_role_checker,
    role_checker,
)
from app.models.empleados import Empleado
from app.schemas.operaciones import AreaResumenSchema, CoberturaAreaResponse
from app.services.operaciones_service import OperacionesService

router = APIRouter(prefix="/api/v1/operaciones", tags=["operaciones"])


def _gestion_or_equipo():
    """RH con modulo 'operaciones' (`role_checker(["operativo"])`) O jefe con
    scoping de equipo (`gestor_team_role_checker`). Reutiliza ambos factories
    de `app/core/dependencies.py` sin duplicar su logica; si el primero
    rechaza (RH sin modulo / no admin operativo), se intenta el segundo."""
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


@router.get("/areas", response_model=list[AreaResumenSchema])
async def list_areas(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await OperacionesService(db).listar_areas(current_user, rh_ui_mode)


@router.get("/areas/{area_id}/cobertura", response_model=CoberturaAreaResponse)
async def cobertura_area(
    area_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await OperacionesService(db).cobertura_area(current_user, area_id, rh_ui_mode)


@router.get("/areas/{area_id}/export")
async def export_area(
    area_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    output = await OperacionesService(db).exportar_area_excel(current_user, area_id, rh_ui_mode)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=cobertura_area_{area_id}.xlsx"},
    )
