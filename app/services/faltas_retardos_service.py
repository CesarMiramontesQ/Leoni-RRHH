from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_rol
from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS, FaltaRetardoEvento
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosPageResponse,
)


def _empleado_display_nombre(empleado: Empleado | None) -> str | None:
    if empleado is None:
        return None
    return empleado.nombre


def _empleado_display_no(empleado: Empleado | None) -> str | None:
    if empleado is None or empleado.no_empleado is None:
        return None
    return str(empleado.no_empleado)


class FaltasRetardosService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FaltasRetardosRepository(db)
        self.empleado_repo = EmpleadoRepository(db)

    async def _empleado_ids_scope(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> list[int] | None:
        scope = effective_data_scope_rol(current_user, rh_ui_mode)
        if scope in ("director", "rh"):
            return None
        if scope == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            return [e.empleado_id for e in subordinados] + [current_user.empleado_id]
        if scope == "gerente":
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
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
            raise ForbiddenError("No tiene permiso para registrar eventos de este empleado")
        return empleado

    def _to_response(self, evento: FaltaRetardoEvento) -> FaltaRetardoResponse:
        return FaltaRetardoResponse(
            id=evento.id,
            empleado_id=evento.empleado_id,
            empleado_nombre=_empleado_display_nombre(evento.empleado),
            numero_empleado=_empleado_display_no(evento.empleado),
            tipo=evento.tipo,
            fecha_evento=evento.fecha_evento,
            fecha_fin=evento.fecha_fin,
            observaciones=evento.observaciones,
            registrado_por_id=evento.registrado_por_id,
            registrado_por_nombre=_empleado_display_nombre(evento.registrado_por),
            created_at=evento.created_at,
        )

    async def list_eventos(
        self,
        current_user: Empleado,
        *,
        page: int,
        page_size: int,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
    ) -> FaltasRetardosPageResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        items, total = await self.repo.list_page(
            page=page,
            page_size=page_size,
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            empleado_ids_scope=scope_ids,
        )
        return FaltasRetardosPageResponse(
            items=[self._to_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_evento(
        self,
        data: FaltaRetardoCreateRequest,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> FaltaRetardoResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        await self._assert_empleado_en_alcance(data.empleado_id, scope_ids)

        evento = await self.repo.create(
            {
                "empleado_id": data.empleado_id,
                "tipo": data.tipo,
                "fecha_evento": data.fecha_evento,
                "fecha_fin": data.fecha_fin,
                "observaciones": data.observaciones,
                "registrado_por_id": current_user.empleado_id,
            }
        )
        await self.db.commit()
        refreshed = await self.repo.get_with_relations(evento.id)
        if refreshed is None:
            raise DomainValidationError("No se pudo recuperar el registro creado")
        return self._to_response(refreshed)

    def list_tipos(self) -> list[str]:
        return list(FALTA_RETARDO_TIPOS)
