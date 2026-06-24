# app/services/evaluacion_service.py
"""
Logica de negocio para Evaluaciones de Competencias — Fase 2.

Responsabilidades:
  - CRUD de evaluaciones (upsert semantics)
  - Evaluacion bulk
  - Permisos: RH evalua a todos, supervisor solo su area
  - Vista por empleado
"""

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import (
    AccionRecomendada,
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    NivelPuesto,
    PerfilFunciones,
    PuestoPerfil,
)
from app.repositories.evaluacion_repository import EvaluacionRepository
from app.schemas.evaluaciones import (
    EmpleadoCompetenciaResumen,
    EmpleadoResumenResponse,
    EvaluacionBulkCreate,
    EvaluacionCreate,
    EvaluacionListResponse,
    EvaluacionResponse,
    EvaluacionUpdate,
)


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
        fecha_evaluacion=ev.fecha_evaluacion,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
    )


class EvaluacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EvaluacionRepository(db)

    def _check_supervisor_permission(self, current_user: Empleado, target_empleado: Empleado):
        rol = current_user.rol.nombre if current_user.rol else None
        # Acceso por permiso de módulo (RH con `evaluaciones`, o no-RH inscrito con el
        # módulo otorgado): puede evaluar a cualquiera, sin restricción de área.
        if user_has_module(current_user, "evaluaciones"):
            return
        if rol == "supervisor":
            if current_user.area_id != target_empleado.area_id:
                raise ForbiddenError("Supervisor solo puede evaluar empleados de su area")
            return
        raise ForbiddenError("Solo RH o supervisores pueden crear evaluaciones")

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

    async def crear(
        self, data: EvaluacionCreate, current_user: Empleado
    ) -> EvaluacionResponse:
        target = await self._get_empleado(data.empleado_id)
        self._check_supervisor_permission(current_user, target)
        await self._get_competencia(data.competencia_id)

        ev = await self.repo.upsert(
            empleado_id=data.empleado_id,
            competencia_id=data.competencia_id,
            nivel_actual=data.nivel_actual,
            evaluador_id=current_user.id,
            observaciones=data.observaciones,
        )
        # Reload with relations
        ev = await self.repo.get(ev.id)
        await self.db.commit()
        return _to_response(ev)

    async def obtener(self, id: int) -> EvaluacionResponse:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError("Evaluacion", id)
        return _to_response(ev)

    async def actualizar(
        self, id: int, data: EvaluacionUpdate, current_user: Empleado
    ) -> EvaluacionResponse:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError("Evaluacion", id)

        target = await self._get_empleado(ev.empleado_id)
        self._check_supervisor_permission(current_user, target)

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
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError("Evaluacion", id)
        deleted = await self.repo.delete(id)
        if not deleted:
            raise NotFoundError("Evaluacion", id)
        await self.db.commit()

    async def listar(
        self,
        page: int = 1,
        page_size: int = 10,
        empleado_id: int | None = None,
        competencia_id: int | None = None,
        area_id: int | None = None,
    ) -> EvaluacionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            empleado_id=empleado_id,
            competencia_id=competencia_id,
            area_id=area_id,
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
        rol = current_user.rol.nombre if current_user.rol else None
        if rol not in ("rh", "supervisor") and current_user.id != empleado_id:
            raise ForbiddenError("Solo puedes ver tus propias evaluaciones")
        if rol == "supervisor" and current_user.id != empleado_id:
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
                self._check_supervisor_permission(current_user, target)
                await self._get_competencia(ev_data.competencia_id)
                await self.repo.upsert(
                    empleado_id=ev_data.empleado_id,
                    competencia_id=ev_data.competencia_id,
                    nivel_actual=ev_data.nivel_actual,
                    evaluador_id=current_user.id,
                    observaciones=ev_data.observaciones,
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

    async def resumen_empleado(
        self, empleado_id: int, current_user: Empleado
    ) -> EmpleadoResumenResponse:
        rol = current_user.rol.nombre if current_user.rol else None
        if rol not in ("rh", "supervisor") and current_user.id != empleado_id:
            raise ForbiddenError("Solo puedes ver tu propio resumen")
        if rol == "supervisor" and current_user.id != empleado_id:
            target = await self._get_empleado(empleado_id)
            if current_user.area_id != target.area_id:
                raise ForbiddenError("Supervisor solo puede ver resumen de su area")

        emp = await self._get_empleado(empleado_id)

        # Try to resolve by assigned position (PerfilFunciones)
        pf_result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.puesto_perfil).selectinload(PuestoPerfil.nivel),
            )
            .where(
                PerfilFunciones.empleado_id == emp.id,
                PerfilFunciones.activo.is_(True),
            )
        )
        perfil_funciones = pf_result.scalar_one_or_none()

        puesto_nombre = None
        nivel_puesto = None
        departamento = None

        if perfil_funciones:
            pp = perfil_funciones.puesto_perfil
            puesto_nombre = pp.nombre if pp else None
            nivel_puesto = pp.nivel.nombre if pp and pp.nivel else None
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

        # Get employee's evaluations
        evaluaciones = await self.repo.list_by_empleado(empleado_id)
        eval_map = {ev.competencia_id: ev.nivel_actual for ev in evaluaciones}

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
            nivel_puesto=nivel_puesto,
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
        )
