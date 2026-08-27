"""Contratos del personal (`/api/v1/contratos`).

Prefijo propio porque `role_checker` resuelve el módulo RH por prefijo más largo: aquí
manda el módulo `contratos` (Permisos RH) vía `role_checker(["operativo"])`. Lee solo la
caché de Bono; nunca DATOS_ANALISIS.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.core.exceptions import NotFoundError
from app.models.empleados import Empleado
from app.schemas.contratos import (
    VENTANA_DIAS_DEFAULT,
    VENTANA_DIAS_MAX,
    ContratoAreaOption,
    ContratoEmpleadoResumen,
    ContratosKpisResponse,
    ContratosListResponse,
    EstatusContrato,
)
from app.services.contratos_service import ContratosService

router = APIRouter(prefix="/api/v1/contratos", tags=["Contratos"])


def _svc(db: AsyncSession = Depends(get_db)) -> ContratosService:
    return ContratosService(db)


_VENTANA = Query(VENTANA_DIAS_DEFAULT, ge=1, le=VENTANA_DIAS_MAX)


@router.get("", response_model=ContratosListResponse)
async def list_contratos(
    ventana_dias: int = _VENTANA,
    estatus: EstatusContrato | None = None,
    area_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ContratosService = Depends(_svc),
):
    """Empleados activos con su contrato actual, ordenados por vencimiento (NULL al final)."""
    return await svc.listar(
        ventana_dias=ventana_dias,
        estatus=estatus,
        area_id=area_id,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.get("/kpis", response_model=ContratosKpisResponse)
async def kpis_contratos(
    ventana_dias: int = _VENTANA,
    area_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ContratosService = Depends(_svc),
):
    """Conteo por estatus (excluyentes; suman `total`). Respeta área y búsqueda, no el estatus."""
    return await svc.kpis(ventana_dias=ventana_dias, area_id=area_id, q=q)


@router.get("/areas", response_model=list[ContratoAreaOption])
async def areas_contratos(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ContratosService = Depends(_svc),
):
    """Áreas con personal activo en la caché, para el filtro del listado."""
    return await svc.areas()


@router.get("/export.csv")
async def exportar_contratos_csv(
    ventana_dias: int = _VENTANA,
    estatus: EstatusContrato | None = None,
    area_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ContratosService = Depends(_svc),
):
    """El listado filtrado completo como CSV (mismas columnas que la tabla)."""
    contenido = await svc.exportar_csv(
        ventana_dias=ventana_dias, estatus=estatus, area_id=area_id, q=q
    )
    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contratos.csv"'},
    )


@router.get("/empleados/{no_empleado}", response_model=ContratoEmpleadoResumen)
async def contrato_empleado(
    no_empleado: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: ContratosService = Depends(_svc),
):
    """Contrato actual de un empleado. 404 si no está en la caché."""
    resumen = await svc.resumen_empleado(no_empleado)
    if resumen is None:
        raise NotFoundError("El empleado no tiene contrato sincronizado.")
    return resumen
