"""Tests puros de la formula del indice objetivo (modulo Historial Objetivo).

`calcular_indice` es una funcion pura sobre `ConteosHistorial` -- sin BD ni
fixtures async. Ver `app/services/historial_objetivo/{constants,types,formula}.py`.
"""

from __future__ import annotations

import pytest

from app.services.historial_objetivo.constants import (
    PESOS_ACTAS,
    PESOS_FALTAS,
    PESOS_INCIDENCIAS,
    semaforo,
)
from app.services.historial_objetivo.formula import calcular_indice
from app.services.historial_objetivo.types import ConteosFuente, ConteosHistorial
from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)


def _historial(
    actas: dict[str, int] | None = None,
    faltas: dict[str, int] | None = None,
    incidencias: dict[str, int] | None = None,
    progresivo: dict[str, int] | None = None,
) -> ConteosHistorial:
    return ConteosHistorial(
        actas=ConteosFuente(actas or {}),
        faltas=ConteosFuente(faltas or {}),
        incidencias=ConteosFuente(incidencias or {}),
        progresivo=ConteosFuente(progresivo or {}),
    )


def test_historial_limpio_indice_100_verde():
    resultado = calcular_indice(_historial())
    assert resultado.indice == 100.0
    assert resultado.semaforo == "verde"
    assert resultado.penalizacion_total == 0.0


def test_muchas_actas_firmadas_clamp_inferior_a_0_rojo():
    # 10 actas firmadas * 15 = 150 de penalizacion -> clamp a 0
    resultado = calcular_indice(_historial(actas={"signed": 10}))
    assert resultado.indice == 0.0
    assert resultado.semaforo == "rojo"


def test_caso_mixto_2_retardos_1_falta_injustificada_84_amarillo():
    # 100 - (2*3 + 1*10) = 84
    resultado = calcular_indice(
        _historial(faltas={"retardo": 2, "falta_injustificada": 1})
    )
    assert resultado.indice == 84.0
    assert resultado.semaforo == "amarillo"


@pytest.mark.parametrize(
    "indice, esperado",
    [
        (59.9, "rojo"),
        (60, "amarillo"),
        (84.9, "amarillo"),
        (85, "verde"),
    ],
)
def test_semaforo_bandas_en_limites_exactos(indice, esperado):
    assert semaforo(indice) == esperado


def test_progresivo_conteo_cero_no_penaliza_en_v1():
    resultado = calcular_indice(_historial(progresivo={}))
    assert resultado.indice == 100.0
    desglose_progresivo = next(
        d for d in resultado.desglose if d.fuente == "progresivo"
    )
    assert desglose_progresivo.penalizacion == 0.0


def test_desglose_reporta_penalizacion_por_fuente():
    resultado = calcular_indice(
        _historial(
            faltas={"retardo": 2},
            incidencias={TIPO_INCIDENCIA_CALIDAD: 1},
        )
    )
    por_fuente = {d.fuente: d.penalizacion for d in resultado.desglose}
    assert por_fuente["faltas"] == 6.0  # 2 * 3
    assert por_fuente["incidencias"] == 6.0  # 1 * 6
    assert por_fuente["actas"] == 0.0
    assert por_fuente["progresivo"] == 0.0
    assert resultado.penalizacion_total == 12.0
    assert resultado.indice == 88.0


def test_desglose_por_tipo_incluye_peso_y_conteo():
    resultado = calcular_indice(_historial(faltas={"retardo": 2}))
    desglose_faltas = next(d for d in resultado.desglose if d.fuente == "faltas")
    assert len(desglose_faltas.tipos) == 1
    detalle = desglose_faltas.tipos[0]
    assert detalle.tipo == "retardo"
    assert detalle.conteo == 2
    assert detalle.peso == 3
    assert detalle.penalizacion == 6.0


def test_tipo_goce_en_faltas_no_penaliza():
    resultado = calcular_indice(_historial(faltas={"matrimonio": 5}))
    assert resultado.indice == 100.0


def test_pesos_faltas_cubre_todos_los_tipos_del_modelo():
    """Blindaje anti-drift: si se agrega un tipo nuevo a `FALTA_RETARDO_TIPOS`
    en el modelo, este test falla y obliga a asignarle un peso en
    `PESOS_FALTAS` (import solo aqui -- el paquete de calculo sigue puro)."""
    from app.models.faltas_retardos import FALTA_RETARDO_TIPOS

    assert set(PESOS_FALTAS.keys()) == set(FALTA_RETARDO_TIPOS)


def test_pesos_actas_cubre_todos_los_estados_del_enum():
    """Blindaje anti-drift equivalente para los estados de acta (import solo
    aqui, derivado del Enum real de la columna -- no un literal duplicado)."""
    from app.models.actas import ActaAdministrativa

    estados_enum = set(ActaAdministrativa.__table__.columns["estado"].type.enums)
    assert estados_enum == {
        "draft",
        "pending_sign",
        "signed",
        "archived",
        "cancelled",
    }
    assert set(PESOS_ACTAS.keys()) == estados_enum


def test_pesos_incidencias_coincide_con_tipos_calidad_y_seguridad():
    assert set(PESOS_INCIDENCIAS.keys()) == {
        TIPO_INCIDENCIA_CALIDAD,
        TIPO_INCIDENCIA_SEGURIDAD,
    }
