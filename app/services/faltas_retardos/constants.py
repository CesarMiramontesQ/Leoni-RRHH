"""Constantes y mapeos para faltas y retardos (datos-analisis y bono)."""

from __future__ import annotations

ORIGEN_IMPORTADAS_HISTORICO = "importadas_historico"
ORIGEN_PONDERACIONES = "ponderaciones"
ORIGEN_EVALUACION_HISTORICA = "evaluacion_historica"
ORIGEN_MANUAL = "manual"
# Orígenes de datos-analisis (TRESS): fila diaria de dbo.AUSENCIA y permiso con
# goce de dbo.PERMISO.
ORIGEN_AUSENCIA = "ausencia"
ORIGEN_PERMISO = "permiso"

_ID_OFFSETS: dict[str, int] = {
    ORIGEN_IMPORTADAS_HISTORICO: 1_000_000_000,
    ORIGEN_PONDERACIONES: 2_000_000_000,
    ORIGEN_EVALUACION_HISTORICA: 3_000_000_000,
    ORIGEN_MANUAL: 4_000_000_000,
    ORIGEN_AUSENCIA: 5_000_000_000,
    ORIGEN_PERMISO: 6_000_000_000,
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


# tipo API → código con el que RH lee la incidencia en el reporte semanal en Excel.
#
# Es el código de TRESS, no una etiqueta nueva: FJ/FI/RE/SUS/VAC son los AU_TIPO de
# `dbo.AUSENCIA` (ver `datos_analisis_faltas_retardos_base.sql`) y los permisos con goce
# viajan en TRESS como PM_TIPO 'FJ', así que matrimonio, defunción y paternidad salen
# también como FJ.
#
# Las cuatro incapacidades del IMSS (INC, IN1, IAC, ITR) llegan a la caché ya colapsadas
# en el tipo `incapacidad` —el CASE del SQL del sync no conserva el AU_TIPO original—,
# así que todas se exportan como INC. INC1 queda para `incapacidad_interna`, que es el
# permiso con goce que RH captura a mano y sí es un tipo propio.
TIPO_A_CODIGO_REPORTE: dict[str, str] = {
    "falta_justificada": "FJ",
    "falta_injustificada": "FI",
    "retardo": "RE",
    "incapacidad": "INC",
    "suspension": "SUS",
    "vacaciones": "VAC",
    "matrimonio": "FJ",
    "incapacidad_interna": "INC1",
    "defuncion": "FJ",
    "paternidad": "FJ",
}
