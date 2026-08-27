from datetime import date

import pytest

from app.utils.homeoffice_periodo import bloque_semanas, semanas_en_anio_iso


def test_periodo_1_es_la_semana_iso_lunes_a_domingo():
    # 2026-06-10 es miércoles; su semana ISO va del lunes 8 al domingo 14.
    assert bloque_semanas(date(2026, 6, 10), 1) == (date(2026, 6, 8), date(2026, 6, 14))
    assert bloque_semanas(date(2026, 6, 8), 1) == (date(2026, 6, 8), date(2026, 6, 14))
    assert bloque_semanas(date(2026, 6, 14), 1) == (date(2026, 6, 8), date(2026, 6, 14))


def test_periodo_2_agrupa_semanas_iso_impar_par():
    # Semana ISO 24 de 2026 = 8-14 jun (par) → bloque (23, 24) = 1-14 jun.
    assert bloque_semanas(date(2026, 6, 10), 2) == (date(2026, 6, 1), date(2026, 6, 14))
    # Semana 25 (15-21 jun) abre el bloque (25, 26) = 15-28 jun.
    assert bloque_semanas(date(2026, 6, 15), 2) == (date(2026, 6, 15), date(2026, 6, 28))


def test_bloque_de_dos_semanas_no_se_ancla_al_mes():
    # 30 jun y 1 jul caen en la misma semana ISO 27 → mismo bloque.
    assert bloque_semanas(date(2026, 6, 30), 2) == bloque_semanas(date(2026, 7, 1), 2)


def test_anio_iso_de_53_semanas_deja_bloque_corto_al_final():
    # 2026 tiene 53 semanas ISO; con periodo 2 la semana 53 queda sola.
    assert semanas_en_anio_iso(2026) == 53
    inicio, fin = bloque_semanas(date(2026, 12, 31), 2)
    assert inicio == date(2026, 12, 28)
    assert fin == date(2027, 1, 3)


def test_primeros_dias_de_enero_pertenecen_al_anio_iso_anterior():
    # 2027-01-01 es viernes de la semana 53 de 2026.
    assert bloque_semanas(date(2027, 1, 1), 1) == (date(2026, 12, 28), date(2027, 1, 3))


def test_periodo_invalido():
    with pytest.raises(ValueError):
        bloque_semanas(date(2026, 6, 10), 0)
