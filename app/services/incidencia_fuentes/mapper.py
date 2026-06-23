"""
Transformación centralizada de filas de fuentes externas al contrato IncidenciaResponse.

Supuestos de mapeo (calidad_historico):
- ``origen_id`` ← ``calidad_historico.id`` (identificador en bono).
- ``id`` ← ``origen_id`` (la UI usa el id de la fuente; no hay fila en levelup_incidencias).
- ``tipo_incidencia`` ← siempre ``Calidad`` en esta fase.
- ``tipo`` ← ``Calidad`` (compatibilidad con filtros y analítica existentes).
- ``categoria`` ← ``incidencia_categoria.nombre`` (subclasificación de negocio en bono).
- ``detalle`` ← ``calidad_historico.motivo``.
- ``fecha`` ← ``calidad_historico.fecha``.
- ``area`` / ``subarea`` ← descripciones de catálogo (``areas`` / ``subareas``), no los IDs crudos.
- ``origen`` ← ``calidad_historico``.
- ``created_at`` / ``updated_at`` ← derivados de ``fecha`` (sin timestamps en la fuente).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.schemas.incidencias import IncidenciaResponse
from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
)


def _epoch_from_fecha(fecha: date | None) -> datetime:
    if fecha is None:
        return datetime.now(timezone.utc)
    return datetime(fecha.year, fecha.month, fecha.day, tzinfo=timezone.utc)


def map_fuente_row_to_incidencia_response(
    row: dict[str, Any],
    *,
    tipo_incidencia: str,
    origen: str,
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

    return IncidenciaResponse(
        id=origen_id,
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


def map_calidad_historico_row(row: dict[str, Any]) -> IncidenciaResponse:
    """Atajo para filas de ``calidad_historico``."""
    return map_fuente_row_to_incidencia_response(
        row,
        tipo_incidencia=TIPO_INCIDENCIA_CALIDAD,
        origen=ORIGEN_CALIDAD_HISTORICO,
    )
