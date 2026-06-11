"""Servicio de Horas Extra (vista RH): solicitudes reales registradas en BD."""

from __future__ import annotations

from app.core.data_scope import effective_data_scope_rol, empleado_ids_en_alcance
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.horas_extra import HorasExtraSolicitud, HorasExtraSolicitudDetalle
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.horas_extra_repository import HorasExtraRepository
from app.repositories.horas_extra_solicitud_repository import HorasExtraSolicitudRepository
from app.schemas.horas_extra import (
    HorasExtraCentroCostoOption,
    HorasExtraEmpleadoResponse,
    HorasExtraFilaResponse,
    HorasExtraFilterOptionsResponse,
    HorasExtraLiderResponse,
    HorasExtraListResponse,
    HorasExtraResumenResponse,
    HorasExtraSolicitudInfoResponse,
    HorasExtraTabFiltro,
)
from app.schemas.horas_extra_solicitud import HorasExtraSolicitudResponse
from app.services.horas_extra_solicitud_service import HorasExtraSolicitudService
from app.utils.business_time import business_today
from sqlalchemy.ext.asyncio import AsyncSession

_ROLES_PERMITIDOS = frozenset({"rh", "director", "gerente"})


class HorasExtraService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HorasExtraRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.solicitud_repo = HorasExtraSolicitudRepository(db)
        self.solicitud_svc = HorasExtraSolicitudService(db)

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
            centrocosto_id=(
                int(emp.centrocosto_id) if emp.centrocosto_id is not None else None
            ),
            lider=lider,
        )

    @staticmethod
    def _aprobacion_firmada(solicitud: HorasExtraSolicitud):
        """Última firma resuelta (aprobado/rechazado) de la solicitud, si existe."""
        firmadas = [
            a
            for a in solicitud.aprobaciones
            if a.estado in ("aprobado", "rechazado") and a.fecha_aprobacion is not None
        ]
        if not firmadas:
            return None
        return max(firmadas, key=lambda a: a.fecha_aprobacion)

    def _to_fila_response(
        self, detalle: HorasExtraSolicitudDetalle
    ) -> HorasExtraFilaResponse:
        solicitud = detalle.solicitud
        firma = self._aprobacion_firmada(solicitud)
        return HorasExtraFilaResponse(
            empleado=self._to_empleado_response(detalle.empleado),
            solicitud=HorasExtraSolicitudInfoResponse(
                solicitud_id=solicitud.id,
                semana=solicitud.semana_inicio.isocalendar()[1],
                semana_inicio=solicitud.semana_inicio,
                fecha_solicitud=solicitud.fecha_solicitud,
                tipo=solicitud.tipo,
                area_descripcion=solicitud.area.descripcion if solicitud.area else None,
                centrocosto_id=solicitud.centrocosto_id,
                centrocosto_descripcion=(
                    solicitud.centro_costo.descripcion if solicitud.centro_costo else None
                ),
                motivo=solicitud.motivo.descripcion if solicitud.motivo else None,
                estado=solicitud.estado,
                total_horas=float(detalle.total_horas),
                registrado_por_nombre=(
                    solicitud.registrado_por.nombre if solicitud.registrado_por else None
                ),
                aprobador_nombre=(
                    firma.aprobador.nombre if firma and firma.aprobador else None
                ),
                fecha_aprobacion=(
                    firma.fecha_aprobacion.date() if firma else None
                ),
            ),
        )

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

        filtros = {
            "q": q,
            "area_id": area_id,
            "centrocosto_id": centrocosto_id,
            "lider_empleado_id": lider_empleado_id,
            "ids_permitidos": ids_permitidos,
        }

        total = await self.repo.count_filas(tab=tab, **filtros)
        offset = (page - 1) * page_size
        detalles = await self.repo.list_filas(
            offset=offset, limit=page_size, tab=tab, **filtros
        )
        tabs = await self.repo.tabs_counts(**filtros)

        total_horas, con_registro, con_horas = await self.repo.resumen_filas(
            ids_permitidos=ids_permitidos
        )
        solicitudes_por_estado = await self.repo.solicitudes_counts(
            ids_permitidos=ids_permitidos
        )
        pendientes = solicitudes_por_estado.get("pendiente", 0)
        aprobadas = solicitudes_por_estado.get("aprobado", 0)
        rechazadas = solicitudes_por_estado.get("rechazado", 0)
        total_solicitudes = sum(solicitudes_por_estado.values())
        total_decisiones = aprobadas + rechazadas
        pct_aprob = (
            round((aprobadas / total_decisiones) * 100, 1) if total_decisiones else 0.0
        )

        activos_planta = await self.repo.count_empleados_activos_planta(
            ids_permitidos=ids_permitidos
        )
        centros = await self.repo.list_centros_costo_en_solicitudes(
            ids_permitidos=ids_permitidos
        )

        resumen = HorasExtraResumenResponse(
            total_horas_extra=round(float(total_horas), 2),
            colaboradores_con_registro=con_registro,
            empleados_con_horas_extra=con_horas,
            empleados_activos_planta=activos_planta,
            solicitudes_total=total_solicitudes,
            solicitudes_pendientes=pendientes,
            solicitudes_aprobadas=aprobadas,
            solicitudes_rechazadas=rechazadas,
            porcentaje_aprobacion=pct_aprob,
        )

        return HorasExtraListResponse(
            semana_actual=business_today().isocalendar()[1],
            resumen=resumen,
            tabs=tabs,
            filter_options=HorasExtraFilterOptionsResponse(
                centros_costo=[
                    HorasExtraCentroCostoOption(
                        id=cc_id, label=descripcion or str(cc_id)
                    )
                    for cc_id, descripcion in centros
                ]
            ),
            items=[self._to_fila_response(d) for d in detalles],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener_detalle(
        self,
        solicitud_id: int,
        *,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> HorasExtraSolicitudResponse:
        self._require_acceso(current_user)
        ids_permitidos = await self._ids_permitidos(current_user, rh_ui_mode)

        solicitud = await self.solicitud_repo.get_solicitud_by_id(solicitud_id)
        if solicitud is None:
            raise NotFoundError("Solicitud de horas extra", solicitud_id)

        if ids_permitidos is not None:
            empleado_ids = {d.empleado_id for d in solicitud.detalle}
            if not empleado_ids.intersection(ids_permitidos):
                raise NotFoundError("Solicitud de horas extra", solicitud_id)

        return self.solicitud_svc.build_response(solicitud)
