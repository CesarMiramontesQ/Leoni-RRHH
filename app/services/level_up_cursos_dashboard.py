"""Servicio del dashboard de seguimiento de capacitaciones (Level Up)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.models.level_up import Curso, CursoEmpleado, CursoGrupo, CursoPuesto, CursoSesion
from app.repositories.level_up_cursos_dashboard import LevelUpCursosDashboardRepository
from app.schemas.level_up_dashboard import (
    CursosDashboardAreaItem,
    CursosDashboardCursoCompletadoItem,
    CursosDashboardEmpleadoHistorialResponse,
    CursosDashboardEmpleadoResumenItem,
    CursosDashboardHistorialCursoItem,
    CursosDashboardHistorialSesionItem,
    CursosDashboardKpis,
    CursosDashboardRegistroItem,
    CursosDashboardRegistrosResponse,
    CursosDashboardResumenResponse,
    CursosDashboardSesionProximaItem,
    EstadoCursoEmpleadoLiteral,
)
from app.services.level_up_asignaciones import LevelUpAsignacionesService
from app.services.level_up_estado_curso import (
    InscripcionEstadoInput,
    compute_estado_curso_empleado,
    fecha_finalizacion_curso,
)


@dataclass
class _ParCursoEmpleado:
    empleado_id: int
    curso_id: int
    asignado: bool = False
    origen: str | None = None
    inscripciones: list[InscripcionEstadoInput] = field(default_factory=list)


@dataclass
class CursosAreaAgg:
    """Agregado de capacitacion de UN area, para el Dashboard de Talento."""

    total_pares: int = 0
    completados: int = 0
    empleados_obligatorio_pendiente: set[int] = field(default_factory=set)
    empleados: set[int] = field(default_factory=set)
    """Todos los empleados con al menos un par (empleado, curso) evaluable en
    esta area, independiente del estado. Es la fuente para saber quien SI fue
    evaluado en capacitacion (para distinguir 'no aplica' de 'esta bien')."""


class LevelUpCursosDashboardService:
    TOP_N = 8
    ESTADOS_CURSO_ACTIVOS: frozenset[str] = frozenset(
        {"pendiente", "programado", "no_acreditado", "en_progreso"}
    )

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = LevelUpCursosDashboardRepository(db)
        self.asig = LevelUpAsignacionesService(db)

    async def _build_assignment_index(
        self,
        cursos: list[Curso],
        curso_puestos: list[CursoPuesto],
        grupos: list[CursoGrupo],
        extras: list[CursoEmpleado],
    ) -> dict[tuple[int, int], str]:
        """(empleado_id, curso_id) -> origen (puesto|grupo|extra)."""
        curso_ids = {c.id for c in cursos}
        puesto_perfil_ids = {cp.puesto_perfil_id for cp in curso_puestos if cp.curso_id in curso_ids}
        pp_empleados = await self.repo.empleados_por_puesto_perfil(puesto_perfil_ids)
        grupo_empleados = await self.repo.empleados_por_grupos(
            [g for g in grupos if g.curso_id in curso_ids]
        )

        covered_by_puesto: dict[int, set[int]] = {}
        for cp in curso_puestos:
            if cp.curso_id not in curso_ids:
                continue
            for emp_id in pp_empleados.get(cp.puesto_perfil_id, set()):
                covered_by_puesto.setdefault(cp.curso_id, set()).add(emp_id)

        index: dict[tuple[int, int], str] = {}
        for curso_id, emp_ids in covered_by_puesto.items():
            for emp_id in emp_ids:
                index[(emp_id, curso_id)] = "puesto"

        for curso_id, emp_ids in grupo_empleados.items():
            for emp_id in emp_ids:
                if (emp_id, curso_id) not in index:
                    index[(emp_id, curso_id)] = "grupo"

        for ce in extras:
            if ce.curso_id not in curso_ids:
                continue
            if ce.empleado_id in covered_by_puesto.get(ce.curso_id, set()):
                continue
            if (ce.empleado_id, ce.curso_id) not in index:
                index[(ce.empleado_id, ce.curso_id)] = "extra"

        return index

    def _inscripcion_input(self, ce: CursoEmpleado) -> InscripcionEstadoInput | None:
        if not ce.sesion:
            return None
        estado = ce.sesion.estado.value if hasattr(ce.sesion.estado, "value") else str(ce.sesion.estado)
        return InscripcionEstadoInput(
            sesion_estado=estado,
            asistio=ce.asistio,
            fecha_inscripcion=ce.fecha,
            fecha_sesion_fin=ce.sesion.fecha_fin,
            fecha_sesion_inicio=ce.sesion.fecha_inicio,
        )

    async def _build_pares(
        self,
        cursos: list[Curso] | None = None,
        solo_activos: bool = False,
    ) -> tuple[dict[int, Curso], dict[tuple[int, int], _ParCursoEmpleado]]:
        if cursos is None:
            cursos = await self.repo.list_cursos_activos()
        curso_map = {c.id: c for c in cursos}

        curso_puestos = await self.repo.list_all_curso_puestos()
        grupos = await self.repo.list_all_grupos()
        extras = await self.repo.list_extras_sin_sesion()
        completed_pairs: set[tuple[int, int]] = set()
        if solo_activos:
            completed_pairs = await self.repo.completed_curso_pairs()
            inscripciones = await self.repo.list_inscripciones_activas_con_sesion()
        else:
            inscripciones = await self.repo.list_inscripciones_con_sesion()

        assignment_index = await self._build_assignment_index(cursos, curso_puestos, grupos, extras)

        pares: dict[tuple[int, int], _ParCursoEmpleado] = {}

        for (emp_id, curso_id), origen in assignment_index.items():
            if curso_id not in curso_map:
                continue
            if solo_activos and (emp_id, curso_id) in completed_pairs:
                continue
            pares[(emp_id, curso_id)] = _ParCursoEmpleado(
                empleado_id=emp_id,
                curso_id=curso_id,
                asignado=True,
                origen=origen,
            )

        for ce in inscripciones:
            if ce.curso_id not in curso_map:
                continue
            key = (ce.empleado_id, ce.curso_id)
            if solo_activos and key in completed_pairs:
                continue
            par = pares.get(key)
            if par is None:
                par = _ParCursoEmpleado(empleado_id=ce.empleado_id, curso_id=ce.curso_id, asignado=False)
                pares[key] = par
            ins = self._inscripcion_input(ce)
            if ins:
                par.inscripciones.append(ins)

        return curso_map, pares

    async def _build_pares_empleado(
        self,
        empleado_id: int,
    ) -> tuple[dict[int, Curso], dict[tuple[int, int], _ParCursoEmpleado]]:
        cursos_asignados = await self.asig.cursos_asignados_a_empleado(empleado_id)
        inscripciones = await self.repo.list_inscripciones_empleado_con_sesion(empleado_id)

        curso_ids = set(cursos_asignados)
        curso_ids.update(ce.curso_id for ce in inscripciones)
        if not curso_ids:
            return {}, {}

        cursos = await self.repo.list_cursos_by_ids(curso_ids)
        curso_map = {c.id: c for c in cursos}

        pares: dict[tuple[int, int], _ParCursoEmpleado] = {}
        for cid in cursos_asignados:
            if cid not in curso_map:
                continue
            origen = await self.asig.origen_asignacion(empleado_id, cid)
            pares[(empleado_id, cid)] = _ParCursoEmpleado(
                empleado_id=empleado_id,
                curso_id=cid,
                asignado=True,
                origen=origen,
            )

        for ce in inscripciones:
            if ce.curso_id not in curso_map:
                continue
            key = (empleado_id, ce.curso_id)
            par = pares.get(key)
            if par is None:
                par = _ParCursoEmpleado(
                    empleado_id=empleado_id,
                    curso_id=ce.curso_id,
                    asignado=False,
                )
                pares[key] = par
            ins = self._inscripcion_input(ce)
            if ins:
                par.inscripciones.append(ins)

        return curso_map, pares

    @staticmethod
    def _sesion_es_activa(estado_sesion: str, asistio: bool | None) -> bool:
        if estado_sesion in ("programada", "en_curso"):
            return True
        if estado_sesion == "completada":
            return asistio is not True
        return False

    def _estado_par(self, par: _ParCursoEmpleado) -> EstadoCursoEmpleadoLiteral | None:
        estado = compute_estado_curso_empleado(par.asignado, par.inscripciones)
        return estado  # type: ignore[return-value]

    def _ultima_sesion_info(self, par: _ParCursoEmpleado) -> tuple[int | None, str | None, str | None, bool | None]:
        if not par.inscripciones:
            return None, None, None, None
        priority = {"en_curso": 0, "programada": 1, "completada": 2, "cancelada": 3}
        sorted_ins = sorted(
            par.inscripciones,
            key=lambda i: (priority.get(i.sesion_estado, 9), i.fecha_sesion_inicio or date.min),
            reverse=True,
        )
        best = sorted_ins[0]
        # No tenemos sesion_id en InscripcionEstadoInput - we'll fix by loading from CE in registros
        return None, (
            str(best.fecha_sesion_inicio) if best.fecha_sesion_inicio else None
        ), best.sesion_estado, best.asistio

    async def _enrich_registros(
        self,
        pares: dict[tuple[int, int], _ParCursoEmpleado],
        curso_map: dict[int, Curso],
        inscripciones_raw: list[CursoEmpleado],
    ) -> list[CursosDashboardRegistroItem]:
        emp_ids = {p.empleado_id for p in pares.values()}
        empleados = await self.repo.get_empleados_map(emp_ids)

        # Map (emp, curso) -> latest inscription row for sesion_id
        ins_by_pair: dict[tuple[int, int], CursoEmpleado] = {}
        for ce in inscripciones_raw:
            key = (ce.empleado_id, ce.curso_id)
            prev = ins_by_pair.get(key)
            if prev is None or (ce.sesion and prev.sesion and ce.sesion.fecha_inicio > prev.sesion.fecha_inicio):
                ins_by_pair[key] = ce

        items: list[CursosDashboardRegistroItem] = []
        for (emp_id, curso_id), par in pares.items():
            estado = self._estado_par(par)
            if estado is None:
                continue
            curso = curso_map.get(curso_id)
            emp = empleados.get(emp_id)
            ce = ins_by_pair.get((emp_id, curso_id))
            sesion = ce.sesion if ce else None
            fin = fecha_finalizacion_curso(par.inscripciones)
            area_nombre = None
            puesto_nombre = None
            if emp:
                area_nombre = emp.area.descripcion if getattr(emp, "area", None) else None
                puesto_nombre = emp.puesto.descripcion if getattr(emp, "puesto", None) else None

            items.append(
                CursosDashboardRegistroItem(
                    empleado_id=emp_id,
                    nombre_empleado=emp.nombre if emp else None,
                    no_empleado=str(emp.no_empleado) if emp and emp.no_empleado is not None else None,
                    area_nombre=area_nombre,
                    puesto_nombre=puesto_nombre,
                    curso_id=curso_id,
                    curso_nombre=curso.nombre if curso else None,
                    curso_obligatorio=bool(curso.obligatorio) if curso else False,
                    estado_curso=estado,
                    origen_asignacion=par.origen,
                    sesion_id=sesion.id if sesion else None,
                    sesion_fecha_inicio=str(sesion.fecha_inicio) if sesion else None,
                    estado_sesion=(
                        sesion.estado.value if sesion and hasattr(sesion.estado, "value") else (
                            str(sesion.estado) if sesion else None
                        )
                    ),
                    asistio=ce.asistio if ce else None,
                    fecha_finalizacion=str(fin) if fin else None,
                )
            )
        return items

    def _apply_filtros(
        self,
        items: list[CursosDashboardRegistroItem],
        *,
        empleado_id: int | None = None,
        curso_id: int | None = None,
        area_id: int | None = None,
        puesto_id: int | None = None,
        estado_curso: str | None = None,
        estado_sesion: str | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        q: str | None = None,
        empleado_area_map: dict[int, int | None] | None = None,
        empleado_puesto_map: dict[int, int | None] | None = None,
    ) -> list[CursosDashboardRegistroItem]:
        filtered = items
        if empleado_id is not None:
            filtered = [i for i in filtered if i.empleado_id == empleado_id]
        if curso_id is not None:
            filtered = [i for i in filtered if i.curso_id == curso_id]
        if area_id is not None and empleado_area_map:
            filtered = [i for i in filtered if empleado_area_map.get(i.empleado_id) == area_id]
        if puesto_id is not None and empleado_puesto_map:
            filtered = [i for i in filtered if empleado_puesto_map.get(i.empleado_id) == puesto_id]
        if estado_curso:
            filtered = [i for i in filtered if i.estado_curso == estado_curso]
        if estado_sesion:
            filtered = [i for i in filtered if i.estado_sesion == estado_sesion]
        if fecha_desde or fecha_hasta:
            def in_range(item: CursosDashboardRegistroItem) -> bool:
                if not item.sesion_fecha_inicio:
                    return False
                d = date.fromisoformat(item.sesion_fecha_inicio)
                if fecha_desde and d < fecha_desde:
                    return False
                if fecha_hasta and d > fecha_hasta:
                    return False
                return True
            filtered = [i for i in filtered if in_range(i)]
        if q and q.strip():
            term = q.strip().lower()
            filtered = [
                i for i in filtered
                if (i.nombre_empleado and term in i.nombre_empleado.lower())
                or (i.curso_nombre and term in i.curso_nombre.lower())
                or (i.no_empleado and term in i.no_empleado.lower())
            ]
        return filtered

    def _empleados_resumen_items(
        self,
        emp_counts: dict[int, int],
        empleados: dict[int, Empleado],
    ) -> list[CursosDashboardEmpleadoResumenItem]:
        sorted_ids = sorted(emp_counts.keys(), key=lambda e: (-emp_counts[e], e))[: self.TOP_N]
        items: list[CursosDashboardEmpleadoResumenItem] = []
        for eid in sorted_ids:
            emp = empleados.get(eid)
            area_nombre = emp.area.descripcion if emp and getattr(emp, "area", None) else None
            items.append(
                CursosDashboardEmpleadoResumenItem(
                    empleado_id=eid,
                    nombre_empleado=emp.nombre if emp else None,
                    no_empleado=str(emp.no_empleado) if emp and emp.no_empleado is not None else None,
                    area_nombre=area_nombre,
                    pendientes_count=emp_counts[eid],
                )
            )
        return items

    async def obtener_resumen(
        self, solo_activos: bool = True, area_id: int | None = None
    ) -> CursosDashboardResumenResponse:
        """`area_id` recorta el resumen a un area. Recorta las DOS familias de
        KPI: los pares (empleado x curso) por el empleado, y las sesiones por
        tener al menos un inscrito del area — una sesion no es de un area, asi
        que sin ese segundo recorte medio tablero seguiria siendo global."""
        curso_map, pares = await self._build_pares(solo_activos=solo_activos)
        emp_area: set[int] | None = None
        if area_id is not None:
            emp_area = await self.repo.empleado_ids_de_area(area_id)
            pares = {k: v for k, v in pares.items() if v.empleado_id in emp_area}

        estados_curso: list[str] = []
        pendientes_por_emp: dict[int, int] = {}
        sesiones_pend_por_emp: dict[int, int] = {}
        cursos_asignados_ids: set[int] = set()
        empleados_sin_obligatorio: set[int] = set()
        completados_light: list[tuple[int, int, str, str | None]] = []

        for (emp_id, curso_id), par in pares.items():
            estado = self._estado_par(par)
            if estado is None:
                continue
            if solo_activos and estado not in self.ESTADOS_CURSO_ACTIVOS:
                continue
            estados_curso.append(estado)
            curso = curso_map.get(curso_id)
            if par.origen:
                cursos_asignados_ids.add(curso_id)
            if estado == "pendiente":
                pendientes_por_emp[emp_id] = pendientes_por_emp.get(emp_id, 0) + 1
            if estado in ("programado", "en_progreso"):
                sesiones_pend_por_emp[emp_id] = sesiones_pend_por_emp.get(emp_id, 0) + 1
            if curso and curso.obligatorio and estado != "completado":
                empleados_sin_obligatorio.add(emp_id)
            if not solo_activos and estado == "completado":
                fin = fecha_finalizacion_curso(par.inscripciones)
                if fin:
                    completados_light.append(
                        (emp_id, curso_id, str(fin), curso.nombre if curso else None),
                    )

        inscritos = await self.repo.count_inscritos_por_sesion(emp_area)
        if solo_activos:
            sesiones = await self.repo.list_sesiones_activas()
            cursos_completados_kpi = await self.repo.count_completed_curso_pairs(emp_area)
            sesiones_completadas_kpi = 0
        else:
            sesiones = await self.repo.list_sesiones()
            cursos_completados_kpi = estados_curso.count("completado")
            sesiones_completadas_kpi = sum(1 for s in sesiones if s.estado.value == "completada")

        if emp_area is not None:
            # `inscritos` ya viene contado solo con la gente del area, asi que
            # sus claves SON las sesiones que tocan al area.
            sesiones = [s for s in sesiones if s.id in inscritos]
            sesiones_completadas_kpi = (
                0 if solo_activos else sum(1 for s in sesiones if s.estado.value == "completada")
            )

        kpis = CursosDashboardKpis(
            cursos_asignados=len(cursos_asignados_ids),
            cursos_pendientes=estados_curso.count("pendiente"),
            cursos_completados=cursos_completados_kpi,
            cursos_con_sesion_proxima=estados_curso.count("programado") + estados_curso.count("en_progreso"),
            sesiones_pendientes=len(sesiones) if solo_activos else sum(
                1 for s in sesiones if s.estado.value in ("programada", "en_curso")
            ),
            sesiones_programadas=sum(1 for s in sesiones if s.estado.value == "programada"),
            sesiones_completadas=sesiones_completadas_kpi,
            empleados_con_cursos_pendientes=len(pendientes_por_emp),
            empleados_con_sesiones_pendientes=len(sesiones_pend_por_emp),
            empleados_sin_completar_obligatorio=len(empleados_sin_obligatorio),
        )

        top_emp_ids: set[int] = set()
        for emp_counts in (pendientes_por_emp, sesiones_pend_por_emp):
            top_emp_ids.update(
                sorted(emp_counts.keys(), key=lambda e: (-emp_counts[e], e))[: self.TOP_N],
            )
        completados_recientes: list[CursosDashboardCursoCompletadoItem] = []
        if not solo_activos:
            completados_light.sort(key=lambda row: row[2], reverse=True)
            top_emp_ids.update(row[0] for row in completados_light[: self.TOP_N])
        empleados = await self.repo.get_empleados_map(top_emp_ids)
        if not solo_activos:
            completados_recientes = [
                CursosDashboardCursoCompletadoItem(
                    empleado_id=emp_id,
                    nombre_empleado=empleados[emp_id].nombre if emp_id in empleados else None,
                    curso_id=curso_id,
                    curso_nombre=curso_nombre,
                    fecha_finalizacion=fecha_fin,
                )
                for emp_id, curso_id, fecha_fin, curso_nombre in completados_light[: self.TOP_N]
            ]

        hoy = date.today()
        proximas = [
            s for s in sesiones
            if s.estado.value in ("programada", "en_curso") and s.fecha_inicio >= hoy
        ]
        proximas.sort(key=lambda s: s.fecha_inicio)
        sesiones_proximas = [
            CursosDashboardSesionProximaItem(
                sesion_id=s.id,
                curso_id=s.curso_id,
                curso_nombre=curso_map.get(s.curso_id).nombre if curso_map.get(s.curso_id) else None,
                fecha_inicio=str(s.fecha_inicio),
                estado=s.estado.value if hasattr(s.estado, "value") else str(s.estado),
                inscritos_count=inscritos.get(s.id, 0),
            )
            for s in proximas[: self.TOP_N]
        ]

        areas = await self.repo.areas_con_registros()
        return CursosDashboardResumenResponse(
            kpis=kpis,
            areas=[CursosDashboardAreaItem(id=aid, nombre=nombre) for aid, nombre in areas],
            empleados_cursos_pendientes=self._empleados_resumen_items(pendientes_por_emp, empleados),
            empleados_sesiones_pendientes=self._empleados_resumen_items(sesiones_pend_por_emp, empleados),
            sesiones_proximas=sesiones_proximas,
            cursos_completados_recientes=completados_recientes,
        )

    async def listar_registros(
        self,
        page: int = 1,
        page_size: int = 50,
        empleado_id: int | None = None,
        curso_id: int | None = None,
        area_id: int | None = None,
        puesto_id: int | None = None,
        estado_curso: str | None = None,
        estado_sesion: str | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        q: str | None = None,
    ) -> CursosDashboardRegistrosResponse:
        curso_map, pares = await self._build_pares()
        inscripciones_raw = await self.repo.list_inscripciones_con_sesion()
        items = await self._enrich_registros(pares, curso_map, inscripciones_raw)

        emp_ids = {i.empleado_id for i in items}
        empleados = await self.repo.get_empleados_map(emp_ids)
        area_map = {eid: e.area_id for eid, e in empleados.items()}
        puesto_map = {eid: e.puesto_id for eid, e in empleados.items()}

        filtered = self._apply_filtros(
            items,
            empleado_id=empleado_id,
            curso_id=curso_id,
            area_id=area_id,
            puesto_id=puesto_id,
            estado_curso=estado_curso,
            estado_sesion=estado_sesion,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            q=q,
            empleado_area_map=area_map,
            empleado_puesto_map=puesto_map,
        )
        filtered.sort(key=lambda r: (r.nombre_empleado or "", r.curso_nombre or ""))
        total = len(filtered)
        start = (page - 1) * page_size
        page_items = filtered[start : start + page_size]
        return CursosDashboardRegistrosResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def historial_empleado(
        self,
        empleado_id: int,
        estado_curso: str | None = None,
        solo_activos: bool = True,
    ) -> CursosDashboardEmpleadoHistorialResponse:
        from app.core.exceptions import NotFoundError

        emp = await self.repo.get_empleado(empleado_id)
        if not emp:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        curso_map, pares = await self._build_pares_empleado(empleado_id)
        inscripciones_raw = await self.repo.list_inscripciones_empleado_con_sesion(empleado_id)

        cursos_items: list[CursosDashboardHistorialCursoItem] = []
        for (_, curso_id), par in pares.items():
            estado = self._estado_par(par)
            if estado is None:
                continue
            if solo_activos and estado not in self.ESTADOS_CURSO_ACTIVOS:
                continue
            if estado_curso and estado != estado_curso:
                continue
            curso = curso_map.get(curso_id)
            fin = fecha_finalizacion_curso(par.inscripciones)
            cursos_items.append(
                CursosDashboardHistorialCursoItem(
                    curso_id=curso_id,
                    curso_nombre=curso.nombre if curso else None,
                    curso_obligatorio=bool(curso.obligatorio) if curso else False,
                    estado_curso=estado,
                    origen_asignacion=par.origen,
                    fecha_finalizacion=str(fin) if fin else None,
                )
            )
        cursos_items.sort(key=lambda c: c.curso_nombre or "")

        hoy = date.today()
        sesiones_items: list[CursosDashboardHistorialSesionItem] = []
        for ce in inscripciones_raw:
            if not ce.sesion:
                continue
            s = ce.sesion
            estado_s = s.estado.value if hasattr(s.estado, "value") else str(s.estado)
            if solo_activos and not self._sesion_es_activa(estado_s, ce.asistio):
                continue
            curso = curso_map.get(ce.curso_id)
            es_proxima = estado_s in ("programada", "en_curso") and s.fecha_inicio >= hoy
            sesiones_items.append(
                CursosDashboardHistorialSesionItem(
                    sesion_id=s.id,
                    curso_id=ce.curso_id,
                    curso_nombre=curso.nombre if curso else None,
                    fecha_inicio=str(s.fecha_inicio),
                    fecha_fin=str(s.fecha_fin) if s.fecha_fin else None,
                    estado_sesion=estado_s,
                    asistio=ce.asistio,
                    es_proxima=es_proxima,
                )
            )
        sesiones_items.sort(key=lambda s: s.fecha_inicio, reverse=True)

        area_nombre = emp.area.descripcion if getattr(emp, "area", None) else None
        puesto_nombre = emp.puesto.descripcion if getattr(emp, "puesto", None) else None

        return CursosDashboardEmpleadoHistorialResponse(
            empleado_id=empleado_id,
            nombre_empleado=emp.nombre,
            no_empleado=str(emp.no_empleado) if emp.no_empleado is not None else None,
            area_nombre=area_nombre,
            puesto_nombre=puesto_nombre,
            cursos=cursos_items,
            sesiones=sesiones_items,
        )

    async def resumen_por_area(
        self, empleado_ids_scope: list[int] | None
    ) -> dict[int | None, CursosAreaAgg]:
        """Agrega el estado de los pares (empleado, curso) por area.

        Punto de entrada del Dashboard de Talento. Reutiliza `_build_pares` y
        `_estado_par`, de modo que el estado de un curso se decide con LA misma
        logica que la pantalla de seguimiento -- aqui no se reimplementa.

        `empleado_ids_scope` = None significa universo. La clave `None` del dict
        agrupa a empleados sin area asignada.
        """
        curso_map, pares = await self._build_pares()
        if empleado_ids_scope is not None:
            permitidos = set(empleado_ids_scope)
            pares = {k: v for k, v in pares.items() if v.empleado_id in permitidos}
        if not pares:
            return {}

        emp_ids = {p.empleado_id for p in pares.values()}
        empleados = await self.repo.get_empleados_map(emp_ids)

        out: dict[int | None, CursosAreaAgg] = {}
        for par in pares.values():
            estado = self._estado_par(par)
            if estado is None:
                continue
            emp = empleados.get(par.empleado_id)
            area_id = emp.area_id if emp is not None else None
            agg = out.setdefault(area_id, CursosAreaAgg())
            agg.total_pares += 1
            agg.empleados.add(par.empleado_id)
            if estado == "completado":
                agg.completados += 1
            else:
                curso = curso_map.get(par.curso_id)
                if curso is not None and curso.obligatorio:
                    agg.empleados_obligatorio_pendiente.add(par.empleado_id)
        return out
