from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.incidencias import (
    IncidenciasAreasResponse,
    IncidenciasEstadisticasResponse,
    IncidenciasListPageResponse,
    IncidenciasSubareasResponse,
    IncidenciasTiposResponse,
)
from app.api.v1.incidencias.agent_router import router as incidencias_agent_router
from app.services.incidencia_service import IncidenciaService

router = APIRouter(prefix="/api/v1/incidencias", tags=["Incidencias"])
router.include_router(incidencias_agent_router)


def _svc(db: AsyncSession = Depends(get_db)) -> IncidenciaService:
    return IncidenciaService(db)


@router.get("/")
async def health():
    return {"modulo": "incidencias", "status": "activo", "version": "1.0.0"}


@router.get("", response_model=IncidenciasListPageResponse)
async def list_incidencias(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaService = Depends(_svc),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=10),
    tipo: str | None = Query(None, description="Coincide exactamente con la columna tipo"),
    empleado_id: int | None = Query(None),
    no_empleado: str | None = Query(None),
    nombre: str | None = Query(None),
    fecha: date | None = Query(None),
    categoria: str | None = Query(None),
    area: str | None = Query(None),
    subarea: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
):
    """Listado paginado con filtros; máximo 10 registros por página."""
    return await svc.list_incidencias_paginated(
        current_user,
        page,
        page_size,
        rh_ui_mode=rh_ui_mode,
        tipo=tipo.strip() if tipo and tipo.strip() else None,
        empleado_id=empleado_id,
        no_empleado=no_empleado.strip() if no_empleado and no_empleado.strip() else None,
        nombre=nombre.strip() if nombre and nombre.strip() else None,
        fecha=fecha,
        categoria=categoria.strip() if categoria and categoria.strip() else None,
        area=area.strip() if area and area.strip() else None,
        subarea=subarea.strip() if subarea and subarea.strip() else None,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )


@router.get("/tipos", response_model=IncidenciasTiposResponse)
async def list_incidencias_tipos(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaService = Depends(_svc),
):
    """Valores distintos de `tipo` registrados en el alcance del usuario."""
    items = await svc.list_tipos_registrados(current_user, rh_ui_mode=rh_ui_mode)
    return IncidenciasTiposResponse(items=items)


@router.get("/areas", response_model=IncidenciasAreasResponse)
async def list_incidencias_areas(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaService = Depends(_svc),
):
    """Áreas distintas con incidencias en el alcance del usuario."""
    items = await svc.list_areas_registradas(current_user, rh_ui_mode=rh_ui_mode)
    return IncidenciasAreasResponse(items=items)


@router.get("/subareas", response_model=IncidenciasSubareasResponse)
async def list_incidencias_subareas(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaService = Depends(_svc),
    area: str | None = Query(None, description="Filtra subáreas de esta área (valor exacto del catálogo)"),
):
    """Subáreas distintas con incidencias; opcionalmente acotadas a un área."""
    items = await svc.list_subareas_registradas(current_user, rh_ui_mode=rh_ui_mode, area=area)
    return IncidenciasSubareasResponse(items=items)


@router.get("/estadisticas", response_model=IncidenciasEstadisticasResponse)
async def estadisticas_incidencias(
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaService = Depends(_svc),
    tipo: str | None = Query(None, description="Coincide exactamente con la columna tipo"),
    empleado_id: int | None = Query(None),
    no_empleado: str | None = Query(None),
    nombre: str | None = Query(None),
    fecha: date | None = Query(None),
    categoria: str | None = Query(None),
    area: str | None = Query(None),
    subarea: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    tendencia_agrupacion: str | None = Query(
        None,
        description="Granularidad de tendencia: dia, semana o mes (dashboard RH)",
    ),
):
    """Agregados para analítica (totales, top 10, distribución por tipo) con los mismos filtros que el listado."""
    agr = (tendencia_agrupacion or "").strip().lower() or None
    if agr not in (None, "dia", "semana", "mes"):
        agr = None
    return await svc.estadisticas_incidencias(
        current_user,
        rh_ui_mode=rh_ui_mode,
        tipo=tipo.strip() if tipo and tipo.strip() else None,
        empleado_id=empleado_id,
        no_empleado=no_empleado.strip() if no_empleado and no_empleado.strip() else None,
        nombre=nombre.strip() if nombre and nombre.strip() else None,
        fecha=fecha,
        categoria=categoria.strip() if categoria and categoria.strip() else None,
        area=area.strip() if area and area.strip() else None,
        subarea=subarea.strip() if subarea and subarea.strip() else None,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tendencia_agrupacion=agr,
    )


@router.post("")
async def create_incidencia(
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
):
    return {"message": "Endpoint en desarrollo"}


@router.get("/{id}")
async def get_incidencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "supervisor", "director"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.put("/{id}/estado")
async def update_estado(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.post("/{id}/evidencias")
async def upload_evidencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.get("/{id}/evidencias/{eid}")
async def download_evidencia(
    id: int,
    eid: int,
    current_user: Empleado = Depends(get_current_user),
):
    return {"message": "Endpoint en desarrollo", "incidencia_id": id, "evidencia_id": eid}
