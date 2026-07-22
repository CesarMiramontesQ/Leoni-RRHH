"""Constantes del indice objetivo (pesos por tipo + umbrales de semaforo).

Pesos de penalizacion documentados y ajustables (cambiar el valor aqui basta,
no hay logica dispersa en otro lado). Todo tipo ya modelado en otro modulo
se REUSA de su constante existente en vez de duplicar strings -- ver los
imports de `app.models.faltas_retardos` y
`app.services.incidencia_fuentes.constants`.

Formula (ver `app.services.historial_objetivo.formula.calcular_indice`):

    indice = clamp(100 - Σ(peso_tipo * conteo_tipo), 0, 100)

Redondeo a 2 decimales -- mismo criterio que el indice de desempeno
(`app.services.ciclo_desempeno_service.combinar_score`), consistente entre
los "indices/scores" del proyecto.
"""

from __future__ import annotations

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS_GOCE
from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)

# ══════════════════════════════════════════════════════════════════════════
# Fuentes
# ══════════════════════════════════════════════════════════════════════════
FUENTE_ACTAS = "actas"
FUENTE_FALTAS = "faltas"
FUENTE_INCIDENCIAS = "incidencias"
FUENTE_PROGRESIVO = "progresivo"

FUENTES: tuple[str, ...] = (
    FUENTE_ACTAS,
    FUENTE_FALTAS,
    FUENTE_INCIDENCIAS,
    FUENTE_PROGRESIVO,
)

# ══════════════════════════════════════════════════════════════════════════
# Pesos por fuente/tipo
# ══════════════════════════════════════════════════════════════════════════

# Actas por estado (`ActaAdministrativa.estado`, ver `app/models/actas.py`,
# enum `acta_estado_enum`). No se importa el modelo aqui a proposito: este
# paquete es de calculo puro (sin SQLAlchemy); los strings replican el enum.
PESOS_ACTAS: dict[str, float] = {
    "signed": 15,
    "pending_sign": 7,
    "draft": 0,
    "cancelled": 0,
    "archived": 0,
}

# Faltas/retardos por tipo -- claves = `FALTA_RETARDO_TIPOS`
# (`app/models/faltas_retardos.py`), reusadas via `FALTA_RETARDO_TIPOS_GOCE`
# para no repetir los 4 strings de licencias con goce de sueldo (no son
# falta atribuible al empleado -> peso 0).
PESOS_FALTAS: dict[str, float] = {
    "falta_injustificada": 10,
    "suspension": 12,
    "retardo": 3,
    "falta_justificada": 1,
    "incapacidad": 0,
    **{tipo: 0 for tipo in FALTA_RETARDO_TIPOS_GOCE},
}

# Incidencias Bono por tipo (`TIPO_INCIDENCIA_CALIDAD`/`TIPO_INCIDENCIA_SEGURIDAD`,
# ver `app/services/incidencia_fuentes/constants.py`).
PESOS_INCIDENCIAS: dict[str, float] = {
    TIPO_INCIDENCIA_CALIDAD: 6,
    TIPO_INCIDENCIA_SEGURIDAD: 6,
}

# Progresivo / bono-productividad: v1 NO tiene agregador de conteos todavia
# (existe el modulo `app/api/v1/bono_productividad` pero resuelve otra cosa,
# el sync de bonos/incidencias -- no hay una fuente de "conteo de eventos
# progresivo" lista para este indice). El service (Tarea 4) siempre pasa un
# `ConteosFuente` vacio para esta fuente; el peso default queda documentado
# para cuando exista el agregador real (no hay tipos definidos aun, por eso
# `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` es `{}`).
PESO_PROGRESIVO_DEFAULT: float = 6

PESOS_POR_FUENTE: dict[str, dict[str, float]] = {
    FUENTE_ACTAS: PESOS_ACTAS,
    FUENTE_FALTAS: PESOS_FALTAS,
    FUENTE_INCIDENCIAS: PESOS_INCIDENCIAS,
    FUENTE_PROGRESIVO: {},
}

# ══════════════════════════════════════════════════════════════════════════
# Semaforo
# ══════════════════════════════════════════════════════════════════════════
SEMAFORO_UMBRAL_AMARILLO = 60
SEMAFORO_UMBRAL_VERDE = 85


def semaforo(indice: float) -> str:
    """Semaforo del indice 0-100: `rojo` si < 60, `amarillo` si < 85, `verde`
    si >= 85. Mismo criterio de banda que
    `app.services.ciclo_desempeno_service.banda` (bajo/medio/alto),
    renombrado a la terminologia de semaforo de este modulo."""
    valor = float(indice)
    if valor < SEMAFORO_UMBRAL_AMARILLO:
        return "rojo"
    if valor < SEMAFORO_UMBRAL_VERDE:
        return "amarillo"
    return "verde"
