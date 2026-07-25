"""Dashboard de Talento: agregador de solo lectura por area.

Principio central: este service NO re-deriva nada de tablas crudas. Consume los
building blocks que ya alimentan cada modulo (Operaciones, Ciclo de Desempeno,
dashboard de Cursos, repositorio de PDI, Historial Objetivo), de modo que sus
numeros cuadran por construccion con la pantalla de origen.

Scope: se resuelve UNA sola vez con el module_key de este modulo y se pasa
explicito a cada bloque. Si cada bloque resolviera el suyo, dos columnas de la
misma fila saldrian calculadas sobre poblaciones distintas.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.pdi_repository import PDIRepository
from app.services.ciclo_desempeno_service import CicloDesempenoService
from app.services.historial_objetivo_service import HistorialObjetivoService
from app.services.level_up_cursos_dashboard import LevelUpCursosDashboardService
from app.services.operaciones_service import OperacionesService
from app.services.talento import calculo
from app.services.talento.constants import (
    POLIVALENCIA_BAJA_MAX,
    RANGO_OBJETIVO_MESES_DEFAULT,
)
# Las dataclasses de salida (Bloque*/Area*/Org*/DetalleArea/etc.) viven en
# app.services.talento.types junto con SenalesEmpleado -- son la misma
# categoria de estructura pura (sin self, sin BD). Se reexportan aca para no
# romper a quien ya las importa desde este modulo (tests, y a futuro los
# schemas Pydantic que las espejan).
from app.services.talento.types import (  # noqa: F401
    AreaCapacitacion,
    AreaDesempeno,
    AreaObjetivo,
    AreaPdi,
    AreaPolivalencia,
    BloqueCapacitacion,
    BloqueDesempeno,
    BloqueObjetivo,
    BloquePdi,
    BloquePolivalencia,
    CicloInfo,
    DetalleArea,
    EmpleadoFoco,
    OrgCapacitacion,
    OrgDesempeno,
    OrgObjetivo,
    OrgPdi,
    OrgPolivalencia,
    RangoObjetivo,
    SenalesEmpleado,
)

MODULE_KEY = "dashboard-talento"


def _f(valor: Decimal | float | None) -> float | None:
    return None if valor is None else float(valor)


class TalentoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)
        self.oper_svc = OperacionesService(db)
        self.ciclo_svc = CicloDesempenoService(db)
        self.cursos_svc = LevelUpCursosDashboardService(db)
        self.pdi_repo = PDIRepository(db)
        self.historial_svc = HistorialObjetivoService(db)

    # ── Scope y catalogos ────────────────────────────────────────────────
    async def scope(self, current_user: Empleado, rh_ui_mode: str | None) -> list[int] | None:
        """Ids de empleados visibles (`None` = universo), resueltos con el
        module_key de ESTE modulo. Unico punto donde se decide el scope."""
        return await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )

    async def areas_de_empleados(self, empleado_ids: list[int]) -> dict[int, int | None]:
        """empleado_id -> area_id. `Empleado.area_id` es el mismo criterio que
        ya usan PDI y el dashboard de cursos para agrupar por area."""
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.area_id).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
        return {row[0]: row[1] for row in result.all()}

    async def nombres_de_areas(self, area_ids: list[int]) -> dict[int, str]:
        """area_id -> descripcion. Tabla legacy `areas`, solo lectura."""
        from app.models.catalogos import Area

        ids = [a for a in area_ids if a is not None]
        if not ids:
            return {}
        result = await self.db.execute(
            select(Area.area_id, Area.descripcion).where(Area.area_id.in_(ids))
        )
        return {row[0]: row[1] for row in result.all()}

    async def ciclo_vigente(self, ciclo_id: int | None):
        """Ciclo a mostrar: el pedido, si no el `activo`, si no el ultimo
        `cerrado` por fecha de fin. `None` si no hay ninguno."""
        if ciclo_id is not None:
            ciclos = await self.ciclo_svc.list_ciclos()
            return next((c for c in ciclos if c.id == ciclo_id), None)
        activos = await self.ciclo_svc.list_ciclos(estado="activo")
        if activos:
            return activos[0]
        cerrados = await self.ciclo_svc.list_ciclos(estado="cerrado")
        if not cerrados:
            return None
        return sorted(
            cerrados, key=lambda c: (c.fecha_fin or date.min, c.id), reverse=True
        )[0]

    # ── Bloque: polivalencia ─────────────────────────────────────────────
    async def bloque_polivalencia(
        self, current_user: Empleado, rh_ui_mode: str | None
    ) -> BloquePolivalencia:
        scope = await self.scope(current_user, rh_ui_mode)
        resumenes = await self.oper_svc.listar_areas_con_scope(scope)
        areas = [
            AreaPolivalencia(
                area_id=r.area_id,
                area_nombre=r.area_nombre,
                n_empleados=r.n_empleados,
                pol_pct=r.pol_area_pct,
                resiliencia_pct=r.resiliencia_pct,
                n_criticas=r.n_criticas,
                semaforo=calculo.semaforo_pct(r.pol_area_pct),
            )
            for r in resumenes
        ]
        if not areas:
            return BloquePolivalencia(disponible=True, org=None, areas=[], motivo="sin_datos")
        pol_org = calculo.promedio_ponderado([(a.pol_pct or 0.0, a.n_empleados) for a in areas])
        res_org = calculo.promedio_ponderado(
            [(a.resiliencia_pct or 0.0, a.n_empleados) for a in areas]
        )
        org = OrgPolivalencia(
            pol_pct=pol_org,
            resiliencia_pct=res_org,
            n_criticas=sum(a.n_criticas for a in areas),
            n_empleados=sum(a.n_empleados for a in areas),
            semaforo=calculo.semaforo_pct(pol_org),
        )
        return BloquePolivalencia(disponible=True, org=org, areas=areas)

    # ── Bloque: desempeno ────────────────────────────────────────────────
    async def bloque_desempeno(
        self, current_user: Empleado, rh_ui_mode: str | None, ciclo_id: int | None
    ) -> BloqueDesempeno:
        ciclo = await self.ciclo_vigente(ciclo_id)
        if ciclo is None:
            return BloqueDesempeno(disponible=False, motivo="sin_ciclo")

        scope = await self.scope(current_user, rh_ui_mode)
        scope_set = set(scope) if scope is not None else None
        resultados = await self.ciclo_svc.resultados_ciclo(ciclo.id, scope_set)
        if not resultados:
            return BloqueDesempeno(
                disponible=True,
                ciclo=CicloInfo(id=ciclo.id, nombre=ciclo.nombre, estado=ciclo.estado),
                org=None,
                areas=[],
                motivo="sin_resultados",
            )

        area_por_emp = await self.areas_de_empleados([r.empleado_id for r in resultados])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        por_area: dict[int | None, list] = {}
        for r in resultados:
            por_area.setdefault(area_por_emp.get(r.empleado_id), []).append(r)

        areas: list[AreaDesempeno] = []
        for area_id, filas in por_area.items():
            areas.append(self._area_desempeno(area_id, nombres.get(area_id), filas))
        areas.sort(key=lambda a: (a.calificacion_promedio is None, a.calificacion_promedio or 0.0))

        nine_box_resp = await self.ciclo_svc.construir_9box(ciclo.id, scope_set)
        nine_box = {
            celda.segmento: len(celda.empleados) for celda in getattr(nine_box_resp, "celdas", [])
        }
        org_area = self._area_desempeno(None, "org", resultados)
        org = OrgDesempeno(
            calificacion_promedio=org_area.calificacion_promedio,
            cumplimiento_metas_pct=org_area.cumplimiento_metas_pct,
            con_resultado_pct=org_area.con_resultado_pct,
            distribucion=org_area.distribucion,
            nine_box=nine_box,
            semaforo=self._semaforo_desempeno(org_area.calificacion_promedio, ciclo),
            n_empleados=len(resultados),
        )
        for a in areas:
            a.semaforo = self._semaforo_desempeno(a.calificacion_promedio, ciclo)
        return BloqueDesempeno(
            disponible=True,
            ciclo=CicloInfo(id=ciclo.id, nombre=ciclo.nombre, estado=ciclo.estado),
            org=org,
            areas=areas,
        )

    def _area_desempeno(self, area_id, area_nombre, filas) -> AreaDesempeno:
        calificaciones = [
            _f(r.calificacion_desempeno) for r in filas if r.calificacion_desempeno is not None
        ]
        metas = [_f(r.cumplimiento_metas) for r in filas if r.cumplimiento_metas is not None]
        distribucion = {"bajo": 0, "medio": 0, "alto": 0}
        for r in filas:
            banda = r.banda_desempeno_efectiva
            if banda in distribucion:
                distribucion[banda] += 1
        return AreaDesempeno(
            area_id=area_id,
            area_nombre=area_nombre or "Sin area",
            n_empleados=len(filas),
            calificacion_promedio=calculo.promedio(calificaciones),
            cumplimiento_metas_pct=calculo.promedio(metas),
            con_resultado_pct=round(len(calificaciones) / len(filas) * 100, 1) if filas else 0.0,
            distribucion=distribucion,
            semaforo=None,  # lo llena el caller, que conoce los umbrales del ciclo
        )

    @staticmethod
    def _semaforo_desempeno(valor: float | None, ciclo) -> str | None:
        """Semaforo de desempeno con los umbrales DEL CICLO (no los de Talento):
        el dashboard no inventa cortes de desempeno."""
        if valor is None:
            return None
        if valor >= float(ciclo.umbral_alto):
            return "verde"
        if valor >= float(ciclo.umbral_medio):
            return "ambar"
        return "rojo"

    @staticmethod
    def _pct(parte: int, total: int) -> float | None:
        """Porcentaje a 1 decimal. Total 0 -> None (n/d), nunca 0.0."""
        if total <= 0:
            return None
        return round(parte / total * 100, 1)

    # ── Bloque: capacitacion ─────────────────────────────────────────────
    async def bloque_capacitacion(
        self, current_user: Empleado, rh_ui_mode: str | None
    ) -> BloqueCapacitacion:
        scope = await self.scope(current_user, rh_ui_mode)
        resumen = await self.cursos_svc.resumen_por_area(scope)
        if not resumen:
            return BloqueCapacitacion(disponible=True, org=None, areas=[], motivo="sin_datos")

        nombres = await self.nombres_de_areas([a for a in resumen if a is not None])
        areas: list[AreaCapacitacion] = []
        for area_id, agg in resumen.items():
            pct = self._pct(agg.completados, agg.total_pares)
            areas.append(
                AreaCapacitacion(
                    area_id=area_id,
                    area_nombre=nombres.get(area_id, "Sin area") if area_id else "Sin area",
                    total_pares=agg.total_pares,
                    completados=agg.completados,
                    cumplimiento_pct=pct,
                    n_obligatorio_pendiente=len(agg.empleados_obligatorio_pendiente),
                    semaforo=calculo.semaforo_pct(pct),
                )
            )
        areas.sort(key=lambda a: (a.cumplimiento_pct is None, a.cumplimiento_pct or 0.0))

        total = sum(a.total_pares for a in areas)
        completados = sum(a.completados for a in areas)
        pct_org = self._pct(completados, total)
        org = OrgCapacitacion(
            total_pares=total,
            completados=completados,
            cumplimiento_pct=pct_org,
            n_obligatorio_pendiente=sum(a.n_obligatorio_pendiente for a in areas),
            semaforo=calculo.semaforo_pct(pct_org),
        )
        return BloqueCapacitacion(disponible=True, org=org, areas=areas)

    # ── Bloque: PDI ──────────────────────────────────────────────────────
    async def bloque_pdi(self, current_user: Empleado, rh_ui_mode: str | None) -> BloquePdi:
        """Un PDI cancelado deja de existir para el dashboard: ni suma a
        activos, ni castiga el cumplimiento. `n_activos` se calcula desde
        en_proceso + pendientes (nunca resta cancelados de `total`, que
        cuenta de mas: en_proceso + pendientes + cancelados). `cumplimiento_pct`
        usa `total - cancelados` como denominador."""
        scope = await self.scope(current_user, rh_ui_mode)
        filas = await self.pdi_repo.equipo_pdi_aggregates(empleado_ids=scope)
        if not filas:
            return BloquePdi(disponible=True, org=None, areas=[], motivo="sin_datos")

        area_por_emp = await self.areas_de_empleados([f.empleado_id for f in filas])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        # area -> [total, completados, en_proceso, pendientes, vencidos, cancelados]
        acc: dict[int | None, list[int]] = {}
        for f in filas:
            area_id = area_por_emp.get(f.empleado_id)
            a = acc.setdefault(area_id, [0, 0, 0, 0, 0, 0])
            a[0] += f.total
            a[1] += f.completadas
            a[2] += f.en_proceso
            a[3] += f.pendientes
            a[4] += f.vencidas
            a[5] += f.cancelados

        areas: list[AreaPdi] = []
        for area_id, (total, completados, en_proceso, pendientes, vencidos, cancelados) in acc.items():
            pct = self._pct(completados, total - cancelados)
            areas.append(
                AreaPdi(
                    area_id=area_id,
                    area_nombre=nombres.get(area_id, "Sin area") if area_id else "Sin area",
                    total=total,
                    completados=completados,
                    cancelados=cancelados,
                    cumplimiento_pct=pct,
                    n_vencidos=vencidos,
                    n_activos=max(en_proceso + pendientes - vencidos, 0),
                    semaforo=calculo.semaforo_pct(pct),
                )
            )
        areas.sort(key=lambda a: (a.cumplimiento_pct is None, a.cumplimiento_pct or 0.0))

        total = sum(a.total for a in areas)
        completados = sum(a.completados for a in areas)
        cancelados = sum(a.cancelados for a in areas)
        pct_org = self._pct(completados, total - cancelados)
        org = OrgPdi(
            total=total,
            completados=completados,
            cancelados=cancelados,
            cumplimiento_pct=pct_org,
            n_vencidos=sum(a.n_vencidos for a in areas),
            n_activos=sum(a.n_activos for a in areas),
            semaforo=calculo.semaforo_pct(pct_org),
        )
        return BloquePdi(disponible=True, org=org, areas=areas)

    # ── Bloque: historial objetivo (diferido) ────────────────────────────
    async def bloque_objetivo(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
        desde: date | None,
        hasta: date | None,
        area_id: int | None,
    ) -> BloqueObjetivo:
        """Indice objetivo (0-100) promediado por area.

        Se sirve en su propio endpoint porque consulta DATOS_ANALISIS: si esa BD
        no responde, solo esta columna se cae. NO confundir este indice con el
        `indice_historial` del resultado del ciclo: aquel ya va ponderado dentro
        de la calificacion de desempeno y se calcula sobre el rango del ciclo."""
        if hasta is None:
            hasta = date.today()
        if desde is None:
            desde = hasta - timedelta(days=30 * RANGO_OBJETIVO_MESES_DEFAULT)

        scope = await self.scope(current_user, rh_ui_mode)
        resp = await self.historial_svc.indice_equipo_con_scope(scope, desde, hasta)
        rango = RangoObjetivo(desde=desde, hasta=hasta)
        if not resp.items:
            return BloqueObjetivo(disponible=True, rango=rango, org=None, areas=[], motivo="sin_datos")

        area_por_emp = await self.areas_de_empleados([i.empleado_id for i in resp.items])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        por_area: dict[int | None, list[float]] = {}
        for item in resp.items:
            a = area_por_emp.get(item.empleado_id)
            if area_id is not None and a != area_id:
                continue
            por_area.setdefault(a, []).append(float(item.resultado.indice))

        areas = [
            AreaObjetivo(
                area_id=aid,
                area_nombre=(nombres.get(aid, "Sin area") if aid else "Sin area"),
                n_empleados=len(indices),
                indice_promedio=calculo.promedio(indices),
            )
            for aid, indices in por_area.items()
        ]
        areas.sort(key=lambda a: (a.indice_promedio is None, a.indice_promedio or 0.0))
        todos = [v for indices in por_area.values() for v in indices]
        org = OrgObjetivo(n_empleados=len(todos), indice_promedio=calculo.promedio(todos))
        return BloqueObjetivo(disponible=True, rango=rango, org=org, areas=areas)

    # ── Senales por empleado (detalle de area) ───────────────────────────
    async def _pdi_vencido_por_empleado(self, empleado_ids: list[int]) -> dict[int, bool]:
        if not empleado_ids:
            return {}
        filas = await self.pdi_repo.equipo_pdi_aggregates(empleado_ids=empleado_ids)
        return {f.empleado_id: f.vencidas > 0 for f in filas}

    async def _obligatorio_pendiente_por_empleado(
        self, empleado_ids: list[int]
    ) -> dict[int, bool | None]:
        """`None` = el empleado no aparecio en ningun par (empleado, curso):
        no es evaluable en capacitacion (no confundir con `False`, que
        significa 'se evaluo y no tiene obligatorios pendientes')."""
        if not empleado_ids:
            return {}
        resumen = await self.cursos_svc.resumen_por_area(empleado_ids)
        aparecieron: set[int] = set()
        pendientes: set[int] = set()
        for agg in resumen.values():
            aparecieron |= agg.empleados
            pendientes |= agg.empleados_obligatorio_pendiente
        return {
            eid: (eid in pendientes) if eid in aparecieron else None
            for eid in empleado_ids
        }

    async def detalle_area(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
        area_id: int,
        ciclo_id: int | None,
    ) -> DetalleArea:
        """Agregados del area + empleados en foco.

        `polivalencia_empleados_area` es quien decide visibilidad: propaga
        `NotFoundError` (area inexistente) o `ForbiddenError` (fuera de scope),
        mismo criterio que `cobertura_area` en Operaciones."""
        scope = await self.scope(current_user, rh_ui_mode)
        polivalencia = await self.oper_svc.polivalencia_empleados_area(area_id, scope)
        empleado_ids = [p.empleado_id for p in polivalencia]
        nombres = await self.nombres_de_areas([area_id])

        ciclo = await self.ciclo_vigente(ciclo_id)
        banda_por_emp: dict[int, str | None] = {}
        area_desempeno: AreaDesempeno | None = None
        if ciclo is not None:
            resultados = await self.ciclo_svc.resultados_ciclo(ciclo.id, set(empleado_ids))
            banda_por_emp = {r.empleado_id: r.banda_desempeno_efectiva for r in resultados}
            if resultados:
                area_desempeno = self._area_desempeno(
                    area_id, nombres.get(area_id), resultados
                )
                area_desempeno.semaforo = self._semaforo_desempeno(
                    area_desempeno.calificacion_promedio, ciclo
                )

        pdi_vencido = await self._pdi_vencido_por_empleado(empleado_ids)
        obligatorio = await self._obligatorio_pendiente_por_empleado(empleado_ids)

        senales = [
            SenalesEmpleado(
                empleado_id=p.empleado_id,
                no_empleado=p.no_empleado,
                nombre=p.nombre,
                puesto_nombre=p.puesto_nombre,
                desempeno_bajo=(
                    None
                    if p.empleado_id not in banda_por_emp
                    else banda_por_emp[p.empleado_id] == "bajo"
                ),
                polivalencia_baja=(
                    None if p.pol_pct is None else p.pol_pct < POLIVALENCIA_BAJA_MAX
                ),
                capacitacion_pendiente=obligatorio.get(p.empleado_id),
                pdi_vencido=pdi_vencido.get(p.empleado_id),
            )
            for p in polivalencia
        ]
        foco = [
            EmpleadoFoco(
                empleado_id=s.empleado_id,
                no_empleado=s.no_empleado,
                nombre=s.nombre,
                puesto_nombre=s.puesto_nombre,
                senales=s.senales_activas,
            )
            for s in calculo.empleados_en_foco(senales)
        ]

        bloque_pol = await self.bloque_polivalencia(current_user, rh_ui_mode)
        bloque_cap = await self.bloque_capacitacion(current_user, rh_ui_mode)
        bloque_pdi = await self.bloque_pdi(current_user, rh_ui_mode)
        return DetalleArea(
            area_id=area_id,
            area_nombre=nombres.get(area_id, "Sin area"),
            desempeno=area_desempeno,
            polivalencia=next((a for a in bloque_pol.areas if a.area_id == area_id), None),
            capacitacion=next((a for a in bloque_cap.areas if a.area_id == area_id), None),
            pdi=next((a for a in bloque_pdi.areas if a.area_id == area_id), None),
            empleados_foco=foco,
        )

    # ── Export xlsx ──────────────────────────────────────────────────────
    async def exportar_excel(
        self, current_user: Empleado, rh_ui_mode: str | None, ciclo_id: int | None
    ) -> BytesIO:
        """xlsx con 2 hojas: Resumen por area y Empleados en foco.

        El bloque de historial objetivo se intenta, pero si DATOS_ANALISIS no
        responde su columna queda como "no disponible": el export nunca falla
        por culpa de la BD externa."""
        from openpyxl import Workbook

        pol = await self.bloque_polivalencia(current_user, rh_ui_mode)
        cap = await self.bloque_capacitacion(current_user, rh_ui_mode)
        pdi = await self.bloque_pdi(current_user, rh_ui_mode)
        des = await self.bloque_desempeno(current_user, rh_ui_mode, ciclo_id)
        try:
            obj = await self.bloque_objetivo(current_user, rh_ui_mode, None, None, None)
            obj_por_area = {a.area_id: a.indice_promedio for a in obj.areas}
            obj_disponible = True
        except Exception:  # noqa: BLE001 - la BD externa no debe tumbar el export
            obj_por_area = {}
            obj_disponible = False

        des_por_area = {a.area_id: a for a in des.areas}
        cap_por_area = {a.area_id: a for a in cap.areas}
        pdi_por_area = {a.area_id: a for a in pdi.areas}

        wb = Workbook()
        hoja = wb.active
        hoja.title = "Resumen por area"
        hoja.append(
            ["Area", "Personal", "Desempeno", "Polivalencia", "Resiliencia",
             "Indice objetivo", "Capacitacion", "PDI", "Competencias criticas"]
        )
        for a in pol.areas:
            d = des_por_area.get(a.area_id)
            c = cap_por_area.get(a.area_id)
            p = pdi_por_area.get(a.area_id)
            hoja.append([
                a.area_nombre,
                a.n_empleados,
                d.calificacion_promedio if d else None,
                a.pol_pct,
                a.resiliencia_pct,
                obj_por_area.get(a.area_id) if obj_disponible else "no disponible",
                c.cumplimiento_pct if c else None,
                p.cumplimiento_pct if p else None,
                a.n_criticas,
            ])

        hoja_foco = wb.create_sheet("Empleados en foco")
        hoja_foco.append(["Area", "No. empleado", "Nombre", "Puesto", "Senales"])
        for a in pol.areas:
            detalle = await self.detalle_area(current_user, rh_ui_mode, a.area_id, ciclo_id)
            for e in detalle.empleados_foco:
                hoja_foco.append([
                    a.area_nombre, e.no_empleado, e.nombre, e.puesto_nombre,
                    ", ".join(e.senales),
                ])

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
