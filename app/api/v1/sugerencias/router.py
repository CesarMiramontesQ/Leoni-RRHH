"""Router del Motor de Sugerencias de Capacitacion (RH-gated, modulo 'sugerencias')."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
from app.services.sugerencia_capacitacion_service import SugerenciaCapacitacionService

router = APIRouter(
    prefix="/api/v1/level-up/sugerencias", tags=["Level Up - Sugerencias"]
)


def _svc(db: AsyncSession = Depends(get_db)) -> SugerenciaCapacitacionService:
    return SugerenciaCapacitacionService(db)


@router.get("", response_model=list[SugerenciaCapacitacionResponse])
async def listar(
    estado: Optional[str] = Query(None),
    prioridad: Optional[int] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.listar(estado=estado, prioridad=prioridad)


@router.post("", response_model=SugerenciaCapacitacionResponse, status_code=status.HTTP_201_CREATED)
async def crear(
    data: SugerenciaCapacitacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.crear(data)


@router.put("/{sugerencia_id}", response_model=SugerenciaCapacitacionResponse)
async def actualizar(
    sugerencia_id: int,
    data: SugerenciaCapacitacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.actualizar(sugerencia_id, data)


@router.delete("/{sugerencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    sugerencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    await svc.eliminar(sugerencia_id)


@router.post("/generar-desde-brechas", response_model=list[SugerenciaCapacitacionResponse])
async def generar_desde_brechas(
    data: GenerarDesdeBrechasRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.generar_desde_brechas(
        data.area_id, data.umbral_brecha, current_user_id=current_user.empleado_id
    )
