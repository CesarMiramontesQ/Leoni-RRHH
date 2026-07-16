from datetime import date

import pytest

from app.utils.descansos_fechas import (
    avanzar_hasta_reunir_dias,
    fechas_efectivas_en_rango,
    partir_tramos_por_semanas,
    tramos_consecutivos,
)


def test_fechas_efectivas_excluye_descansos_del_rango():
    assert fechas_efectivas_en_rango(
        date(2026, 7, 20),
        date(2026, 7, 23),
        {date(2026, 7, 22)},
    ) == [
        date(2026, 7, 20),
        date(2026, 7, 21),
        date(2026, 7, 23),
    ]


def test_avanzar_lunes_con_descansos_martes_miercoles_termina_jueves():
    assert avanzar_hasta_reunir_dias(
        date(2026, 7, 20),
        2,
        {date(2026, 7, 21), date(2026, 7, 22)},
    ) == [
        date(2026, 7, 20),
        date(2026, 7, 23),
    ]


def test_avanzar_dias_habiles_conserva_regla_fin_de_semana():
    assert avanzar_hasta_reunir_dias(
        date(2026, 7, 24),
        2,
        set(),
        solo_lunes_viernes=True,
    ) == [
        date(2026, 7, 24),
        date(2026, 7, 27),
    ]


def test_tramos_consecutivos_agrupa_lunes_martes_y_jueves():
    assert tramos_consecutivos(
        [
            date(2026, 7, 20),
            date(2026, 7, 21),
            date(2026, 7, 23),
        ]
    ) == [
        (date(2026, 7, 20), date(2026, 7, 21)),
        (date(2026, 7, 23), date(2026, 7, 23)),
    ]


def test_partir_tramos_corta_adicionalmente_por_semana():
    assert partir_tramos_por_semanas(
        [(date(2026, 7, 17), date(2026, 7, 21))]
    ) == [
        (date(2026, 7, 17), date(2026, 7, 19)),
        (date(2026, 7, 20), date(2026, 7, 21)),
    ]


def test_fechas_efectivas_rechaza_rango_invertido():
    with pytest.raises(ValueError, match="fecha_fin"):
        fechas_efectivas_en_rango(
            date(2026, 7, 21),
            date(2026, 7, 20),
            set(),
        )
