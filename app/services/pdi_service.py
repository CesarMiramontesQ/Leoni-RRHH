"""Service para Plan de Desarrollo Individual (PDI)."""

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import PlanDesarrolloIndividual, PerfilFunciones, CompetenciaRequisito, EvaluacionCompetencia
from app.repositories.pdi_repository import PDIRepository
from app.schemas.pdi import PDICreate, PDIUpdate, PDIResponse, PDIListResponse, PDIGestionListResponse, PDIGestionItem, PDIResumenResponse, PDIEstadoPatch, PDIProgresoEmpleadoItem, PDIProgresoEquipoResponse, EquipoResumenBrechaItem, EquipoResumenEmpleadoItem, EquipoResumenResponse, HeatmapCompetencia, HeatmapEmpleado, HeatmapCell, HeatmapResponse, TimelineEvent, TimelineResponse


VALID_TRANSITIONS = {
    "pendiente": {"en_proceso", "cancelado"},
    "en_proceso": {"completado", "cancelado"},
    "completado": set(),
    "cancelado": set(),
}


class PDIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PDIRepository(db)

    async def listar(
        self,
        empleado_id: int,
        current_user: Empleado,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> PDIListResponse:
        self._check_read_access(empleado_id, current_user)
        items = await self.repo.list_by_empleado(empleado_id, estado=estado, competencia_id=competencia_id)
        total = await self.repo.count_by_empleado(empleado_id, estado=estado, competencia_id=competencia_id)
        return PDIListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
        )

    async def crear(
        self,
        empleado_id: int,
        data: PDICreate,
        current_user: Empleado,
    ) -> PDIResponse:
        self._check_write_access(current_user)
        instance = PlanDesarrolloIndividual(
            empleado_id=empleado_id,
            competencia_id=data.competencia_id,
            accion=data.accion,
            tipo=data.tipo,
            duracion_horas=data.duracion_horas,
            fecha_inicio=data.fecha_inicio,
            fecha_fin=data.fecha_fin,
            responsable=data.responsable,
            estado="pendiente",
            creado_por=current_user.empleado_id,
        )
        instance = await self.repo.create(instance)
        return self._to_response(instance)

    async def actualizar(
        self,
        empleado_id: int,
        pdi_id: int,
        data: PDIUpdate,
        current_user: Empleado,
    ) -> PDIResponse:
        self._check_write_access(current_user)
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("Acción PDI no encontrada")

        if item.estado in ("completado", "cancelado"):
            raise ForbiddenError("No se puede modificar una acción en estado terminal")

        if data.estado and data.estado != item.estado:
            allowed = VALID_TRANSITIONS.get(item.estado, set())
            if data.estado not in allowed:
                raise ForbiddenError(
                    f"Transición de '{item.estado}' a '{data.estado}' no permitida"
                )
            item.estado = data.estado

        if data.accion is not None:
            item.accion = data.accion
        if data.tipo is not None:
            item.tipo = data.tipo
        if data.duracion_horas is not None:
            item.duracion_horas = data.duracion_horas
        if data.fecha_inicio is not None:
            item.fecha_inicio = data.fecha_inicio
        if data.fecha_fin is not None:
            item.fecha_fin = data.fecha_fin
        if data.responsable is not None:
            item.responsable = data.responsable

        await self.db.flush()
        await self.db.refresh(item, attribute_names=["competencia"])
        return self._to_response(item)

    async def eliminar(
        self,
        empleado_id: int,
        pdi_id: int,
        current_user: Empleado,
    ) -> None:
        self._check_write_access(current_user)
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("Acción PDI no encontrada")
        await self.repo.delete(pdi_id)

    def _check_read_access(self, empleado_id: int, user: Empleado) -> None:
        if user_has_module(user, "evaluaciones"):
            return
        if hasattr(user, "rol") and user.rol and user.rol.nombre == "supervisor":
            return
        if user.empleado_id != empleado_id:
            raise ForbiddenError("No tienes acceso a este recurso")

    def _check_write_access(self, user: Empleado) -> None:
        if not user_has_module(user, "evaluaciones"):
            raise ForbiddenError("Solo RH puede gestionar el PDI")

    def _resolve_area_scope(self, current_user: Empleado) -> list[int] | None:
        if user_has_module(current_user, "evaluaciones"):
            return None
        if hasattr(current_user, "rol") and current_user.rol and current_user.rol.nombre in ("supervisor", "gerente"):
            if current_user.area_id:
                return [current_user.area_id]
            return []
        raise ForbiddenError("No tienes acceso a la gestión de PDI")

    async def listar_consolidado(
        self,
        current_user: Empleado,
        page: int = 1,
        page_size: int = 10,
        area_id: int | None = None,
        estado: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        search: str | None = None,
        solo_vencidas: bool = False,
    ) -> PDIGestionListResponse:
        area_ids = self._resolve_area_scope(current_user)
        offset = (page - 1) * page_size
        items, total = await self.repo.list_consolidated(
            offset=offset,
            limit=page_size,
            area_id=area_id,
            area_ids=area_ids,
            estado=estado,
            fecha_inicio_desde=fecha_inicio,
            fecha_fin_hasta=fecha_fin,
            search=search,
            solo_vencidas=solo_vencidas,
        )
        return PDIGestionListResponse(
            items=[self._to_gestion_item(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener_resumen(self, current_user: Empleado) -> PDIResumenResponse:
        area_ids = self._resolve_area_scope(current_user)
        data = await self.repo.resumen(area_ids=area_ids)
        return PDIResumenResponse(**data)

    def _to_gestion_item(self, item: PlanDesarrolloIndividual) -> PDIGestionItem:
        emp = item.empleado
        emp_nombre = emp.nombre if emp else "—"
        area_nombre = emp.area.descripcion if emp and emp.area else None
        puesto_nombre = None
        comp_nombre = item.competencia.nombre if item.competencia else "—"
        today = date.today()
        vencida = item.fecha_fin < today and item.estado not in ("completado", "cancelado")
        return PDIGestionItem(
            id=item.id,
            empleado_id=item.empleado_id,
            empleado_nombre=emp_nombre,
            area_nombre=area_nombre,
            puesto_nombre=puesto_nombre,
            competencia_id=item.competencia_id,
            competencia_nombre=comp_nombre,
            accion=item.accion,
            tipo=item.tipo,
            duracion_horas=item.duracion_horas,
            fecha_inicio=item.fecha_inicio,
            fecha_fin=item.fecha_fin,
            responsable=item.responsable,
            estado=item.estado,
            vencida=vencida,
            created_at=item.created_at.isoformat() if item.created_at else "",
            updated_at=item.updated_at.isoformat() if item.updated_at else "",
        )

    async def cambiar_estado(
        self,
        pdi_id: int,
        nuevo_estado: str,
        current_user: Empleado,
    ) -> PDIGestionItem:
        self._check_write_access(current_user)
        item = await self.repo.get_with_empleado(pdi_id)
        if not item:
            raise NotFoundError("Acción PDI no encontrada")

        area_ids = self._resolve_area_scope(current_user)
        if area_ids is not None:
            emp_area = item.empleado.area_id if item.empleado else None
            if emp_area not in area_ids:
                raise ForbiddenError("No tienes acceso a este recurso")

        if item.estado in ("completado", "cancelado"):
            raise ForbiddenError("No se puede modificar una acción en estado terminal")

        allowed = VALID_TRANSITIONS.get(item.estado, set())
        if nuevo_estado not in allowed:
            raise ForbiddenError(
                f"Transición de '{item.estado}' a '{nuevo_estado}' no permitida"
            )

        item.estado = nuevo_estado
        await self.db.flush()
        await self.db.refresh(item, attribute_names=["competencia"])
        return self._to_gestion_item(item)

    async def progreso_equipo(
        self,
        current_user: Empleado,
        area_id: int | None = None,
    ) -> PDIProgresoEquipoResponse:
        area_ids = self._resolve_area_scope(current_user)
        rows = await self.repo.progreso_por_empleado(area_ids=area_ids, area_id=area_id)
        items = []
        for row in rows:
            total = row.total or 0
            completadas = row.completadas or 0
            pct = (completadas / total * 100) if total > 0 else 0.0
            items.append(PDIProgresoEmpleadoItem(
                empleado_id=row.empleado_id,
                empleado_nombre=row.empleado_nombre,
                area_nombre=row.area_nombre,
                total=total,
                completadas=completadas,
                en_proceso=row.en_proceso or 0,
                pendientes=row.pendientes or 0,
                vencidas=row.vencidas or 0,
                progreso_pct=round(pct, 1),
            ))
        return PDIProgresoEquipoResponse(items=items, total=len(items))

    async def equipo_resumen(
        self,
        current_user: Empleado,
        area_id: int | None = None,
    ) -> EquipoResumenResponse:
        area_ids = self._resolve_area_scope(current_user)
        pdi_rows = await self.repo.equipo_pdi_aggregates(area_ids=area_ids, area_id=area_id)
        if not pdi_rows:
            return EquipoResumenResponse(items=[], total=0)

        empleado_ids = [row.empleado_id for row in pdi_rows]

        emp_stmt = (
            select(Empleado)
            .options(selectinload(Empleado.area))
            .where(Empleado.empleado_id.in_(empleado_ids))
        )
        emp_result = await self.db.execute(emp_stmt)
        emp_map = {e.empleado_id: e for e in emp_result.scalars().all()}

        pf_stmt = (
            select(PerfilFunciones)
            .options(selectinload(PerfilFunciones.puesto_perfil))
            .where(
                PerfilFunciones.empleado_id.in_(empleado_ids),
                PerfilFunciones.activo.is_(True),
            )
        )
        pf_result = await self.db.execute(pf_stmt)
        pf_map = {pf.empleado_id: pf for pf in pf_result.scalars().all()}

        pf_keys = set()
        for pf in pf_map.values():
            if pf.puesto_perfil_id and pf.grado_id:
                pf_keys.add((pf.puesto_perfil_id, pf.grado_id))

        all_requisitos: list = []
        if pf_keys:
            req_conditions = [
                and_(
                    CompetenciaRequisito.puesto_perfil_id == pp_id,
                    CompetenciaRequisito.grado_id == g_id,
                )
                for pp_id, g_id in pf_keys
            ]
            req_stmt = (
                select(CompetenciaRequisito)
                .options(selectinload(CompetenciaRequisito.competencia))
                .where(or_(*req_conditions))
            )
            req_result = await self.db.execute(req_stmt)
            all_requisitos = list(req_result.scalars().all())

        req_by_key: dict[tuple[int, int], list] = {}
        for req in all_requisitos:
            key = (req.puesto_perfil_id, req.grado_id)
            req_by_key.setdefault(key, []).append(req)

        eval_stmt = select(EvaluacionCompetencia).where(
            EvaluacionCompetencia.empleado_id.in_(empleado_ids)
        )
        eval_result = await self.db.execute(eval_stmt)
        eval_by_emp: dict[int, dict[int, int]] = {}
        for ev in eval_result.scalars().all():
            eval_by_emp.setdefault(ev.empleado_id, {})[ev.competencia_id] = ev.nivel_actual

        items = []
        for pdi_row in pdi_rows:
            emp = emp_map.get(pdi_row.empleado_id)
            if not emp:
                continue

            if pdi_row.vencidas > 0:
                estatus = "vencido"
            elif pdi_row.en_proceso > 0:
                estatus = "en_proceso"
            elif pdi_row.pendientes > 0:
                estatus = "pendiente"
            elif pdi_row.completadas > 0:
                estatus = "completado"
            else:
                estatus = "sin_acciones"

            pf = pf_map.get(pdi_row.empleado_id)
            brechas_criticas: list[EquipoResumenBrechaItem] = []
            total_competencias = 0
            evaluadas_count = 0
            cumplimiento_sum = 0.0
            puesto_nombre = None

            if pf:
                puesto_nombre = pf.puesto_perfil.nombre if pf.puesto_perfil else None
                key = (pf.puesto_perfil_id, pf.grado_id)
                requisitos = req_by_key.get(key, [])
                eval_map = eval_by_emp.get(pdi_row.empleado_id, {})

                comp_reqs: dict[int, tuple[str, int]] = {}
                for req in requisitos:
                    comp = req.competencia
                    if not comp:
                        continue
                    existing = comp_reqs.get(comp.id)
                    if existing is None or req.nivel_requerido > existing[1]:
                        comp_reqs[comp.id] = (comp.nombre, req.nivel_requerido)

                total_competencias = len(comp_reqs)
                for comp_id, (comp_nombre, nivel_req) in comp_reqs.items():
                    nivel_act = eval_map.get(comp_id, 0)
                    if comp_id in eval_map:
                        evaluadas_count += 1
                    gap = max(0, nivel_req - nivel_act)
                    if nivel_req > 0:
                        cumplimiento_sum += min(nivel_act / nivel_req, 1.0)
                    else:
                        cumplimiento_sum += 1.0
                    if gap >= 1.5:
                        brechas_criticas.append(EquipoResumenBrechaItem(
                            competencia_id=comp_id,
                            competencia_nombre=comp_nombre,
                            gap=float(gap),
                        ))

            evaluacion_prom = (cumplimiento_sum / total_competencias * 100) if total_competencias > 0 else 0.0
            score_str = f"{evaluadas_count}/{total_competencias}"
            progreso_pct = (pdi_row.completadas / pdi_row.total * 100) if pdi_row.total > 0 else 0.0

            items.append(EquipoResumenEmpleadoItem(
                empleado_id=pdi_row.empleado_id,
                nombre=emp.nombre,
                no_empleado=emp.no_empleado or 0,
                puesto_nombre=puesto_nombre,
                area_nombre=emp.area.descripcion if emp.area else None,
                estatus_pdi=estatus,
                brechas_criticas=sorted(brechas_criticas, key=lambda b: -b.gap)[:5],
                ultima_actualizacion=pdi_row.ultima_actualizacion.isoformat() if pdi_row.ultima_actualizacion else None,
                score_competencias=score_str,
                evaluacion_general_prom=round(evaluacion_prom, 1),
                pdi_total=pdi_row.total,
                pdi_completadas=pdi_row.completadas,
                progreso_pct=round(progreso_pct, 1),
            ))

        status_order = {"vencido": 0, "pendiente": 1, "en_proceso": 2, "completado": 3, "sin_acciones": 4}
        items.sort(key=lambda x: (status_order.get(x.estatus_pdi, 5), x.nombre))

        return EquipoResumenResponse(items=items, total=len(items))

    async def heatmap(
        self,
        current_user: Empleado,
        area_id: int | None = None,
    ) -> HeatmapResponse:
        area_ids = self._resolve_area_scope(current_user)

        pf_stmt = (
            select(PerfilFunciones)
            .join(PerfilFunciones.empleado)
            .options(
                selectinload(PerfilFunciones.puesto_perfil),
                selectinload(PerfilFunciones.empleado),
            )
            .where(PerfilFunciones.activo.is_(True))
        )
        if area_ids is not None:
            pf_stmt = pf_stmt.where(Empleado.area_id.in_(area_ids))
        if area_id is not None:
            pf_stmt = pf_stmt.where(Empleado.area_id == area_id)
        pf_result = await self.db.execute(pf_stmt)
        perfiles = list(pf_result.scalars().all())

        if not perfiles:
            return HeatmapResponse(competencias=[], empleados=[], matriz={})

        empleado_list: list[HeatmapEmpleado] = []
        pf_map: dict[int, PerfilFunciones] = {}
        seen_emp: set[int] = set()
        for pf in perfiles:
            emp = pf.empleado
            if not emp or emp.empleado_id in seen_emp:
                continue
            seen_emp.add(emp.empleado_id)
            pf_map[emp.empleado_id] = pf
            empleado_list.append(HeatmapEmpleado(
                empleado_id=emp.empleado_id,
                nombre=emp.nombre,
                no_empleado=emp.no_empleado or 0,
            ))

        empleado_ids = list(seen_emp)

        pf_keys: set[tuple[int, int]] = set()
        for pf in pf_map.values():
            if pf.puesto_perfil_id and pf.grado_id:
                pf_keys.add((pf.puesto_perfil_id, pf.grado_id))

        all_requisitos: list = []
        if pf_keys:
            req_conditions = [
                and_(
                    CompetenciaRequisito.puesto_perfil_id == pp_id,
                    CompetenciaRequisito.grado_id == g_id,
                )
                for pp_id, g_id in pf_keys
            ]
            req_stmt = (
                select(CompetenciaRequisito)
                .options(selectinload(CompetenciaRequisito.competencia))
                .where(or_(*req_conditions))
            )
            req_result = await self.db.execute(req_stmt)
            all_requisitos = list(req_result.scalars().all())

        req_by_key: dict[tuple[int, int], list] = {}
        competencia_set: dict[int, tuple[str, str]] = {}
        for req in all_requisitos:
            key = (req.puesto_perfil_id, req.grado_id)
            req_by_key.setdefault(key, []).append(req)
            comp = req.competencia
            if comp and comp.id not in competencia_set:
                competencia_set[comp.id] = (comp.nombre, getattr(comp, "categoria", "") or "")

        competencia_list = [
            HeatmapCompetencia(competencia_id=cid, competencia_nombre=name, categoria=cat)
            for cid, (name, cat) in sorted(competencia_set.items(), key=lambda x: x[1][0])
        ]

        eval_stmt = select(EvaluacionCompetencia).where(
            EvaluacionCompetencia.empleado_id.in_(empleado_ids)
        )
        eval_result = await self.db.execute(eval_stmt)
        eval_by_emp: dict[int, dict[int, int]] = {}
        for ev in eval_result.scalars().all():
            eval_by_emp.setdefault(ev.empleado_id, {})[ev.competencia_id] = ev.nivel_actual

        matriz: dict[str, dict[str, HeatmapCell]] = {}
        for emp_id, pf in pf_map.items():
            key = (pf.puesto_perfil_id, pf.grado_id)
            requisitos = req_by_key.get(key, [])
            eval_map = eval_by_emp.get(emp_id, {})

            emp_cells: dict[str, HeatmapCell] = {}
            for req in requisitos:
                comp = req.competencia
                if not comp:
                    continue
                nivel_act = eval_map.get(comp.id, 0)
                gap = max(0, req.nivel_requerido - nivel_act)
                emp_cells[str(comp.id)] = HeatmapCell(
                    nivel_requerido=req.nivel_requerido,
                    nivel_actual=nivel_act,
                    gap=float(gap),
                )
            matriz[str(emp_id)] = emp_cells

        empleado_list.sort(key=lambda e: e.nombre)
        return HeatmapResponse(
            competencias=competencia_list,
            empleados=empleado_list,
            matriz=matriz,
        )

    async def timeline(
        self,
        current_user: Empleado,
        area_id: int | None = None,
    ) -> TimelineResponse:
        area_ids = self._resolve_area_scope(current_user)
        items = await self.repo.timeline_events(area_ids=area_ids, area_id=area_id)
        today = date.today()

        eventos = []
        for item in items:
            emp_nombre = item.empleado.nombre if item.empleado else "—"
            comp_nombre = item.competencia.nombre if item.competencia else "—"
            vencida = item.fecha_fin < today and item.estado not in ("completado", "cancelado")
            dias_rest = (item.fecha_fin - today).days if item.estado not in ("completado", "cancelado") else None
            eventos.append(TimelineEvent(
                id=item.id,
                empleado_id=item.empleado_id,
                empleado_nombre=emp_nombre,
                competencia_nombre=comp_nombre,
                accion=item.accion,
                fecha_inicio=item.fecha_inicio.isoformat(),
                fecha_fin=item.fecha_fin.isoformat(),
                estado=item.estado,
                vencida=vencida,
                dias_restantes=dias_rest,
            ))

        return TimelineResponse(eventos=eventos, total=len(eventos))

    def _to_response(self, item: PlanDesarrolloIndividual) -> PDIResponse:
        comp_nombre = item.competencia.nombre if item.competencia else "—"
        return PDIResponse(
            id=item.id,
            empleado_id=item.empleado_id,
            competencia_id=item.competencia_id,
            competencia_nombre=comp_nombre,
            accion=item.accion,
            tipo=item.tipo,
            duracion_horas=item.duracion_horas,
            fecha_inicio=item.fecha_inicio,
            fecha_fin=item.fecha_fin,
            responsable=item.responsable,
            estado=item.estado,
            creado_por=item.creado_por,
            creado_por_nombre=None,
            created_at=item.created_at.isoformat() if item.created_at else "",
            updated_at=item.updated_at.isoformat() if item.updated_at else "",
        )
