"""Router del Motor de Evidencias de Capacitacion.

Gestion RH-gated (modulo 'evidencias', role_checker(["operativo"])). La firma es
self-service: /mis-firmas y /firmas/{id}/firmar usan current_user.empleado_id
(nunca un id del body); sus prefijos estan en RH_SELF_SERVICE_API_PREFIXES.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion_service import EvidenciaCapacitacionService

router = APIRouter(prefix="/api/v1/level-up/evidencias", tags=["Level Up - Evidencias"])


def _svc(db: AsyncSession = Depends(get_db)) -> EvidenciaCapacitacionService:
    return EvidenciaCapacitacionService(db)


# ── Self-service (firmante) — antes de /{id} para no colisionar ──
@router.get("/mis-firmas", response_model=list[EvidenciaConFirmasResponse])
async def mis_firmas(
    current_user: Empleado = Depends(get_current_user),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.mis_firmas_pendientes(current_user.empleado_id)


@router.post("/firmas/{firma_id}/firmar", response_model=EvidenciaConFirmasResponse)
async def firmar(
    firma_id: int, data: FirmarRequest,
    current_user: Empleado = Depends(get_current_user),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.firmar(firma_id, current_user.empleado_id, data)


# ── Gestion (RH) ──
@router.get("", response_model=list[EvidenciaConFirmasResponse])
async def listar(
    empleado_id: Optional[int] = Query(None),
    capacitacion_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.listar(empleado_id=empleado_id, capacitacion_id=capacitacion_id, estado=estado)


@router.post("", response_model=EvidenciaConFirmasResponse, status_code=status.HTTP_201_CREATED)
async def crear(
    data: EvidenciaCrearRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.crear(data)


@router.get("/{evidencia_id}", response_model=EvidenciaConFirmasResponse)
async def obtener(
    evidencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.obtener(evidencia_id)


@router.put("/{evidencia_id}", response_model=EvidenciaConFirmasResponse)
async def actualizar(
    evidencia_id: int, data: EvidenciaCapacitacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.actualizar(evidencia_id, data)


@router.delete("/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    evidencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    await svc.eliminar(evidencia_id)


@router.post("/{evidencia_id}/firmantes", response_model=EvidenciaConFirmasResponse)
async def agregar_firmante(
    evidencia_id: int, data: FirmanteAsignar,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.agregar_firmante(evidencia_id, data)


@router.delete("/firmantes/{firma_id}", response_model=EvidenciaConFirmasResponse)
async def quitar_firmante(
    firma_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.quitar_firmante(firma_id)
