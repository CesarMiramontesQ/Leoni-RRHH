# app/api/v1/evaluaciones/router.py
"""
Router de Evaluaciones de Competencias — Modulo Talento Fase 2.

Endpoints:
  GET  /api/v1/evaluaciones/                      — Listar (paginado, filtros)
  POST /api/v1/evaluaciones/                      — Crear/actualizar evaluacion
  GET  /api/v1/evaluaciones/{id}                  — Detalle
  PUT  /api/v1/evaluaciones/{id}                  — Actualizar
  DELETE /api/v1/evaluaciones/{id}                — Eliminar (RH)
  GET  /api/v1/evaluaciones/empleado/{empleado_id} — Evaluaciones de un empleado
  POST /api/v1/evaluaciones/bulk                  — Bulk create (RH)
"""

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.evaluaciones import (
    EmpleadoResumenResponse,
    EvaluacionBulkCreate,
    EvaluacionCreate,
    EvaluacionListResponse,
    EvaluacionResponse,
    EvaluacionUpdate,
)
from app.schemas.pdi import PDICreate, PDIUpdate, PDIListResponse, PDIResponse, PDIGestionListResponse, PDIGestionItem, PDIResumenResponse, PDIEstadoPatch, PDIProgresoEquipoResponse, EquipoResumenResponse
from app.services.evaluacion_service import EvaluacionService
from app.services.pdi_service import PDIService

router = APIRouter(prefix="/api/v1/evaluaciones", tags=["Evaluaciones"])


# ── Endpoints especiales (antes de /{id}) ───────────────────────────────────


@router.get("/pdi", response_model=PDIGestionListResponse)
async def listar_pdi_consolidado(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    area_id: int | None = Query(None),
    estado: str | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    search: str | None = Query(None),
    solo_vencidas: bool = Query(False),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PDIService(db)
    return await service.listar_consolidado(
        current_user=current_user,
        page=page,
        page_size=page_size,
        area_id=area_id,
        estado=estado,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        search=search,
        solo_vencidas=solo_vencidas,
    )


@router.get("/pdi/resumen", response_model=PDIResumenResponse)
async def resumen_pdi(
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PDIService(db)
    return await service.obtener_resumen(current_user=current_user)


@router.get("/pdi/progreso-equipo", response_model=PDIProgresoEquipoResponse)
async def progreso_equipo_pdi(
    area_id: int | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PDIService(db)
    return await service.progreso_equipo(current_user=current_user, area_id=area_id)


@router.get("/pdi/equipo-resumen", response_model=EquipoResumenResponse)
async def equipo_resumen_pdi(
    area_id: int | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PDIService(db)
    return await service.equipo_resumen(current_user=current_user, area_id=area_id)


@router.patch("/pdi/{pdi_id}/estado", response_model=PDIGestionItem)
async def patch_pdi_estado(
    pdi_id: int,
    body: PDIEstadoPatch,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = PDIService(db)
    return await service.cambiar_estado(
        pdi_id=pdi_id,
        nuevo_estado=body.estado,
        current_user=current_user,
    )


@router.get("/empleado/{empleado_id}", response_model=list[EvaluacionResponse])
async def evaluaciones_por_empleado(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Todas las evaluaciones de un empleado."""
    service = EvaluacionService(db)
    return await service.listar_por_empleado(
        empleado_id=empleado_id, current_user=current_user
    )


@router.get("/empleado/{empleado_id}/resumen", response_model=EmpleadoResumenResponse)
async def resumen_empleado(
    empleado_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resumen de competencias: requeridas vs evaluadas, gaps y cumplimiento %."""
    service = EvaluacionService(db)
    return await service.resumen_empleado(
        empleado_id=empleado_id, current_user=current_user
    )


@router.get("/empleado/{empleado_id}/pdi", response_model=PDIListResponse)
async def listar_pdi(
    empleado_id: int,
    estado: str | None = Query(None),
    competencia_id: int | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Listar acciones PDI de un empleado."""
    service = PDIService(db)
    return await service.listar(
        empleado_id=empleado_id,
        current_user=current_user,
        estado=estado,
        competencia_id=competencia_id,
    )


@router.post(
    "/empleado/{empleado_id}/pdi",
    response_model=PDIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_pdi(
    empleado_id: int,
    body: PDICreate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Crear acción PDI. Solo RH."""
    service = PDIService(db)
    return await service.crear(empleado_id=empleado_id, data=body, current_user=current_user)


@router.put("/empleado/{empleado_id}/pdi/{pdi_id}", response_model=PDIResponse)
async def actualizar_pdi(
    empleado_id: int,
    pdi_id: int,
    body: PDIUpdate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar acción PDI. Solo RH."""
    service = PDIService(db)
    return await service.actualizar(
        empleado_id=empleado_id, pdi_id=pdi_id, data=body, current_user=current_user
    )


@router.delete("/empleado/{empleado_id}/pdi/{pdi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_pdi(
    empleado_id: int,
    pdi_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar acción PDI. Solo RH."""
    service = PDIService(db)
    await service.eliminar(empleado_id=empleado_id, pdi_id=pdi_id, current_user=current_user)


@router.post("/bulk", status_code=status.HTTP_200_OK)
async def bulk_evaluaciones(
    body: EvaluacionBulkCreate,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Crear/actualizar multiples evaluaciones en batch. Solo RH."""
    service = EvaluacionService(db)
    return await service.bulk_crear(data=body, current_user=current_user)


# ── CRUD ────────────────────────────────────────────────────────────────────


@router.get("", response_model=EvaluacionListResponse)
async def listar_evaluaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    empleado_id: int | None = Query(None),
    competencia_id: int | None = Query(None),
    area_id: int | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista evaluaciones con paginacion y filtros."""
    service = EvaluacionService(db)
    return await service.listar(
        page=page,
        page_size=page_size,
        empleado_id=empleado_id,
        competencia_id=competencia_id,
        area_id=area_id,
    )


@router.post(
    "",
    response_model=EvaluacionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_evaluacion(
    body: EvaluacionCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Crear o actualizar evaluacion. RH o supervisor (solo su area)."""
    service = EvaluacionService(db)
    return await service.crear(data=body, current_user=current_user)


@router.get("/{id}", response_model=EvaluacionResponse)
async def obtener_evaluacion(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una evaluacion."""
    service = EvaluacionService(db)
    return await service.obtener(id=id)


@router.put("/{id}", response_model=EvaluacionResponse)
async def actualizar_evaluacion(
    id: int,
    body: EvaluacionUpdate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar evaluacion. RH o supervisor (solo su area)."""
    service = EvaluacionService(db)
    return await service.actualizar(id=id, data=body, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_evaluacion(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar evaluacion. Solo RH."""
    service = EvaluacionService(db)
    await service.eliminar(id=id, current_user=current_user)
