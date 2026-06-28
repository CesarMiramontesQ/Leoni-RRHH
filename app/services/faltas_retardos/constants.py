"""Constantes y mapeos para faltas y retardos desde bono."""

from __future__ import annotations

ORIGEN_IMPORTADAS_HISTORICO = "importadas_historico"
ORIGEN_PONDERACIONES = "ponderaciones"
ORIGEN_EVALUACION_HISTORICA = "evaluacion_historica"
ORIGEN_MANUAL = "manual"

_ID_OFFSETS: dict[str, int] = {
    ORIGEN_IMPORTADAS_HISTORICO: 1_000_000_000,
    ORIGEN_PONDERACIONES: 2_000_000_000,
    ORIGEN_EVALUACION_HISTORICA: 3_000_000_000,
}

CODIGO_PONDERACION_A_TIPO: dict[str, str] = {
    "FJ": "falta_justificada",
    "FI": "falta_injustificada",
    "RE": "retardo",
    "INC": "incapacidad",
    "IN1": "incapacidad",
    "ITR": "incapacidad",
    "IAC": "incapacidad",
    "SUS": "suspension",
}

# tipo API → (codigo ponderación, inc_id en importadas_historico)
TIPO_A_PONDERACION: dict[str, tuple[str, int]] = {
    "falta_injustificada": ("FI", 6),
    "retardo": ("RE", 8),
    "incapacidad": ("INC", 9),
    "suspension": ("SUS", 13),
}


def synthetic_falta_retardo_id(origen: str, origen_id: int) -> int:
    base = _ID_OFFSETS.get(origen, 9_000_000_000)
    return base + int(origen_id)
