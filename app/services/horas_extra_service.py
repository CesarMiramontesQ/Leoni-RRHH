"""Servicio de Horas Extra: empleados reales + campos simulados estables."""

from __future__ import annotations

from app.core.data_scope import effective_data_scope_rol, empleado_ids_en_alcance
from app.core.exceptions import ForbiddenError
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.horas_extra_repository import HorasExtraRepository
from app.schemas.horas_extra import (
    HorasExtraCentroCostoOption,
    HorasExtraEmpleadoResponse,
    HorasExtraFilaResponse,
    HorasExtraFilterOptionsResponse,
    HorasExtraLiderResponse,
    HorasExtraListResponse,
    HorasExtraResumenResponse,
    HorasExtraSimuladoResponse,
    HorasExtraTabFiltro,
)
from app.services.horas_extra_simulacion import SEMANA_ACTUAL, simular_fila_horas_extra
from sqlalchemy.ext.asyncio import AsyncSession

_ROLES_PERMITIDOS = frozenset({"rh", "director", "gerente"})


class HorasExtraService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HorasExtraRepository(db)
        self.empleado_repo = EmpleadoRepository(db)

    def _require_acceso(self, current_user: Empleado) -> None:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol not in _ROLES_PERMITIDOS:
            raise ForbiddenError(detail="No tienes acceso a Horas Extra")

    async def _ids_permitidos(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> list[int] | None:
        scope = effective_data_scope_rol(current_user, rh_ui_mode)
        if scope in ("rh", "director"):
            return None
        if scope == "gerente":
            return await empleado_ids_en_alcance(
                self.empleado_repo,
                current_user,
                rh_ui_mode,
            )
        raise ForbiddenError(detail="No tienes acceso a Horas Extra")

    @staticmethod
    def _to_empleado_response(emp: Empleado) -> HorasExtraEmpleadoResponse:
        lider: HorasExtraLiderResponse | None = None
        if emp.lider:
            lider = HorasExtraLiderResponse(
                empleado_id=int(emp.lider.empleado_id),
                nombre=emp.lider.nombre,
            )
        return HorasExtraEmpleadoResponse(
            id=emp.id,
            empleado_id=int(emp.empleado_id),
            no_empleado=emp.no_empleado,
            nombre=emp.nombre,
            puesto_nombre=emp.puesto.descripcion if emp.puesto else None,
            centrocosto_id=int(emp.centrocosto_id),
            lider=lider,
        )

    def _tab_coincide(self, estado: str, tab: HorasExtraTabFiltro) -> bool:
        if tab == "todos":
            return True
        mapping = {
            "pendientes": "pendiente",
            "aprobados": "aprobado",
            "rechazados": "rechazado",
        }
        return estado == mapping[tab]

    async def listar(
        self,
        *,
        current_user: Empleado,
        rh_ui_mode: str | None,
        page: int,
        page_size: int,
        tab: HorasExtraTabFiltro = "todos",
        q: str | None = None,
        area_id: int | None = None,
        centrocosto_id: int | None = None,
        lider_empleado_id: int | None = None,
    ) -> HorasExtraListResponse:
        self._require_acceso(current_user)
        ids_permitidos = await self._ids_permitidos(current_user, rh_ui_mode)

        pares = await self.repo.list_ids_con_centro_costo(
            q=q,
            area_id=area_id,
            centrocosto_id=centrocosto_id,
            lider_empleado_id=lider_empleado_id,
            ids_permitidos=ids_permitidos,
        )

        filas_simuladas = [
            (local_id, empleado_id, simular_fila_horas_extra(empleado_id))
            for local_id, empleado_id in pares
        ]

        tabs = {
            "todos": len(filas_simuladas),
            "pendientes": sum(1 for _, _, s in filas_simuladas if s["estado_aprobacion"] == "pendiente"),
            "aprobados": sum(1 for _, _, s in filas_simuladas if s["estado_aprobacion"] == "aprobado"),
            "rechazados": sum(1 for _, _, s in filas_simuladas if s["estado_aprobacion"] == "rechazado"),
        }

        filtradas = [
            (local_id, empleado_id, sim)
            for local_id, empleado_id, sim in filas_simuladas
            if self._tab_coincide(sim["estado_aprobacion"], tab)
        ]
        total = len(filtradas)
        offset = (page - 1) * page_size
        pagina_ids = [local_id for local_id, _, _ in filtradas[offset : offset + page_size]]

        empleados_map: dict[int, Empleado] = {}
        if pagina_ids:
            empleados = await self.repo.list_by_ids(pagina_ids)
            empleados_map = {e.id: e for e in empleados}

        items: list[HorasExtraFilaResponse] = []
        sim_por_local = {local_id: sim for local_id, _, sim in filtradas}
        for local_id in pagina_ids:
            emp = empleados_map.get(local_id)
            if not emp:
                continue
            sim = sim_por_local[local_id]
            items.append(
                HorasExtraFilaResponse(
                    empleado=self._to_empleado_response(emp),
                    simulado=HorasExtraSimuladoResponse(**sim),
                )
            )

        total_horas = round(sum(s["total_horas_extra"] for _, _, s in filas_simuladas), 2)
        con_he = sum(1 for _, _, s in filas_simuladas if s["total_horas_extra"] > 0)
        pendientes = tabs["pendientes"]
        aprobados = tabs["aprobados"]
        rechazados = tabs["rechazados"]
        con_dif = sum(1 for _, _, s in filas_simuladas if s["dif_caseta"] > 0)
        total_decisiones = aprobados + rechazados
        pct_aprob = round((aprobados / total_decisiones) * 100, 1) if total_decisiones else 0.0

        activos_planta = await self.repo.count_empleados_activos_planta(ids_permitidos=ids_permitidos)
        centros_ids = await self.repo.list_distinct_centrocosto_ids(ids_permitidos=ids_permitidos)

        resumen = HorasExtraResumenResponse(
            total_horas_extra=total_horas,
            colaboradores_con_registro=len(filas_simuladas),
            empleados_con_horas_extra=con_he,
            empleados_activos_planta=activos_planta,
            solicitudes_pendientes=pendientes,
            solicitudes_aprobadas=aprobados,
            solicitudes_rechazadas=rechazados,
            solicitudes_con_dif_caseta=con_dif,
            porcentaje_aprobacion=pct_aprob,
        )

        return HorasExtraListResponse(
            semana_actual=SEMANA_ACTUAL,
            resumen=resumen,
            tabs=tabs,
            filter_options=HorasExtraFilterOptionsResponse(
                centros_costo=[
                    HorasExtraCentroCostoOption(id=cc_id, label=str(cc_id))
                    for cc_id in centros_ids
                ]
            ),
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
