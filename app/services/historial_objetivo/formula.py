"""Formula pura del indice objetivo del empleado (Historial Objetivo).

    indice = clamp(100 - Σ(peso_tipo * conteo_tipo), 0, 100)

Redondeado a 2 decimales (ver nota de redondeo en `constants.py`). Funcion
pura: sin BD, sin async, sin I/O -- solo opera sobre `ConteosHistorial` (ver
`types.py`) y las tablas de pesos de `constants.py`.
"""

from __future__ import annotations

from app.services.historial_objetivo.constants import (
    FUENTE_ACTAS,
    FUENTE_FALTAS,
    FUENTE_INCIDENCIAS,
    FUENTE_PROGRESIVO,
    PESOS_POR_FUENTE,
    semaforo,
)
from app.services.historial_objetivo.types import (
    ConteosFuente,
    ConteosHistorial,
    DesgloseFuente,
    DesglosePorTipo,
    ResultadoIndiceObjetivo,
)


def _desglose_fuente(fuente: str, conteos: ConteosFuente) -> DesgloseFuente:
    """Penalizacion de una fuente + detalle por tipo. Tipos sin conteo (0 o
    ausentes) se omiten del detalle; un tipo no reconocido por la tabla de
    pesos de la fuente penaliza 0 (peso 0 implicito, ver `types.ConteosFuente`)."""
    pesos = PESOS_POR_FUENTE.get(fuente, {})
    tipos: list[DesglosePorTipo] = []
    penalizacion_fuente = 0.0
    for tipo, conteo in conteos.conteos.items():
        if not conteo:
            continue
        peso = float(pesos.get(tipo, 0.0))
        penalizacion = peso * conteo
        penalizacion_fuente += penalizacion
        tipos.append(
            DesglosePorTipo(
                tipo=tipo,
                conteo=conteo,
                peso=peso,
                penalizacion=round(penalizacion, 2),
            )
        )
    return DesgloseFuente(
        fuente=fuente,
        penalizacion=round(penalizacion_fuente, 2),
        tipos=tuple(tipos),
    )


def calcular_indice(conteos: ConteosHistorial) -> ResultadoIndiceObjetivo:
    """Calcula el indice objetivo 0-100 a partir de los conteos por fuente.

    `indice = clamp(100 - Σ(peso_tipo * conteo_tipo), 0, 100)`, redondeado a
    2 decimales. `penalizacion_total` es la suma SIN clamp (Σ de todas las
    fuentes) -- puede superar 100 aunque el indice ya haya tocado piso 0;
    sirve para que la UI explique la magnitud real de la penalizacion, no
    solo el piso. El desglose por fuente/tipo usa las mismas penalizaciones
    (redondeadas a 2 decimales cada una) que alimentan esta suma."""
    desgloses = tuple(
        _desglose_fuente(fuente, valor)
        for fuente, valor in (
            (FUENTE_ACTAS, conteos.actas),
            (FUENTE_FALTAS, conteos.faltas),
            (FUENTE_INCIDENCIAS, conteos.incidencias),
            (FUENTE_PROGRESIVO, conteos.progresivo),
        )
    )
    penalizacion_total = round(sum(d.penalizacion for d in desgloses), 2)
    indice = round(max(0.0, min(100.0, 100.0 - penalizacion_total)), 2)
    return ResultadoIndiceObjetivo(
        indice=indice,
        semaforo=semaforo(indice),
        penalizacion_total=penalizacion_total,
        desglose=desgloses,
    )
