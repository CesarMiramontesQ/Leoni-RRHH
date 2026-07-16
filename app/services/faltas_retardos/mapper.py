"""Mapeo de filas bono → respuesta API de faltas y retardos."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.schemas.faltas_retardos import FaltaRetardoResponse
from app.services.faltas_retardos.constants import (
    CODIGO_PONDERACION_A_TIPO,
    synthetic_falta_retardo_id,
)


def map_bono_row(row: dict[str, Any]) -> FaltaRetardoResponse | None:
    origen = str(row.get("origen") or "").strip()
    origen_id = row.get("origen_id")
    empleado_id = row.get("empleado_id")
    tipo_codigo = str(row.get("tipo_codigo") or "").strip().upper()
    if not origen or origen_id is None or empleado_id is None or not tipo_codigo:
        return None

    tipo = CODIGO_PONDERACION_A_TIPO.get(tipo_codigo)
    if tipo is None:
        return None

    fecha_evento = row.get("fecha_evento")
    if fecha_evento is None:
        fecha_evento = date.today()
    elif not isinstance(fecha_evento, date):
        fecha_evento = date.fromisoformat(str(fecha_evento)[:10])

    fecha_fin = row.get("fecha_fin")
    if fecha_fin is not None and not isinstance(fecha_fin, date):
        fecha_fin = date.fromisoformat(str(fecha_fin)[:10])

    nombre = row.get("nombre")
    no_empleado = row.get("no_empleado")
    raw_obs = row.get("observaciones")
    observaciones = str(raw_obs).strip() if raw_obs else None

    created_at = datetime.now(timezone.utc)
    fecha_registro = row.get("fecha_registro")
    if fecha_registro is not None:
        if isinstance(fecha_registro, datetime):
            created_at = (
                fecha_registro.replace(tzinfo=timezone.utc)
                if fecha_registro.tzinfo is None
                else fecha_registro
            )
        elif isinstance(fecha_registro, date):
            created_at = datetime.combine(fecha_registro, datetime.min.time(), tzinfo=timezone.utc)

    return FaltaRetardoResponse(
        id=synthetic_falta_retardo_id(origen, int(origen_id)),
        empleado_id=int(empleado_id),
        empleado_nombre=str(nombre).strip() if nombre else None,
        numero_empleado=str(no_empleado).strip() if no_empleado else None,
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
