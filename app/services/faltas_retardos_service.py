from datetime import date, timedelta

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_for_module
from app.core.exceptions import DomainValidationError, ForbiddenError, NotFoundError, ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.models.faltas_retardos import (
    FALTA_RETARDO_TIPOS,
    FALTA_RETARDO_TIPOS_GOCE,
    FALTA_RETARDO_TIPOS_RANGO,
    FaltaRetardoEvento,
)
from app.repositories.bono_importadas_historico_repository import BonoImportadasHistoricoRepository
from app.repositories.datos_analisis_faltas_retardos_repository import (
    DatosAnalisisFaltasRetardosRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.schemas.faltas_retardos import (
    FaltaRetardoCreateRequest,
    FaltaRetardoResponse,
    FaltasRetardosEstadisticasResponse,
    FaltasRetardosPageResponse,
)
from app.services.faltas_retardos.constants import (
    ORIGEN_IMPORTADAS_HISTORICO,
    ORIGEN_MANUAL,
    TIPO_A_PONDERACION,
    synthetic_falta_retardo_id,
)
from app.services.faltas_retardos.mapper import map_bono_row
from app.services.faltas_retardos.mapper_tress import map_tress_row
from app.services.descansos_empleado_service import obtener_descansos_tress
from app.services.tress_goce_service import (
    FALTA_RETARDO_TIPOS_GOCE_FJ,
    GOCE_PM_COMENTA,
    registrar_permisos_goce_tramos_en_tress,
)
from app.services.tress_suspension_service import registrar_suspension_en_tress
from app.utils.clasificacion_empleado import empleado_es_administrativo
from app.utils.descansos_fechas import (
    avanzar_hasta_reunir_dias,
    fechas_efectivas_en_rango,
    partir_tramos_por_semanas,
    tramos_consecutivos,
)
from app.utils.vacaciones_fechas import defuncion_rango_para_empleado, paternidad_rango

_FALTA_RETARDO_TIPOS_BONO_RANGO = frozenset({"incapacidad", "suspension"})
_DIAS_GOCE = {
    "matrimonio": 2,
    "defuncion": 3,
    "paternidad": 7,
}

# Sin filtro de fechas el listado recorrería el histórico completo de TRESS
# (desde 1999, ~166k filas y varios segundos). Con esta ventana la consulta baja
# a decenas de milisegundos; pedir una fecha "desde" anterior sigue llegando a
# todo el histórico.
VENTANA_DEFAULT_MESES = 12

# `incapacidad_interna` no existe en TRESS (el código II del catálogo dbo.INCIDEN
# tiene cero uso y este sistema nunca la escribe allí), así que solo vive en
# levelup_faltas_retardos.
_TIPOS_SOLO_LEVELUP = frozenset({"incapacidad_interna"})

# Tope al mezclar eventos locales con los de TRESS: sin él, pedir una página
# lejana traería medio histórico a memoria.
_MAX_PREFETCH_TRESS = 5000


def _ventana_por_defecto(
    fecha_inicio: date | None, fecha_fin: date | None
) -> tuple[date | None, date | None]:
    if fecha_inicio is not None or fecha_fin is not None:
        return fecha_inicio, fecha_fin
    hoy = date.today()
    return hoy - timedelta(days=365 * VENTANA_DEFAULT_MESES // 12), None


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
                "origen": ORIGEN_MANUAL,
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

    async def _enriquecer_con_levelup(
        self, items: list[FaltaRetardoResponse]
    ) -> list[FaltaRetardoResponse]:
        """Restaura motivo y "registrado por" de las filas que registró este sistema.

        TRESS no guarda quién capturó desde la app, así que se empata por
        (empleado_id, fecha_evento, tipo) contra `levelup_faltas_retardos`. El
        cruce es 1:1, de modo que no altera el conteo ni la paginación.
        """
        claves = [
            (item.empleado_id, item.fecha_evento, item.tipo)
            for item in items
            if item.empleado_id
        ]
        if not claves:
            return items
        eventos = await self.audit_repo.map_eventos_por_clave(claves)
        if not eventos:
            return items
        enriched: list[FaltaRetardoResponse] = []
        for item in items:
            evento = eventos.get((item.empleado_id, item.fecha_evento, item.tipo))
            if evento is None:
                enriched.append(item)
                continue
            update: dict = {
                "id": synthetic_falta_retardo_id(ORIGEN_MANUAL, evento.id),
                "origen": ORIGEN_MANUAL,
                "origen_id": evento.id,
                "registrado_por_id": evento.registrado_por_id,
                "registrado_por_nombre": _empleado_display_nombre(evento.registrado_por),
                "created_at": evento.created_at,
            }
            if evento.observaciones is not None:
                update["observaciones"] = evento.observaciones
            if evento.fecha_fin is not None:
                update["fecha_fin"] = evento.fecha_fin
            enriched.append(item.model_copy(update=update))
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
            if data.tipo in _FALTA_RETARDO_TIPOS_BONO_RANGO:
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

    def _with_datos_analisis_repo(self) -> tuple:
        """Motor efímero de datos-analisis; el llamador hace dispose() en finally."""
        try:
            engine = DatosAnalisisReadClient.create_read_engine()
        except Exception as exc:  # noqa: BLE001 - driver/configuración de integración
            raise ServiceUnavailableError(
                "No se pudieron consultar las incidencias en datos-analisis."
            ) from exc
        if engine is None:
            raise ServiceUnavailableError(
                "Base datos-analisis no configurada (variables DATOS_ANALISIS_DB_*)."
            )
        return engine, DatosAnalisisFaltasRetardosRepository(engine)

    async def _cb_codigos_filtrados(
        self,
        *,
        empleado_id: int | None,
        busqueda: str | None,
        scope_ids: list[int] | None,
        area: str | None = None,
    ) -> list[int] | None:
        """Números de empleado a los que acotar TRESS, o None si no hay restricción.

        Sin restricción no se manda la lista completa de la plantilla: el filtro
        se omite y SQL Server recorre todo el rango de fechas.
        """
        restrictivo = (
            scope_ids is not None
            or empleado_id is not None
            or bool(busqueda and busqueda.strip())
            or bool(area and area.strip())
        )
        if not restrictivo:
            return None
        return await self.empleado_repo.list_no_empleados_filtrados(
            empleado_ids_scope=scope_ids,
            empleado_id=empleado_id,
            busqueda=busqueda,
            area=area,
        )

    async def _map_tress_rows(
        self, rows: list[dict]
    ) -> list[FaltaRetardoResponse]:
        nos = [row["no_empleado"] for row in rows if row.get("no_empleado") is not None]
        empleados = await self.empleado_repo.map_por_no_empleados(nos)
        items: list[FaltaRetardoResponse] = []
        for row in rows:
            empleado_id, nombre = empleados.get(row.get("no_empleado"), (None, None))
            mapped = map_tress_row(row, empleado_id=empleado_id, empleado_nombre=nombre)
            if mapped is not None:
                items.append(mapped)
        return await self._enriquecer_con_levelup(items)

    async def _extras_levelup(
        self,
        repo: DatosAnalisisFaltasRetardosRepository,
        levelup_items: list[FaltaRetardoResponse],
        *,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> list[FaltaRetardoResponse]:
        """Eventos locales con goce que TRESS no tiene (no se pueden contar allá).

        `incapacidad_interna` nunca llega a TRESS. Del resto, quedan como extra
        solo los que no empatan con un permiso de TRESS — típicamente altas
        anteriores a que existiera el INSERT directo a nómina.
        """
        if not levelup_items:
            return []
        solo_locales = [i for i in levelup_items if i.tipo in _TIPOS_SOLO_LEVELUP]
        candidatos = [i for i in levelup_items if i.tipo not in _TIPOS_SOLO_LEVELUP]
        if not candidatos:
            return solo_locales

        nos = {
            int(i.numero_empleado)
            for i in candidatos
            if i.numero_empleado and i.numero_empleado.isdigit()
        }
        claves_tress = await repo.list_claves_permisos_goce(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            cb_codigos=sorted(nos) if nos else None,
        )
        extras = list(solo_locales)
        for item in candidatos:
            no_empleado = (
                int(item.numero_empleado)
                if item.numero_empleado and item.numero_empleado.isdigit()
                else None
            )
            if no_empleado is None:
                extras.append(item)
                continue
            if (no_empleado, item.fecha_evento, item.tipo) not in claves_tress:
                extras.append(item)
        return extras

    def _map_levelup_evento(self, ev: FaltaRetardoEvento) -> FaltaRetardoResponse:
        return FaltaRetardoResponse(
            id=synthetic_falta_retardo_id(ORIGEN_MANUAL, ev.id),
            empleado_id=ev.empleado_id,
            empleado_nombre=_empleado_display_nombre(ev.empleado),
            numero_empleado=_empleado_display_no(ev.empleado),
            tipo=ev.tipo,  # type: ignore[arg-type]
            fecha_evento=ev.fecha_evento,
            fecha_fin=ev.fecha_fin,
            observaciones=ev.observaciones,
            registrado_por_id=ev.registrado_por_id,
            registrado_por_nombre=_empleado_display_nombre(ev.registrado_por),
            created_at=ev.created_at,
            origen=ORIGEN_MANUAL,
            origen_id=ev.id,
        )

    async def _list_levelup_items(
        self,
        *,
        empleado_id: int | None,
        tipo: str | None,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        busqueda: str | None,
        scope_ids: list[int] | None,
    ) -> list[FaltaRetardoResponse]:
        if tipo is not None and tipo not in FALTA_RETARDO_TIPOS_GOCE:
            return []
        rows = await self.audit_repo.list_levelup_filtered(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            empleado_ids_scope=scope_ids,
            tipos_permitidos=FALTA_RETARDO_TIPOS_GOCE if tipo is None else None,
        )
        return [self._map_levelup_evento(r) for r in rows]

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
        fecha_inicio, fecha_fin = _ventana_por_defecto(fecha_inicio, fecha_fin)

        levelup_items = await self._list_levelup_items(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            scope_ids=scope_ids,
        )

        # incapacidad_interna solo existe en levelup: paginar sin tocar TRESS.
        if tipo is not None and tipo in _TIPOS_SOLO_LEVELUP:
            return self._paginar_en_memoria(levelup_items, page, page_size)

        cb_codigos = await self._cb_codigos_filtrados(
            empleado_id=empleado_id, busqueda=busqueda, scope_ids=scope_ids
        )
        if cb_codigos is not None and not cb_codigos:
            return self._paginar_en_memoria(levelup_items, page, page_size)

        engine, repo = self._with_datos_analisis_repo()
        try:
            tress_total = await repo.count(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                cb_codigos=cb_codigos,
                tipo=tipo,
            )
            extras = await self._extras_levelup(
                repo, levelup_items, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin
            )
            total = tress_total + len(extras)
            page, offset = self._normalizar_pagina(page, page_size, total)

            # Sin extras la paginación es íntegra del lado de SQL Server. Con
            # extras hay que mezclar, y para eso se traen las filas hasta el
            # final de la página pedida (tope duro para no barrer el histórico).
            if extras:
                rows = await repo.list_offset(
                    0,
                    min(offset + page_size, _MAX_PREFETCH_TRESS),
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            else:
                rows = await repo.list_offset(
                    offset,
                    page_size,
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar incidencias en datos-analisis: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

        items = await self._map_tress_rows(rows)
        if extras:
            merged = sorted(
                [*extras, *items],
                key=lambda x: (x.fecha_evento, x.id),
                reverse=True,
            )
            items = merged[offset : offset + page_size]

        return FaltasRetardosPageResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def _normalizar_pagina(page: int, page_size: int, total: int) -> tuple[int, int]:
        if total == 0:
            return 1, 0
        offset = (page - 1) * page_size
        if offset >= total:
            page = max(1, (total + page_size - 1) // page_size)
            offset = (page - 1) * page_size
        return page, offset

    def _paginar_en_memoria(
        self, items: list[FaltaRetardoResponse], page: int, page_size: int
    ) -> FaltasRetardosPageResponse:
        total = len(items)
        page, offset = self._normalizar_pagina(page, page_size, total)
        return FaltasRetardosPageResponse(
            items=items[offset : offset + page_size],
            total=total,
            page=page,
            page_size=page_size,
        )

    def _normalizar_por_tipo(self, por_tipo: dict[str, int]) -> dict[str, int]:
        salida: dict[str, int] = {t: 0 for t in FALTA_RETARDO_TIPOS}
        for clave, count in por_tipo.items():
            if clave in salida:
                salida[clave] += int(count)
        return salida

    def _map_periodo_tipo_rows(
        self, rows: list[tuple[str, str, int]]
    ) -> list[dict[str, object]]:
        merged: dict[tuple[str, str], int] = {}
        for periodo, clave, count in rows:
            if clave not in FALTA_RETARDO_TIPOS:
                continue
            key = (periodo, clave)
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
        por_tipo = self._normalizar_por_tipo(por_codigo)

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
            por_tipo_emp = self._normalizar_por_tipo(por_codigo_emp)
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
        fecha_inicio, fecha_fin = _ventana_por_defecto(fecha_inicio, fecha_fin)
        agr = (
            tendencia_agrupacion.strip().lower()
            if tendencia_agrupacion and tendencia_agrupacion.strip()
            else None
        )
        agr = agr if agr in ("dia", "semana", "mes") else None

        # Los eventos locales (incapacidad interna y goce previo a la escritura
        # directa a TRESS) se agregan aparte para que los KPIs cuadren con la tabla.
        levelup_items = await self._list_levelup_items(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            busqueda=busqueda,
            scope_ids=scope_ids,
        )

        cb_codigos = await self._cb_codigos_filtrados(
            empleado_id=empleado_id, busqueda=busqueda, scope_ids=scope_ids, area=area
        )
        if cb_codigos is not None and not cb_codigos:
            return self._estadisticas_solo_levelup(levelup_items, agr)

        engine, repo = self._with_datos_analisis_repo()
        try:
            filters = {
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "cb_codigos": cb_codigos,
                "tipo": tipo,
            }
            por_tipo = await repo.aggregate_por_tipo(**filters)
            por_mes = await repo.aggregate_por_mes(**filters)
            top_tress = await repo.aggregate_empleados_top(limit=10, **filters)
            periodo_rows = (
                await repo.aggregate_por_periodo_y_tipo(agrupacion=agr, **filters)
                if agr
                else []
            )
            extras = await self._extras_levelup(
                repo, levelup_items, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin
            )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar estadísticas en datos-analisis: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

        for item in extras:
            por_tipo[item.tipo] = por_tipo.get(item.tipo, 0) + 1
        por_mes = self._sumar_periodos(por_mes, [i.fecha_evento for i in extras], "mes")
        if agr:
            periodo_rows = [*periodo_rows, *self._periodos_de_extras(extras, agr)]

        empleados_top = await self._hidratar_empleados_top(top_tress, extras)
        return self._build_estadisticas_response(
            por_tipo,
            por_mes,
            empleados_top,
            por_periodo_y_tipo=self._map_periodo_tipo_rows(periodo_rows) if agr else None,
            tendencia_agrupacion=agr,
        )

    @staticmethod
    def _periodo_de_fecha(fecha: date, agrupacion: str) -> str:
        if agrupacion == "dia":
            return fecha.isoformat()
        if agrupacion == "semana":
            return (fecha - timedelta(days=fecha.weekday())).isoformat()
        return fecha.strftime("%Y-%m")

    def _periodos_de_extras(
        self, extras: list[FaltaRetardoResponse], agrupacion: str
    ) -> list[tuple[str, str, int]]:
        return [
            (self._periodo_de_fecha(item.fecha_evento, agrupacion), item.tipo, 1)
            for item in extras
        ]

    def _sumar_periodos(
        self, por_periodo: list[tuple[str, int]], fechas: list[date], agrupacion: str
    ) -> list[tuple[str, int]]:
        merged = dict(por_periodo)
        for fecha in fechas:
            periodo = self._periodo_de_fecha(fecha, agrupacion)
            merged[periodo] = merged.get(periodo, 0) + 1
        return sorted(merged.items())

    async def _hidratar_empleados_top(
        self,
        top_tress: list[tuple[int, int, dict[str, int]]],
        extras: list[FaltaRetardoResponse],
    ) -> list[tuple[int, str | None, str | None, int, dict[str, int]]]:
        """Convierte (no_empleado, total, por_tipo) de TRESS en el shape del schema."""
        acumulado: dict[int, dict[str, int]] = {
            no_empleado: dict(por_tipo) for no_empleado, _total, por_tipo in top_tress
        }
        for item in extras:
            if not item.numero_empleado or not item.numero_empleado.isdigit():
                continue
            destino = acumulado.setdefault(int(item.numero_empleado), {})
            destino[item.tipo] = destino.get(item.tipo, 0) + 1

        empleados = await self.empleado_repo.map_por_no_empleados(list(acumulado.keys()))
        salida: list[tuple[int, str | None, str | None, int, dict[str, int]]] = []
        for no_empleado, por_tipo in acumulado.items():
            empleado_id, nombre = empleados.get(no_empleado, (0, None))
            salida.append((empleado_id, str(no_empleado), nombre, sum(por_tipo.values()), por_tipo))
        salida.sort(key=lambda row: (-row[3], row[0]))
        return salida[:10]

    def _estadisticas_solo_levelup(
        self, items: list[FaltaRetardoResponse], agrupacion: str | None
    ) -> FaltasRetardosEstadisticasResponse:
        por_tipo: dict[str, int] = {}
        for item in items:
            por_tipo[item.tipo] = por_tipo.get(item.tipo, 0) + 1
        por_mes = self._sumar_periodos([], [i.fecha_evento for i in items], "mes")
        periodo_rows = self._periodos_de_extras(items, agrupacion) if agrupacion else []
        empleados: dict[int, dict[str, int]] = {}
        for item in items:
            destino = empleados.setdefault(item.empleado_id, {})
            destino[item.tipo] = destino.get(item.tipo, 0) + 1
        empleados_top = [
            (
                empleado_id,
                next(
                    (i.numero_empleado for i in items if i.empleado_id == empleado_id),
                    None,
                ),
                next((i.empleado_nombre for i in items if i.empleado_id == empleado_id), None),
                sum(tipos.values()),
                tipos,
            )
            for empleado_id, tipos in empleados.items()
        ]
        empleados_top.sort(key=lambda row: (-row[3], row[0]))
        return self._build_estadisticas_response(
            por_tipo,
            por_mes,
            empleados_top[:10],
            por_periodo_y_tipo=self._map_periodo_tipo_rows(periodo_rows) if agrupacion else None,
            tendencia_agrupacion=agrupacion,
        )

    def _validar_fechas_goce(self, data: FaltaRetardoCreateRequest, *, administrativo: bool) -> None:
        assert data.fecha_fin is not None
        if data.tipo == "matrimonio":
            dias = (data.fecha_fin - data.fecha_evento).days + 1
            if dias != 2:
                raise DomainValidationError(
                    "Matrimonio solo permite registrar exactamente 2 días consecutivos "
                    "(fecha fin debe ser un día después de la fecha de inicio)."
                )
        elif data.tipo == "defuncion":
            esperado_inicio, esperado_fin = defuncion_rango_para_empleado(
                data.fecha_evento,
                administrativo=administrativo,
            )
            if data.fecha_evento != esperado_inicio or data.fecha_fin != esperado_fin:
                if administrativo:
                    raise DomainValidationError(
                        "Defunción para colaboradores administrativos requiere exactamente "
                        "3 días hábiles. Si el rango cruza fin de semana, se usan los días "
                        "hábiles más cercanos."
                    )
                raise DomainValidationError(
                    "Defunción solo permite registrar exactamente 3 días consecutivos "
                    "(fecha fin = dos días después de la fecha de inicio)."
                )
        elif data.tipo == "paternidad":
            esperado_inicio, esperado_fin = paternidad_rango(data.fecha_evento)
            if data.fecha_evento != esperado_inicio or data.fecha_fin != esperado_fin:
                raise DomainValidationError(
                    "Paternidad solo permite registrar exactamente 7 días hábiles. "
                    "Si la fecha de inicio cae en fin de semana, se usan los días hábiles "
                    "más cercanos."
                )

    async def _tramos_goce_sin_descansos(
        self,
        *,
        data: FaltaRetardoCreateRequest,
        no_empleado: int,
        administrativo: bool,
    ) -> list[tuple[date, date]]:
        assert data.fecha_fin is not None
        if data.tipo in FALTA_RETARDO_TIPOS_GOCE_FJ:
            horizonte = data.fecha_evento + timedelta(days=365)
            descansos = set(
                await obtener_descansos_tress(
                    cb_codigo=no_empleado,
                    fecha_inicio=data.fecha_evento,
                    fecha_fin=horizonte,
                )
            )
            if data.fecha_evento in descansos:
                raise DomainValidationError(
                    "La fecha inicial no puede ser un descanso aplicado en TRESS."
                )
            solo_lunes_viernes = data.tipo == "paternidad" or (
                data.tipo == "defuncion" and administrativo
            )
            fechas = avanzar_hasta_reunir_dias(
                data.fecha_evento,
                _DIAS_GOCE[data.tipo],
                descansos,
                solo_lunes_viernes=solo_lunes_viernes,
            )
            if fechas[-1] > horizonte:
                raise DomainValidationError(
                    "No fue posible reunir los días otorgados dentro del rango consultable."
                )
        else:
            descansos = await obtener_descansos_tress(
                cb_codigo=no_empleado,
                fecha_inicio=data.fecha_evento,
                fecha_fin=data.fecha_fin,
            )
            fechas = fechas_efectivas_en_rango(
                data.fecha_evento,
                data.fecha_fin,
                descansos,
            )
            if not fechas:
                raise DomainValidationError(
                    "El rango efectivo queda vacío porque todos los días son descansos."
                )
        return partir_tramos_por_semanas(tramos_consecutivos(fechas))

    async def _crear_evento_goce(
        self,
        data: FaltaRetardoCreateRequest,
        current_user: Empleado,
        empleado: Empleado,
    ) -> FaltaRetardoResponse:
        if data.fecha_fin is None:
            raise DomainValidationError("fecha_fin es obligatoria para permisos con goce")

        emp_clf = await self.empleado_repo.get_with_clasificacion(empleado.empleado_id)
        administrativo = emp_clf is not None and empleado_es_administrativo(emp_clf)
        self._validar_fechas_goce(data, administrativo=administrativo)

        observaciones = data.observaciones.strip() if data.observaciones else None
        tramos = await self._tramos_goce_sin_descansos(
            data=data,
            no_empleado=int(empleado.no_empleado),
            administrativo=administrativo,
        )

        # Matrimonio / defunción / paternidad: split lun–dom + INSERT directo dbo.PERMISO (FJ).
        # incapacidad_interna: solo levelup (sin cola RPA; INSERT TRESS pendiente de contrato).
        if data.tipo in FALTA_RETARDO_TIPOS_GOCE_FJ:
            comentario_tress = GOCE_PM_COMENTA[data.tipo]
            await registrar_permisos_goce_tramos_en_tress(
                no_empleado=int(empleado.no_empleado),
                tramos=tramos,
                comentario=comentario_tress,
            )
            first_ev: FaltaRetardoEvento | None = None
            for inicio, fin in tramos:
                ev = await self.audit_repo.create_evento(
                    empleado_id=empleado.empleado_id,
                    tipo=data.tipo,
                    fecha_evento=inicio,
                    fecha_fin=fin,
                    observaciones=observaciones,
                    registrado_por_id=current_user.empleado_id,
                )
                if first_ev is None:
                    first_ev = ev
            assert first_ev is not None
            await self.db.commit()
            loaded = await self.audit_repo.get_with_relations(first_ev.id)
            return self._map_levelup_evento(loaded if loaded is not None else first_ev)

        first_ev: FaltaRetardoEvento | None = None
        for inicio, fin in tramos:
            ev = await self.audit_repo.create_evento(
                empleado_id=empleado.empleado_id,
                tipo=data.tipo,
                fecha_evento=inicio,
                fecha_fin=fin,
                observaciones=observaciones,
                registrado_por_id=current_user.empleado_id,
            )
            if first_ev is None:
                first_ev = ev
        assert first_ev is not None
        await self.db.commit()
        loaded = await self.audit_repo.get_with_relations(first_ev.id)
        return self._map_levelup_evento(loaded if loaded is not None else first_ev)

    async def crear_evento(
        self,
        data: FaltaRetardoCreateRequest,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
    ) -> FaltaRetardoResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        empleado = await self._assert_empleado_en_alcance(data.empleado_id, scope_ids)

        if data.tipo in FALTA_RETARDO_TIPOS_GOCE:
            return await self._crear_evento_goce(data, current_user, empleado)

        suspension_tramos: list[tuple[date, date]] | None = None
        if data.tipo == "suspension":
            if data.fecha_fin is None:
                raise DomainValidationError("fecha_fin es obligatoria para suspensión")
            descansos = await obtener_descansos_tress(
                cb_codigo=int(empleado.no_empleado),
                fecha_inicio=data.fecha_evento,
                fecha_fin=data.fecha_fin,
            )
            fechas = fechas_efectivas_en_rango(
                data.fecha_evento,
                data.fecha_fin,
                descansos,
            )
            if not fechas:
                raise DomainValidationError(
                    "El rango efectivo queda vacío porque todos los días son descansos."
                )
            suspension_tramos = partir_tramos_por_semanas(tramos_consecutivos(fechas))
            for inicio, fin in suspension_tramos:
                await registrar_suspension_en_tress(
                    no_empleado=int(empleado.no_empleado),
                    fecha_inicio=inicio,
                    fecha_fin=fin,
                    comentario=(data.observaciones or "").strip(),
                )

        datos_por_tramo = (
            [
                data.model_copy(
                    update={"fecha_evento": inicio, "fecha_fin": fin}
                )
                for inicio, fin in suspension_tramos
            ]
            if suspension_tramos is not None
            else [data]
        )
        origen_ids_por_tramo: list[tuple[list[int], FaltaRetardoCreateRequest]] = []
        for datos_tramo in datos_por_tramo:
            ids = await self._insertar_en_importadas_historico(empleado, datos_tramo)
            origen_ids_por_tramo.append((ids, datos_tramo))
        origen_ids = [
            origen_id
            for ids, _datos_tramo in origen_ids_por_tramo
            for origen_id in ids
        ]
        origen_id = origen_ids[0]

        fecha_fin = data.fecha_fin if data.tipo in FALTA_RETARDO_TIPOS_RANGO else None
        observaciones = data.observaciones.strip() if data.observaciones else None

        for ids, datos_tramo in origen_ids_por_tramo:
            await self.audit_repo.save_registros_auditoria(
                bono_origen=ORIGEN_IMPORTADAS_HISTORICO,
                bono_origen_ids=ids,
                registrado_por_id=current_user.empleado_id,
                observaciones=observaciones,
                fecha_fin=(
                    datos_tramo.fecha_fin
                    if data.tipo in FALTA_RETARDO_TIPOS_RANGO
                    else None
                ),
            )
            # La suspensión sí llega a TRESS, pero allá no queda constancia de
            # quién la capturó desde la app. La copia local permite recuperar
            # usuario, motivo y fecha real de registro al listar desde TRESS. No
            # duplica renglones: `_list_levelup_items` solo lee tipos con goce.
            if data.tipo == "suspension":
                await self.audit_repo.create_evento(
                    empleado_id=empleado.empleado_id,
                    tipo=data.tipo,
                    fecha_evento=datos_tramo.fecha_evento,
                    fecha_fin=datos_tramo.fecha_fin,
                    observaciones=observaciones,
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

        return self._to_response_importadas(
            mapped,
            current_user=current_user,
            fecha_fin=datos_por_tramo[0].fecha_fin if fecha_fin is not None else None,
            observaciones=observaciones,
        )

    def list_tipos(self) -> list[str]:
        return list(FALTA_RETARDO_TIPOS)
