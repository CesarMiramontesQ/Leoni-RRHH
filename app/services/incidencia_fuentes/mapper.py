"""
Transformación centralizada de filas de fuentes externas al contrato IncidenciaResponse.

Mapeo calidad_historico:
- ``detalle`` ← ``motivo``; ``categoria`` ← ``incidencia_categoria.nombre``

Mapeo seguridad_historico:
- ``detalle`` ← ``observaciones``; ``categoria`` ← ``ponderacion_seguridad.descripcion``

Ambas fuentes exponen ``origen``, ``origen_id`` y ``tipo_incidencia`` en la consulta unificada.
El ``id`` de respuesta es sintético (offset por origen) para evitar colisiones entre tablas.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.schemas.incidencias import IncidenciaResponse
from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    ORIGEN_SEGURIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)

_ORIGEN_ID_OFFSET: dict[str, int] = {
    ORIGEN_CALIDAD_HISTORICO: 1_000_000_000,
    ORIGEN_SEGURIDAD_HISTORICO: 2_000_000_000,
}


def synthetic_incidencia_id(origen: str, origen_id: int) -> int:
    """ID estable y único entre fuentes históricas de bono."""
    base = _ORIGEN_ID_OFFSET.get(origen, 0)
    return base + int(origen_id)


def _epoch_from_fecha(fecha: date | None) -> datetime:
    if fecha is None:
        return datetime.now(timezone.utc)
    return datetime(fecha.year, fecha.month, fecha.day, tzinfo=timezone.utc)


def map_fuente_row_to_incidencia_response(
    row: dict[str, Any],
    *,
    tipo_incidencia: str,
    origen: str,
    response_id: int | None = None,
) -> IncidenciaResponse:
    """Normaliza una fila de repositorio de fuente al schema de respuesta de incidencias."""
    origen_id = int(row["origen_id"])
    empleado_id = int(row["empleado_id"])
    fecha_val = row.get("fecha")
    fecha: date | None
    if isinstance(fecha_val, datetime):
        fecha = fecha_val.date()
    elif isinstance(fecha_val, date):
        fecha = fecha_val
    else:
        fecha = None

    ts = _epoch_from_fecha(fecha)
    categoria = row.get("categoria")
    cat_txt = str(categoria).strip() if categoria is not None and str(categoria).strip() else None
    api_id = response_id if response_id is not None else synthetic_incidencia_id(origen, origen_id)

    return IncidenciaResponse(
        id=api_id,
        empleado_id=empleado_id,
        tipo=tipo_incidencia,
        tipo_incidencia=tipo_incidencia,
        subtipo=cat_txt,
        no_empleado=row.get("no_empleado"),
        nombre=row.get("nombre"),
        fecha=fecha,
        categoria=cat_txt,
        detalle=row.get("detalle"),
        area=row.get("area"),
        subarea=row.get("subarea"),
        origen=origen,
        origen_id=origen_id,
        synced_at=None,
        created_at=ts,
        updated_at=ts,
        evidencias_count=0,
        puesto=None,
        supervisor_directo=None,
    )


def map_historico_row(row: dict[str, Any]) -> IncidenciaResponse:
    """Mapea una fila de la consulta unificada (calidad + seguridad)."""
    origen = str(row["origen"])
    tipo_incidencia = str(row["tipo_incidencia"])
    return map_fuente_row_to_incidencia_response(
        row,
        tipo_incidencia=tipo_incidencia,
        origen=origen,
    )


def map_calidad_historico_row(row: dict[str, Any]) -> IncidenciaResponse:
    """Atajo para filas de ``calidad_historico``."""
    return map_fuente_row_to_incidencia_response(
        row,
        tipo_incidencia=TIPO_INCIDENCIA_CALIDAD,
        origen=ORIGEN_CALIDAD_HISTORICO,
    )


def map_seguridad_historico_row(row: dict[str, Any]) -> IncidenciaResponse:
    """Atajo para filas de ``seguridad_historico``."""
    return map_fuente_row_to_incidencia_response(
        row,
        tipo_incidencia=TIPO_INCIDENCIA_SEGURIDAD,
        origen=ORIGEN_SEGURIDAD_HISTORICO,
    )
