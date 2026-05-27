# app/api/v1/perfil_funciones/router.py
"""
Router de Perfil de Funciones — gestion de tareas, cualificaciones,
competencias requeridas, asignaciones y evaluaciones por puesto.

Endpoints:
  ── Tareas ──
  GET    /api/v1/perfiles/{perfil_id}/tareas
  POST   /api/v1/perfiles/{perfil_id}/tareas
  PUT    /api/v1/perfiles/{perfil_id}/tareas/{tarea_id}
  PUT    /api/v1/perfiles/{perfil_id}/tareas/reorder
  DELETE /api/v1/perfiles/{perfil_id}/tareas/{tarea_id}

  ── Cualificaciones ──
  GET    /api/v1/perfiles/{perfil_id}/cualificaciones
  POST   /api/v1/perfiles/{perfil_id}/cualificaciones
  PUT    /api/v1/perfiles/{perfil_id}/cualificaciones/{cualificacion_id}
  DELETE /api/v1/perfiles/{perfil_id}/cualificaciones/{cualificacion_id}

  ── Competencias Requeridas (tabla unificada competencia_requisitos) ──
  GET    /api/v1/perfiles/{perfil_id}/competencias
  POST   /api/v1/perfiles/{perfil_id}/competencias

  ── Asignaciones ──
  GET    /api/v1/perfiles/{perfil_id}/asignaciones
  POST   /api/v1/perfiles/{perfil_id}/asignaciones
  GET    /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}
  PUT    /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}
  DELETE /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}
  POST   /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}/firmar

  ── Tareas Extra (per-employee) ──
  GET    /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra
  POST   /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra
  DELETE /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra/{tarea_extra_id}
"""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.perfil_funciones import (
    PerfilCompetenciaCreate,
    PerfilCompetenciaResponse,
    PerfilCualificacionCreate,
    PerfilCualificacionResponse,
    PerfilCualificacionUpdate,
    PerfilFuncionesCompetenciaCreate,
    PerfilFuncionesCualificacionCreate,
    PerfilFuncionesCreate,
    PerfilFuncionesResponse,
    PerfilFuncionesTareaCreate,
    PerfilFuncionesTareaResponse,
    PerfilFuncionesUpdate,
    PerfilTareaCreate,
    PerfilTareaResponse,
    PerfilTareaUpdate,
)
from app.core.catalogos_cualificacion import CATALOGO_ESCOLARIDAD
from app.services.perfil_funciones_service import PerfilFuncionesService

router = APIRouter(prefix="/api/v1/perfiles", tags=["Perfil de Funciones"])


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGOS (rutas estáticas antes de {perfil_id})
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/catalogos/escolaridad")
async def obtener_catalogo_escolaridad():
    """Retorna el catálogo de niveles de escolaridad."""
    return [
        {"key": k, "label": v["label"], "peso": v["peso"]}
        for k, v in CATALOGO_ESCOLARIDAD.items()
    ]


# ══════════════════════════════════════════════════════════════════════════════
# TAREAS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{perfil_id}/tareas", response_model=list[PerfilTareaResponse])
async def listar_tareas(
    perfil_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todas las tareas de un perfil de puesto."""
    service = PerfilFuncionesService(db)
    return await service.listar_tareas(perfil_id=perfil_id)


@router.post(
    "/{perfil_id}/tareas",
    response_model=PerfilTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_tarea(
    perfil_id: int,
    body: PerfilTareaCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una tarea para el perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_tarea(perfil_id=perfil_id, data=body, current_user=current_user)


class ReorderItem(BaseModel):
    id: int
    orden: int


@router.put("/{perfil_id}/tareas/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reordenar_tareas(
    perfil_id: int,
    body: list[ReorderItem],
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Reordena tareas del perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    await service.reordenar_tareas(perfil_id=perfil_id, items=body, current_user=current_user)


@router.put("/{perfil_id}/tareas/{tarea_id}", response_model=PerfilTareaResponse)
async def actualizar_tarea(
    perfil_id: int,
    tarea_id: int,
    body: PerfilTareaUpdate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una tarea del perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.actualizar_tarea(
        perfil_id=perfil_id, tarea_id=tarea_id, data=body, current_user=current_user
    )


@router.delete("/{perfil_id}/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tarea(
    perfil_id: int,
    tarea_id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina una tarea del perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    await service.eliminar_tarea(perfil_id=perfil_id, tarea_id=tarea_id, current_user=current_user)


# ══════════════════════════════════════════════════════════════════════════════
# CUALIFICACIONES
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{perfil_id}/cualificaciones", response_model=list[PerfilCualificacionResponse])
async def listar_cualificaciones(
    perfil_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todas las cualificaciones requeridas del perfil."""
    service = PerfilFuncionesService(db)
    return await service.listar_cualificaciones(perfil_id=perfil_id)


@router.post(
    "/{perfil_id}/cualificaciones",
    response_model=PerfilCualificacionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_cualificacion(
    perfil_id: int,
    body: PerfilCualificacionCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una cualificacion para el perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_cualificacion(
        perfil_id=perfil_id, data=body, current_user=current_user
    )


@router.put(
    "/{perfil_id}/cualificaciones/{cualificacion_id}",
    response_model=PerfilCualificacionResponse,
)
async def actualizar_cualificacion(
    perfil_id: int,
    cualificacion_id: int,
    body: PerfilCualificacionUpdate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una cualificacion del perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.actualizar_cualificacion(
        perfil_id=perfil_id,
        cualificacion_id=cualificacion_id,
        data=body,
        current_user=current_user,
    )


@router.delete(
    "/{perfil_id}/cualificaciones/{cualificacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_cualificacion(
    perfil_id: int,
    cualificacion_id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina una cualificacion del perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    await service.eliminar_cualificacion(
        perfil_id=perfil_id, cualificacion_id=cualificacion_id, current_user=current_user
    )


# ══════════════════════════════════════════════════════════════════════════════
# COMPETENCIAS REQUERIDAS (tabla unificada — editar/borrar solo desde Matriz)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{perfil_id}/competencias", response_model=list[PerfilCompetenciaResponse])
async def listar_competencias(
    perfil_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista competencias requeridas del perfil (desde tabla unificada)."""
    service = PerfilFuncionesService(db)
    return await service.listar_competencias(perfil_id=perfil_id)


@router.post(
    "/{perfil_id}/competencias",
    response_model=PerfilCompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_competencia(
    perfil_id: int,
    body: PerfilCompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Agrega competencia del catalogo al perfil (nivel_requerido=0). Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_competencia(
        perfil_id=perfil_id, data=body, current_user=current_user
    )


# ══════════════════════════════════════════════════════════════════════════════
# ASIGNACIONES
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{perfil_id}/asignaciones", response_model=list[PerfilFuncionesResponse])
async def listar_asignaciones(
    perfil_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista asignaciones activas del perfil."""
    service = PerfilFuncionesService(db)
    return await service.listar_asignaciones(perfil_id=perfil_id)


@router.post(
    "/{perfil_id}/asignaciones",
    response_model=PerfilFuncionesResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_asignacion(
    perfil_id: int,
    body: PerfilFuncionesCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Asigna un empleado al perfil. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_asignacion(
        perfil_id=perfil_id, data=body, current_user=current_user
    )


@router.get("/{perfil_id}/asignaciones/{asignacion_id}")
async def obtener_asignacion(
    perfil_id: int,
    asignacion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene detalle de asignacion con analisis de brechas (gap analysis)."""
    service = PerfilFuncionesService(db)
    return await service.obtener_asignacion_con_gap(perfil_id=perfil_id, asignacion_id=asignacion_id)


class ActualizarEvaluacionesBody(BaseModel):
    """Body para actualizar evaluaciones de una asignacion."""

    evaluaciones_cualificacion: list[PerfilFuncionesCualificacionCreate] | None = None
    evaluaciones_competencia: list[PerfilFuncionesCompetenciaCreate] | None = None


@router.put("/{perfil_id}/asignaciones/{asignacion_id}")
async def actualizar_evaluaciones(
    perfil_id: int,
    asignacion_id: int,
    body: ActualizarEvaluacionesBody,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza evaluaciones de cualificacion y competencia de la asignacion. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.actualizar_evaluaciones(
        perfil_id=perfil_id,
        asignacion_id=asignacion_id,
        evaluaciones_cualificacion=body.evaluaciones_cualificacion,
        evaluaciones_competencia=body.evaluaciones_competencia,
        current_user=current_user,
    )


@router.delete(
    "/{perfil_id}/asignaciones/{asignacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def desactivar_asignacion(
    perfil_id: int,
    asignacion_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva (soft-delete) una asignacion. Solo RH."""
    service = PerfilFuncionesService(db)
    await service.desactivar_asignacion(
        perfil_id=perfil_id, asignacion_id=asignacion_id, current_user=current_user
    )


@router.post("/{perfil_id}/asignaciones/{asignacion_id}/firmar", response_model=PerfilFuncionesResponse)
async def firmar_asignacion(
    perfil_id: int,
    asignacion_id: int,
    body: PerfilFuncionesUpdate,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Registra firma (superior o empleado) en la asignacion."""
    service = PerfilFuncionesService(db)
    return await service.firmar_asignacion(
        perfil_id=perfil_id, asignacion_id=asignacion_id, data=body, current_user=current_user
    )


# ══════════════════════════════════════════════════════════════════════════════
# TAREAS EXTRA (per-employee)
# ══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra",
    response_model=list[PerfilFuncionesTareaResponse],
)
async def listar_tareas_extra(
    perfil_id: int,
    asignacion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista tareas extra asignadas a un empleado."""
    service = PerfilFuncionesService(db)
    return await service.listar_tareas_extra(perfil_id=perfil_id, asignacion_id=asignacion_id)


@router.post(
    "/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra",
    response_model=PerfilFuncionesTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_tarea_extra(
    perfil_id: int,
    asignacion_id: int,
    body: PerfilFuncionesTareaCreate,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Asigna una tarea extra del catalogo a un empleado. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_tarea_extra(
        perfil_id=perfil_id, asignacion_id=asignacion_id, data=body, current_user=current_user
    )


@router.delete(
    "/{perfil_id}/asignaciones/{asignacion_id}/tareas-extra/{tarea_extra_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_tarea_extra(
    perfil_id: int,
    asignacion_id: int,
    tarea_extra_id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina una tarea extra de un empleado. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    await service.eliminar_tarea_extra(
        perfil_id=perfil_id, asignacion_id=asignacion_id,
        tarea_extra_id=tarea_extra_id, current_user=current_user
    )
