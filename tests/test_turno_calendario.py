"""Motor puro de proyección LABORABLE/DESCANSO por TURNO fijo/rotativo.

La expansión rotativa replica ``dbo.FN_GeneraRitmo`` (fase hábil/descanso + token 0).
"""

from datetime import date, time
from decimal import Decimal

from app.utils.turno_calendario import (
    TurnoTress,
    aplanar_patron_rotativo,
    expandir_patron_rotativo,
    proyectar_dia,
)


PATRON_G11 = (
    "2:001,0,2:143,0,2:03,2:03,2:001,0,2:143,0,2:03,\r\n"
    "2:001,2:04,0,2:024,0,2:003,\r\n"
    "2:003,2:04,0,2:024,0,\r\n"
    "2:003,2:003,2:001,0,2:002,0,\r\n"
    "2:003,2:003,2:001,0,\r\n"
    "2:002,0,2:003,2:003,2:001,0,\r\n"
    "2:002,0,2:003,2:003"
)


def test_aplanar_patron_elimina_saltos_de_linea():
    assert aplanar_patron_rotativo("2:001,\r\n0,2:143") == "2:001,0,2:143"


def test_expandir_patron_rotativo_g11_genera_pares_de_descanso():
    ciclo = expandir_patron_rotativo(PATRON_G11)

    assert len(ciclo) == 56
    compact = "".join("D" if d.tipo_dia == 2 else "." for d in ciclo)
    assert compact == "......DD......DD......DD......DD......DD......DD......DD"
    # Primer bloque de descanso: índices 6-7 (segundo token 2:03 en fase descanso)
    assert ciclo[6].tipo_dia == 2
    assert ciclo[7].tipo_dia == 2
    assert ciclo[5].tipo_dia == 0


def test_expandir_token_cero_salta_fase_sin_insertar_dias():
    # 2 hábiles, 0 descanso (salta), 2 hábiles → ciclo solo laborable
    ciclo = expandir_patron_rotativo("2:001,0,2:143")
    assert len(ciclo) == 4
    assert all(d.tipo_dia == 0 for d in ciclo)
    assert [d.codigo_horario for d in ciclo] == ["001", "001", "143", "143"]


def test_expandir_pares_consecutivos_caen_en_descanso():
    ciclo = expandir_patron_rotativo("2:001,2:001")
    assert [d.tipo_dia for d in ciclo] == [0, 0, 2, 2]


def test_dia_fijo_domingo_tip_2_es_descanso():
    turno = TurnoTress(
        codigo="ADM",
        rit_pat=None,
        rit_ini=None,
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("010", "010", "010", "010", "010", "", ""),
    )
    # 2026-07-12 es domingo
    dia = proyectar_dia(turno, date(2026, 7, 12), horarios={"010": (time(8, 0), time(17, 0), Decimal("8"))})

    assert dia.tipo_turno == "FIJO"
    assert dia.estatus == "DESCANSO"
    assert dia.codigo_horario is None


def test_dia_fijo_lunes_tip_0_es_laborable_con_horario():
    turno = TurnoTress(
        codigo="ADM",
        rit_pat="",
        rit_ini=None,
        tips=(0, 0, 0, 0, 0, 1, 2),
        hors=("010", "010", "010", "010", "010", "", ""),
    )
    dia = proyectar_dia(
        turno,
        date(2026, 7, 13),  # lunes
        horarios={"010": (time(8, 0), time(17, 0), Decimal("8"))},
    )

    assert dia.tipo_turno == "FIJO"
    assert dia.estatus == "LABORABLE"
    assert dia.codigo_horario == "010"
    assert dia.hora_entrada == time(8, 0)
    assert dia.hora_salida == time(17, 0)


def test_dia_fijo_tip_1_se_trata_como_laborable():
    turno = TurnoTress(
        codigo="ADM",
        rit_pat=None,
        rit_ini=None,
        tips=(0, 0, 0, 0, 0, 1, 2),
        hors=("", "", "", "", "", "020", ""),
    )
    # sábado con TIP=1
    dia = proyectar_dia(turno, date(2026, 7, 11))

    assert dia.estatus == "LABORABLE"


def test_dia_rotativo_g11_domingo_lunes_julio_son_descanso():
    turno = TurnoTress(
        codigo="G11",
        rit_pat=PATRON_G11,
        rit_ini=date(2025, 6, 16),
        tips=(0, 0, 0, 0, 0, 1, 2),
        hors=("", "", "", "", "", "", ""),
    )
    # Ejemplo de negocio: 19 y 20 de julio 2026 (domingo-lunes)
    assert proyectar_dia(turno, date(2026, 7, 19)).estatus == "DESCANSO"
    assert proyectar_dia(turno, date(2026, 7, 20)).estatus == "DESCANSO"
    assert proyectar_dia(turno, date(2026, 7, 18)).estatus == "LABORABLE"
    assert proyectar_dia(turno, date(2026, 7, 21)).estatus == "LABORABLE"


def test_dia_rotativo_laborable_resuelve_horario():
    turno = TurnoTress(
        codigo="G11",
        rit_pat=PATRON_G11,
        rit_ini=date(2025, 6, 16),
        tips=(0, 0, 0, 0, 0, 1, 2),
        hors=("", "", "", "", "", "", ""),
    )
    dia = proyectar_dia(
        turno,
        date(2025, 6, 16),
        horarios={"001": (time(6, 0), time(14, 0), Decimal("8"))},
    )

    assert dia.estatus == "LABORABLE"
    assert dia.codigo_horario == "001"
    assert dia.hora_entrada == time(6, 0)


def test_parse_hora_tress_vive_en_turno_calendario():
    """Es parseo de formatos de TRESS, no acceso a datos: su casa es este módulo."""
    from datetime import time

    from app.utils.turno_calendario import parse_hora_tress

    assert parse_hora_tress("0600") == time(6, 0)
    assert parse_hora_tress("2200") == time(22, 0)
    assert parse_hora_tress("600") == time(6, 0)
    assert parse_hora_tress(None) is None
    assert parse_hora_tress("") is None
    assert parse_hora_tress("2560") is None
    assert parse_hora_tress("abcd") is None


def test_no_queda_camino_odbc_de_descansos():
    """Regresión del objetivo del cambio: el repositorio ODBC de descansos no debe volver."""
    import importlib

    import pytest as _pytest

    with _pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.repositories.datos_analisis_descansos_repository")
