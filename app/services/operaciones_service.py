"""Analitica de cobertura y polivalencia por area (solo lectura).

Reutiliza `CompetenciaService.obtener_multihabilidades` (grilla empleado x
competencia por puesto, con manejo de grado) y agrega por area. Scope por rol
via `empleado_ids_scope_por_modulo`. Sin tabla nueva.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.catalogos import Area
from app.models.talento import CompetenciaRequisito, PuestoPerfil
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.competencia_service import CompetenciaService
from app.services.operaciones import calculo
from app.services.operaciones.types import (
    CandidatoCrossTrain,
    CoberturaCompetencia,
    CompetenciaMeta,
    EmpleadoCompetencias,
)

MODULE_KEY = "operaciones"


@dataclass
class PuestoArea:
    puesto_perfil_id: int
    puesto_nombre: str
    area_id: int
    area_nombre: str


@dataclass
class AreaResumen:
    area_id: int
    area_nombre: str
    pol_area_pct: float
    resiliencia_pct: float
    n_criticas: int
    n_empleados: int


@dataclass
class PuestoCobertura:
    puesto_perfil_id: int
    puesto_nombre: str
    competencias: list[CoberturaCompetencia]


@dataclass
class Critica:
    competencia_id: int
    competencia_nombre: str
    severidad: str
    candidatos: list[CandidatoCrossTrain]


@dataclass
class CoberturaArea:
    resumen: AreaResumen
    competencias: list[CoberturaCompetencia]
    puestos: list[PuestoCobertura]
    criticas: list[Critica]


class OperacionesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.comp_svc = CompetenciaService(db)
        self.empleado_repo = EmpleadoRepository(db)

    async def _puestos_con_area(self) -> list[PuestoArea]:
        """Puestos activos con >= 1 competencia requisito, con su area."""
        result = await self.db.execute(
            select(PuestoPerfil.id, PuestoPerfil.nombre, PuestoPerfil.area_id, Area.descripcion)
            .join(Area, Area.area_id == PuestoPerfil.area_id)
            .where(
                PuestoPerfil.activo.is_(True),
                exists().where(CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id),
            )
        )
        return [
            PuestoArea(puesto_perfil_id=r[0], puesto_nombre=r[1], area_id=r[2], area_nombre=r[3])
            for r in result.all()
        ]

    async def _empleados_de_puesto(
        self, puesto_perfil_id: int, puesto_nombre: str
    ) -> tuple[list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]:
        resp = await self.comp_svc.obtener_multihabilidades(puesto_perfil_id)
        comp_meta = {
            c.competencia_id: CompetenciaMeta(c.competencia_id, c.competencia_nombre, c.tipo_nombre)
            for c in resp.competencias
        }
        empleados: list[EmpleadoCompetencias] = []
        for emp in resp.empleados:
            comps: dict[int, tuple[int, int]] = {}
            for comp_id, requerido in emp.requisitos.items():
                if requerido < 1:
                    continue
                comps[comp_id] = (emp.niveles.get(comp_id, 0), requerido)
            empleados.append(
                EmpleadoCompetencias(
                    empleado_id=emp.empleado_id,
                    no_empleado=emp.no_empleado,
                    nombre=emp.nombre,
                    puesto_perfil_id=resp.puesto_perfil_id,
                    puesto_nombre=puesto_nombre,
                    competencias=comps,
                )
            )
        return empleados, comp_meta

    async def _cargar_area(
        self, area_id: int, scope: list[int] | None
    ) -> tuple[str, list[PuestoCobertura], list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]:
        """Devuelve (area_nombre, puestos_cobertura, empleados_scope, comp_meta)."""
        puestos = [p for p in await self._puestos_con_area() if p.area_id == area_id]
        area_nombre = puestos[0].area_nombre if puestos else ""
        puestos_cob: list[PuestoCobertura] = []
        empleados_area: list[EmpleadoCompetencias] = []
        comp_meta: dict[int, CompetenciaMeta] = {}
        for p in puestos:
            emps, meta = await self._empleados_de_puesto(p.puesto_perfil_id, p.puesto_nombre)
            comp_meta.update(meta)
            if scope is not None:
                emps = [e for e in emps if e.empleado_id in scope]
            empleados_area.extend(emps)
            puestos_cob.append(
                PuestoCobertura(
                    puesto_perfil_id=p.puesto_perfil_id,
                    puesto_nombre=p.puesto_nombre,
                    competencias=calculo.cobertura_por_competencia(emps, meta),
                )
            )
        return area_nombre, puestos_cob, empleados_area, comp_meta

    def _resumen(self, area_id, area_nombre, empleados, coberturas) -> AreaResumen:
        n_criticas = sum(1 for c in coberturas if c.severidad != "ok")
        return AreaResumen(
            area_id=area_id,
            area_nombre=area_nombre,
            pol_area_pct=calculo.indice_polivalencia_area(empleados),
            resiliencia_pct=calculo.resiliencia_area(coberturas),
            n_criticas=n_criticas,
            n_empleados=len({e.empleado_id for e in empleados}),
        )

    async def listar_areas(self, current_user, rh_ui_mode) -> list[AreaResumen]:
        scope = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        puestos = await self._puestos_con_area()
        # Agrupa puestos por area en una sola pasada.
        por_area: dict[int, tuple[str, list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]] = {}
        for p in puestos:
            emps, meta = await self._empleados_de_puesto(p.puesto_perfil_id, p.puesto_nombre)
            if scope is not None:
                emps = [e for e in emps if e.empleado_id in scope]
            nombre, acc_emps, acc_meta = por_area.setdefault(p.area_id, (p.area_nombre, [], {}))
            acc_emps.extend(emps)
            acc_meta.update(meta)
        resumenes: list[AreaResumen] = []
        for area_id, (nombre, emps, meta) in por_area.items():
            if not emps:
                continue  # area sin personal en scope
            coberturas = calculo.cobertura_por_competencia(emps, meta)
            resumenes.append(self._resumen(area_id, nombre, emps, coberturas))
        resumenes.sort(key=lambda a: (-a.n_criticas, a.area_nombre))
        return resumenes

    async def cobertura_area(self, current_user, area_id: int, rh_ui_mode) -> CoberturaArea:
        scope = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        area_nombre, puestos_cob, empleados, comp_meta = await self._cargar_area(area_id, scope)
        if not puestos_cob:
            # Area inexistente o sin puestos con competencias requisito: nada que mostrar.
            raise NotFoundError(entidad="Area", id=area_id)
        if not empleados:
            # Existe pero no hay personal visible: fuera de scope (jefe) o sin datos (RH).
            if scope is not None:
                raise ForbiddenError(detail="Area fuera de tu alcance")
            raise NotFoundError(entidad="Area", id=area_id)
        coberturas = calculo.cobertura_por_competencia(empleados, comp_meta)
        criticas = [
            Critica(
                competencia_id=c.competencia_id,
                competencia_nombre=c.competencia_nombre,
                severidad=c.severidad,
                candidatos=calculo.candidatos_crosstrain(c.competencia_id, empleados),
            )
            for c in coberturas
            if c.severidad != "ok"
        ]
        return CoberturaArea(
            resumen=self._resumen(area_id, area_nombre, empleados, coberturas),
            competencias=coberturas,
            puestos=puestos_cob,
            criticas=criticas,
        )
