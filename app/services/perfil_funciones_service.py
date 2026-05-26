# app/services/perfil_funciones_service.py
"""
Logica de negocio para Perfil de Funciones.

Responsabilidades:
  - CRUD de tareas, cualificaciones y competencias requeridas por puesto
  - Asignacion individual empleado-puesto
  - Evaluaciones de cualificaciones y competencias del empleado
  - Firma de perfiles
  - Analisis de brechas (gap analysis)
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import Competencia, PerfilFunciones, PuestoPerfil
from app.repositories.competencia_repository import CompetenciaRequisitoRepository
from app.repositories.perfil_funciones_repository import (
    PerfilCualificacionRepository,
    PerfilFuncionesCualificacionRepository,
    PerfilFuncionesCompetenciaRepository,
    PerfilFuncionesRepository,
    PerfilTareaRepository,
)
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
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
    PerfilFuncionesUpdate,
    PerfilTareaCreate,
    PerfilTareaResponse,
    PerfilTareaUpdate,
)

logger = logging.getLogger(__name__)


class PerfilFuncionesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.puesto_repo = PuestoPerfilRepository(db)
        self.tarea_repo = PerfilTareaRepository(db)
        self.cualificacion_repo = PerfilCualificacionRepository(db)
        self.competencia_repo = CompetenciaRequisitoRepository(db)
        self.asignacion_repo = PerfilFuncionesRepository(db)
        self.eval_cualificacion_repo = PerfilFuncionesCualificacionRepository(db)
        self.eval_competencia_repo = PerfilFuncionesCompetenciaRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    async def _get_perfil_or_404(self, perfil_id: int) -> PuestoPerfil:
        perfil = await self.puesto_repo.get(perfil_id)
        if not perfil or not perfil.activo:
            raise NotFoundError(entidad="PuestoPerfil", id=perfil_id)
        return perfil

    # ══════════════════════════════════════════════════════════════════════════
    # TAREAS
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_tareas(self, perfil_id: int) -> list[PerfilTareaResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.tarea_repo.list_by_perfil(perfil_id)
        return [PerfilTareaResponse.model_validate(t) for t in items]

    async def crear_tarea(
        self, perfil_id: int, data: PerfilTareaCreate, current_user: Empleado
    ) -> PerfilTareaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar tareas del perfil")

        await self._get_perfil_or_404(perfil_id)

        tarea = await self.tarea_repo.create({
            "puesto_perfil_id": perfil_id,
            "orden": data.orden,
            "descripcion": data.descripcion,
            "es_complemento": data.es_complemento,
        })
        return PerfilTareaResponse.model_validate(tarea)

    async def actualizar_tarea(
        self, perfil_id: int, tarea_id: int, data: PerfilTareaUpdate, current_user: Empleado
    ) -> PerfilTareaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar tareas del perfil")

        await self._get_perfil_or_404(perfil_id)

        tarea = await self.tarea_repo.get(tarea_id)
        if not tarea or tarea.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilTarea", id=tarea_id)

        update_data: dict = {}
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.orden is not None:
            update_data["orden"] = data.orden
        if data.es_complemento is not None:
            update_data["es_complemento"] = data.es_complemento

        if update_data:
            tarea = await self.tarea_repo.update(tarea_id, update_data)

        return PerfilTareaResponse.model_validate(tarea)

    async def eliminar_tarea(
        self, perfil_id: int, tarea_id: int, current_user: Empleado
    ) -> None:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar tareas del perfil")

        await self._get_perfil_or_404(perfil_id)

        tarea = await self.tarea_repo.get(tarea_id)
        if not tarea or tarea.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilTarea", id=tarea_id)

        await self.tarea_repo.hard_delete(tarea_id)

    async def reordenar_tareas(
        self, perfil_id: int, items: list, current_user: Empleado
    ) -> None:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar tareas del perfil")

        await self._get_perfil_or_404(perfil_id)

        for item in items:
            tarea = await self.tarea_repo.get(item.id)
            if not tarea or tarea.puesto_perfil_id != perfil_id:
                raise NotFoundError(entidad="PerfilTarea", id=item.id)
            tarea.orden = item.orden
        await self.db.flush()

    # ══════════════════════════════════════════════════════════════════════════
    # CUALIFICACIONES
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_cualificaciones(self, perfil_id: int) -> list[PerfilCualificacionResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.cualificacion_repo.list_by_perfil(perfil_id)
        return [PerfilCualificacionResponse.model_validate(c) for c in items]

    async def crear_cualificacion(
        self, perfil_id: int, data: PerfilCualificacionCreate, current_user: Empleado
    ) -> PerfilCualificacionResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar cualificaciones")

        await self._get_perfil_or_404(perfil_id)

        cualificacion = await self.cualificacion_repo.create({
            "puesto_perfil_id": perfil_id,
            "tipo": data.tipo,
            "situacion_deseada": data.situacion_deseada,
            "comentarios": data.comentarios,
        })
        return PerfilCualificacionResponse.model_validate(cualificacion)

    async def actualizar_cualificacion(
        self, perfil_id: int, cualificacion_id: int, data: PerfilCualificacionUpdate, current_user: Empleado
    ) -> PerfilCualificacionResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar cualificaciones")

        await self._get_perfil_or_404(perfil_id)

        cualificacion = await self.cualificacion_repo.get(cualificacion_id)
        if not cualificacion or cualificacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilCualificacion", id=cualificacion_id)

        update_data: dict = {}
        if data.tipo is not None:
            update_data["tipo"] = data.tipo
        if data.situacion_deseada is not None:
            update_data["situacion_deseada"] = data.situacion_deseada
        if data.comentarios is not None:
            update_data["comentarios"] = data.comentarios

        if update_data:
            cualificacion = await self.cualificacion_repo.update(cualificacion_id, update_data)

        return PerfilCualificacionResponse.model_validate(cualificacion)

    async def eliminar_cualificacion(
        self, perfil_id: int, cualificacion_id: int, current_user: Empleado
    ) -> None:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar cualificaciones")

        await self._get_perfil_or_404(perfil_id)

        cualificacion = await self.cualificacion_repo.get(cualificacion_id)
        if not cualificacion or cualificacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilCualificacion", id=cualificacion_id)

        await self.cualificacion_repo.hard_delete(cualificacion_id)

    # ══════════════════════════════════════════════════════════════════════════
    # COMPETENCIAS REQUERIDAS (usa tabla unificada competencia_requisitos)
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_competencias(self, perfil_id: int) -> list[PerfilCompetenciaResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.competencia_repo.list_by_puesto_with_competencia(perfil_id)
        results = []
        for c in items:
            resp = PerfilCompetenciaResponse(
                id=c.id,
                competencia_id=c.competencia_id,
                competencia_nombre=c.competencia.nombre if c.competencia else "",
                subcategoria=c.competencia.subcategoria if c.competencia else None,
                nivel_requerido=c.nivel_requerido,
                orden=c.orden,
            )
            results.append(resp)
        return results

    async def crear_competencia(
        self, perfil_id: int, data: PerfilCompetenciaCreate, current_user: Empleado
    ) -> PerfilCompetenciaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar competencias requeridas")

        await self._get_perfil_or_404(perfil_id)

        if await self.competencia_repo.exists_by_competencia_and_perfil(data.competencia_id, perfil_id):
            raise ConflictError(detail="Esta competencia ya está asignada al perfil")

        from sqlalchemy import select
        result = await self.db.execute(
            select(Competencia).where(Competencia.id == data.competencia_id)
        )
        catalogo = result.scalar_one_or_none()
        if not catalogo:
            raise NotFoundError(entidad="Competencia", id=data.competencia_id)

        orden = (await self.competencia_repo.max_orden(perfil_id)) + 1

        requisito = await self.competencia_repo.create({
            "puesto_perfil_id": perfil_id,
            "competencia_id": data.competencia_id,
            "nivel_requerido": 0,
            "orden": orden,
        })

        return PerfilCompetenciaResponse(
            id=requisito.id,
            competencia_id=requisito.competencia_id,
            competencia_nombre=catalogo.nombre,
            subcategoria=catalogo.subcategoria,
            nivel_requerido=requisito.nivel_requerido,
            orden=requisito.orden,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # ASIGNACIONES
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_asignaciones(self, perfil_id: int) -> list[PerfilFuncionesResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.asignacion_repo.list_by_perfil(perfil_id)
        results = []
        for a in items:
            data = PerfilFuncionesResponse.model_validate(a)
            if a.empleado:
                data.nombre_empleado = a.empleado.nombre
                data.no_empleado = a.empleado.no_empleado
            results.append(data)
        return results

    async def crear_asignacion(
        self, perfil_id: int, data: PerfilFuncionesCreate, current_user: Empleado
    ) -> PerfilFuncionesResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede asignar perfiles")

        await self._get_perfil_or_404(perfil_id)

        # Verificar que el empleado existe
        from sqlalchemy import select
        result = await self.db.execute(
            select(Empleado).where(Empleado.id == data.empleado_id)
        )
        if not result.scalar_one_or_none():
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        # Verificar duplicado activo
        existing = await self.asignacion_repo.get_active_by_empleado_and_perfil(
            empleado_id=data.empleado_id, puesto_perfil_id=perfil_id
        )
        if existing:
            raise ConflictError(
                detail=f"El empleado {data.empleado_id} ya tiene una asignacion activa para este perfil"
            )

        asignacion = await self.asignacion_repo.create({
            "puesto_perfil_id": perfil_id,
            "empleado_id": data.empleado_id,
            "departamento": data.departamento,
            "activo": True,
        })
        return PerfilFuncionesResponse.model_validate(asignacion)

    async def obtener_asignacion_con_gap(self, perfil_id: int, asignacion_id: int) -> dict:
        """Retorna la asignacion con analisis de brechas (gap analysis)."""
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get_with_evaluaciones(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        # Obtener definiciones del perfil
        cualificaciones_perfil = await self.cualificacion_repo.list_by_perfil(perfil_id)
        competencias_perfil = await self.competencia_repo.list_by_puesto_with_competencia(perfil_id)

        # Mapear evaluaciones existentes
        eval_cual_map = {
            ec.cualificacion_id: ec
            for ec in asignacion.evaluaciones_cualificacion
        }
        eval_comp_map = {
            ec.competencia_requisito_id: ec
            for ec in asignacion.evaluaciones_competencia
        }

        # Construir gap analysis de cualificaciones
        gap_cualificaciones = []
        for cual in cualificaciones_perfil:
            evaluacion = eval_cual_map.get(cual.id)
            gap_cualificaciones.append({
                "cualificacion_id": cual.id,
                "tipo": cual.tipo,
                "situacion_deseada": cual.situacion_deseada,
                "situacion_actual": evaluacion.situacion_actual if evaluacion else None,
                "comentarios": evaluacion.comentarios if evaluacion else None,
                "evaluado": evaluacion is not None,
            })

        # Construir gap analysis de competencias
        gap_competencias = []
        for comp in competencias_perfil:
            evaluacion = eval_comp_map.get(comp.id)
            gap_competencias.append({
                "competencia_requisito_id": comp.id,
                "competencia_nombre": comp.competencia.nombre if comp.competencia else "",
                "subcategoria": comp.competencia.subcategoria if comp.competencia else None,
                "nivel_requerido": comp.nivel_requerido,
                "situacion_actual": evaluacion.situacion_actual if evaluacion else None,
                "comentarios": evaluacion.comentarios if evaluacion else None,
                "evaluado": evaluacion is not None,
            })

        # Estadisticas
        total_cualificaciones = len(cualificaciones_perfil)
        total_competencias = len(competencias_perfil)
        evaluadas_cual = sum(1 for g in gap_cualificaciones if g["evaluado"])
        evaluadas_comp = sum(1 for g in gap_competencias if g["evaluado"])

        return {
            "asignacion": PerfilFuncionesResponse.model_validate(asignacion),
            "gap_cualificaciones": gap_cualificaciones,
            "gap_competencias": gap_competencias,
            "resumen": {
                "total_cualificaciones": total_cualificaciones,
                "evaluadas_cualificaciones": evaluadas_cual,
                "pendientes_cualificaciones": total_cualificaciones - evaluadas_cual,
                "total_competencias": total_competencias,
                "evaluadas_competencias": evaluadas_comp,
                "pendientes_competencias": total_competencias - evaluadas_comp,
            },
        }

    async def actualizar_evaluaciones(
        self,
        perfil_id: int,
        asignacion_id: int,
        evaluaciones_cualificacion: list[PerfilFuncionesCualificacionCreate] | None,
        evaluaciones_competencia: list[PerfilFuncionesCompetenciaCreate] | None,
        current_user: Empleado,
    ) -> dict:
        """Actualiza las evaluaciones de una asignacion (upsert)."""
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede evaluar")

        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        if evaluaciones_cualificacion:
            valid_cual_ids = {
                c.id for c in await self.cualificacion_repo.list_by_perfil(perfil_id)
            }
            invalid = [
                e.cualificacion_id for e in evaluaciones_cualificacion
                if e.cualificacion_id not in valid_cual_ids
            ]
            if invalid:
                raise DomainValidationError(
                    f"cualificacion_id inválido para este perfil: {invalid}"
                )

        if evaluaciones_competencia:
            valid_comp_ids = {
                c.id for c in await self.competencia_repo.list_by_puesto_with_competencia(perfil_id)
            }
            invalid = [
                e.competencia_requisito_id for e in evaluaciones_competencia
                if e.competencia_requisito_id not in valid_comp_ids
            ]
            if invalid:
                raise DomainValidationError(
                    f"competencia_requisito_id inválido para este perfil: {invalid}"
                )

        # Upsert evaluaciones de cualificacion
        if evaluaciones_cualificacion:
            for eval_data in evaluaciones_cualificacion:
                existing = await self.eval_cualificacion_repo.get_by_pair(
                    perfil_funciones_id=asignacion_id,
                    cualificacion_id=eval_data.cualificacion_id,
                )
                if existing:
                    update_fields: dict = {"situacion_actual": eval_data.situacion_actual}
                    if eval_data.comentarios is not None:
                        update_fields["comentarios"] = eval_data.comentarios
                    await self.eval_cualificacion_repo.update(existing.id, update_fields)
                else:
                    await self.eval_cualificacion_repo.create({
                        "perfil_funciones_id": asignacion_id,
                        "cualificacion_id": eval_data.cualificacion_id,
                        "situacion_actual": eval_data.situacion_actual,
                        "comentarios": eval_data.comentarios,
                    })

        # Upsert evaluaciones de competencia
        if evaluaciones_competencia:
            for eval_data in evaluaciones_competencia:
                existing = await self.eval_competencia_repo.get_by_pair(
                    perfil_funciones_id=asignacion_id,
                    competencia_requisito_id=eval_data.competencia_requisito_id,
                )
                if existing:
                    update_fields = {"situacion_actual": eval_data.situacion_actual}
                    if eval_data.comentarios is not None:
                        update_fields["comentarios"] = eval_data.comentarios
                    await self.eval_competencia_repo.update(existing.id, update_fields)
                else:
                    await self.eval_competencia_repo.create({
                        "perfil_funciones_id": asignacion_id,
                        "competencia_requisito_id": eval_data.competencia_requisito_id,
                        "situacion_actual": eval_data.situacion_actual,
                        "comentarios": eval_data.comentarios,
                    })

        # Retornar gap analysis actualizado
        return await self.obtener_asignacion_con_gap(perfil_id, asignacion_id)

    async def firmar_asignacion(
        self, perfil_id: int, asignacion_id: int, data: PerfilFuncionesUpdate, current_user: Empleado
    ) -> PerfilFuncionesResponse:
        """Registra firma del superior o del empleado en la asignacion."""
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        rol = self._get_rol(current_user)

        # Determinar tipo de firma segun rol
        if rol in ("rh", "supervisor"):
            # Firma del superior
            update_data: dict = {}
            if data.firma_superior_id is not None:
                update_data["firma_superior_id"] = data.firma_superior_id
            if data.fecha_firma_superior is not None:
                update_data["fecha_firma_superior"] = data.fecha_firma_superior
            if update_data:
                await self.asignacion_repo.update(asignacion_id, update_data)
        elif current_user.id == asignacion.empleado_id:
            # Firma del empleado asignado
            update_data = {}
            if data.firma_empleado_id is not None:
                update_data["firma_empleado_id"] = data.firma_empleado_id
            if data.fecha_firma_empleado is not None:
                update_data["fecha_firma_empleado"] = data.fecha_firma_empleado
            if update_data:
                await self.asignacion_repo.update(asignacion_id, update_data)
        else:
            raise ForbiddenError(detail="No tiene permiso para firmar esta asignacion")

        # Reload
        asignacion = await self.asignacion_repo.get(asignacion_id)
        return PerfilFuncionesResponse.model_validate(asignacion)

    async def desactivar_asignacion(
        self, perfil_id: int, asignacion_id: int, current_user: Empleado
    ) -> None:
        """Desactiva (soft-delete) una asignacion. Solo RH."""
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        await self.asignacion_repo.update(asignacion_id, {"activo": False})
        await self.db.commit()
