# app/services/evaluacion_service.py
"""
Logica de negocio para Evaluaciones de Competencias — Fase 2 + Workflow.

Responsabilidades:
  - CRUD de evaluaciones (upsert semantics)
  - Evaluacion bulk
  - Workflow de estados: borrador → enviado → en_revision → revisado → cerrado
  - Permisos: RH evalua a todos, supervisor solo su area, empleado solo autoevaluacion
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from app.core.data_scope import effective_data_scope_for_module
from app.core.rh_module_registry import user_has_module
from app.models.auditoria import AuditLog
from app.models.empleados import Empleado
from app.models.talento import (
    AccionRecomendada,
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    GradoPuesto,
    PerfilFunciones,
    PerfilFuncionesCompetencia,
    PuestoPerfil,
)
from app.repositories.evaluacion_repository import EvaluacionRepository
from app.repositories.perfil_funciones_repository import PerfilFuncionesRepository
from app.schemas.evaluaciones import (
    EmpleadoCompetenciaResumen,
    EmpleadoConPerfilItem,
    EmpleadoResumenResponse,
    GradoNivelInfo,
    EvaluacionBulkCreate,
    EvaluacionCreate,
    EvaluacionListResponse,
    EvaluacionResponse,
    EvaluacionUpdate,
    HistorialEvento,
    HistorialResponse,
    TransicionResponse,
)

# ── State machine ──────────────────────────────────────────────────────────────

TRANSICIONES_VALIDAS: dict[tuple[str, str], set[str]] = {
    ("borrador", "enviado"): {"empleado", "supervisor", "rh"},
    ("borrador", "cerrado"): {"rh"},
    ("enviado", "en_revision"): {"supervisor", "rh"},
    ("enviado", "devuelto"): {"supervisor", "rh"},
    ("en_revision", "revisado"): {"supervisor", "rh"},
    ("en_revision", "devuelto"): {"supervisor", "rh"},
    ("revisado", "cerrado"): {"rh"},
    ("revisado", "devuelto"): {"rh"},
    ("devuelto", "enviado"): {"empleado", "supervisor", "rh"},
}

ESTADOS_EDITABLES_EMPLEADO = {"borrador", "devuelto"}
ESTADOS_EDITABLES_SUPERVISOR = {"en_revision"}


def _get_rol(user: Empleado) -> str:
    return user.rol.nombre if user.rol else "empleado"


def _parse_nivel(valor) -> int | None:
    """Convierte el nivel evaluado de competencia (texto) a int. None si no parsea."""
    if valor is None:
        return None
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def _to_response(ev: EvaluacionCompetencia) -> EvaluacionResponse:
    empleado_nombre = ev.empleado.nombre if ev.empleado else None
    competencia_nombre = ev.competencia.nombre if ev.competencia else None
    evaluador_nombre = ev.evaluador.nombre if ev.evaluador else None

    return EvaluacionResponse(
        id=ev.id,
        empleado_id=ev.empleado_id,
        empleado_nombre=empleado_nombre,
        competencia_id=ev.competencia_id,
        competencia_nombre=competencia_nombre,
        nivel_actual=ev.nivel_actual,
        evaluador_id=ev.evaluador_id,
        evaluador_nombre=evaluador_nombre,
        observaciones=ev.observaciones,
        estado=ev.estado,
        comentario_devolucion=ev.comentario_devolucion,
        fecha_evaluacion=ev.fecha_evaluacion,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
    )


class EvaluacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EvaluacionRepository(db)

    # ── Permission helpers ─────────────────────────────────────────────────────

    def _eval_data_scope(self, current_user: Empleado, rh_ui_mode: str | None = None) -> str:
        """Alcance de datos de evaluaciones: módulo ``evaluaciones`` otorgado = vista global."""
        return effective_data_scope_for_module(current_user, "evaluaciones", rh_ui_mode)

    def _check_create_permission(self, current_user: Empleado, target_empleado: Empleado):
        if user_has_module(current_user, "evaluaciones"):
            return
        rol = _get_rol(current_user)
        if rol == "supervisor":
            if current_user.area_id != target_empleado.area_id:
                raise ForbiddenError("Supervisor solo puede evaluar empleados de su area")
            return
        if current_user.id == target_empleado.id:
            return
        raise ForbiddenError("Solo puedes crear autoevaluaciones o necesitas permiso de RH/supervisor")

    def _check_supervisor_of_area(self, current_user: Empleado, target_empleado: Empleado):
        if user_has_module(current_user, "evaluaciones"):
            return
        rol = _get_rol(current_user)
        if rol == "supervisor" and current_user.area_id == target_empleado.area_id:
            return
        raise ForbiddenError("No tienes permiso para esta accion")

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _get_empleado(self, empleado_id: int) -> Empleado:
        result = await self.db.execute(
            select(Empleado).where(Empleado.id == empleado_id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise NotFoundError("Empleado", empleado_id)
        return emp

    async def _get_competencia(self, competencia_id: int) -> Competencia:
        result = await self.db.execute(
            select(Competencia).where(
                Competencia.id == competencia_id,
                Competencia.activo.is_(True),
            )
        )
        comp = result.scalar_one_or_none()
        if not comp:
            raise NotFoundError("Competencia", competencia_id)
        return comp

    async def _get_evaluacion_or_404(self, id: int) -> EvaluacionCompetencia:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError("Evaluacion", id)
        return ev

    async def _registrar_transicion(
        self,
        evaluacion_id: int,
        estado_anterior: str,
        estado_nuevo: str,
        actor: Empleado,
        comentario: str | None = None,
    ) -> None:
        entry = AuditLog(
            usuario_id=actor.id,
            accion="TRANSICION_ESTADO",
            modulo="evaluaciones",
            entidad_id=evaluacion_id,
            datos_antes={"estado": estado_anterior},
            datos_despues={
                "estado": estado_nuevo,
                "actor_nombre": actor.nombre,
                "comentario": comentario,
            },
        )
        self.db.add(entry)
        await self.db.flush()

    def _validar_transicion(self, estado_actual: str, estado_nuevo: str, rol: str):
        key = (estado_actual, estado_nuevo)
        roles_permitidos = TRANSICIONES_VALIDAS.get(key)
        if roles_permitidos is None:
            raise DomainValidationError(
                f"Transicion no permitida: {estado_actual} → {estado_nuevo}"
            )
        if rol not in roles_permitidos:
            raise ForbiddenError(
                f"Rol '{rol}' no puede realizar la transicion {estado_actual} → {estado_nuevo}"
            )

    # ── Workflow transitions ───────────────────────────────────────────────────

    async def enviar(self, id: int, current_user: Empleado) -> TransicionResponse:
        ev = await self._get_evaluacion_or_404(id)
        if current_user.id != ev.empleado_id and not user_has_module(current_user, "evaluaciones"):
            rol = _get_rol(current_user)
            if rol == "supervisor":
                target = await self._get_empleado(ev.empleado_id)
                self._check_supervisor_of_area(current_user, target)
            else:
                raise ForbiddenError("Solo el dueño de la evaluacion puede enviarla")

        rol = _get_rol(current_user)
        self._validar_transicion(ev.estado, "enviado", rol)

        estado_anterior = ev.estado
        ev.estado = "enviado"
        ev.comentario_devolucion = None
        await self._registrar_transicion(id, estado_anterior, "enviado", current_user)
        await self.db.commit()
        return TransicionResponse(id=id, estado="enviado", mensaje="Evaluacion enviada a revision")

    async def revisar(self, id: int, current_user: Empleado) -> TransicionResponse:
        ev = await self._get_evaluacion_or_404(id)
        target = await self._get_empleado(ev.empleado_id)
        self._check_supervisor_of_area(current_user, target)

        rol = _get_rol(current_user)
        self._validar_transicion(ev.estado, "en_revision", rol)

        ev.estado = "en_revision"
        await self._registrar_transicion(id, "enviado", "en_revision", current_user)
        await self.db.commit()
        return TransicionResponse(id=id, estado="en_revision", mensaje="Evaluacion tomada para revision")

    async def aprobar_revision(self, id: int, current_user: Empleado) -> TransicionResponse:
        ev = await self._get_evaluacion_or_404(id)
        target = await self._get_empleado(ev.empleado_id)
        self._check_supervisor_of_area(current_user, target)

        rol = _get_rol(current_user)
        self._validar_transicion(ev.estado, "revisado", rol)

        ev.estado = "revisado"
        await self._registrar_transicion(id, "en_revision", "revisado", current_user)
        await self.db.commit()
        return TransicionResponse(id=id, estado="revisado", mensaje="Evaluacion aprobada por supervisor")

    async def cerrar(self, id: int, current_user: Empleado) -> TransicionResponse:
        ev = await self._get_evaluacion_or_404(id)
        if not user_has_module(current_user, "evaluaciones"):
            raise ForbiddenError("Solo RH puede cerrar evaluaciones")

        rol = _get_rol(current_user)
        self._validar_transicion(ev.estado, "cerrado", rol)

        estado_anterior = ev.estado
        ev.estado = "cerrado"
        await self._registrar_transicion(id, estado_anterior, "cerrado", current_user)
        await self.db.commit()
        return TransicionResponse(id=id, estado="cerrado", mensaje="Evaluacion cerrada")

    async def devolver(
        self, id: int, comentario: str, current_user: Empleado
    ) -> TransicionResponse:
        ev = await self._get_evaluacion_or_404(id)
        target = await self._get_empleado(ev.empleado_id)

        if ev.estado == "revisado":
            if not user_has_module(current_user, "evaluaciones"):
                raise ForbiddenError("Solo RH puede devolver evaluaciones revisadas")
        else:
            self._check_supervisor_of_area(current_user, target)

        rol = _get_rol(current_user)
        self._validar_transicion(ev.estado, "devuelto", rol)

        estado_anterior = ev.estado
        ev.estado = "devuelto"
        ev.comentario_devolucion = comentario
        await self._registrar_transicion(id, estado_anterior, "devuelto", current_user, comentario)
        await self.db.commit()
        return TransicionResponse(id=id, estado="devuelto", mensaje="Evaluacion devuelta para correccion")

    async def historial(self, id: int) -> HistorialResponse:
        ev = await self._get_evaluacion_or_404(id)

        result = await self.db.execute(
            select(AuditLog)
            .where(
                AuditLog.modulo == "evaluaciones",
                AuditLog.entidad_id == id,
            )
            .order_by(AuditLog.timestamp.asc())
        )
        entries = result.scalars().all()

        eventos = []
        for entry in entries:
            datos_despues = entry.datos_despues or {}
            datos_antes = entry.datos_antes or {}
            eventos.append(HistorialEvento(
                actor_nombre=datos_despues.get("actor_nombre"),
                accion=entry.accion,
                estado_anterior=datos_antes.get("estado"),
                estado_nuevo=datos_despues.get("estado"),
                comentario=datos_despues.get("comentario"),
                timestamp=entry.timestamp,
            ))

        return HistorialResponse(
            evaluacion_id=id,
            estado_actual=ev.estado,
            eventos=eventos,
        )

    # ── CRUD ───────────────────────────────────────────────────────────────────

    async def crear(
        self, data: EvaluacionCreate, current_user: Empleado
    ) -> EvaluacionResponse:
        target = await self._get_empleado(data.empleado_id)
        self._check_create_permission(current_user, target)
        await self._get_competencia(data.competencia_id)

        ev = await self.repo.upsert(
            empleado_id=data.empleado_id,
            competencia_id=data.competencia_id,
            nivel_actual=data.nivel_actual,
            evaluador_id=current_user.id,
            observaciones=data.observaciones,
            estado="borrador",
        )
        ev = await self.repo.get(ev.id)
        await self.db.commit()
        return _to_response(ev)

    async def obtener(self, id: int) -> EvaluacionResponse:
        ev = await self._get_evaluacion_or_404(id)
        return _to_response(ev)

    async def actualizar(
        self, id: int, data: EvaluacionUpdate, current_user: Empleado
    ) -> EvaluacionResponse:
        ev = await self._get_evaluacion_or_404(id)
        rol = _get_rol(current_user)

        if user_has_module(current_user, "evaluaciones"):
            if ev.estado not in (ESTADOS_EDITABLES_EMPLEADO | ESTADOS_EDITABLES_SUPERVISOR):
                raise DomainValidationError(
                    f"No se puede editar una evaluacion en estado '{ev.estado}'"
                )
        elif rol == "supervisor":
            if ev.estado not in ESTADOS_EDITABLES_SUPERVISOR:
                raise DomainValidationError(
                    f"Supervisor solo puede editar evaluaciones en estado 'en_revision'"
                )
            target = await self._get_empleado(ev.empleado_id)
            self._check_supervisor_of_area(current_user, target)
        elif current_user.id == ev.empleado_id:
            if ev.estado not in ESTADOS_EDITABLES_EMPLEADO:
                raise DomainValidationError(
                    f"Solo puedes editar tu evaluacion en estado borrador o devuelto"
                )
        else:
            raise ForbiddenError("No tienes permiso para editar esta evaluacion")

        if data.nivel_actual is not None:
            ev.nivel_actual = data.nivel_actual
        if data.observaciones is not None:
            ev.observaciones = data.observaciones
        ev.evaluador_id = current_user.id

        await self.db.flush()
        await self.db.refresh(ev)
        ev = await self.repo.get(ev.id)
        await self.db.commit()
        return _to_response(ev)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        ev = await self._get_evaluacion_or_404(id)
        if ev.estado != "borrador":
            raise DomainValidationError(
                "Solo se pueden eliminar evaluaciones en estado borrador"
            )
        await self.repo.delete(id)
        await self.db.commit()

    async def listar(
        self,
        page: int = 1,
        page_size: int = 10,
        empleado_id: int | None = None,
        competencia_id: int | None = None,
        area_id: int | None = None,
        estado: str | None = None,
    ) -> EvaluacionListResponse:
        offset = (page - 1) * page_size
        estados = [s.strip() for s in estado.split(",")] if estado else None
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            empleado_id=empleado_id,
            competencia_id=competencia_id,
            area_id=area_id,
            estados=estados,
        )
        return EvaluacionListResponse(
            items=[_to_response(ev) for ev in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def listar_por_empleado(
        self, empleado_id: int, current_user: Empleado
    ) -> list[EvaluacionResponse]:
        scope = self._eval_data_scope(current_user)
        if scope not in ("rh", "supervisor") and current_user.id != empleado_id:
            raise ForbiddenError("Solo puedes ver tus propias evaluaciones")
        if scope == "supervisor" and current_user.id != empleado_id:
            target = await self._get_empleado(empleado_id)
            if current_user.area_id != target.area_id:
                raise ForbiddenError("Supervisor solo puede ver evaluaciones de su area")

        items = await self.repo.list_by_empleado(empleado_id)
        return [_to_response(ev) for ev in items]

    async def bulk_crear(
        self, data: EvaluacionBulkCreate, current_user: Empleado
    ) -> dict:
        creadas = 0
        errores = []
        for ev_data in data.evaluaciones:
            try:
                target = await self._get_empleado(ev_data.empleado_id)
                self._check_create_permission(current_user, target)
                await self._get_competencia(ev_data.competencia_id)
                await self.repo.upsert(
                    empleado_id=ev_data.empleado_id,
                    competencia_id=ev_data.competencia_id,
                    nivel_actual=ev_data.nivel_actual,
                    evaluador_id=current_user.id,
                    observaciones=ev_data.observaciones,
                    estado="borrador",
                )
                creadas += 1
            except Exception as e:
                errores.append(
                    f"empleado={ev_data.empleado_id} comp={ev_data.competencia_id}: {str(e)}"
                )

        await self.db.commit()
        return {"creadas": creadas, "errores": errores}

    def _classify_severidad(self, brecha_pct: float) -> str:
        if brecha_pct <= 0:
            return "alineado"
        if brecha_pct <= 30:
            return "media"
        if brecha_pct <= 50:
            return "alta"
        return "critica"

    def _lookup_accion(
        self, brecha_pct: float, acciones: list[AccionRecomendada]
    ) -> tuple[str | None, str | None]:
        brecha_int = round(brecha_pct)
        for a in acciones:
            if a.brecha_min <= brecha_int <= a.brecha_max:
                return a.etiqueta, a.color
        return None, None

    async def listar_empleados_con_perfil(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None = None,
    ) -> list[EmpleadoConPerfilItem]:
        """Lista empleados con una asignación activa a un perfil de puesto (PerfilFunciones).

        Aplica scope: RH ve todos, supervisor solo su área, cualquier otro solo a sí mismo.
        """
        scope = self._eval_data_scope(current_user, rh_ui_mode)
        pf_repo = PerfilFuncionesRepository(self.db)
        asignaciones = await pf_repo.list_all_active()

        if scope == "supervisor":
            asignaciones = [
                a for a in asignaciones
                if a.empleado and a.empleado.area_id == current_user.area_id
            ]
        elif scope != "rh":
            asignaciones = [a for a in asignaciones if a.empleado_id == current_user.id]

        # Nombres de área en batch
        area_ids = {a.empleado.area_id for a in asignaciones if a.empleado and a.empleado.area_id}
        area_map: dict[int, str] = {}
        if area_ids:
            from app.models.catalogos import Area
            area_result = await self.db.execute(
                select(Area.area_id, Area.descripcion).where(Area.area_id.in_(area_ids))
            )
            area_map = {row[0]: row[1] for row in area_result.all()}

        # Requisitos por (puesto_perfil, grado, competencia) en batch.
        puesto_ids = {a.puesto_perfil_id for a in asignaciones}
        reqs_por_pp_grado: dict[tuple[int, int], dict[int, int]] = {}
        if puesto_ids:
            req_result = await self.db.execute(
                select(CompetenciaRequisito)
                .options(selectinload(CompetenciaRequisito.competencia))
                .where(CompetenciaRequisito.puesto_perfil_id.in_(puesto_ids))
            )
            for req in req_result.scalars().all():
                comp = req.competencia
                if not comp or not comp.activo:
                    continue
                key = (req.puesto_perfil_id, req.grado_id)
                comp_map = reqs_por_pp_grado.setdefault(key, {})
                existing = comp_map.get(req.competencia_id)
                if existing is None or req.nivel_requerido > existing:
                    comp_map[req.competencia_id] = req.nivel_requerido

        # Evaluaciones cerradas (nivel actual) por empleado en batch.
        empleado_ids = [a.empleado_id for a in asignaciones]
        cerradas = await self.repo.list_cerradas_by_empleados(empleado_ids)
        eval_por_empleado: dict[int, dict[int, int]] = {}
        for ev in cerradas:
            eval_por_empleado.setdefault(ev.empleado_id, {})[ev.competencia_id] = ev.nivel_actual

        # Nivel actual capturado desde Puestos (PerfilFuncionesCompetencia), con prioridad.
        asig_to_emp = {a.id: a.empleado_id for a in asignaciones}
        if asig_to_emp:
            pfc_result = await self.db.execute(
                select(PerfilFuncionesCompetencia)
                .options(selectinload(PerfilFuncionesCompetencia.competencia_requisito))
                .where(PerfilFuncionesCompetencia.perfil_funciones_id.in_(asig_to_emp.keys()))
            )
            for pfc in pfc_result.scalars().all():
                emp_id = asig_to_emp.get(pfc.perfil_funciones_id)
                req = pfc.competencia_requisito
                nivel = _parse_nivel(pfc.situacion_actual)
                if emp_id is not None and req and nivel is not None:
                    eval_por_empleado.setdefault(emp_id, {})[req.competencia_id] = nivel

        items: list[EmpleadoConPerfilItem] = []
        for a in asignaciones:
            emp = a.empleado
            pp = a.puesto_perfil
            area_nombre = area_map.get(emp.area_id) if emp and emp.area_id else None

            comp_reqs = reqs_por_pp_grado.get((a.puesto_perfil_id, a.grado_id), {})
            eval_map = eval_por_empleado.get(a.empleado_id, {})
            brechas_pct: list[float] = []
            for comp_id, nivel_req in comp_reqs.items():
                nivel_act = eval_map.get(comp_id, 0)
                pct = round(max(0, (nivel_req - nivel_act) / nivel_req * 100), 1) if nivel_req > 0 else 0.0
                brechas_pct.append(pct)

            total = len(brechas_pct)
            brechas_identificadas = sum(1 for p in brechas_pct if p > 0)
            competencias_alineadas = sum(1 for p in brechas_pct if p == 0)
            competencias_evaluadas = sum(
                1 for comp_id in comp_reqs if eval_map.get(comp_id, 0) > 0
            )
            brecha_promedio = round(sum(brechas_pct) / total, 1) if total > 0 else 0.0
            readiness_score = round(100 - brecha_promedio, 1)
            severidad_promedio = self._classify_severidad(brecha_promedio)

            items.append(EmpleadoConPerfilItem(
                empleado_id=a.empleado_id,
                empleado_nombre=emp.nombre if emp else f"ID {a.empleado_id}",
                no_empleado=emp.no_empleado if emp else None,
                puesto_perfil_id=a.puesto_perfil_id,
                puesto_nombre=pp.nombre if pp else None,
                puesto_codigo=pp.codigo if pp else None,
                grado_id=a.grado_id,
                grado_nombre=a.grado.nombre if a.grado else None,
                departamento=a.departamento,
                area_nombre=area_nombre,
                readiness_score=readiness_score,
                brechas_identificadas=brechas_identificadas,
                severidad_promedio=severidad_promedio,
                competencias_alineadas=competencias_alineadas,
                total_competencias=total,
                competencias_evaluadas=competencias_evaluadas,
            ))

        items.sort(key=lambda i: i.readiness_score, reverse=True)
        return items

    async def resumen_empleado(
        self, empleado_id: int, current_user: Empleado
    ) -> EmpleadoResumenResponse:
        scope = self._eval_data_scope(current_user)
        if scope not in ("rh", "supervisor") and current_user.id != empleado_id:
            raise ForbiddenError("Solo puedes ver tu propio resumen")
        if scope == "supervisor" and current_user.id != empleado_id:
            target = await self._get_empleado(empleado_id)
            if current_user.area_id != target.area_id:
                raise ForbiddenError("Supervisor solo puede ver resumen de su area")

        emp = await self._get_empleado(empleado_id)

        # Try to resolve by assigned position (PerfilFunciones)
        pf_result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.puesto_perfil),
                selectinload(PerfilFunciones.grado),
            )
            .where(
                PerfilFunciones.empleado_id == emp.id,
                PerfilFunciones.activo.is_(True),
            )
        )
        perfil_funciones = pf_result.scalar_one_or_none()

        puesto_nombre = None
        grado_nombre = None
        departamento = None

        if perfil_funciones:
            pp = perfil_funciones.puesto_perfil
            puesto_nombre = pp.nombre if pp else None
            grado_nombre = (
                perfil_funciones.grado.nombre if perfil_funciones.grado else None
            )
            departamento = perfil_funciones.departamento

            requisitos_result = await self.db.execute(
                select(CompetenciaRequisito)
                .options(selectinload(CompetenciaRequisito.competencia))
                .where(
                    CompetenciaRequisito.puesto_perfil_id == perfil_funciones.puesto_perfil_id,
                    CompetenciaRequisito.grado_id == perfil_funciones.grado_id,
                )
            )
        else:
            # Fallback: resolve by area
            requisitos_result = await self.db.execute(
                select(CompetenciaRequisito)
                .options(selectinload(CompetenciaRequisito.competencia))
                .join(PuestoPerfil)
                .where(
                    PuestoPerfil.area_id == emp.area_id,
                    PuestoPerfil.activo.is_(True),
                )
            )

        requisitos = requisitos_result.scalars().all()

        # Niveles requeridos por competencia en TODOS los grados del puesto, para
        # mostrar las columnas Grado 1..N. La brecha sigue siendo vs el grado actual.
        grados: list[GradoNivelInfo] = []
        grado_actual_id: int | None = None
        niveles_por_grado_por_comp: dict[int, dict[int, int]] = {}
        if perfil_funciones:
            grado_actual_id = perfil_funciones.grado_id
            todos_req_result = await self.db.execute(
                select(CompetenciaRequisito)
                .options(
                    selectinload(CompetenciaRequisito.competencia),
                    selectinload(CompetenciaRequisito.grado),
                )
                .where(
                    CompetenciaRequisito.puesto_perfil_id == perfil_funciones.puesto_perfil_id,
                )
            )
            grados_presentes: dict[int, GradoPuesto] = {}
            for req in todos_req_result.scalars().all():
                comp = req.competencia
                if not comp or not comp.activo:
                    continue
                if req.grado is not None:
                    grados_presentes[req.grado_id] = req.grado
                comp_map = niveles_por_grado_por_comp.setdefault(comp.id, {})
                comp_map[req.grado_id] = req.nivel_requerido
            grados = [
                GradoNivelInfo(grado_id=g.id, grado_nombre=g.nombre, orden=g.orden)
                for g in sorted(grados_presentes.values(), key=lambda g: g.orden)
            ]

        evaluaciones = await self.repo.list_by_empleado_cerradas(empleado_id)
        eval_map = {ev.competencia_id: ev.nivel_actual for ev in evaluaciones}

        # Nivel actual capturado desde el módulo de Puestos
        # (PerfilFuncionesCompetencia.situacion_actual). Tiene prioridad sobre
        # EvaluacionCompetencia cuando el empleado tiene un perfil asignado.
        if perfil_funciones:
            pfc_result = await self.db.execute(
                select(PerfilFuncionesCompetencia)
                .options(selectinload(PerfilFuncionesCompetencia.competencia_requisito))
                .where(PerfilFuncionesCompetencia.perfil_funciones_id == perfil_funciones.id)
            )
            for pfc in pfc_result.scalars().all():
                req = pfc.competencia_requisito
                nivel = _parse_nivel(pfc.situacion_actual)
                if req and nivel is not None:
                    eval_map[req.competencia_id] = nivel

        # Get evaluador from most recent evaluation
        evaluador_nombre = None
        if evaluaciones:
            latest = max(evaluaciones, key=lambda ev: ev.fecha_evaluacion)
            if latest.evaluador:
                evaluador_nombre = latest.evaluador.nombre

        # Load acciones recomendadas catalog
        acciones_result = await self.db.execute(
            select(AccionRecomendada).order_by(AccionRecomendada.orden)
        )
        acciones = list(acciones_result.scalars().all())

        # Build per-competencia resumen (deduplicate by competencia, take max nivel_requerido)
        competencia_reqs: dict[int, tuple[str, str, int]] = {}
        for req in requisitos:
            comp = req.competencia
            if not comp or not comp.activo:
                continue
            existing = competencia_reqs.get(comp.id)
            if existing is None or req.nivel_requerido > existing[2]:
                competencia_reqs[comp.id] = (comp.nombre, comp.categoria or "tecnica", req.nivel_requerido)

        items: list[EmpleadoCompetenciaResumen] = []
        for comp_id, (nombre, categoria, nivel_req) in sorted(competencia_reqs.items(), key=lambda x: x[1][0]):
            nivel_act = eval_map.get(comp_id, 0)
            gap = max(0, nivel_req - nivel_act)
            brecha_pct = round(max(0, (nivel_req - nivel_act) / nivel_req * 100), 1) if nivel_req > 0 else 0.0
            severidad = self._classify_severidad(brecha_pct)
            accion_etiqueta, accion_color = self._lookup_accion(brecha_pct, acciones)

            items.append(EmpleadoCompetenciaResumen(
                competencia_id=comp_id,
                competencia_nombre=nombre,
                categoria=categoria,
                nivel_requerido=nivel_req,
                nivel_actual=nivel_act,
                niveles_por_grado=niveles_por_grado_por_comp.get(comp_id, {}),
                gap=gap,
                brecha_pct=brecha_pct,
                severidad=severidad,
                accion_recomendada=accion_etiqueta,
                accion_color=accion_color,
            ))

        total = len(items)
        evaluadas = sum(1 for i in items if eval_map.get(i.competencia_id) is not None)
        con_gap = sum(1 for i in items if i.gap > 0)
        competencias_alineadas = sum(1 for i in items if i.brecha_pct == 0)
        brechas_identificadas = sum(1 for i in items if i.brecha_pct > 0)
        brecha_promedio = round(sum(i.brecha_pct for i in items) / total, 1) if total > 0 else 0.0
        severidad_promedio = self._classify_severidad(brecha_promedio)
        readiness_score = round(100 - brecha_promedio, 1)

        if total > 0:
            cumplimiento = sum(
                min(i.nivel_actual / i.nivel_requerido, 1.0) if i.nivel_requerido > 0 else 1.0
                for i in items
            ) / total * 100
        else:
            cumplimiento = 0.0

        area_nombre = None
        if emp.area_id:
            from app.models.catalogos import Area
            area_result = await self.db.execute(
                select(Area.descripcion).where(Area.area_id == emp.area_id)
            )
            area_nombre = area_result.scalar_one_or_none()

        return EmpleadoResumenResponse(
            empleado_id=emp.id,
            empleado_nombre=emp.nombre,
            area_nombre=area_nombre,
            puesto_nombre=puesto_nombre,
            grado_nombre=grado_nombre,
            departamento=departamento,
            evaluador_nombre=evaluador_nombre,
            competencias_alineadas=competencias_alineadas,
            brechas_identificadas=brechas_identificadas,
            brecha_promedio=brecha_promedio,
            severidad_promedio=severidad_promedio,
            readiness_score=readiness_score,
            competencias=items,
            cumplimiento_pct=round(cumplimiento, 1),
            total_competencias=total,
            evaluadas=evaluadas,
            con_gap=con_gap,
            grados=grados,
            grado_actual_id=grado_actual_id,
        )
