"""Generación estable de datos simulados para Horas Extra."""

from __future__ import annotations

import hashlib
from typing import TypedDict

from app.schemas.horas_extra import HorasExtraEstadoAprobacion

SEMANA_ACTUAL = 19

_ESTADOS: tuple[HorasExtraEstadoAprobacion, ...] = ("pendiente", "aprobado", "rechazado")


class HorasExtraSimuladoDict(TypedDict):
    semana: int
    horas_dobles: float
    horas_descanso_trabajado: float
    total_horas_extra: float
    dif_caseta: float
    estado_aprobacion: HorasExtraEstadoAprobacion


def _stable_unit(empleado_id: int, campo: str) -> float:
    digest = hashlib.md5(f"{empleado_id}:{campo}".encode(), usedforsecurity=False).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def simular_fila_horas_extra(empleado_id: int) -> HorasExtraSimuladoDict:
    """Mismos valores para el mismo ``empleado_id`` en cada petición."""
    horas_dobles = round(2.0 + _stable_unit(empleado_id, "dobles") * 10.0, 2)
    horas_descanso = round(_stable_unit(empleado_id, "descanso") * 6.0, 2)
    total = round(horas_dobles + horas_descanso, 2)

    dif_seed = _stable_unit(empleado_id, "caseta")
    if dif_seed < 0.33:
        dif_caseta = 0.0
    elif dif_seed < 0.66:
        dif_caseta = round(0.25 + _stable_unit(empleado_id, "caseta_pos") * 0.75, 2)
    else:
        dif_caseta = round(1.0 + _stable_unit(empleado_id, "caseta_neg") * 1.5, 2)

    estado_idx = int(_stable_unit(empleado_id, "estado") * len(_ESTADOS)) % len(_ESTADOS)
    estado = _ESTADOS[estado_idx]

    return {
        "semana": SEMANA_ACTUAL,
        "horas_dobles": horas_dobles,
        "horas_descanso_trabajado": horas_descanso,
        "total_horas_extra": total,
        "dif_caseta": dif_caseta,
        "estado_aprobacion": estado,
    }
