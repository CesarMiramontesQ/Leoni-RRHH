from __future__ import annotations

import json
from datetime import date
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.agents.incidencias.context_filters import merge_context_filters
from app.models.empleados import Empleado
from app.schemas.incidencias import IncidenciasEstadisticasResponse
from app.services.incidencia_service import IncidenciaService

MAX_TOOL_JSON_CHARS = 4000

ALLOWED_TOOLS = frozenset(
    {
        "consultar_estadisticas",
        "listar_incidencias",
        "obtener_incidencia",
        "listar_tipos",
        "listar_areas",
        "listar_subareas",
    }
)


class ToolFilterArgs(BaseModel):
    model_config = {"extra": "ignore"}

    tipo: str | None = None
    area: str | None = None
    subarea: str | None = None
    no_empleado: str | None = None
    nombre: str | None = None
    empleado_id: int | None = None
    categoria: str | None = None
    fecha: date | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    tendencia_agrupacion: str | None = None


class ListarIncidenciasArgs(ToolFilterArgs):
    page: int = Field(default=1, ge=1, le=100)


class ObtenerIncidenciaArgs(BaseModel):
    model_config = {"extra": "ignore"}

    id: int = Field(ge=1)


class ListarSubareasArgs(BaseModel):
    model_config = {"extra": "ignore"}

    area: str | None = None


def _compact_json(data: Any) -> str:
    raw = json.dumps(data, ensure_ascii=False, default=str)
    if len(raw) <= MAX_TOOL_JSON_CHARS:
        return raw
    return raw[: MAX_TOOL_JSON_CHARS - 20] + "…[truncado]"


def _slim_estadisticas_payload(stats: IncidenciasEstadisticasResponse) -> dict[str, Any]:
    """Reduce payload para el agente: evita series largas que rompen el JSON al truncar."""
    d = stats.model_dump(mode="json")
    return {
        "total_incidencias": d.get("total_incidencias", 0),
        "incidencias_seguridad": d.get("incidencias_seguridad", 0),
        "incidencias_calidad": d.get("incidencias_calidad", 0),
        "empleados_con_mas_incidencias": (d.get("empleados_con_mas_incidencias") or [])[:5],
        "incidencias_por_tipo": (d.get("incidencias_por_tipo") or [])[:12],
        "areas_con_mas_incidencias": (d.get("areas_con_mas_incidencias") or [])[:5],
        "subareas_con_mas_incidencias": (d.get("subareas_con_mas_incidencias") or [])[:5],
        "incidencias_por_mes": (d.get("incidencias_por_mes") or [])[-12:],
    }


class IncidenciasAgentTools:
    def __init__(
        self,
        svc: IncidenciaService,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        context_filters: dict[str, Any] | None = None,
        user_message: str | None = None,
    ) -> None:
        self.svc = svc
        self.current_user = current_user
        self.rh_ui_mode = rh_ui_mode
        self.context_filters = context_filters or {}
        self.user_message = user_message

    async def execute(self, tool: str, args: dict[str, Any]) -> tuple[str, bool]:
        if tool not in ALLOWED_TOOLS:
            return (
                json.dumps({"error": f"Herramienta no permitida: {tool}"}, ensure_ascii=False),
                False,
            )
        try:
            if tool == "consultar_estadisticas":
                payload = merge_context_filters(
                    args, self.context_filters, user_message=self.user_message
                )
                parsed = ToolFilterArgs.model_validate(payload)
                dump = parsed.model_dump(exclude_none=True)
                agr = dump.pop("tendencia_agrupacion", None)
                if agr not in (None, "dia", "semana", "mes"):
                    agr = None
                stats = await self.svc.estadisticas_incidencias(
                    self.current_user,
                    rh_ui_mode=self.rh_ui_mode,
                    tendencia_agrupacion=agr,
                    **dump,
                )
                return _compact_json(_slim_estadisticas_payload(stats)), True

            if tool == "listar_incidencias":
                payload = merge_context_filters(
                    args, self.context_filters, user_message=self.user_message
                )
                parsed = ListarIncidenciasArgs.model_validate(payload)
                page = parsed.page
                dump = parsed.model_dump(exclude_none=True, exclude={"page", "tendencia_agrupacion"})
                result = await self.svc.list_incidencias_paginated(
                    self.current_user,
                    page,
                    10,
                    rh_ui_mode=self.rh_ui_mode,
                    **dump,
                )
                slim = {
                    "total": result.total,
                    "page": result.page,
                    "page_size": result.page_size,
                    "resumen": result.resumen.model_dump(),
                    "items": [
                        {
                            "id": i.id,
                            "tipo": i.tipo,
                            "nombre": i.nombre,
                            "no_empleado": i.no_empleado,
                            "fecha": i.fecha,
                            "area": i.area,
                            "subarea": i.subarea,
                            "detalle": (i.detalle or "")[:200],
                        }
                        for i in result.items
                    ],
                }
                return _compact_json(slim), True

            if tool == "obtener_incidencia":
                parsed = ObtenerIncidenciaArgs.model_validate(args)
                item = await self.svc.get_incidencia(parsed.id, self.current_user)
                return _compact_json(item.model_dump(mode="json")), True

            if tool == "listar_tipos":
                items = await self.svc.list_tipos_registrados(
                    self.current_user, rh_ui_mode=self.rh_ui_mode
                )
                return _compact_json({"items": items}), True

            if tool == "listar_areas":
                items = await self.svc.list_areas_registradas(
                    self.current_user, rh_ui_mode=self.rh_ui_mode
                )
                return _compact_json({"items": items}), True

            if tool == "listar_subareas":
                parsed = ListarSubareasArgs.model_validate(
                    merge_context_filters(
                        args, self.context_filters, user_message=self.user_message
                    )
                )
                items = await self.svc.list_subareas_registradas(
                    self.current_user,
                    rh_ui_mode=self.rh_ui_mode,
                    area=parsed.area,
                )
                return _compact_json({"items": items, "area": parsed.area}), True

            return json.dumps({"error": "Herramienta desconocida"}, ensure_ascii=False), False
        except ValidationError as exc:
            return _compact_json({"error": "Argumentos inválidos", "detail": exc.errors()}), False
        except Exception as exc:  # noqa: BLE001 — feedback al agente
            return _compact_json({"error": str(exc)}), False
