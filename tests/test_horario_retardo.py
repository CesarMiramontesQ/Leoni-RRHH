"""Formato de horas de TRESS y cálculo de minutos de retardo.

TRESS guarda las horas como char 'HHMM' y usa horas >= 24 para decir «al día
siguiente» (un turno que entra a las 18:00 y checa a la 01:00 aparece como '2500').
Estas funciones son puras: no abren ninguna BD.
"""

from app.utils.horario_retardo import (
    formatear_hora_tress,
    minutos_de_retardo,
)


def test_formatea_hhmm_a_hh_dos_puntos_mm():
    assert formatear_hora_tress("0627") == "06:27"
    assert formatear_hora_tress("0600") == "06:00"


def test_conserva_las_horas_mayores_a_23_del_turno_nocturno():
    """'2456' es la 00:56 del día siguiente; normalizarla aquí perdería el «+1 día»."""
    assert formatear_hora_tress("2456") == "24:56"
    assert formatear_hora_tress("3400") == "34:00"


def test_hora_ausente_o_ilegible_es_none():
    assert formatear_hora_tress(None) is None
    assert formatear_hora_tress("") is None
    assert formatear_hora_tress("   ") is None
    assert formatear_hora_tress("abcd") is None
    assert formatear_hora_tress("0670") is None  # 70 minutos no existe
    assert formatear_hora_tress("123") is None


def test_minutos_de_retardo_es_la_diferencia_contra_la_hora_programada():
    assert minutos_de_retardo(programada="0600", entrada="0627") == 27
    assert minutos_de_retardo(programada="1400", entrada="2256") == 536


def test_minutos_de_retardo_cruza_la_medianoche():
    """Turno de las 18:00 que checa a la 01:00: TRESS lo escribe como '2500'."""
    assert minutos_de_retardo(programada="1800", entrada="2500") == 420


def test_llegar_antes_de_la_hora_no_produce_minutos_negativos():
    """0.2% de los retardos de TRESS checan antes de su hora; se degrada a None."""
    assert minutos_de_retardo(programada="0800", entrada="0702") is None


def test_llegar_puntual_da_cero_minutos():
    assert minutos_de_retardo(programada="0800", entrada="0800") == 0


def test_sin_alguna_de_las_dos_horas_no_hay_minutos():
    assert minutos_de_retardo(programada=None, entrada="0627") is None
    assert minutos_de_retardo(programada="0600", entrada=None) is None
    assert minutos_de_retardo(programada="xxxx", entrada="0627") is None
