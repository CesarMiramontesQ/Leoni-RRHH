"""Estructuras de datos puras del indice objetivo (Historial Objetivo).

Sin logica de negocio ni acceso a datos -- solo dataclasses para tipar la
entrada/salida de `calcular_indice` (ver `formula.py`). El service que
resuelve los conteos reales via repositorios (Tarea 4) construye
`ConteosHistorial` y consume `ResultadoIndiceObjetivo`.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ConteosFuente:
    """Conteos por tipo de una sola fuente, ej. faltas: `{"retardo": 2}`.

    Las claves deberian ser tipos reconocidos por
    `constants.PESOS_POR_FUENTE` de la fuente correspondiente; un tipo no
    reconocido no rompe el calculo, simplemente no penaliza (peso 0
    implicito) -- ver `formula._desglose_fuente`."""

    conteos: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class ConteosHistorial:
    """Conteos por fuente de un empleado -- entrada de `calcular_indice`.

    `progresivo` existe para que el service (Tarea 4) tenga donde acoplar
    el futuro agregador de bono-productividad; en v1 siempre se pasa un
    `ConteosFuente` vacio (ver `constants.PESO_PROGRESIVO_DEFAULT`)."""

    actas: ConteosFuente = field(default_factory=ConteosFuente)
    faltas: ConteosFuente = field(default_factory=ConteosFuente)
    incidencias: ConteosFuente = field(default_factory=ConteosFuente)
    progresivo: ConteosFuente = field(default_factory=ConteosFuente)


@dataclass(frozen=True)
class DesglosePorTipo:
    """Penalizacion aportada por un solo tipo dentro de una fuente."""

    tipo: str
    conteo: int
    peso: float
    penalizacion: float


@dataclass(frozen=True)
class DesgloseFuente:
    """Penalizacion total de una fuente + detalle por tipo (para que la UI
    explique "de donde sale el indice"). `tipos` solo incluye tipos con
    conteo > 0 (ver `formula._desglose_fuente`)."""

    fuente: str
    penalizacion: float
    tipos: tuple[DesglosePorTipo, ...] = ()


@dataclass(frozen=True)
class ResultadoIndiceObjetivo:
    """Salida de `calcular_indice`: indice 0-100 (2 decimales), semaforo,
    penalizacion total aplicada (antes del clamp) y desglose por fuente."""

    indice: float
    semaforo: str
    penalizacion_total: float
    desglose: tuple[DesgloseFuente, ...]
