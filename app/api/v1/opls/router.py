"""Router del modulo Manejo de OPLs.

Gestion RH-gated (modulo 'opls', role_checker(["operativo"])). Aprobacion
self-service: /mis-aprobaciones y /aprobaciones/{id}/(aprobar|regresar) usan
current_user.empleado_id (nunca un id del body); sus prefijos estan en
RH_SELF_SERVICE_API_PREFIXES (/mis-aprobaciones y /aprobaciones).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    OPLConVersionesResponse,
    OPLCreate,
    OPLUpdate,
    OPLVersionAgregar,
)
from app.services.opl_service import OPLService

router = APIRouter(prefix="/api/v1/level-up/opls", tags=["Level Up - OPLs"])


def _svc(db: AsyncSession = Depends(get_db)) -> OPLService:
    return OPLService(db)


# ── Self-service (aprobador) — antes de /{opl_id} para no colisionar ──
@router.get("/mis-aprobaciones", response_model=list[OPLConVersionesResponse])
async def mis_aprobaciones(
    current_user: Empleado = Depends(get_current_user),
    svc: OPLService = Depends(_svc),
):
    return await svc.mis_aprobaciones_pendientes(current_user.empleado_id)


@router.post("/aprobaciones/{opl_id}/aprobar", response_model=OPLConVersionesResponse)
async def aprobar(
    opl_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: OPLService = Depends(_svc),
):
    return await svc.aprobar(opl_id, current_user.empleado_id)


@router.post("/aprobaciones/{opl_id}/regresar", response_model=OPLConVersionesResponse)
async def regresar(
    opl_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: OPLService = Depends(_svc),
):
    return await svc.regresar_a_borrador(opl_id, current_user.empleado_id)


# ── Gestion (RH) ──
@router.get("", response_model=list[OPLConVersionesResponse])
async def listar(
    codigo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    proceso: Optional[str] = Query(None),
    maquina: Optional[str] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.listar(codigo=codigo, estado=estado, proceso=proceso, maquina=maquina)


@router.post("", response_model=OPLConVersionesResponse, status_code=status.HTTP_201_CREATED)
async def crear(
    data: OPLCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.crear(data)


@router.get("/{opl_id}", response_model=OPLConVersionesResponse)
async def obtener(
    opl_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.obtener(opl_id)


@router.put("/{opl_id}", response_model=OPLConVersionesResponse)
async def actualizar(
    opl_id: int, data: OPLUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.actualizar(opl_id, data)


@router.delete("/{opl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    opl_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    await svc.eliminar(opl_id)


@router.post("/{opl_id}/versiones", response_model=OPLConVersionesResponse)
async def agregar_version(
    opl_id: int, data: OPLVersionAgregar,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.agregar_version(opl_id, data, current_user.empleado_id)


@router.post("/{opl_id}/enviar-a-revision", response_model=OPLConVersionesResponse)
async def enviar_a_revision(
    opl_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: OPLService = Depends(_svc),
):
    return await svc.enviar_a_revision(opl_id)
