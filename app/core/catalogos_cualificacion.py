"""Catálogo de niveles de escolaridad para cualificaciones con compliance automático."""

from typing import TypedDict


class NivelEscolaridad(TypedDict):
    label: str
    peso: int


CATALOGO_ESCOLARIDAD: dict[str, NivelEscolaridad] = {
    "ninguno": {"label": "Ninguno", "peso": 0},
    "primaria": {"label": "Primaria", "peso": 1},
    "secundaria": {"label": "Secundaria", "peso": 2},
    "preparatoria": {"label": "Preparatoria / Bachillerato", "peso": 3},
    "licenciatura": {"label": "Licenciatura", "peso": 4},
    "maestria": {"label": "Maestría", "peso": 5},
    "doctorado": {"label": "Doctorado", "peso": 6},
}

ESCOLARIDAD_KEYS = set(CATALOGO_ESCOLARIDAD.keys())

TIPOS_ESCOLARIDAD = frozenset({"estudios_finalizados", "estudios_universitarios"})


def es_clave_escolaridad_valida(key: str) -> bool:
    return key in ESCOLARIDAD_KEYS


def calcular_cumplimiento(situacion_deseada: str, situacion_actual: str) -> bool | None:
    """True si actual >= deseada, False si <, None si alguna clave no es válida."""
    deseada = CATALOGO_ESCOLARIDAD.get(situacion_deseada)
    actual = CATALOGO_ESCOLARIDAD.get(situacion_actual)
    if deseada is None or actual is None:
        return None
    return actual["peso"] >= deseada["peso"]
