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

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.models.level_up import Curso, CursoEmpleado, CursoPuesto
from app.models.talento import PerfilFunciones
from app.schemas.perfil_funciones import (
    EmpleadoDisponibleResponse,
    EvaluacionCompetenciaSyncBody,
    PerfilCompetenciaCreate,
    PerfilCompetenciaResponse,
    PerfilCompetenciaSyncBody,
    PerfilCompetenciaUpdate,
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
from app.services.perfil_funciones_service import PerfilFuncionesService

router = APIRouter(prefix="/api/v1/perfiles", tags=["Perfil de Funciones"])


# ══════════════════════════════════════════════════════════════════════════════
# BÚSQUEDA DE EMPLEADOS PARA ASIGNAR
# (ruta estática declarada antes de las rutas "/{perfil_id}/...")
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/empleados-disponibles", response_model=list[EmpleadoDisponibleResponse])
async def buscar_empleados_disponibles(
    q: str = Query("", description="Nombre o número de empleado (mínimo 2 caracteres)"),
    limit: int = Query(10, ge=1, le=50),
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Empleados activos sin asignación de perfil, para el buscador del modal de asignar.

    El guard ``role_checker`` deja pasar además a usuarios con el módulo ``puestos``
    (bypass por módulo según la ruta), que es quien asigna empleados a perfiles.
    """
    service = PerfilFuncionesService(db)
    return await service.buscar_empleados_disponibles(q=q, limit=limit)


# ══════════════════════════════════════════════════════════════════════════════
# TAREAS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/{perfil_id}/tareas", response_model=list[PerfilTareaResponse])
async def listar_tareas(
    perfil_id: int,
    grado_id: int | None = Query(
        None, gt=0, description="Si se indica, generales + específicas de ese grado"
    ),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista tareas de un perfil. Con grado_id: generales + específicas del grado."""
    service = PerfilFuncionesService(db)
    return await service.listar_tareas(perfil_id=perfil_id, grado_id=grado_id)


@router.post(
    "/{perfil_id}/tareas",
    response_model=PerfilTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_tarea(
    perfil_id: int,
    body: PerfilTareaCreate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    grado_id: int | None = Query(
        None,
        gt=0,
        description="Si se indica, específicas del grado + generales; si se omite, todas",
    ),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista competencias requeridas del perfil (generales + específicas del grado)."""
    service = PerfilFuncionesService(db)
    return await service.listar_competencias(perfil_id=perfil_id, grado_id=grado_id)


@router.post(
    "/{perfil_id}/competencias",
    response_model=PerfilCompetenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_competencia(
    perfil_id: int,
    body: PerfilCompetenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Agrega competencia del catálogo al perfil con nivel mínimo requerido (1-4). Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.crear_competencia(
        perfil_id=perfil_id, data=body, current_user=current_user
    )


@router.patch(
    "/{perfil_id}/competencias/{requisito_id}",
    response_model=PerfilCompetenciaResponse,
)
async def actualizar_nivel_competencia(
    perfil_id: int,
    requisito_id: int,
    body: PerfilCompetenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza el nivel mínimo requerido de una competencia del perfil."""
    service = PerfilFuncionesService(db)
    return await service.actualizar_nivel_competencia(
        perfil_id=perfil_id,
        requisito_id=requisito_id,
        data=body,
        current_user=current_user,
    )


@router.put("/{perfil_id}/competencias/sync", response_model=list[PerfilCompetenciaResponse])
async def sincronizar_competencias(
    perfil_id: int,
    body: PerfilCompetenciaSyncBody,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Sync completo de competencias requeridas por tipo (multi-select)."""
    service = PerfilFuncionesService(db)
    return await service.sincronizar_competencias(
        perfil_id=perfil_id,
        grado_id=body.grado_id,
        tipo_competencia_id=body.tipo_competencia_id,
        competencias=body.competencias,
        current_user=current_user,
    )


@router.put("/{perfil_id}/asignaciones/{asignacion_id}/competencias-eval")
async def sincronizar_evaluacion_competencias(
    perfil_id: int,
    asignacion_id: int,
    body: EvaluacionCompetenciaSyncBody,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Sync evaluación de competencias del empleado (nivel 0-4)."""
    service = PerfilFuncionesService(db)
    return await service.sincronizar_evaluacion_competencias(
        perfil_id=perfil_id,
        asignacion_id=asignacion_id,
        evaluaciones=[(e.competencia_requisito_id, e.nivel) for e in body.evaluaciones],
        current_user=current_user,
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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


@router.patch(
    "/{perfil_id}/asignaciones/{asignacion_id}",
    response_model=PerfilFuncionesResponse,
)
async def actualizar_asignacion(
    perfil_id: int,
    asignacion_id: int,
    body: PerfilFuncionesUpdate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza metadatos de la asignacion (p. ej. grado). Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    return await service.actualizar_asignacion(
        perfil_id=perfil_id,
        asignacion_id=asignacion_id,
        data=body,
        current_user=current_user,
    )


class ActualizarEvaluacionesBody(BaseModel):
    """Body para actualizar evaluaciones de una asignacion."""

    evaluaciones_cualificacion: list[PerfilFuncionesCualificacionCreate] | None = None
    evaluaciones_competencia: list[PerfilFuncionesCompetenciaCreate] | None = None


@router.put("/{perfil_id}/asignaciones/{asignacion_id}")
async def actualizar_evaluaciones(
    perfil_id: int,
    asignacion_id: int,
    body: ActualizarEvaluacionesBody,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
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
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina una tarea extra de un empleado. Solo RH o supervisor."""
    service = PerfilFuncionesService(db)
    await service.eliminar_tarea_extra(
        perfil_id=perfil_id, asignacion_id=asignacion_id,
        tarea_extra_id=tarea_extra_id, current_user=current_user
    )


# ══════════════════════════════════════════════════════════════════════════════
# EVALUACIÓN DE TAREAS
# ══════════════════════════════════════════════════════════════════════════════


class EvaluacionTareaItem(BaseModel):
    tarea_extra_id: int
    nivel: int


class EvaluacionTareasSyncBody(BaseModel):
    evaluaciones: list[EvaluacionTareaItem]


@router.put("/{perfil_id}/asignaciones/{asignacion_id}/tareas-eval")
async def evaluar_tareas(
    perfil_id: int,
    asignacion_id: int,
    body: EvaluacionTareasSyncBody,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Evalúa tareas de un empleado con escala 1-3."""
    service = PerfilFuncionesService(db)
    return await service.evaluar_tareas(
        perfil_id=perfil_id,
        asignacion_id=asignacion_id,
        evaluaciones=[(e.tarea_extra_id, e.nivel) for e in body.evaluaciones],
        current_user=current_user,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CURSOS ASIGNADOS AL PUESTO
# ══════════════════════════════════════════════════════════════════════════════


class CursoPuestoCreate(BaseModel):
    curso_id: int
    obligatorio: bool = False
    sesion_id: int | None = None


class CursoPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    curso_id: int
    puesto_perfil_id: int
    obligatorio: bool
    curso_nombre: str | None = None
    sesion_id: int | None = None
    sesion_fecha: str | None = None


@router.get("/{perfil_id}/cursos", response_model=list[CursoPuestoResponse])
async def listar_cursos_puesto(
    perfil_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista cursos asignados a un perfil de puesto."""
    stmt = (
        select(CursoPuesto)
        .options(selectinload(CursoPuesto.curso), selectinload(CursoPuesto.sesion))
        .where(CursoPuesto.puesto_perfil_id == perfil_id)
        .order_by(CursoPuesto.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [
        CursoPuestoResponse(
            id=cp.id,
            curso_id=cp.curso_id,
            puesto_perfil_id=cp.puesto_perfil_id,
            obligatorio=cp.obligatorio,
            curso_nombre=cp.curso.nombre if cp.curso else None,
            sesion_id=cp.sesion_id,
            sesion_fecha=str(cp.sesion.fecha_inicio) if cp.sesion else None,
        )
        for cp in items
    ]


@router.post(
    "/{perfil_id}/cursos",
    response_model=CursoPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def asignar_curso_puesto(
    perfil_id: int,
    body: CursoPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Asigna un curso a un perfil de puesto. Solo RH o supervisor."""
    dup_query = select(CursoPuesto).where(
        CursoPuesto.curso_id == body.curso_id,
        CursoPuesto.puesto_perfil_id == perfil_id,
    )
    if body.sesion_id is not None:
        dup_query = dup_query.where(CursoPuesto.sesion_id == body.sesion_id)
    else:
        dup_query = dup_query.where(CursoPuesto.sesion_id.is_(None))

    existing = await db.execute(dup_query)
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Este curso ya está asignado a este puesto.")

    if body.sesion_id is not None:
        from app.models.level_up import CursoSesion
        sesion = await db.get(CursoSesion, body.sesion_id)
        if not sesion or sesion.curso_id != body.curso_id:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Sesión no encontrada o no pertenece al curso.")

    cp = CursoPuesto(
        curso_id=body.curso_id,
        puesto_perfil_id=perfil_id,
        obligatorio=body.obligatorio,
        sesion_id=body.sesion_id,
    )
    db.add(cp)
    await db.commit()
    await db.refresh(cp, attribute_names=["curso", "sesion"])
    return CursoPuestoResponse(
        id=cp.id,
        curso_id=cp.curso_id,
        puesto_perfil_id=cp.puesto_perfil_id,
        obligatorio=cp.obligatorio,
        curso_nombre=cp.curso.nombre if cp.curso else None,
        sesion_id=cp.sesion_id,
        sesion_fecha=str(cp.sesion.fecha_inicio) if cp.sesion else None,
    )


@router.delete(
    "/{perfil_id}/cursos/{curso_puesto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_curso_puesto(
    perfil_id: int,
    curso_puesto_id: int,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina la asignación de un curso a un puesto. Solo RH o supervisor."""
    result = await db.execute(
        select(CursoPuesto).where(
            CursoPuesto.id == curso_puesto_id,
            CursoPuesto.puesto_perfil_id == perfil_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Asignación de curso no encontrada.")
    await db.delete(cp)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# CURSOS EXTRA POR EMPLEADO (individuales, via asignación)
# ══════════════════════════════════════════════════════════════════════════════


class CursoEmpleadoCreate(BaseModel):
    curso_id: int
    sesion_id: int | None = None


class CursoEmpleadoResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    curso_id: int
    empleado_id: int
    curso_nombre: str | None = None
    sesion_id: int | None = None
    sesion_fecha: str | None = None


@router.get(
    "/{perfil_id}/asignaciones/{asignacion_id}/cursos-extra",
    response_model=list[CursoEmpleadoResponse],
)
async def listar_cursos_extra(
    perfil_id: int,
    asignacion_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista cursos extra asignados individualmente a un empleado."""
    asig = await db.get(PerfilFunciones, asignacion_id)
    if not asig or asig.puesto_perfil_id != perfil_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Asignación no encontrada.")

    stmt = (
        select(CursoEmpleado)
        .options(selectinload(CursoEmpleado.curso), selectinload(CursoEmpleado.sesion))
        .where(CursoEmpleado.empleado_id == asig.empleado_id)
        .order_by(CursoEmpleado.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [
        CursoEmpleadoResponse(
            id=ce.id,
            curso_id=ce.curso_id,
            empleado_id=ce.empleado_id,
            curso_nombre=ce.curso.nombre if ce.curso else None,
            sesion_id=ce.sesion_id,
            sesion_fecha=str(ce.sesion.fecha_inicio) if ce.sesion else None,
        )
        for ce in items
    ]


@router.post(
    "/{perfil_id}/asignaciones/{asignacion_id}/cursos-extra",
    response_model=CursoEmpleadoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def asignar_curso_extra(
    perfil_id: int,
    asignacion_id: int,
    body: CursoEmpleadoCreate,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Asigna un curso extra individual a un empleado. Solo RH o supervisor."""
    asig = await db.get(PerfilFunciones, asignacion_id)
    if not asig or asig.puesto_perfil_id != perfil_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Asignación no encontrada.")

    dup_query = select(CursoEmpleado).where(
        CursoEmpleado.curso_id == body.curso_id,
        CursoEmpleado.empleado_id == asig.empleado_id,
    )
    if body.sesion_id is not None:
        dup_query = dup_query.where(CursoEmpleado.sesion_id == body.sesion_id)
    else:
        dup_query = dup_query.where(CursoEmpleado.sesion_id.is_(None))

    existing = await db.execute(dup_query)
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Este curso ya está asignado a este empleado.")

    if body.sesion_id is not None:
        from app.models.level_up import CursoSesion
        sesion = await db.get(CursoSesion, body.sesion_id)
        if not sesion or sesion.curso_id != body.curso_id:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Sesión no encontrada o no pertenece al curso.")

    ce = CursoEmpleado(
        curso_id=body.curso_id,
        empleado_id=asig.empleado_id,
        sesion_id=body.sesion_id,
    )
    db.add(ce)
    await db.commit()
    await db.refresh(ce, attribute_names=["curso", "sesion"])
    return CursoEmpleadoResponse(
        id=ce.id,
        curso_id=ce.curso_id,
        empleado_id=ce.empleado_id,
        curso_nombre=ce.curso.nombre if ce.curso else None,
        sesion_id=ce.sesion_id,
        sesion_fecha=str(ce.sesion.fecha_inicio) if ce.sesion else None,
    )


@router.delete(
    "/{perfil_id}/asignaciones/{asignacion_id}/cursos-extra/{curso_empleado_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_curso_extra(
    perfil_id: int,
    asignacion_id: int,
    curso_empleado_id: int,
    current_user: Empleado = Depends(role_checker(["operativo", "supervisor"])),
    db: AsyncSession = Depends(get_db),
):
    """Elimina un curso extra de un empleado. Solo RH o supervisor."""
    asig = await db.get(PerfilFunciones, asignacion_id)
    if not asig or asig.puesto_perfil_id != perfil_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Asignación no encontrada.")

    result = await db.execute(
        select(CursoEmpleado).where(
            CursoEmpleado.id == curso_empleado_id,
            CursoEmpleado.empleado_id == asig.empleado_id,
        )
    )
    ce = result.scalar_one_or_none()
    if not ce:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Curso extra no encontrado.")
    await db.delete(ce)
    await db.commit()
