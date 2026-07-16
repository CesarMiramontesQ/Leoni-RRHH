"""Tests de partición por semana calendario (lun–dom)."""

from datetime import date

import pytest

from app.utils.calendar_weeks import split_calendar_weeks


def test_mismo_tramo_intra_semana():
    # Jue 2026-05-07 … Vie 2026-05-08 (misma semana)
    assert split_calendar_weeks(date(2026, 5, 7), date(2026, 5, 8)) == [
        (date(2026, 5, 7), date(2026, 5, 8)),
    ]


def test_cruza_domingo_a_lunes():
    # Jue 2026-05-07 … Lun 2026-05-11
    assert split_calendar_weeks(date(2026, 5, 7), date(2026, 5, 11)) == [
        (date(2026, 5, 7), date(2026, 5, 10)),  # hasta domingo
        (date(2026, 5, 11), date(2026, 5, 11)),
    ]


def test_un_solo_dia():
    assert split_calendar_weeks(date(2026, 5, 10), date(2026, 5, 10)) == [
        (date(2026, 5, 10), date(2026, 5, 10)),
    ]


def test_semana_completa_lun_dom():
    assert split_calendar_weeks(date(2026, 5, 4), date(2026, 5, 10)) == [
        (date(2026, 5, 4), date(2026, 5, 10)),
    ]


def test_tres_semanas():
    # Lun 4 … Dom 17 → dos semanas completas
    assert split_calendar_weeks(date(2026, 5, 4), date(2026, 5, 17)) == [
        (date(2026, 5, 4), date(2026, 5, 10)),
        (date(2026, 5, 11), date(2026, 5, 17)),
    ]


def test_fecha_fin_anterior_raises():
    with pytest.raises(ValueError):
        split_calendar_weeks(date(2026, 5, 10), date(2026, 5, 9))
