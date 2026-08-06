"""Mapeo de filas de datos-analisis (TRESS) → respuesta API de faltas y retardos."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.schemas.faltas_retardos import FaltaRetardoResponse
from app.services.faltas_retardos.constants import synthetic_falta_retardo_id


def map_tress_row(
    row: dict[str, Any],
    *,
    empleado_id: int | None,
    empleado_nombre: str | None,
) -> FaltaRetardoResponse | None:
    """Convierte una fila del SQL base. Devuelve None si la fila es inservible.

    `empleado_id` puede ser None cuando el empleado existe en TRESS pero no en
    Postgres: se expone como 0 en vez de descartar la fila, para que el total
    de la página cuadre con lo que se ve.
    """
    origen = str(row.get("origen") or "").strip()
    origen_id = row.get("origen_id")
    tipo = str(row.get("tipo") or "").strip()
    fecha_evento = row.get("fecha_evento")
    if not origen or origen_id is None or tipo not in FALTA_RETARDO_TIPOS:
        return None
    if fecha_evento is None:
        return None
    if not isinstance(fecha_evento, date):
        fecha_evento = date.fromisoformat(str(fecha_evento)[:10])

    fecha_fin = row.get("fecha_fin")
    if fecha_fin is not None and not isinstance(fecha_fin, date):
        fecha_fin = date.fromisoformat(str(fecha_fin)[:10])

    raw_obs = row.get("observaciones")
    observaciones = str(raw_obs).strip() if raw_obs and str(raw_obs).strip() else None

    # created_at sale de PM_CAPTURA cuando existe. Sin ese dato se usa la fecha
    # del evento: poner "hoy" pintaría la fecha de registro de todas las filas.
    fecha_registro = row.get("fecha_registro")
    if isinstance(fecha_registro, datetime):
        created_at = (
            fecha_registro.replace(tzinfo=timezone.utc)
            if fecha_registro.tzinfo is None
            else fecha_registro
        )
    elif isinstance(fecha_registro, date):
        created_at = datetime.combine(fecha_registro, datetime.min.time(), tzinfo=timezone.utc)
    else:
        created_at = datetime.combine(fecha_evento, datetime.min.time(), tzinfo=timezone.utc)

    no_empleado = row.get("no_empleado")

    return FaltaRetardoResponse(
        id=synthetic_falta_retardo_id(origen, int(origen_id)),
        empleado_id=int(empleado_id) if empleado_id is not None else 0,
        empleado_nombre=str(empleado_nombre).strip() if empleado_nombre else None,
        numero_empleado=str(no_empleado) if no_empleado is not None else None,
        tipo=tipo,  # type: ignore[arg-type]
        fecha_evento=fecha_evento,
        fecha_fin=fecha_fin,
        observaciones=observaciones,
        registrado_por_id=None,
        registrado_por_nombre=None,
        created_at=created_at,
        origen=origen,
        origen_id=int(origen_id),
    )
