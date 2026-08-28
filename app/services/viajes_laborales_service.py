from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_for_module
from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.viajes_laborales import (
    VIAJE_LABORAL_ESTADOS_CANCELABLES,
    VIAJE_LABORAL_ESTADOS_EDITABLES,
    VIAJE_LABORAL_ESTADOS_ENVIABLES,
    ViajeLaboral,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.viajes_laborales_repository import ViajesLaboralesRepository
from app.schemas.viajes_laborales import (
    ViajeLaboralCreate,
    ViajeLaboralRechazarRequest,
    ViajeLaboralResponse,
    ViajeLaboralUpdate,
    ViajesLaboralesEstadisticasResponse,
    ViajesLaboralesPageResponse,
    list_estado_items,
)


def _empleado_display_nombre(empleado: Empleado | None) -> str | None:
    if empleado is None:
        return None
    return empleado.nombre


def _empleado_display_no(empleado: Empleado | None) -> str | None:
    if empleado is None or empleado.no_empleado is None:
        return None
    return str(empleado.no_empleado)


class ViajesLaboralesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)
        self.repo = ViajesLaboralesRepository(db)

    @staticmethod
    def _rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    def _to_response(self, viaje: ViajeLaboral) -> ViajeLaboralResponse:
        return ViajeLaboralResponse(
            id=viaje.id,
            empleado_id=viaje.empleado_id,
            empleado_nombre=_empleado_display_nombre(viaje.empleado),
            numero_empleado=_empleado_display_no(viaje.empleado),
            fecha_salida=viaje.fecha_salida,
            fecha_regreso=viaje.fecha_regreso,
            lugar_origen=viaje.lugar_origen,
            lugar_destino=viaje.lugar_destino,
            motivo=viaje.motivo,
            descripcion=viaje.descripcion,
            medio_transporte=viaje.medio_transporte,
            hospedaje=viaje.hospedaje,
            viaticos_estimados=viaje.viaticos_estimados,
            estado=viaje.estado,  # type: ignore[arg-type]
            registrado_por_id=viaje.registrado_por_id,
            registrado_por_nombre=_empleado_display_nombre(viaje.registrado_por),
            aprobado_por_id=viaje.aprobado_por_id,
            aprobado_por_nombre=_empleado_display_nombre(viaje.aprobado_por),
            motivo_rechazo=viaje.motivo_rechazo,
            created_at=viaje.created_at,
            updated_at=viaje.updated_at,
        )

    async def _empleado_ids_scope(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> list[int] | None:
        scope = effective_data_scope_for_module(
            current_user, "viajes-laborales", rh_ui_mode
        )
        if scope in ("director", "rh"):
            return None
        if scope in ("supervisor", "gerente"):
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS, atravesar_inactivos=True
            )
            return list(equipo) + [current_user.empleado_id]
        return [current_user.empleado_id]

    async def _assert_empleado_en_alcance(
        self,
        empleado_id: int,
        scope_ids: list[int] | None,
    ) -> Empleado:
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if empleado is None:
            raise NotFoundError("Empleado no encontrado")
        if scope_ids is not None and empleado_id not in scope_ids:
            raise ForbiddenError(
                "No tiene permiso para registrar viajes de este empleado"
            )
        return empleado

    async def _get_viaje_en_alcance(
        self,
        viaje_id: int,
        scope_ids: list[int] | None,
    ) -> ViajeLaboral:
        viaje = await self.repo.get_with_relations(viaje_id)
        if viaje is None:
            raise NotFoundError(entidad="ViajeLaboral", id=viaje_id)
        if scope_ids is not None and viaje.empleado_id not in scope_ids:
            raise ForbiddenError("No tiene permiso para acceder a este viaje")
        return viaje

    def _assert_puede_aprobar(self, current_user: Empleado, rh_ui_mode: str | None) -> None:
        scope = effective_data_scope_for_module(
            current_user, "viajes-laborales", rh_ui_mode
        )
        if scope not in ("director", "rh"):
            raise ForbiddenError("Solo RH o director pueden aprobar o rechazar viajes")

    def _filter_kwargs(
        self,
        *,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> dict:
        return {
            "empleado_id": empleado_id,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "destino": destino,
            "estado": estado,
            "busqueda": busqueda,
            "empleado_ids_scope": empleado_ids_scope,
        }

    async def list_viajes(
        self,
        current_user: Empleado,
        *,
        page: int,
        page_size: int,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> ViajesLaboralesPageResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        filters = self._filter_kwargs(
            empleado_id=empleado_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            destino=destino,
            estado=estado,
            busqueda=busqueda,
            empleado_ids_scope=scope_ids,
        )
        items, total = await self.repo.list_page(
            page=page, page_size=page_size, **filters
        )
        if total > 0 and (page - 1) * page_size >= total:
            page = max(1, (total + page_size - 1) // page_size)
            items, total = await self.repo.list_page(
                page=page, page_size=page_size, **filters
            )
        return ViajesLaboralesPageResponse(
            items=[self._to_response(v) for v in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def estadisticas(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        destino: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> ViajesLaboralesEstadisticasResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        counts = await self.repo.count_by_estado(
            **self._filter_kwargs(
                empleado_id=empleado_id,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                destino=destino,
                estado=estado,
                busqueda=busqueda,
                empleado_ids_scope=scope_ids,
            )
        )
        total = sum(counts.values())
        return ViajesLaboralesEstadisticasResponse(
            total=total,
            pendientes=counts.get("pendiente", 0),
            aprobados=counts.get("aprobado", 0),
            cancelados=counts.get("cancelado", 0),
        )

    def list_estados(self):
        return list_estado_items()

    async def obtener(
        self,
        viaje_id: int,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        return self._to_response(viaje)

    async def crear(
        self,
        data: ViajeLaboralCreate,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        await self._assert_empleado_en_alcance(data.empleado_id, scope_ids)
        viaje = await self.repo.create(
            {
                "empleado_id": data.empleado_id,
                "fecha_salida": data.fecha_salida,
                "fecha_regreso": data.fecha_regreso,
                "lugar_origen": data.lugar_origen,
                "lugar_destino": data.lugar_destino,
                "motivo": data.motivo,
                "descripcion": data.descripcion,
                "medio_transporte": data.medio_transporte,
                "hospedaje": data.hospedaje,
                "viaticos_estimados": data.viaticos_estimados,
                "estado": "borrador",
                "registrado_por_id": current_user.empleado_id,
            }
        )
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje.id)
        assert viaje is not None
        return self._to_response(viaje)

    async def actualizar(
        self,
        viaje_id: int,
        data: ViajeLaboralUpdate,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado not in VIAJE_LABORAL_ESTADOS_EDITABLES:
            raise ConflictError(
                detail="Solo se pueden editar viajes en borrador o rechazado"
            )

        updates = data.model_dump(exclude_unset=True)
        if not updates:
            return self._to_response(viaje)

        if "empleado_id" in updates:
            await self._assert_empleado_en_alcance(updates["empleado_id"], scope_ids)

        fecha_salida = updates.get("fecha_salida", viaje.fecha_salida)
        fecha_regreso = updates.get("fecha_regreso", viaje.fecha_regreso)
        if fecha_regreso < fecha_salida:
            raise DomainValidationError(
                "fecha_regreso no puede ser anterior a fecha_salida"
            )

        updates["updated_at"] = datetime.now(timezone.utc)
        if viaje.estado == "rechazado":
            updates["motivo_rechazo"] = None
            updates["aprobado_por_id"] = None

        await self.repo.update(viaje_id, updates)
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje_id)
        assert viaje is not None
        return self._to_response(viaje)

    async def enviar(
        self,
        viaje_id: int,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado not in VIAJE_LABORAL_ESTADOS_ENVIABLES:
            raise ConflictError(
                detail="Solo se pueden enviar viajes en borrador o rechazado"
            )
        await self.repo.update(
            viaje_id,
            {
                "estado": "pendiente",
                "motivo_rechazo": None,
                "aprobado_por_id": None,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje_id)
        assert viaje is not None
        return self._to_response(viaje)

    async def aprobar(
        self,
        viaje_id: int,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        self._assert_puede_aprobar(current_user, rh_ui_mode)
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado != "pendiente":
            raise ConflictError(detail="Solo se pueden aprobar viajes pendientes")
        await self.repo.update(
            viaje_id,
            {
                "estado": "aprobado",
                "aprobado_por_id": current_user.empleado_id,
                "motivo_rechazo": None,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje_id)
        assert viaje is not None
        return self._to_response(viaje)

    async def rechazar(
        self,
        viaje_id: int,
        data: ViajeLaboralRechazarRequest,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        self._assert_puede_aprobar(current_user, rh_ui_mode)
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado != "pendiente":
            raise ConflictError(detail="Solo se pueden rechazar viajes pendientes")
        await self.repo.update(
            viaje_id,
            {
                "estado": "rechazado",
                "aprobado_por_id": current_user.empleado_id,
                "motivo_rechazo": data.motivo_rechazo,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje_id)
        assert viaje is not None
        return self._to_response(viaje)

    async def cancelar(
        self,
        viaje_id: int,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> ViajeLaboralResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado not in VIAJE_LABORAL_ESTADOS_CANCELABLES:
            raise ConflictError(
                detail="Solo se pueden cancelar viajes pendientes o aprobados"
            )
        await self.repo.update(
            viaje_id,
            {
                "estado": "cancelado",
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self.db.commit()
        viaje = await self.repo.get_with_relations(viaje_id)
        assert viaje is not None
        return self._to_response(viaje)

    async def eliminar(
        self,
        viaje_id: int,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> None:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        viaje = await self._get_viaje_en_alcance(viaje_id, scope_ids)
        if viaje.estado != "borrador":
            raise ConflictError(detail="Solo se pueden eliminar viajes en borrador")
        await self.repo.hard_delete(viaje_id)
        await self.db.commit()
