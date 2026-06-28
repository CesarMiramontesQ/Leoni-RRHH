from datetime import date

from app.utils.vacaciones_fechas import (
    defuncion_rango_administrativo,
    defuncion_rango_calendario,
    defuncion_rango_para_empleado,
    dias_laborales_inclusive,
    rango_incluye_fin_de_semana,
    sumar_dias_habiles,
)


def test_rango_incluye_fin_de_semana():
    assert rango_incluye_fin_de_semana(date(2026, 5, 4), date(2026, 5, 8)) is False
    assert rango_incluye_fin_de_semana(date(2026, 5, 8), date(2026, 5, 11)) is True
    assert rango_incluye_fin_de_semana(date(2026, 5, 9), date(2026, 5, 10)) is True


def test_dias_laborales_inclusive():
    assert dias_laborales_inclusive(date(2026, 5, 4), date(2026, 5, 8)) == 5
    assert dias_laborales_inclusive(date(2026, 5, 8), date(2026, 5, 8)) == 1


def test_defuncion_rango_calendario_tres_dias():
    assert defuncion_rango_calendario(date(2026, 5, 6)) == (
        date(2026, 5, 6),
        date(2026, 5, 8),
    )


def test_defuncion_rango_administrativo_entre_semana():
    assert defuncion_rango_administrativo(date(2026, 5, 6)) == (
        date(2026, 5, 6),
        date(2026, 5, 8),
    )


def test_defuncion_rango_administrativo_cruza_fin_de_semana():
    # Jue 7 → Jue, Vie, Lun
    assert defuncion_rango_administrativo(date(2026, 5, 7)) == (
        date(2026, 5, 7),
        date(2026, 5, 11),
    )
    # Vie 8 → Vie, Lun, Mar
    assert defuncion_rango_administrativo(date(2026, 5, 8)) == (
        date(2026, 5, 8),
        date(2026, 5, 12),
    )
    # Sáb 9 → Lun, Mar, Mié
    assert defuncion_rango_administrativo(date(2026, 5, 9)) == (
        date(2026, 5, 11),
        date(2026, 5, 13),
    )


def test_defuncion_rango_para_empleado_no_administrativo():
    assert defuncion_rango_para_empleado(date(2026, 5, 7), administrativo=False) == (
        date(2026, 5, 7),
        date(2026, 5, 9),
    )


def test_sumar_dias_habiles_siete_desde_lunes():
    assert sumar_dias_habiles(date(2026, 5, 4), 7) == date(2026, 5, 12)
