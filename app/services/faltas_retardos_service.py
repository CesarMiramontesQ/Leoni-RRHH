from datetime import date

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_for_module
from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError, ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS, FALTA_RETARDO_TIPOS_RANGO
from app.repositories.bono_faltas_retardos_repository import BonoFaltasRetardosRepository
from app.repositories.bono_importadas_historico_repository import BonoImportadasHistoricoRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosEstadisticasResponse,
    FaltasRetardosPageResponse,
)
from app.services.faltas_retardos.constants import (
    CODIGO_PONDERACION_A_TIPO,
    ORIGEN_IMPORTADAS_HISTORICO,
    TIPO_A_PONDERACION,
)
from app.services.faltas_retardos.mapper import map_bono_row
from app.services.tress_suspension_service import registrar_suspension_en_tress


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
        self.empleado_repo = EmpleadoRepository(db)
        self.audit_repo = FaltasRetardosRepository(db)

    async def _empleado_ids_scope(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> list[int] | None:
        scope = effective_data_scope_for_module(current_user, "faltas-retardos", rh_ui_mode)
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

    def _to_response_importadas(
        self,
        mapped: FaltaRetardoResponse,
        *,
        current_user: Empleado,
        fecha_fin: date | None,
        observaciones: str | None,
    ) -> FaltaRetardoResponse:
        return mapped.model_copy(
            update={
                "fecha_fin": fecha_fin,
                "observaciones": observaciones,
                "registrado_por_id": current_user.empleado_id,
                "registrado_por_nombre": _empleado_display_nombre(current_user),
            }
        )

    async def _with_bono_importadas_repo(self) -> tuple:
        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            raise ServiceUnavailableError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )
        return engine, BonoImportadasHistoricoRepository(engine)

    async def _enrich_registrado_por(
        self, items: list[FaltaRetardoResponse]
    ) -> list[FaltaRetardoResponse]:
        origen_ids = [
            item.origen_id
            for item in items
            if item.origen == ORIGEN_IMPORTADAS_HISTORICO and item.origen_id is not None
        ]
        if not origen_ids:
            return items
        audit_map = await self.audit_repo.map_registros_auditoria(
            bono_origen=ORIGEN_IMPORTADAS_HISTORICO,
            bono_origen_ids=origen_ids,
        )
        if not audit_map:
            return items
        enriched: list[FaltaRetardoResponse] = []
        for item in items:
            audit = audit_map.get(item.origen_id) if item.origen_id is not None else None
            if audit is None:
                enriched.append(item)
                continue
            enriched.append(
                item.model_copy(
                    update={
                        "registrado_por_id": audit.registrado_por_id,
                        "registrado_por_nombre": _empleado_display_nombre(
                            audit.registrado_por
                        ),
                        "created_at": audit.created_at,
                    }
                )
            )
        return enriched

    async def _insertar_en_importadas_historico(
        self,
        empleado: Empleado,
        data: FaltaRetardoCreateRequest,
    ) -> list[int]:
        ponderacion = TIPO_A_PONDERACION.get(data.tipo)
        if ponderacion is None:
            raise DomainValidationError(
                f"Tipo {data.tipo!r} no se puede registrar en importadas_historico"
            )
        tipo_inc, inc_id = ponderacion

        engine, repo = await self._with_bono_importadas_repo()
        try:
            if data.tipo in FALTA_RETARDO_TIPOS_RANGO:
                assert data.fecha_fin is not None
                semana_ids = await repo.list_semana_ids_en_rango(
                    data.fecha_evento, data.fecha_fin
                )
                if not semana_ids:
                    raise DomainValidationError(
                        "No hay semana histórica en bono para el rango de fechas indicado"
                    )
                first_id: int | None = None
                inserted_ids: list[int] = []
                for semana_id in semana_ids:
                    new_id = await repo.insert_evento(
                        no_empleado=int(empleado.no_empleado),
                        tipo_inc=tipo_inc,
                        inc_id=inc_id,
                        id_semana=semana_id,
                        area_empleado=empleado.area_id,
                        subarea_empleado=empleado.subarea_id,
                        fecha_incidencia=None,
                    )
                    inserted_ids.append(new_id)
                    if first_id is None:
                        first_id = new_id
                assert first_id is not None
                return inserted_ids

            semana_id = await repo.resolve_semana_id(data.fecha_evento)
            if semana_id is None:
                raise DomainValidationError(
                    "No hay semana histórica en bono para la fecha del evento"
                )
            new_id = await repo.insert_evento(
                no_empleado=int(empleado.no_empleado),
                tipo_inc=tipo_inc,
                inc_id=inc_id,
                id_semana=semana_id,
                area_empleado=empleado.area_id,
                subarea_empleado=empleado.subarea_id,
                fecha_incidencia=data.fecha_evento,
            )
            return [new_id]
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al registrar en importadas_historico: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

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
            items = await self._enrich_registrado_por(items)

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

    def _map_por_codigo_a_tipo(self, por_codigo: dict[str, int]) -> dict[str, int]:
        por_tipo: dict[str, int] = {t: 0 for t in FALTA_RETARDO_TIPOS}
        for codigo, count in por_codigo.items():
            api_tipo = CODIGO_PONDERACION_A_TIPO.get(codigo.upper())
            if api_tipo:
                por_tipo[api_tipo] = por_tipo.get(api_tipo, 0) + int(count)
        return por_tipo

    def _map_periodo_tipo_rows(
        self, rows: list[tuple[str, str, int]]
    ) -> list[dict[str, object]]:
        merged: dict[tuple[str, str], int] = {}
        for periodo, codigo, count in rows:
            api_tipo = CODIGO_PONDERACION_A_TIPO.get(codigo.upper())
            if not api_tipo:
                continue
            key = (periodo, api_tipo)
            merged[key] = merged.get(key, 0) + int(count)
        return [
            {"periodo": periodo, "tipo": tipo, "total": total}
            for (periodo, tipo), total in sorted(
                merged.items(), key=lambda item: (item[0][0], item[0][1])
            )
        ]

    def _build_estadisticas_response(
        self,
        por_codigo: dict[str, int],
        por_mes: list[tuple[str, int]],
        empleados_top: list[tuple[int, str | None, str | None, int, dict[str, int]]],
        *,
        por_periodo_y_tipo: list[dict[str, object]] | None = None,
        tendencia_agrupacion: str | None = None,
    ) -> FaltasRetardosEstadisticasResponse:
        por_tipo = self._map_por_codigo_a_tipo(por_codigo)

        total = sum(por_tipo.values())
        eventos_por_tipo = [
            {
                "tipo": tipo,
                "total": por_tipo[tipo],
                "porcentaje": round((por_tipo[tipo] / total) * 100, 1) if total else 0.0,
            }
            for tipo in FALTA_RETARDO_TIPOS
            if por_tipo[tipo] > 0
        ]
        eventos_por_tipo.sort(key=lambda x: x["total"], reverse=True)

        empleados_con_mas_eventos = []
        for empleado_id, no_empleado, nombre, count, por_codigo_emp in empleados_top:
            por_tipo_emp = self._map_por_codigo_a_tipo(por_codigo_emp)
            empleados_con_mas_eventos.append(
                {
                    "empleado_id": empleado_id,
                    "no_empleado": no_empleado,
                    "nombre": nombre,
                    "total": count,
                    "por_tipo": [
                        {"tipo": tipo, "total": por_tipo_emp[tipo]}
                        for tipo in FALTA_RETARDO_TIPOS
                        if por_tipo_emp[tipo] > 0
                    ],
                }
            )

        return FaltasRetardosEstadisticasResponse(
            total_eventos=total,
            falta_justificada=por_tipo["falta_justificada"],
            falta_injustificada=por_tipo["falta_injustificada"],
            retardo=por_tipo["retardo"],
            incapacidad=por_tipo["incapacidad"],
            suspension=por_tipo["suspension"],
            eventos_por_mes=[
                {"periodo": periodo, "total": count} for periodo, count in por_mes
            ],
            eventos_por_periodo_y_tipo=por_periodo_y_tipo or [],
            tendencia_agrupacion=tendencia_agrupacion,
            eventos_por_tipo=eventos_por_tipo,
            empleados_con_mas_eventos=empleados_con_mas_eventos,
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
        area: str | None = None,
        tendencia_agrupacion: str | None = None,
    ) -> FaltasRetardosEstadisticasResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        engine, repo = await self._with_bono_repo()
        try:
            filters = {
                "empleado_id": empleado_id,
                "tipo": tipo,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "busqueda": busqueda,
                "area": area,
                "empleado_ids_scope": scope_ids,
            }
            por_codigo = await repo.aggregate_por_tipo_codigo(**filters)
            por_mes = await repo.aggregate_por_mes(**filters)
            empleados_top = await repo.aggregate_empleados_top_por_tipo(limit=10, **filters)
            agr = (
                tendencia_agrupacion.strip().lower()
                if tendencia_agrupacion and tendencia_agrupacion.strip()
                else None
            )
            por_periodo_y_tipo: list[dict[str, object]] | None = None
            if agr in ("dia", "semana", "mes"):
                periodo_rows = await repo.aggregate_por_periodo_y_tipo(agrupacion=agr, **filters)
                por_periodo_y_tipo = self._map_periodo_tipo_rows(periodo_rows)
            return self._build_estadisticas_response(
                por_codigo,
                por_mes,
                empleados_top,
                por_periodo_y_tipo=por_periodo_y_tipo,
                tendencia_agrupacion=agr if agr in ("dia", "semana", "mes") else None,
            )
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
        empleado = await self._assert_empleado_en_alcance(data.empleado_id, scope_ids)

        if data.tipo == "suspension":
            if data.fecha_fin is None:
                raise DomainValidationError("fecha_fin es obligatoria para suspensión")
            await registrar_suspension_en_tress(
                no_empleado=int(empleado.no_empleado),
                fecha_inicio=data.fecha_evento,
                fecha_fin=data.fecha_fin,
                comentario=(data.observaciones or "").strip(),
            )

        origen_ids = await self._insertar_en_importadas_historico(empleado, data)
        origen_id = origen_ids[0]

        await self.audit_repo.save_registros_auditoria(
            bono_origen=ORIGEN_IMPORTADAS_HISTORICO,
            bono_origen_ids=origen_ids,
            registrado_por_id=current_user.empleado_id,
        )
        await self.db.commit()

        engine, repo = await self._with_bono_importadas_repo()
        try:
            row = await repo.fetch_evento_row(origen_id)
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al leer registro en importadas_historico: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

        if row is None:
            raise DomainValidationError(
                "Registro creado en importadas_historico pero no fue posible recuperarlo"
            )

        mapped = map_bono_row(row)
        if mapped is None:
            raise DomainValidationError(
                "Registro creado en importadas_historico con formato no reconocido"
            )
        if mapped.origen != ORIGEN_IMPORTADAS_HISTORICO:
            raise DomainValidationError("Origen inesperado al recuperar el registro creado")

        fecha_fin = data.fecha_fin if data.tipo in FALTA_RETARDO_TIPOS_RANGO else None
        observaciones = data.observaciones.strip() if data.observaciones else None
        return self._to_response_importadas(
            mapped,
            current_user=current_user,
            fecha_fin=fecha_fin,
            observaciones=observaciones,
        )

    def list_tipos(self) -> list[str]:
        return list(FALTA_RETARDO_TIPOS)
