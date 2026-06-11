"""Lógica de negocio: solicitudes de horas extra por supervisor."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.horas_extra import HorasExtraSolicitud, HorasExtraSolicitudDetalle
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.horas_extra_solicitud_repository import HorasExtraSolicitudRepository
from app.schemas.horas_extra_solicitud import (
    HorasExtraCatalogoOption,
    HorasExtraDetalleResponse,
    HorasExtraEmpleadoOption,
    HorasExtraSolicitudCreate,
    HorasExtraSolicitudListItem,
    HorasExtraSolicitudListResponse,
    HorasExtraSolicitudOpcionesResponse,
    HorasExtraSolicitudResponse,
    HorasExtraSubareaOption,
)
from app.utils.clasificacion_empleado import empleado_es_administrativo


class HorasExtraSolicitudService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HorasExtraSolicitudRepository(db)
        self.empleado_repo = EmpleadoRepository(db)

    @staticmethod
    def _require_supervisor(current_user: Empleado) -> None:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol != "supervisor":
            raise ForbiddenError(
                detail="Permisos insuficientes. Se requiere rol supervisor."
            )

    @staticmethod
    def _es_lunes(fecha: date) -> bool:
        return fecha.weekday() == 0

    @staticmethod
    def _sum_horas_detalle(row: HorasExtraSolicitudDetalle) -> Decimal:
        return (
            row.lunes
            + row.martes
            + row.miercoles
            + row.jueves
            + row.viernes
            + row.sabado
            + row.domingo
        )

    def _total_general(self, solicitud: HorasExtraSolicitud) -> Decimal:
        return sum((self._sum_horas_detalle(d) for d in solicitud.detalle), Decimal("0"))

    async def _empleados_elegibles_ids(self, supervisor: Empleado) -> set[int]:
        subordinados = await self.empleado_repo.get_subordinados(
            supervisor.empleado_id, settings.ESTADOS_ACTIVOS_IDS
        )
        if not subordinados:
            return set()
        empleados = await self.repo.get_empleados_by_ids([e.id for e in subordinados])
        return {
            emp.id for emp in empleados if not empleado_es_administrativo(emp)
        }

    async def obtener_opciones(
        self, current_user: Empleado
    ) -> HorasExtraSolicitudOpcionesResponse:
        self._require_supervisor(current_user)

        elegibles_ids = await self._empleados_elegibles_ids(current_user)
        empleados_db = await self.repo.get_empleados_by_ids(sorted(elegibles_ids))

        return HorasExtraSolicitudOpcionesResponse(
            departamentos=[
                HorasExtraCatalogoOption(id=d.departamento_id, label=d.nombre)
                for d in await self.repo.list_departamentos_activos()
            ],
            areas=[
                HorasExtraCatalogoOption(id=a.area_id, label=a.descripcion)
                for a in await self.repo.list_areas_activas()
            ],
            subareas=[
                HorasExtraSubareaOption(
                    id=s.subarea_id, label=s.descripcion, area_id=s.area_id
                )
                for s in await self.repo.list_subareas_activas()
            ],
            centros_costo=[
                HorasExtraCatalogoOption(id=c.centrocosto_id, label=c.descripcion)
                for c in await self.repo.list_centros_costo_activos()
            ],
            motivos=[
                HorasExtraCatalogoOption(id=m.id, label=m.descripcion)
                for m in await self.repo.list_motivos_activos()
            ],
            empleados=[
                HorasExtraEmpleadoOption(
                    id=e.id,
                    no_empleado=e.no_empleado,
                    nombre=e.nombre,
                    centrocosto_id=e.centrocosto_id,
                )
                for e in sorted(empleados_db, key=lambda x: x.nombre.lower())
            ],
        )

    async def _validar_referencias(self, data: HorasExtraSolicitudCreate) -> None:
        if not self._es_lunes(data.semana_inicio):
            raise DomainValidationError(
                detail="La semana debe iniciar en lunes (semana_inicio)."
            )

        departamento = await self.repo.get_departamento(data.departamento_id)
        if departamento is None or not departamento.activo:
            raise DomainValidationError(detail="Departamento no válido.")

        area = await self.repo.get_area(data.area_id)
        if area is None:
            raise DomainValidationError(detail="Área no válida.")

        subarea = await self.repo.get_subarea(data.subarea_id)
        if subarea is None:
            raise DomainValidationError(detail="Subárea no válida.")
        if subarea.area_id != data.area_id:
            raise DomainValidationError(
                detail="La subárea no pertenece al área seleccionada."
            )

        centro = await self.repo.get_centro_costo(data.centrocosto_id)
        if centro is None or not centro.activo:
            raise DomainValidationError(detail="Centro de costo no válido.")

        motivo = await self.repo.get_motivo(data.motivo_id)
        if motivo is None or not motivo.activo:
            raise DomainValidationError(detail="Motivo no válido.")

    async def _validar_empleados(
        self,
        data: HorasExtraSolicitudCreate,
        supervisor: Empleado,
    ) -> list[HorasExtraSolicitudDetalle]:
        if not data.empleados:
            raise DomainValidationError(
                detail="Debe incluir al menos un empleado en la solicitud."
            )

        ids_solicitados = [row.empleado_id for row in data.empleados]
        if len(ids_solicitados) != len(set(ids_solicitados)):
            raise DomainValidationError(
                detail="No se puede repetir el mismo empleado en la solicitud."
            )

        elegibles = await self._empleados_elegibles_ids(supervisor)
        empleados_db = await self.repo.get_empleados_by_ids(ids_solicitados)
        encontrados = {e.id: e for e in empleados_db}

        detalle_rows: list[HorasExtraSolicitudDetalle] = []
        total_horas_solicitud = Decimal("0")

        for row in data.empleados:
            emp = encontrados.get(row.empleado_id)
            if emp is None:
                raise DomainValidationError(
                    detail=f"Empleado id={row.empleado_id} no encontrado."
                )
            if row.empleado_id not in elegibles:
                raise DomainValidationError(
                    detail=(
                        f"El empleado {emp.no_empleado} no está disponible "
                        "para solicitudes de horas extra."
                    )
                )
            if empleado_es_administrativo(emp):
                raise DomainValidationError(
                    detail=(
                        f"No se permiten horas extra para empleados administrativos "
                        f"({emp.no_empleado})."
                    )
                )

            total_empleado = (
                row.lunes
                + row.martes
                + row.miercoles
                + row.jueves
                + row.viernes
                + row.sabado
                + row.domingo
            )
            total_horas_solicitud += total_empleado

            detalle_rows.append(
                HorasExtraSolicitudDetalle(
                    empleado_id=row.empleado_id,
                    lunes=row.lunes,
                    martes=row.martes,
                    miercoles=row.miercoles,
                    jueves=row.jueves,
                    viernes=row.viernes,
                    sabado=row.sabado,
                    domingo=row.domingo,
                )
            )

        if total_horas_solicitud <= 0:
            raise DomainValidationError(
                detail="La solicitud debe registrar al menos una hora mayor a cero."
            )

        return detalle_rows

    async def crear(
        self,
        data: HorasExtraSolicitudCreate,
        current_user: Empleado,
    ) -> HorasExtraSolicitudResponse:
        self._require_supervisor(current_user)
        await self._validar_referencias(data)
        detalle_rows = await self._validar_empleados(data, current_user)

        solicitud = HorasExtraSolicitud(
            fecha_solicitud=data.fecha_solicitud,
            semana_inicio=data.semana_inicio,
            tipo=data.tipo,
            departamento_id=data.departamento_id,
            area_id=data.area_id,
            subarea_id=data.subarea_id,
            centrocosto_id=data.centrocosto_id,
            motivo_id=data.motivo_id,
            comentarios=data.comentarios,
            estado="pendiente",
            registrado_por_id=current_user.id,
        )

        creada = await self.repo.create(solicitud, detalle_rows)
        await self.db.commit()
        return self._to_response(creada)

    async def listar_mis_solicitudes(
        self,
        current_user: Empleado,
        *,
        page: int = 1,
        page_size: int = 10,
    ) -> HorasExtraSolicitudListResponse:
        self._require_supervisor(current_user)
        offset = (page - 1) * page_size
        items_db = await self.repo.list_by_registrado(
            registrado_por_id=current_user.id,
            offset=offset,
            limit=page_size,
        )
        total = await self.repo.count_by_registrado(registrado_por_id=current_user.id)

        items = [
            HorasExtraSolicitudListItem(
                id=s.id,
                fecha_solicitud=s.fecha_solicitud,
                semana_inicio=s.semana_inicio,
                departamento_nombre=s.departamento.nombre if s.departamento else "",
                area_descripcion=s.area.descripcion if s.area else "",
                tipo=s.tipo,
                total_horas_general=self._total_general(s),
                estado=s.estado,
                created_at=s.created_at,
            )
            for s in items_db
        ]

        return HorasExtraSolicitudListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener_detalle(
        self,
        solicitud_id: int,
        current_user: Empleado,
    ) -> HorasExtraSolicitudResponse:
        self._require_supervisor(current_user)
        solicitud = await self.repo.get_by_id(
            solicitud_id, registrado_por_id=current_user.id
        )
        if solicitud is None:
            raise NotFoundError("Solicitud de horas extra", solicitud_id)
        return self._to_response(solicitud)

    def _to_response(self, solicitud: HorasExtraSolicitud) -> HorasExtraSolicitudResponse:
        detalle = [
            HorasExtraDetalleResponse(
                id=d.id,
                empleado_id=d.empleado_id,
                no_empleado=d.empleado.no_empleado if d.empleado else "",
                nombre_empleado=d.empleado.nombre if d.empleado else "",
                lunes=d.lunes,
                martes=d.martes,
                miercoles=d.miercoles,
                jueves=d.jueves,
                viernes=d.viernes,
                sabado=d.sabado,
                domingo=d.domingo,
                total_horas=self._sum_horas_detalle(d),
            )
            for d in solicitud.detalle
        ]
        return HorasExtraSolicitudResponse(
            id=solicitud.id,
            fecha_solicitud=solicitud.fecha_solicitud,
            semana_inicio=solicitud.semana_inicio,
            tipo=solicitud.tipo,
            departamento_id=solicitud.departamento_id,
            departamento_nombre=(
                solicitud.departamento.nombre if solicitud.departamento else ""
            ),
            area_id=solicitud.area_id,
            area_descripcion=solicitud.area.descripcion if solicitud.area else "",
            subarea_id=solicitud.subarea_id,
            subarea_descripcion=(
                solicitud.subarea.descripcion if solicitud.subarea else ""
            ),
            centrocosto_id=solicitud.centrocosto_id,
            centrocosto_descripcion=(
                solicitud.centro_costo.descripcion if solicitud.centro_costo else ""
            ),
            motivo_id=solicitud.motivo_id,
            motivo_descripcion=solicitud.motivo.descripcion if solicitud.motivo else "",
            comentarios=solicitud.comentarios,
            estado=solicitud.estado,
            total_horas_general=sum((d.total_horas for d in detalle), Decimal("0")),
            total_empleados=len(detalle),
            created_at=solicitud.created_at,
            detalle=detalle,
        )
