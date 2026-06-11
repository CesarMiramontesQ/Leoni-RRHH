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
    HorasExtraDetalleResponse,
    HorasExtraEmpleadoOption,
    HorasExtraSolicitudCreate,
    HorasExtraSolicitudListItem,
    HorasExtraSolicitudListResponse,
    HorasExtraSolicitudOpcionesResponse,
    HorasExtraSolicitudResponse,
)
from app.utils.business_time import business_today
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
    def _numero_semana_iso(fecha: date) -> int:
        return fecha.isocalendar()[1]

    @staticmethod
    def _semanas_permitidas(semana_actual: int) -> set[int]:
        permitidas = {semana_actual}
        if semana_actual > 1:
            permitidas.add(semana_actual - 1)
        for offset in range(1, 5):
            futura = semana_actual + offset
            if futura <= 53:
                permitidas.add(futura)
        return permitidas

    @staticmethod
    def _lunes_de_semana_iso(anio: int, semana: int) -> date:
        return date.fromisocalendar(anio, semana, 1)

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
            empleados=[
                HorasExtraEmpleadoOption(
                    id=e.id,
                    no_empleado=e.no_empleado,
                    nombre=e.nombre,
                    centrocosto_id=e.centrocosto_id,
                    area_id=e.area_id,
                    subarea_id=e.subarea_id,
                )
                for e in sorted(empleados_db, key=lambda x: x.nombre.lower())
            ],
            semana_actual=self._numero_semana_iso(business_today()),
        )

    async def _validar_semana(self, fecha_solicitud: date, semana: int) -> date:
        semana_actual = self._numero_semana_iso(business_today())
        if semana not in self._semanas_permitidas(semana_actual):
            raise DomainValidationError(
                detail=(
                    "La semana seleccionada no está permitida. "
                    "Solo puedes capturar la semana anterior, la actual "
                    "o las cuatro siguientes."
                )
            )
        try:
            semana_inicio = self._lunes_de_semana_iso(fecha_solicitud.year, semana)
        except ValueError as exc:
            raise DomainValidationError(
                detail="Número de semana no válido para el año de la solicitud."
            ) from exc
        return semana_inicio

    async def _resolver_contexto_desde_empleados(
        self,
        empleados_db: list[Empleado],
    ) -> tuple[int, int, int, int]:
        if not empleados_db:
            raise DomainValidationError(
                detail="Debe incluir al menos un empleado en la solicitud."
            )

        referencia = empleados_db[0]
        if referencia.area_id is None:
            raise DomainValidationError(
                detail=(
                    f"El empleado {referencia.no_empleado} no tiene área asignada."
                )
            )
        if referencia.subarea_id is None:
            raise DomainValidationError(
                detail=(
                    f"El empleado {referencia.no_empleado} no tiene subárea asignada."
                )
            )
        if referencia.centrocosto_id is None:
            raise DomainValidationError(
                detail=(
                    f"El empleado {referencia.no_empleado} "
                    "no tiene centro de costo asignado."
                )
            )

        area_id = referencia.area_id
        subarea_id = referencia.subarea_id
        centrocosto_id = referencia.centrocosto_id

        for emp in empleados_db[1:]:
            if (
                emp.area_id != area_id
                or emp.subarea_id != subarea_id
                or emp.centrocosto_id != centrocosto_id
            ):
                raise DomainValidationError(
                    detail=(
                        "Todos los empleados deben compartir área, subárea "
                        "y centro de costo."
                    )
                )

        area = await self.repo.get_area(area_id)
        if area is None:
            raise DomainValidationError(detail="Área no válida.")

        subarea = await self.repo.get_subarea(subarea_id)
        if subarea is None:
            raise DomainValidationError(detail="Subárea no válida.")
        if subarea.area_id != area_id:
            raise DomainValidationError(
                detail="La subárea del empleado no pertenece a su área."
            )

        centro = await self.repo.get_centro_costo(centrocosto_id)
        if centro is None or not centro.activo:
            raise DomainValidationError(detail="Centro de costo no válido.")

        departamento = await self.repo.get_or_create_departamento_por_area(area)

        return (
            departamento.departamento_id,
            area_id,
            subarea_id,
            centrocosto_id,
        )

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

        await self._resolver_contexto_desde_empleados(empleados_db)
        return detalle_rows

    async def crear(
        self,
        data: HorasExtraSolicitudCreate,
        current_user: Empleado,
    ) -> HorasExtraSolicitudResponse:
        self._require_supervisor(current_user)
        semana_inicio = await self._validar_semana(data.fecha_solicitud, data.semana)
        detalle_rows = await self._validar_empleados(data, current_user)

        ids_solicitados = [row.empleado_id for row in data.empleados]
        empleados_db = await self.repo.get_empleados_by_ids(ids_solicitados)
        (
            departamento_id,
            area_id,
            subarea_id,
            centrocosto_id,
        ) = await self._resolver_contexto_desde_empleados(empleados_db)

        motivo = await self.repo.get_or_create_motivo_texto(data.motivo)

        solicitud = HorasExtraSolicitud(
            fecha_solicitud=data.fecha_solicitud,
            semana_inicio=semana_inicio,
            tipo=data.tipo,
            departamento_id=departamento_id,
            area_id=area_id,
            subarea_id=subarea_id,
            centrocosto_id=centrocosto_id,
            motivo_id=motivo.id,
            comentarios=None,
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
                semana=self._numero_semana_iso(s.semana_inicio),
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
            semana=self._numero_semana_iso(solicitud.semana_inicio),
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
