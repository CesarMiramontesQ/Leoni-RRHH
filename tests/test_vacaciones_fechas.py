from datetime import date

from app.utils.vacaciones_fechas import dias_laborales_inclusive, rango_incluye_fin_de_semana


def test_rango_incluye_fin_de_semana():
    assert rango_incluye_fin_de_semana(date(2026, 5, 4), date(2026, 5, 8)) is False
    assert rango_incluye_fin_de_semana(date(2026, 5, 8), date(2026, 5, 11)) is True
    assert rango_incluye_fin_de_semana(date(2026, 5, 9), date(2026, 5, 10)) is True


def test_dias_laborales_inclusive():
    assert dias_laborales_inclusive(date(2026, 5, 4), date(2026, 5, 8)) == 5
    assert dias_laborales_inclusive(date(2026, 5, 8), date(2026, 5, 8)) == 1
