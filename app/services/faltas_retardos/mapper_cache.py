"""Mapeo de filas de `levelup_incidencias_tress` → respuesta API de faltas y retardos."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.schemas.faltas_retardos import FaltaRetardoResponse
from app.services.faltas_retardos.constants import ORIGEN_MANUAL, synthetic_falta_retardo_id


def map_cache_row(row: dict[str, Any]) -> FaltaRetardoResponse | None:
    """Convierte una fila de la caché. Devuelve None si la fila es inservible.

    Las filas sin `empleado_id` —empleado que existe en TRESS pero no en Bono— ya no
    llegan hasta aquí: las descarta `IncidenciasTressCacheRepository._filtros`, para que
    el total de la página cuadre con lo que se ve. El `or 0` de abajo se queda como
    defensa por si alguna lectura futura no pasa por ese helper.
    """
    origen = str(row.get("origen") or "").strip()
    origen_id = row.get("origen_id")
    tipo = str(row.get("tipo") or "").strip()
    fecha_evento = row.get("fecha_evento")
    if not origen or origen_id is None or tipo not in FALTA_RETARDO_TIPOS:
        return None
    if not isinstance(fecha_evento, date):
        return None

    # El id sintético siempre usa el origen real de la fila (`ausencia`/`permiso`),
    # nunca "manual": si se calculara con "manual" el offset se mezclaría con una LLAVE
    # de TRESS y podría chocar con el id de una fila manual legítima (cuyo `origen_id` es
    # un id de `levelup_faltas_retardos`).
    id_sintetico = synthetic_falta_retardo_id(origen, int(origen_id))

    # created_at sale de fecha_registro (PM_CAPTURA) cuando existe. Sin ese dato se usa
    # la fecha del evento: poner "hoy" pintaría la fecha de registro de todas las filas.
    # La caché solo guarda fecha (no hora), así que la hora exacta de captura no es
    # recuperable para las filas que RH también registró localmente.
    fecha_registro = row.get("fecha_registro")
    base = fecha_registro if isinstance(fecha_registro, date) else fecha_evento
    created_at = datetime.combine(base, datetime.min.time(), tzinfo=timezone.utc)

    empleado_id = row.get("empleado_id")
    no_empleado = row.get("no_empleado")
    nombre = row.get("empleado_nombre")
    registrado_por_id = row.get("registrado_por_id")
    registrador = row.get("registrado_por_nombre")

    # El sync estampa registrado_por_id/observaciones/fecha_fin sobre la fila de TRESS
    # cuando empata con un evento que RH capturó en levelup_faltas_retardos. La UI debe
    # seguir mostrando "Manual" para esas filas, aunque vivan en la rama ausencia/permiso
    # de la caché (el id y el origen_id de abajo se quedan con el origen real de TRESS).
    origen_mostrado = ORIGEN_MANUAL if registrado_por_id is not None else origen

    return FaltaRetardoResponse(
        id=id_sintetico,
        empleado_id=int(empleado_id) if empleado_id is not None else 0,
        empleado_nombre=str(nombre).strip() if nombre else None,
        numero_empleado=str(no_empleado) if no_empleado is not None else None,
        tipo=tipo,  # type: ignore[arg-type]
        fecha_evento=fecha_evento,
        fecha_fin=row.get("fecha_fin"),
        observaciones=row.get("observaciones"),
        registrado_por_id=registrado_por_id,
        registrado_por_nombre=str(registrador).strip() if registrador else None,
        created_at=created_at,
        origen=origen_mostrado,
        origen_id=int(origen_id),
    )
