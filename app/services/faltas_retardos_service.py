from datetime import date

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_rol
from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError, ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS, FaltaRetardoEvento
from app.repositories.bono_faltas_retardos_repository import BonoFaltasRetardosRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosEstadisticasResponse,
    FaltasRetardosPageResponse,
)
from app.services.faltas_retardos.constants import CODIGO_PONDERACION_A_TIPO, ORIGEN_MANUAL
from app.services.faltas_retardos.mapper import map_bono_row


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

    def _to_response_manual(self, evento: FaltaRetardoEvento) -> FaltaRetardoResponse:
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
            origen=ORIGEN_MANUAL,
            origen_id=evento.id,
        )

    async def _with_bono_repo(self) -> tuple:
        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            raise ServiceUnavailableError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )
        return engine, BonoFaltasRetardosRepository(engine)

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
        page = max(1, page)
        page_size = min(100, max(1, page_size))

        engine, repo = await self._with_bono_repo()
        try:
            total = await repo.count(
                empleado_id=empleado_id,
                tipo=tipo,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                busqueda=busqueda,
                empleado_ids_scope=scope_ids,
            )
            offset = (page - 1) * page_size
            if total == 0:
                page = 1
            elif offset >= total:
                page = max(1, (total + page_size - 1) // page_size)
                offset = (page - 1) * page_size

            rows = await repo.list_offset(
                offset,
                page_size,
                empleado_id=empleado_id,
                tipo=tipo,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                busqueda=busqueda,
                empleado_ids_scope=scope_ids,
            )
            items: list[FaltaRetardoResponse] = []
            for row in rows:
                mapped = map_bono_row(row)
                if mapped is not None:
                    items.append(mapped)

            return FaltasRetardosPageResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
            )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar faltas y retardos en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

    def _map_estadisticas(self, por_codigo: dict[str, int]) -> FaltasRetardosEstadisticasResponse:
        por_tipo: dict[str, int] = {t: 0 for t in FALTA_RETARDO_TIPOS}
        for codigo, count in por_codigo.items():
            api_tipo = CODIGO_PONDERACION_A_TIPO.get(codigo.upper())
            if api_tipo:
                por_tipo[api_tipo] = por_tipo.get(api_tipo, 0) + int(count)
        return FaltasRetardosEstadisticasResponse(
            total_eventos=sum(por_tipo.values()),
            falta_justificada=por_tipo["falta_justificada"],
            falta_injustificada=por_tipo["falta_injustificada"],
            retardo=por_tipo["retardo"],
            incapacidad=por_tipo["incapacidad"],
            suspension=por_tipo["suspension"],
        )

    async def estadisticas_eventos(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
    ) -> FaltasRetardosEstadisticasResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        engine, repo = await self._with_bono_repo()
        try:
            por_codigo = await repo.aggregate_por_tipo_codigo(
                empleado_id=empleado_id,
                tipo=tipo,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                busqueda=busqueda,
                empleado_ids_scope=scope_ids,
            )
            return self._map_estadisticas(por_codigo)
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar estadísticas en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

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
        return self._to_response_manual(refreshed)

    def list_tipos(self) -> list[str]:
        return list(FALTA_RETARDO_TIPOS)
