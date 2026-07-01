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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    PerfilCualificacion,
    PerfilFunciones,
    PerfilTarea,
    PuestoPerfil,
    TareaCatalogo,
)
from app.repositories.competencia_repository import CompetenciaRequisitoRepository
from app.repositories.cualificaciones_catalogo_repository import CualificacionCatalogoRepository
from app.repositories.perfil_funciones_repository import (
    PerfilCualificacionRepository,
    PerfilFuncionesCualificacionRepository,
    PerfilFuncionesCompetenciaRepository,
    PerfilFuncionesRepository,
    PerfilFuncionesTareaRepository,
    PerfilTareaRepository,
)
from app.schemas.cualificaciones_catalogo import (
    OpcionCalificacionResponse,
    validar_criterio_requerido,
    validar_valor_capturado,
)
from app.services.calificacion_comparador_service import (
    evaluar_cumplimiento,
    resolver_etiqueta_opcion,
)
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
from app.services.grado_puesto_service import GradoPuestoService
from app.services.metodo_calificacion_competencia_service import (
    MetodoCalificacionCompetenciaService,
)
from app.schemas.perfil_funciones import (
    EmpleadoDisponibleResponse,
    PerfilCompetenciaCreate,
    PerfilCompetenciaResponse,
    PerfilCompetenciaSyncItem,
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

logger = logging.getLogger(__name__)


def _parse_nivel(valor) -> int | None:
    """Convierte el nivel evaluado de competencia (string) a int. None si no parsea."""
    if valor is None:
        return None
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def contar_cumplimiento_gap(
    gap_cualificaciones: list[dict],
    gap_competencias: list[dict],
) -> tuple[int, int]:
    """Cuenta (requeridos, cumplen) para una asignación a partir de su gap analysis.

    - requeridos = total de cualificaciones + competencias del perfil/grado.
    - cumplen = requisitos satisfechos:
        cualificación: evaluada y `cumple is True`.
        competencia: evaluada y nivel evaluado >= nivel requerido.
    Las brechas son `requeridos - cumplen` (incluye no-cumple y pendientes sin evaluar).
    """
    requeridos = len(gap_cualificaciones) + len(gap_competencias)
    cumplen = 0
    for c in gap_cualificaciones:
        if c.get("evaluado") and c.get("cumple") is True:
            cumplen += 1
    for k in gap_competencias:
        if not k.get("evaluado"):
            continue
        nivel = _parse_nivel(k.get("situacion_actual"))
        requerido = k.get("nivel_requerido") or 0
        if nivel is not None and nivel >= requerido:
            cumplen += 1
    return requeridos, cumplen


class PerfilFuncionesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.puesto_repo = PuestoPerfilRepository(db)
        self.tarea_repo = PerfilTareaRepository(db)
        self.cualificacion_repo = PerfilCualificacionRepository(db)
        self.cualificacion_catalogo_repo = CualificacionCatalogoRepository(db)
        self.competencia_repo = CompetenciaRequisitoRepository(db)
        self.asignacion_repo = PerfilFuncionesRepository(db)
        self.eval_cualificacion_repo = PerfilFuncionesCualificacionRepository(db)
        self.eval_competencia_repo = PerfilFuncionesCompetenciaRepository(db)
        self.tarea_extra_repo = PerfilFuncionesTareaRepository(db)
        self.grado_service = GradoPuestoService(db)
        self.metodo_competencia_service = MetodoCalificacionCompetenciaService(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    @staticmethod
    def _scope_rol(user: Empleado, rh_ui_mode: str | None = None) -> str:
        from app.core.data_scope import effective_data_scope_for_module

        # Módulo "puestos" otorgado = operación global (no acotada por rol base).
        return effective_data_scope_for_module(user, "puestos", rh_ui_mode)

    @staticmethod
    def _to_competencia_response(requisito: CompetenciaRequisito) -> PerfilCompetenciaResponse:
        comp = requisito.competencia
        return PerfilCompetenciaResponse(
            id=requisito.id,
            competencia_id=requisito.competencia_id,
            competencia_nombre=comp.nombre if comp else "",
            tipo_competencia_id=comp.tipo_competencia_id if comp else None,
            tipo_nombre=(
                comp.tipo_competencia.nombre
                if comp and comp.tipo_competencia
                else None
            ),
            grado_id=requisito.grado_id,
            grado_nombre=requisito.grado.nombre if requisito.grado else "",
            nivel_requerido=requisito.nivel_requerido,
            orden=requisito.orden,
        )

    @staticmethod
    def _to_asignacion_response(asignacion: PerfilFunciones) -> PerfilFuncionesResponse:
        data = PerfilFuncionesResponse.model_validate(asignacion)
        if asignacion.grado:
            data.grado_nombre = asignacion.grado.nombre
        if asignacion.empleado:
            data.nombre_empleado = asignacion.empleado.nombre
            data.no_empleado = asignacion.empleado.no_empleado
        return data

    async def _get_perfil_or_404(self, perfil_id: int) -> PuestoPerfil:
        perfil = await self.puesto_repo.get(perfil_id)
        if not perfil or not perfil.activo:
            raise NotFoundError(entidad="PuestoPerfil", id=perfil_id)
        return perfil

    @staticmethod
    def _tarea_to_response(t: PerfilTarea) -> PerfilTareaResponse:
        """Si la tarea viene del catálogo, la descripción y tipo se resuelven desde ahí."""
        catalogo = t.tarea_catalogo
        if catalogo and t.tarea_catalogo_id:
            descripcion = catalogo.nombre
            es_complemento = catalogo.es_complemento
            catalogo_nombre = catalogo.nombre
        else:
            descripcion = t.descripcion
            es_complemento = t.es_complemento
            catalogo_nombre = None

        return PerfilTareaResponse(
            id=t.id,
            puesto_perfil_id=t.puesto_perfil_id,
            orden=t.orden,
            descripcion=descripcion,
            es_complemento=es_complemento,
            tarea_catalogo_id=t.tarea_catalogo_id,
            tarea_catalogo_nombre=catalogo_nombre,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )

    async def _get_tarea_with_catalogo(self, tarea_id: int) -> PerfilTarea | None:
        from sqlalchemy.orm import selectinload

        result = await self.db.execute(
            select(PerfilTarea)
            .options(selectinload(PerfilTarea.tarea_catalogo))
            .where(PerfilTarea.id == tarea_id)
        )
        return result.scalar_one_or_none()

    # ══════════════════════════════════════════════════════════════════════════
    # TAREAS
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_tareas(self, perfil_id: int) -> list[PerfilTareaResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.tarea_repo.list_by_perfil(perfil_id)
        return [self._tarea_to_response(t) for t in items]

    async def crear_tarea(
        self, perfil_id: int, data: PerfilTareaCreate, current_user: Empleado
    ) -> PerfilTareaResponse:
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar tareas del perfil")

        await self._get_perfil_or_404(perfil_id)

        descripcion = data.descripcion
        es_complemento = data.es_complemento

        if data.tarea_catalogo_id:
            result = await self.db.execute(
                select(TareaCatalogo).where(
                    TareaCatalogo.id == data.tarea_catalogo_id,
                    TareaCatalogo.activo.is_(True),
                )
            )
            tarea_cat = result.scalar_one_or_none()
            if not tarea_cat:
                raise NotFoundError(entidad="TareaCatalogo", id=data.tarea_catalogo_id)
            if not descripcion:
                descripcion = tarea_cat.nombre
            es_complemento = tarea_cat.es_complemento

        tarea = await self.tarea_repo.create({
            "puesto_perfil_id": perfil_id,
            "orden": data.orden,
            "descripcion": descripcion,
            "es_complemento": es_complemento,
            "tarea_catalogo_id": data.tarea_catalogo_id,
        })
        tarea = await self._get_tarea_with_catalogo(tarea.id)
        assert tarea is not None
        return self._tarea_to_response(tarea)

    async def actualizar_tarea(
        self, perfil_id: int, tarea_id: int, data: PerfilTareaUpdate, current_user: Empleado
    ) -> PerfilTareaResponse:
        rol = self._scope_rol(current_user)
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
            await self.tarea_repo.update(tarea_id, update_data)

        tarea = await self._get_tarea_with_catalogo(tarea_id)
        assert tarea is not None
        return self._tarea_to_response(tarea)

    async def eliminar_tarea(
        self, perfil_id: int, tarea_id: int, current_user: Empleado
    ) -> None:
        rol = self._scope_rol(current_user)
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
        rol = self._scope_rol(current_user)
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

    @staticmethod
    def _resolver_criterio_label(cual: PerfilCualificacion, opciones: list) -> str:
        criterio = cual.criterio_requerido or {}
        if criterio.get("na"):
            return "No aplica"
        if criterio.get("opcion_valor"):
            label = resolver_etiqueta_opcion(opciones, criterio["opcion_valor"])
            return label or str(criterio["opcion_valor"])
        if criterio.get("min_anios") is not None:
            base = f"{criterio['min_anios']} años mín."
            if criterio.get("texto"):
                return f"{base} — {criterio['texto']}"
            return base
        if criterio.get("texto"):
            return str(criterio["texto"])
        if cual.situacion_deseada:
            return cual.situacion_deseada
        return "—"

    @staticmethod
    def _resolver_capturado_label(evaluacion, opciones: list, metodo) -> str | None:
        if not evaluacion:
            return None
        capturado = evaluacion.valor_capturado or {}
        if capturado.get("na"):
            return "No aplica"
        if capturado.get("opcion_valor"):
            label = resolver_etiqueta_opcion(opciones, capturado["opcion_valor"])
            return label or str(capturado["opcion_valor"])
        if capturado.get("anios") is not None:
            base = f"{capturado['anios']} años"
            if capturado.get("texto"):
                return f"{base} — {capturado['texto']}"
            return base
        if capturado.get("texto"):
            return str(capturado["texto"])
        if evaluacion.situacion_actual:
            return evaluacion.situacion_actual
        return None

    @staticmethod
    def _opciones_activas(cual: PerfilCualificacion) -> list:
        cat = cual.cualificacion_catalogo
        if not cat or not cat.metodo_calificacion:
            return []
        return [o for o in cat.metodo_calificacion.opciones if o.activo]

    def _to_cualificacion_response(self, cual: PerfilCualificacion) -> PerfilCualificacionResponse:
        cat = cual.cualificacion_catalogo
        metodo = cat.metodo_calificacion if cat else None
        opciones = [
            OpcionCalificacionResponse.model_validate(o)
            for o in sorted(self._opciones_activas(cual), key=lambda x: (x.orden, x.id))
        ]
        return PerfilCualificacionResponse(
            id=cual.id,
            puesto_perfil_id=cual.puesto_perfil_id,
            cualificacion_catalogo_id=cual.cualificacion_catalogo_id,
            cualificacion_nombre=cat.nombre if cat else "",
            tipo_nombre=cat.tipo_cualificacion.nombre if cat and cat.tipo_cualificacion else "",
            metodo_tipo=metodo.tipo if metodo else "",
            metodo_config=metodo.config if metodo else {},
            opciones=opciones,
            criterio_requerido=cual.criterio_requerido,
            comentarios=cual.comentarios,
            created_at=cual.created_at,
            updated_at=cual.updated_at,
        )

    async def _validar_criterio_contra_catalogo(
        self, catalogo_id: int, criterio: dict
    ) -> None:
        cat = await self.cualificacion_catalogo_repo.get_with_relaciones(catalogo_id)
        if not cat or not cat.activo:
            raise NotFoundError(entidad="CualificacionCatalogo", id=catalogo_id)
        metodo = cat.metodo_calificacion
        if not metodo:
            raise DomainValidationError("La cualificación no tiene método de calificación asociado")
        try:
            validar_criterio_requerido(metodo.config or {}, criterio)
        except ValueError as exc:
            raise DomainValidationError(str(exc)) from exc

    async def listar_cualificaciones(self, perfil_id: int) -> list[PerfilCualificacionResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.cualificacion_repo.list_by_perfil(perfil_id)
        return [self._to_cualificacion_response(c) for c in items]

    async def crear_cualificacion(
        self, perfil_id: int, data: PerfilCualificacionCreate, current_user: Empleado
    ) -> PerfilCualificacionResponse:
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar cualificaciones")

        await self._get_perfil_or_404(perfil_id)
        await self._validar_criterio_contra_catalogo(data.cualificacion_catalogo_id, data.criterio_requerido)

        existentes = await self.cualificacion_repo.list_by_perfil(perfil_id)
        if any(c.cualificacion_catalogo_id == data.cualificacion_catalogo_id for c in existentes):
            raise DomainValidationError("Esta cualificación ya está asignada al perfil")

        cualificacion = await self.cualificacion_repo.create({
            "puesto_perfil_id": perfil_id,
            "cualificacion_catalogo_id": data.cualificacion_catalogo_id,
            "criterio_requerido": data.criterio_requerido,
            "comentarios": data.comentarios,
        })
        cualificacion = await self.cualificacion_repo.get_with_catalogo(cualificacion.id)
        return self._to_cualificacion_response(cualificacion)  # type: ignore[arg-type]

    async def actualizar_cualificacion(
        self, perfil_id: int, cualificacion_id: int, data: PerfilCualificacionUpdate, current_user: Empleado
    ) -> PerfilCualificacionResponse:
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar cualificaciones")

        await self._get_perfil_or_404(perfil_id)

        cualificacion = await self.cualificacion_repo.get_with_catalogo(cualificacion_id)
        if not cualificacion or cualificacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilCualificacion", id=cualificacion_id)

        if data.criterio_requerido is not None:
            cat_id = cualificacion.cualificacion_catalogo_id
            if cat_id:
                await self._validar_criterio_contra_catalogo(cat_id, data.criterio_requerido)

        update_data: dict = {}
        if data.criterio_requerido is not None:
            update_data["criterio_requerido"] = data.criterio_requerido
        if data.comentarios is not None:
            update_data["comentarios"] = data.comentarios

        if update_data:
            cualificacion = await self.cualificacion_repo.update(cualificacion_id, update_data)
            cualificacion = await self.cualificacion_repo.get_with_catalogo(cualificacion_id)

        return self._to_cualificacion_response(cualificacion)  # type: ignore[arg-type]

    async def eliminar_cualificacion(
        self, perfil_id: int, cualificacion_id: int, current_user: Empleado
    ) -> None:
        rol = self._scope_rol(current_user)
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

    async def listar_competencias(
        self, perfil_id: int, grado_id: int
    ) -> list[PerfilCompetenciaResponse]:
        await self._get_perfil_or_404(perfil_id)
        await self.grado_service.validar_grado_activo(grado_id)
        items = await self.competencia_repo.list_by_puesto_with_competencia(
            perfil_id, grado_id=grado_id
        )
        return [self._to_competencia_response(c) for c in items]

    async def crear_competencia(
        self, perfil_id: int, data: PerfilCompetenciaCreate, current_user: Empleado
    ) -> PerfilCompetenciaResponse:
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar competencias requeridas")

        await self._get_perfil_or_404(perfil_id)
        grado = await self.grado_service.validar_grado_activo(data.grado_id)

        if await self.competencia_repo.exists_by_competencia_and_perfil(
            data.competencia_id, perfil_id, data.grado_id
        ):
            raise ConflictError(detail="Esta competencia ya está asignada al perfil en este grado")

        from sqlalchemy.orm import selectinload
        result = await self.db.execute(
            select(Competencia)
            .options(selectinload(Competencia.tipo_competencia))
            .where(Competencia.id == data.competencia_id)
        )
        catalogo = result.scalar_one_or_none()
        if not catalogo:
            raise NotFoundError(entidad="Competencia", id=data.competencia_id)

        await self.metodo_competencia_service.validar_nivel_requerido(data.nivel_requerido)

        orden = (await self.competencia_repo.max_orden(perfil_id, data.grado_id)) + 1

        requisito = await self.competencia_repo.create({
            "puesto_perfil_id": perfil_id,
            "competencia_id": data.competencia_id,
            "grado_id": grado.id,
            "nivel_requerido": data.nivel_requerido,
            "orden": orden,
        })
        requisito.grado = grado
        requisito.competencia = catalogo
        return self._to_competencia_response(requisito)

    async def sincronizar_competencias(
        self,
        perfil_id: int,
        grado_id: int,
        tipo_competencia_id: int,
        competencias: list[PerfilCompetenciaSyncItem],
        current_user: Empleado,
    ) -> list[PerfilCompetenciaResponse]:
        """Sync competencias del catálogo por tipo y grado (incluye nivel requerido por puesto)."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar competencias requeridas")

        await self._get_perfil_or_404(perfil_id)
        await self.grado_service.validar_grado_activo(grado_id)

        result = await self.db.execute(
            select(Competencia.id).where(
                Competencia.tipo_competencia_id == tipo_competencia_id,
                Competencia.activo.is_(True),
            )
        )
        catalogo_ids = {row[0] for row in result.all()}

        requested_map = {c.competencia_id: c.nivel_requerido for c in competencias}
        requested_ids = set(requested_map.keys())

        if requested_ids:
            await self.metodo_competencia_service.validar_niveles_requeridos(
                set(requested_map.values())
            )
            invalid = requested_ids - catalogo_ids
            if invalid:
                raise DomainValidationError(
                    f"competencia_ids inválidos para tipo de competencia {tipo_competencia_id}: {sorted(invalid)}"
                )

        current = await self.competencia_repo.list_by_puesto_and_tipo(
            perfil_id, tipo_competencia_id, grado_id
        )
        current_catalogo = {r.competencia_id: r for r in current if r.competencia_id in catalogo_ids}
        current_catalogo_ids = set(current_catalogo.keys())

        to_remove = current_catalogo_ids - requested_ids
        to_add = requested_ids - current_catalogo_ids
        to_update = requested_ids & current_catalogo_ids

        if to_remove:
            ids_to_delete = [current_catalogo[cid].id for cid in to_remove]
            await self.competencia_repo.delete_by_ids(ids_to_delete)

        if to_add:
            orden_base = (await self.competencia_repo.max_orden(perfil_id, grado_id)) + 1
            for i, comp_id in enumerate(sorted(to_add)):
                await self.competencia_repo.create({
                    "puesto_perfil_id": perfil_id,
                    "competencia_id": comp_id,
                    "grado_id": grado_id,
                    "nivel_requerido": requested_map[comp_id],
                    "orden": orden_base + i,
                })

        for comp_id in sorted(to_update):
            requisito = current_catalogo[comp_id]
            nuevo_nivel = requested_map[comp_id]
            if requisito.nivel_requerido != nuevo_nivel:
                requisito.nivel_requerido = nuevo_nivel
                await self.db.flush()

        return await self.listar_competencias(perfil_id, grado_id)

    async def actualizar_nivel_competencia(
        self,
        perfil_id: int,
        requisito_id: int,
        data: PerfilCompetenciaUpdate,
        current_user: Empleado,
    ) -> PerfilCompetenciaResponse:
        """Actualiza el nivel mínimo requerido de una competencia ya asociada al perfil."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede gestionar competencias requeridas")

        await self._get_perfil_or_404(perfil_id)

        from sqlalchemy.orm import selectinload

        result = await self.db.execute(
            select(CompetenciaRequisito)
            .options(
                selectinload(CompetenciaRequisito.competencia).selectinload(
                    Competencia.tipo_competencia
                ),
                selectinload(CompetenciaRequisito.grado),
            )
            .where(
                CompetenciaRequisito.id == requisito_id,
                CompetenciaRequisito.puesto_perfil_id == perfil_id,
            )
        )
        requisito = result.scalar_one_or_none()
        if not requisito:
            raise NotFoundError(entidad="CompetenciaRequisito", id=requisito_id)

        await self.metodo_competencia_service.validar_nivel_requerido(data.nivel_requerido)

        requisito.nivel_requerido = data.nivel_requerido
        await self.db.flush()
        await self.db.refresh(requisito)

        return self._to_competencia_response(requisito)

    TIPO_COMPLEMENTOS_NOMBRE = "Complementos"

    async def sincronizar_evaluacion_competencias(
        self,
        perfil_id: int,
        asignacion_id: int,
        evaluaciones: list[tuple[int, int]],
        current_user: Empleado,
    ) -> dict:
        """Sync evaluación de competencias demostradas (nivel 0-4). No afecta competencias de Matriz."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede evaluar")

        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        all_requisitos = await self.competencia_repo.list_by_puesto_with_competencia(
            perfil_id, grado_id=asignacion.grado_id
        )
        demostradas_ids = {
            c.id for c in all_requisitos
            if c.competencia
            and (
                not c.competencia.tipo_competencia
                or c.competencia.tipo_competencia.nombre != self.TIPO_COMPLEMENTOS_NOMBRE
            )
        }

        eval_req_ids = [req_id for req_id, _ in evaluaciones]
        if eval_req_ids:
            invalid = [cid for cid in eval_req_ids if cid not in demostradas_ids]
            if invalid:
                raise DomainValidationError(
                    f"competencia_requisito_id inválido para competencias demostradas: {invalid}"
                )

        # Preservar evaluaciones de competencias de Matriz (no-demostradas)
        matriz_ids = [c.id for c in all_requisitos if c.id not in demostradas_ids]
        preserve_ids = eval_req_ids + matriz_ids

        await self.eval_competencia_repo.delete_by_asignacion_excluding(
            asignacion_id, preserve_ids
        )

        for req_id, nivel in evaluaciones:
            existing = await self.eval_competencia_repo.get_by_pair(
                perfil_funciones_id=asignacion_id,
                competencia_requisito_id=req_id,
            )
            situacion = str(nivel)
            if existing:
                existing.situacion_actual = situacion
            else:
                await self.eval_competencia_repo.create({
                    "perfil_funciones_id": asignacion_id,
                    "competencia_requisito_id": req_id,
                    "situacion_actual": situacion,
                })

        await self.db.flush()
        return await self.obtener_asignacion_con_gap(perfil_id, asignacion_id)

    # ══════════════════════════════════════════════════════════════════════════
    # ASIGNACIONES
    # ══════════════════════════════════════════════════════════════════════════

    async def buscar_empleados_disponibles(
        self, q: str, limit: int = 10
    ) -> list[EmpleadoDisponibleResponse]:
        """Empleados activos sin asignación de perfil que matchean ``q`` (min 2 chars)."""
        if not q or len(q.strip()) < 2:
            return []
        empleados = await self.asignacion_repo.buscar_empleados_disponibles(
            q, settings.ESTADOS_ACTIVOS_IDS, limit
        )
        return [EmpleadoDisponibleResponse.model_validate(e) for e in empleados]

    async def listar_asignaciones(self, perfil_id: int) -> list[PerfilFuncionesResponse]:
        await self._get_perfil_or_404(perfil_id)
        items = await self.asignacion_repo.list_by_perfil(perfil_id)
        return [self._to_asignacion_response(a) for a in items]

    async def crear_asignacion(
        self, perfil_id: int, data: PerfilFuncionesCreate, current_user: Empleado
    ) -> PerfilFuncionesResponse:
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede asignar perfiles")

        await self._get_perfil_or_404(perfil_id)

        # Verificar que el empleado existe
        from sqlalchemy import select
        result = await self.db.execute(
            select(Empleado).where(Empleado.empleado_id == data.empleado_id)
        )
        empleado = result.scalar_one_or_none()
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        # Verificar duplicado activo
        existing = await self.asignacion_repo.get_active_by_empleado_and_perfil(
            empleado_id=data.empleado_id, puesto_perfil_id=perfil_id
        )
        if existing:
            raise ConflictError(
                detail=f"El empleado {data.empleado_id} ya tiene una asignacion activa para este perfil"
            )

        grado = await self.grado_service.validar_grado_activo(data.grado_id)

        asignacion = await self.asignacion_repo.create({
            "puesto_perfil_id": perfil_id,
            "empleado_id": data.empleado_id,
            "grado_id": grado.id,
            "departamento": data.departamento,
            "activo": True,
        })
        asignacion.grado = grado
        asignacion.empleado = empleado
        return self._to_asignacion_response(asignacion)

    async def actualizar_asignacion(
        self,
        perfil_id: int,
        asignacion_id: int,
        data: PerfilFuncionesUpdate,
        current_user: Empleado,
    ) -> PerfilFuncionesResponse:
        """Actualiza metadatos de una asignacion (p. ej. cambio de grado)."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede actualizar asignaciones")

        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get_with_evaluaciones(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        update_fields: dict = {}
        if data.departamento is not None:
            update_fields["departamento"] = data.departamento
        if data.activo is not None:
            update_fields["activo"] = data.activo

        grado_cambiado = False
        if data.grado_id is not None and data.grado_id != asignacion.grado_id:
            grado = await self.grado_service.validar_grado_activo(data.grado_id)
            update_fields["grado_id"] = grado.id
            grado_cambiado = True

        if update_fields:
            await self.asignacion_repo.update(asignacion_id, update_fields)

        if grado_cambiado:
            valid_requisitos = await self.competencia_repo.list_by_puesto_with_competencia(
                perfil_id, grado_id=data.grado_id
            )
            keep_ids = [r.id for r in valid_requisitos]
            await self.eval_competencia_repo.delete_by_asignacion_excluding(
                asignacion_id, keep_ids
            )

        asignacion = await self.asignacion_repo.get_with_evaluaciones(asignacion_id)
        return self._to_asignacion_response(asignacion)

    async def obtener_asignacion_con_gap(self, perfil_id: int, asignacion_id: int) -> dict:
        """Retorna la asignacion con analisis de brechas (gap analysis)."""
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get_with_evaluaciones(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        # Obtener definiciones del perfil (competencias filtradas por grado de la asignacion)
        cualificaciones_perfil = await self.cualificacion_repo.list_by_perfil(perfil_id)
        competencias_perfil = await self.competencia_repo.list_by_puesto_with_competencia(
            perfil_id, grado_id=asignacion.grado_id
        )

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
            cumple: bool | None = None
            metodo = None
            opciones = self._opciones_activas(cual)
            if cual.cualificacion_catalogo and cual.cualificacion_catalogo.metodo_calificacion:
                metodo = cual.cualificacion_catalogo.metodo_calificacion
            if evaluacion is not None:
                cumple = evaluar_cumplimiento(
                    metodo,
                    opciones,
                    cual.criterio_requerido,
                    evaluacion.valor_capturado,
                    situacion_deseada=cual.situacion_deseada,
                    situacion_actual=evaluacion.situacion_actual,
                    anios_minimos=cual.anios_minimos,
                    anios_actuales=evaluacion.anios_actuales,
                )
            criterio_label = self._resolver_criterio_label(cual, opciones)
            capturado_label = self._resolver_capturado_label(evaluacion, opciones, metodo)
            gap_cualificaciones.append({
                "cualificacion_id": cual.id,
                "cualificacion_catalogo_id": cual.cualificacion_catalogo_id,
                "cualificacion_nombre": (
                    cual.cualificacion_catalogo.nombre if cual.cualificacion_catalogo else ""
                ),
                "tipo_nombre": (
                    cual.cualificacion_catalogo.tipo_cualificacion.nombre
                    if cual.cualificacion_catalogo and cual.cualificacion_catalogo.tipo_cualificacion
                    else ""
                ),
                "metodo_tipo": metodo.tipo if metodo else "",
                "metodo_config": metodo.config if metodo else {},
                "opciones": [OpcionCalificacionResponse.model_validate(o).model_dump() for o in opciones],
                "criterio_requerido": cual.criterio_requerido,
                "criterio_label": criterio_label,
                "valor_capturado": evaluacion.valor_capturado if evaluacion else None,
                "capturado_label": capturado_label,
                "comentarios": evaluacion.comentarios if evaluacion else None,
                "evaluado": evaluacion is not None,
                "cumple": cumple,
            })

        # Construir gap analysis de competencias
        gap_competencias = []
        for comp in competencias_perfil:
            evaluacion = eval_comp_map.get(comp.id)
            gap_competencias.append({
                "competencia_requisito_id": comp.id,
                "competencia_nombre": comp.competencia.nombre if comp.competencia else "",
                "tipo_competencia_id": (
                    comp.competencia.tipo_competencia_id if comp.competencia else None
                ),
                "tipo_nombre": (
                    comp.competencia.tipo_competencia.nombre
                    if comp.competencia and comp.competencia.tipo_competencia
                    else None
                ),
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
            "asignacion": self._to_asignacion_response(asignacion),
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

    async def brechas_cumplimiento_por_perfil(
        self, perfil_ids: list[int]
    ) -> dict[int, tuple[int, int]]:
        """Agrega (requeridos, cumplen) por perfil sumando cada asignación activa en su grado.

        Reusa `obtener_asignacion_con_gap` (grado-correcto). Las brechas activas de un perfil
        son `requeridos - cumplen` (cualificaciones que no cumplen + competencias por debajo del
        nivel + requisitos aún sin evaluar).
        """
        resultado: dict[int, tuple[int, int]] = {}
        for perfil_id in perfil_ids:
            asignaciones = await self.asignacion_repo.list_by_perfil(perfil_id)
            total_req = 0
            total_cum = 0
            for asignacion in asignaciones:
                gap = await self.obtener_asignacion_con_gap(perfil_id, asignacion.id)
                req, cum = contar_cumplimiento_gap(
                    gap["gap_cualificaciones"], gap["gap_competencias"]
                )
                total_req += req
                total_cum += cum
            resultado[perfil_id] = (total_req, total_cum)
        return resultado

    async def actualizar_evaluaciones(
        self,
        perfil_id: int,
        asignacion_id: int,
        evaluaciones_cualificacion: list[PerfilFuncionesCualificacionCreate] | None,
        evaluaciones_competencia: list[PerfilFuncionesCompetenciaCreate] | None,
        current_user: Empleado,
    ) -> dict:
        """Actualiza las evaluaciones de una asignacion (upsert)."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede evaluar")

        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        if evaluaciones_cualificacion:
            cuales_perfil = await self.cualificacion_repo.list_by_perfil(perfil_id)
            cuales_by_id = {c.id: c for c in cuales_perfil}
            valid_cual_ids = set(cuales_by_id.keys())
            invalid = [
                e.cualificacion_id for e in evaluaciones_cualificacion
                if e.cualificacion_id not in valid_cual_ids
            ]
            if invalid:
                raise DomainValidationError(
                    f"cualificacion_id inválido para este perfil: {invalid}"
                )
            for eval_data in evaluaciones_cualificacion:
                cual = cuales_by_id[eval_data.cualificacion_id]
                metodo = (
                    cual.cualificacion_catalogo.metodo_calificacion
                    if cual.cualificacion_catalogo else None
                )
                if metodo:
                    try:
                        validar_valor_capturado(metodo.config or {}, eval_data.valor_capturado)
                    except ValueError as exc:
                        raise DomainValidationError(
                            f"Cualificación id={eval_data.cualificacion_id}: {exc}"
                        ) from exc
                    opcion_valor = eval_data.valor_capturado.get("opcion_valor")
                    if opcion_valor:
                        valid_vals = {o.valor for o in self._opciones_activas(cual)}
                        if valid_vals and opcion_valor not in valid_vals:
                            raise DomainValidationError(
                                f"Cualificación id={eval_data.cualificacion_id}: "
                                f"opcion_valor '{opcion_valor}' no es válida para el método configurado"
                            )

        if evaluaciones_competencia:
            valid_comp_ids = {
                c.id
                for c in await self.competencia_repo.list_by_puesto_with_competencia(
                    perfil_id, grado_id=asignacion.grado_id
                )
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
                    update_fields: dict = {"valor_capturado": eval_data.valor_capturado}
                    if eval_data.comentarios is not None:
                        update_fields["comentarios"] = eval_data.comentarios
                    await self.eval_cualificacion_repo.update(existing.id, update_fields)
                else:
                    await self.eval_cualificacion_repo.create({
                        "perfil_funciones_id": asignacion_id,
                        "cualificacion_id": eval_data.cualificacion_id,
                        "valor_capturado": eval_data.valor_capturado,
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

        rol = self._scope_rol(current_user)

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

    # ══════════════════════════════════════════════════════════════════════════
    # TAREAS EXTRA (per-employee)
    # ══════════════════════════════════════════════════════════════════════════

    async def listar_tareas_extra(
        self, perfil_id: int, asignacion_id: int
    ) -> list[PerfilFuncionesTareaResponse]:
        await self._get_perfil_or_404(perfil_id)
        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        items = await self.tarea_extra_repo.list_by_asignacion(asignacion_id)
        return [
            PerfilFuncionesTareaResponse(
                id=t.id,
                perfil_funciones_id=t.perfil_funciones_id,
                tarea_catalogo_id=t.tarea_catalogo_id,
                tarea_catalogo_nombre=t.tarea_catalogo.nombre if t.tarea_catalogo else "",
                tarea_catalogo_categoria=t.tarea_catalogo.categoria if t.tarea_catalogo else None,
                created_at=t.created_at,
            )
            for t in items
        ]

    async def crear_tarea_extra(
        self, perfil_id: int, asignacion_id: int, data: PerfilFuncionesTareaCreate, current_user: Empleado
    ) -> PerfilFuncionesTareaResponse:
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        result = await self.db.execute(
            select(TareaCatalogo).where(
                TareaCatalogo.id == data.tarea_catalogo_id,
                TareaCatalogo.activo.is_(True),
            )
        )
        tarea_cat = result.scalar_one_or_none()
        if not tarea_cat:
            raise NotFoundError(entidad="TareaCatalogo", id=data.tarea_catalogo_id)

        existing = await self.tarea_extra_repo.get_by_pair(asignacion_id, data.tarea_catalogo_id)
        if existing:
            raise ConflictError(detail="Esta tarea ya esta asignada como extra a este empleado")

        item = await self.tarea_extra_repo.create({
            "perfil_funciones_id": asignacion_id,
            "tarea_catalogo_id": data.tarea_catalogo_id,
        })
        await self.db.commit()
        await self.db.refresh(item)

        return PerfilFuncionesTareaResponse(
            id=item.id,
            perfil_funciones_id=item.perfil_funciones_id,
            tarea_catalogo_id=item.tarea_catalogo_id,
            tarea_catalogo_nombre=tarea_cat.nombre,
            tarea_catalogo_categoria=tarea_cat.categoria,
            created_at=item.created_at,
        )

    async def eliminar_tarea_extra(
        self, perfil_id: int, asignacion_id: int, tarea_extra_id: int, current_user: Empleado
    ) -> None:
        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        tarea_extra = await self.tarea_extra_repo.get(tarea_extra_id)
        if not tarea_extra or tarea_extra.perfil_funciones_id != asignacion_id:
            raise NotFoundError(entidad="PerfilFuncionesTarea", id=tarea_extra_id)

        await self.tarea_extra_repo.hard_delete(tarea_extra_id)
        await self.db.commit()

    async def evaluar_tareas(
        self,
        perfil_id: int,
        asignacion_id: int,
        evaluaciones: list[tuple[int, int]],
        current_user: Empleado,
    ) -> dict:
        """Evalúa tareas de un empleado con escala 1-3."""
        rol = self._scope_rol(current_user)
        if rol not in ("rh", "supervisor"):
            raise ForbiddenError(detail="Solo RH o supervisor puede evaluar")

        await self._get_perfil_or_404(perfil_id)

        asignacion = await self.asignacion_repo.get(asignacion_id)
        if not asignacion or asignacion.puesto_perfil_id != perfil_id or not asignacion.activo:
            raise NotFoundError(entidad="PerfilFunciones", id=asignacion_id)

        for tarea_extra_id, nivel in evaluaciones:
            if nivel < 1 or nivel > 3:
                raise DomainValidationError(f"Nivel inválido: {nivel}. Debe ser 1, 2 o 3.")
            tarea = await self.tarea_extra_repo.get(tarea_extra_id)
            if not tarea or tarea.perfil_funciones_id != asignacion_id:
                raise NotFoundError(entidad="PerfilFuncionesTarea", id=tarea_extra_id)
            await self.tarea_extra_repo.update(tarea_extra_id, {"nivel": nivel})

        await self.db.flush()
        return await self.obtener_asignacion_con_gap(perfil_id, asignacion_id)
