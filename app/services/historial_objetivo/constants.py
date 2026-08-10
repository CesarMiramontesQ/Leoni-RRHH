"""Constantes del indice objetivo (pesos por tipo + umbrales de semaforo).

Pesos de penalizacion documentados y ajustables (cambiar el valor aqui basta,
no hay logica dispersa en otro lado). Este paquete es de calculo puro (sin
SQLAlchemy, importable sin BD): los tipos ya modelados en `app.models.*` se
REPLICAN como strings literales (no se importan) para no arrastrar
`app.core.database.Base`; los de `app.services.incidencia_fuentes.constants`
si se importan porque ese modulo tampoco depende de BD.

Formula (ver `app.services.historial_objetivo.formula.calcular_indice`):

    indice = clamp(100 - Σ(peso_tipo * conteo_tipo), 0, 100)

Redondeo a 2 decimales -- mismo criterio que el indice de desempeno
(`app.services.ciclo_desempeno_service.combinar_score`), consistente entre
los "indices/scores" del proyecto.
"""

from __future__ import annotations

from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)

# Tipos de falta/retardo con goce de sueldo (`FALTA_RETARDO_TIPOS_GOCE` en
# `app/models/faltas_retardos.py`). Se replican como strings literales -- y NO
# se importa el modelo -- porque ese modulo importa `app.core.database.Base`
# (construye el engine y revienta con RuntimeError fuera de APP_ENV=test).
# Este paquete debe ser importable sin BD; ver docstring del modulo.
FALTA_RETARDO_TIPOS_GOCE: frozenset[str] = frozenset(
    {"matrimonio", "defuncion", "paternidad", "incapacidad_interna"}
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
    # Ausencia planificada y autorizada: no es falta atribuible al empleado.
    "vacaciones": 0,
    **{tipo: 0 for tipo in FALTA_RETARDO_TIPOS_GOCE},
}

# Incidencias Bono por tipo (`TIPO_INCIDENCIA_CALIDAD`/`TIPO_INCIDENCIA_SEGURIDAD`,
# ver `app/services/incidencia_fuentes/constants.py`).
PESOS_INCIDENCIAS: dict[str, float] = {
    TIPO_INCIDENCIA_CALIDAD: 6,
    TIPO_INCIDENCIA_SEGURIDAD: 6,
}

# Progresivo / bono-productividad: se cuenta el numero de semanas en que el
# empleado perdio su bono de productividad (`pierde_bono = 1` en
# `incidencias_progresivo` / `incidencias_progresivo_historico`). Es la senal
# propia del progresivo (un resultado), NO se re-cuentan las causas del resumen
# semanal (faltas/suspensiones/actas), que ya penalizan via las otras fuentes
# -- evita el doble conteo. Peso en un solo lugar (`PESO_PROGRESIVO_DEFAULT`).
TIPO_PROGRESIVO_PIERDE_BONO = "pierde_bono"
PESO_PROGRESIVO_DEFAULT: float = 6

PESOS_POR_FUENTE: dict[str, dict[str, float]] = {
    FUENTE_ACTAS: PESOS_ACTAS,
    FUENTE_FALTAS: PESOS_FALTAS,
    FUENTE_INCIDENCIAS: PESOS_INCIDENCIAS,
    FUENTE_PROGRESIVO: {TIPO_PROGRESIVO_PIERDE_BONO: PESO_PROGRESIVO_DEFAULT},
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
