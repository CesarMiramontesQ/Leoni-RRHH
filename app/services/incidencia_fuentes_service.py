"""
Servicio agregador de fuentes de incidencias por tipo.

Fuentes activas: ``calidad_historico`` y ``seguridad_historico`` (consulta unificada).
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_scope import effective_data_scope_for_module
from app.core.exceptions import ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.repositories.bono_historico_incidencias_repository import (
    BonoHistoricoIncidenciasRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.incidencias import (
    IncidenciaAreaTotalItem,
    IncidenciaEmpleadoTipoCountItem,
    IncidenciaEmpleadoTotalItem,
    IncidenciaMesTipoItem,
    IncidenciaPeriodoTipoItem,
    IncidenciaResponse,
    IncidenciaSerieMensualItem,
    IncidenciaSubareaTotalItem,
    IncidenciaTipoDistribucionItem,
    IncidenciasEstadisticasResponse,
    IncidenciasKpiResumen,
    IncidenciasListPageResponse,
)
from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
    TIPOS_INCIDENCIA_REGISTRADOS,
)
from app.services.incidencia_fuentes.mapper import map_historico_row
from app.services.incidencia_fuentes.types import IncidenciaFuenteFilters


class IncidenciaFuentesService:
    """Lee incidencias desde fuentes externas tipadas y las unifica al formato de la API."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    async def _empleado_ids_scope(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
    ) -> list[int] | None:
        scope = effective_data_scope_for_module(current_user, "incidencias", rh_ui_mode)
        if scope in ("director", "rh"):
            return None
        if scope == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.empleado_id for e in subordinados] + [current_user.empleado_id]
            return ids
        if scope == "gerente":
            equipo = await self.empleado_repo.get_ids_subarbol(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            return list(equipo) + [current_user.empleado_id]
        return [current_user.empleado_id]

    def _build_filters(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        tipo: str | None = None,
        empleado_id: int | None = None,
        no_empleado: str | None = None,
        nombre: str | None = None,
        fecha: date | None = None,
        categoria: str | None = None,
        area: str | None = None,
        subarea: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        empleado_ids_scope: list[int] | None = None,
    ) -> IncidenciaFuenteFilters:
        return IncidenciaFuenteFilters(
            tipo=tipo,
            empleado_id=empleado_id,
            no_empleado=no_empleado,
            nombre=nombre,
            fecha=fecha,
            categoria=categoria,
            area=area,
            subarea=subarea,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            empleado_ids_scope=empleado_ids_scope,
        )

    async def _with_bono_repo(self):
        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            raise ServiceUnavailableError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )
        return engine, BonoHistoricoIncidenciasRepository(engine)

    async def _enriquecer_response(self, item: IncidenciaResponse) -> None:
        emp = None
        no = (item.no_empleado or "").strip()
        if no:
            emp = await self.empleado_repo.get_by_no_empleado_con_puesto_y_lider(no)
        if emp is None:
            emp = await self.empleado_repo.get_with_area_y_lider(item.empleado_id)
        if emp is None:
            return
        if emp.puesto is not None and emp.puesto.descripcion:
            p = str(emp.puesto.descripcion).strip()
            item.puesto = p or None
        if emp.lider is not None and emp.lider.nombre:
            s = str(emp.lider.nombre).strip()
            item.supervisor_directo = s or None

    async def list_incidencias_paginated(
        self,
        current_user: Empleado,
        page: int,
        page_size: int,
        *,
        rh_ui_mode: str | None = None,
        tipo: str | None = None,
        empleado_id: int | None = None,
        no_empleado: str | None = None,
        nombre: str | None = None,
        fecha: date | None = None,
        categoria: str | None = None,
        area: str | None = None,
        subarea: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> IncidenciasListPageResponse:
        page_size = min(10, max(1, page_size))
        page = max(1, page)
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        filters = self._build_filters(
            current_user,
            rh_ui_mode=rh_ui_mode,
            tipo=tipo,
            empleado_id=empleado_id,
            no_empleado=no_empleado,
            nombre=nombre,
            fecha=fecha,
            categoria=categoria,
            area=area,
            subarea=subarea,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            empleado_ids_scope=scope_ids,
        )

        engine, repo = await self._with_bono_repo()
        try:
            total = await repo.count(filters)
            offset = (page - 1) * page_size
            if total == 0:
                page = 1
            elif offset >= total:
                page = max(1, (total + page_size - 1) // page_size)
                offset = (page - 1) * page_size

            rows = await repo.list_offset(offset, page_size, filters)
            response_items: list[IncidenciaResponse] = []
            for row in rows:
                r = map_historico_row(row)
                await self._enriquecer_response(r)
                response_items.append(r)

            return IncidenciasListPageResponse(
                items=response_items,
                total=total,
                page=page,
                page_size=page_size,
                resumen=IncidenciasKpiResumen(
                    abiertas=total,
                    en_investigacion=0,
                    resueltas=0,
                    criticas=0,
                ),
            )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar incidencias históricas en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

    async def estadisticas_incidencias(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        tipo: str | None = None,
        empleado_id: int | None = None,
        no_empleado: str | None = None,
        nombre: str | None = None,
        fecha: date | None = None,
        categoria: str | None = None,
        area: str | None = None,
        subarea: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        tendencia_agrupacion: str | None = None,
    ) -> IncidenciasEstadisticasResponse:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        filters = self._build_filters(
            current_user,
            rh_ui_mode=rh_ui_mode,
            tipo=tipo,
            empleado_id=empleado_id,
            no_empleado=no_empleado,
            nombre=nombre,
            fecha=fecha,
            categoria=categoria,
            area=area,
            subarea=subarea,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            empleado_ids_scope=scope_ids,
        )

        engine, repo = await self._with_bono_repo()
        try:
            total_incidencias = await repo.count(filters)
            conteos = await repo.count_por_tipo_incidencia(filters)
            incidencias_calidad = conteos.get(TIPO_INCIDENCIA_CALIDAD, 0)
            incidencias_seguridad = conteos.get(TIPO_INCIDENCIA_SEGURIDAD, 0)

            areas_raw = await repo.aggregate_areas_top(filters, limit=10)
            subareas_raw = await repo.aggregate_subareas_top_with_area(filters, limit=10)
            empleados_raw = await repo.aggregate_empleados_top_por_tipo(filters, limit=10)
            tipos_raw = await repo.aggregate_tipos_con_totales(filters)
            mes_rows = await repo.aggregate_totales_por_mes(filters)
            mes_tipo_rows = await repo.aggregate_totales_por_mes_y_tipo(filters)

            total_tipos = sum(c for _, c in tipos_raw)
            incidencias_por_tipo: list[IncidenciaTipoDistribucionItem] = []
            for tipo_str, cnt in tipos_raw:
                pct = round(100.0 * cnt / total_tipos, 2) if total_tipos > 0 else 0.0
                incidencias_por_tipo.append(
                    IncidenciaTipoDistribucionItem(tipo=tipo_str, total=cnt, porcentaje=pct)
                )

            incidencias_por_mes = [
                IncidenciaSerieMensualItem(periodo=p, total=c) for p, c in mes_rows
            ]
            incidencias_por_mes_y_tipo = [
                IncidenciaMesTipoItem(periodo=p, tipo=t, total=c)
                for p, t, c in mes_tipo_rows
            ]

            periodo_y_tipo: list[IncidenciaPeriodoTipoItem] = []
            agr = tendencia_agrupacion if tendencia_agrupacion in ("dia", "semana", "mes") else None
            if agr:
                periodo_rows = await repo.aggregate_totales_por_periodo_y_tipo(
                    filters, agrupacion=agr
                )
                periodo_y_tipo = [
                    IncidenciaPeriodoTipoItem(periodo=p, tipo=t, total=c)
                    for p, t, c in periodo_rows
                ]

            total_periodo_anterior: int | None = None
            variacion_total_pct: float | None = None
            if fecha_inicio is not None and fecha_fin is not None:
                span_days = (fecha_fin - fecha_inicio).days + 1
                prev_end = fecha_inicio - timedelta(days=1)
                prev_start = prev_end - timedelta(days=span_days - 1)
                prev_filters = self._build_filters(
                    current_user,
                    rh_ui_mode=rh_ui_mode,
                    tipo=tipo,
                    empleado_id=empleado_id,
                    no_empleado=no_empleado,
                    nombre=nombre,
                    fecha=fecha,
                    categoria=categoria,
                    area=area,
                    subarea=subarea,
                    fecha_inicio=prev_start,
                    fecha_fin=prev_end,
                    empleado_ids_scope=scope_ids,
                )
                total_prev = await repo.count(prev_filters)
                total_periodo_anterior = total_prev
                if total_prev > 0:
                    variacion_total_pct = round(
                        100.0 * (total_incidencias - total_prev) / total_prev,
                        1,
                    )

            return IncidenciasEstadisticasResponse(
                total_incidencias=total_incidencias,
                incidencias_seguridad=incidencias_seguridad,
                incidencias_calidad=incidencias_calidad,
                areas_con_mas_incidencias=[
                    IncidenciaAreaTotalItem(area=a, total=t) for a, t in areas_raw
                ],
                subareas_con_mas_incidencias=[
                    IncidenciaSubareaTotalItem(subarea=s, total=t, area=ar)
                    for s, ar, t in subareas_raw
                ],
                empleados_con_mas_incidencias=[
                    IncidenciaEmpleadoTotalItem(
                        empleado_id=eid,
                        no_empleado=no,
                        nombre=nom,
                        total=cnt,
                        por_tipo=[
                            IncidenciaEmpleadoTipoCountItem(tipo=tipo, total=tipo_cnt)
                            for tipo, tipo_cnt in sorted(
                                por_tipo.items(),
                                key=lambda x: (-x[1], x[0]),
                            )
                            if tipo_cnt > 0
                        ],
                    )
                    for eid, no, nom, cnt, por_tipo in empleados_raw
                ],
                incidencias_por_tipo=incidencias_por_tipo,
                incidencias_por_mes=incidencias_por_mes,
                incidencias_por_mes_y_tipo=incidencias_por_mes_y_tipo,
                tendencia_agrupacion=agr,
                incidencias_por_periodo_y_tipo=periodo_y_tipo,
                total_periodo_anterior=total_periodo_anterior,
                variacion_total_pct=variacion_total_pct,
            )
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar incidencias históricas en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

    async def list_tipos_registrados(self) -> list[str]:
        return list(TIPOS_INCIDENCIA_REGISTRADOS)

    async def list_areas_registradas(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None = None,
    ) -> list[str]:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        filters = self._build_filters(
            current_user,
            rh_ui_mode=rh_ui_mode,
            empleado_ids_scope=scope_ids,
        )
        engine, repo = await self._with_bono_repo()
        try:
            return await repo.distinct_areas(filters)
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar incidencias históricas en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()

    async def list_subareas_registradas(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        area: str | None = None,
    ) -> list[str]:
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        filters = self._build_filters(
            current_user,
            rh_ui_mode=rh_ui_mode,
            empleado_ids_scope=scope_ids,
        )
        area_val = area.strip() if area and area.strip() else None
        engine, repo = await self._with_bono_repo()
        try:
            return await repo.distinct_subareas(filters, area=area_val)
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar incidencias históricas en bono: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()
