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

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.ciclo_desempeno_service import CicloDesempenoService
from app.services.operaciones_service import OperacionesService
from app.services.talento import calculo

MODULE_KEY = "dashboard-talento"


# ── Tipos de salida ───────────────────────────────────────────────────────
@dataclass
class OrgPolivalencia:
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


@dataclass
class AreaPolivalencia:
    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


@dataclass
class BloquePolivalencia:
    disponible: bool
    org: OrgPolivalencia | None
    areas: list[AreaPolivalencia] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaDesempeno:
    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    semaforo: str | None


@dataclass
class OrgDesempeno:
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


@dataclass
class CicloInfo:
    id: int
    nombre: str
    estado: str


@dataclass
class BloqueDesempeno:
    disponible: bool
    ciclo: CicloInfo | None = None
    org: OrgDesempeno | None = None
    areas: list[AreaDesempeno] = field(default_factory=list)
    motivo: str | None = None


def _f(valor: Decimal | float | None) -> float | None:
    return None if valor is None else float(valor)


class TalentoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)
        self.oper_svc = OperacionesService(db)
        self.ciclo_svc = CicloDesempenoService(db)

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
            cerrados, key=lambda c: (c.fecha_fin is None, c.fecha_fin, c.id), reverse=True
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
