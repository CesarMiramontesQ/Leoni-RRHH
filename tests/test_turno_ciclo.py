"""Ciclo de un turno en bloques: agrupación, posición y degradación.

Los patrones que se usan aquí son los **reales** de TRESS (`ROT321`, `GA1`, `GS1`), no
inventados: el valor de estas pruebas está en que reproduzcan el formato que llega de
nómina, incluidos sus CRLF y sus tokens raros.
"""

from datetime import date, datetime

import pytest

from app.utils.turno_calendario import TurnoTress
from app.utils.turno_ciclo import (
    ANCLA_VACIA,
    TurnoCicloError,
    ancla_valida,
    bloques_del_ciclo,
    jornadas_del_turno,
    longitud_ciclo,
    posicion_en_ciclo,
    tipo_turno,
    turno_tress_desde_modelo,
)

# Patrón real del turno ROT321 ("3a2a1a"), ciclo de 21 días.
ROT321_PAT = "5:003,2:002,5:002,0,1:006,1:002,6:001,1:001"
ROT321_INI = date(2020, 3, 9)

# Patrón real del turno GA1 ("Grupo 1 2021 LCM2"), con los CRLF tal como vienen.
GA1_PAT = (
    "3:010,3:010,1:010,\r\n2:011,1:013,0,3:011,1:011,\r\n"
    "2:011,0,1:012,3:011,1:011,\r\n2:011,4:010,1:010\r\n"
)


def _rotativo(pat: str, ini: date | None) -> TurnoTress:
    return TurnoTress(
        codigo="ROT", rit_pat=pat, rit_ini=ini, tips=(0,) * 7, hors=("",) * 7
    )


def _fijo(tips: tuple[int, ...], hors: tuple[str, ...]) -> TurnoTress:
    return TurnoTress(codigo="05A", rit_pat="", rit_ini=None, tips=tips, hors=hors)


# ───────────────────────────── expansión y agrupación ─────────────────────────────


def test_el_ciclo_rotativo_mide_lo_que_suman_sus_tokens():
    # 5+2+5+0+1+1+6+1: el token `0` aporta cero días y solo avanza la fase.
    assert longitud_ciclo(_rotativo(ROT321_PAT, ROT321_INI)) == 21


def test_los_crlf_del_patron_no_alteran_el_ciclo():
    assert longitud_ciclo(_rotativo(GA1_PAT, date(2020, 12, 28))) == 28


def test_los_bloques_agrupan_dias_consecutivos_con_la_misma_jornada():
    bloques = bloques_del_ciclo(_rotativo(ROT321_PAT, ROT321_INI))
    resumen = [(b.etiqueta, b.estatus, b.ho_codigo) for b in bloques]
    assert resumen == [
        ("Días 1–5", "LABORABLE", "003"),
        ("Días 6–7", "DESCANSO", None),
        ("Días 8–12", "LABORABLE", "002"),
        ("Día 13", "LABORABLE", "006"),
        ("Día 14", "DESCANSO", None),
        ("Días 15–20", "LABORABLE", "001"),
        ("Día 21", "DESCANSO", None),
    ]


def test_el_segundo_bloque_de_la_misma_jornada_cae_en_descanso():
    """Así codifica TRESS los descansos rotativos, y es lo que valida el motor.

    En `2:003,2:003` el primer token va en fase hábil y el segundo en fase descanso,
    aunque ambos declaren la misma jornada.
    """
    bloques = bloques_del_ciclo(_rotativo("2:001,0,2:003,2:003", date(2026, 1, 1)))
    assert [(b.dias, b.estatus, b.ho_codigo) for b in bloques] == [
        (2, "LABORABLE", "001"),
        (2, "LABORABLE", "003"),
        (2, "DESCANSO", None),
    ]


def test_las_jornadas_del_turno_excluyen_las_de_descanso_y_no_se_repiten():
    assert jornadas_del_turno(_rotativo(ROT321_PAT, ROT321_INI)) == [
        "003",
        "002",
        "006",
        "001",
    ]


def test_un_turno_fijo_se_expone_como_ciclo_semanal():
    turno = _fijo((0, 0, 0, 0, 0, 2, 2), ("005A",) * 7)
    assert tipo_turno(turno) == "FIJO"
    assert longitud_ciclo(turno) == 7
    assert [(b.etiqueta, b.estatus) for b in bloques_del_ciclo(turno)] == [
        ("Lun–Vie", "LABORABLE"),
        ("Sáb–Dom", "DESCANSO"),
    ]


# ───────────────────────────── posición en el calendario ─────────────────────────────


def test_la_fecha_ancla_es_la_posicion_uno():
    assert posicion_en_ciclo(_rotativo(ROT321_PAT, ROT321_INI), ROT321_INI) == 0


@pytest.mark.parametrize(
    "desde,hasta",
    [
        (date(2026, 1, 31), date(2026, 2, 1)),  # cambio de mes
        (date(2025, 12, 31), date(2026, 1, 1)),  # cambio de año
        (date(2024, 2, 28), date(2024, 2, 29)),  # año bisiesto
        (date(2026, 8, 8), date(2026, 8, 9)),  # fin de semana
    ],
)
def test_el_ciclo_avanza_un_dia_sin_importar_el_borde_de_calendario(desde, hasta):
    turno = _rotativo(ROT321_PAT, ROT321_INI)
    assert (posicion_en_ciclo(turno, desde) + 1) % 21 == posicion_en_ciclo(turno, hasta)


def test_una_vuelta_completa_regresa_a_la_misma_posicion():
    from datetime import timedelta

    turno = _rotativo(ROT321_PAT, ROT321_INI)
    f = date(2026, 8, 11)
    assert posicion_en_ciclo(turno, f) == posicion_en_ciclo(turno, f + timedelta(days=21))


def test_en_un_turno_fijo_la_posicion_es_el_dia_de_la_semana():
    turno = _fijo((0, 0, 0, 0, 0, 2, 2), ("005A",) * 7)
    assert posicion_en_ciclo(turno, date(2026, 8, 11)) == 1  # martes
    assert posicion_en_ciclo(turno, date(2026, 8, 15)) == 5  # sábado


# ───────────────────────────── degradación, no 500 ─────────────────────────────


def test_un_patron_con_codigo_no_numerico_se_reporta_como_invalido():
    """`2:03S` existe en los turnos de seguridad y el motor no lo interpreta.

    Se espera un error tipado que la pantalla pueda convertir en un aviso, no un fallo
    genérico que tumbe la lista entera.
    """
    with pytest.raises(TurnoCicloError) as exc:
        bloques_del_ciclo(_rotativo("1:026S,0,1:024S", date(2018, 9, 17)))
    assert exc.value.motivo == "PATRON_INVALIDO"


def test_un_rotativo_sin_ancla_real_no_devuelve_una_posicion_plausible():
    """`1899-12-30` es el "vacío" de TRESS, no una fecha.

    Sin esta comprobación el cálculo devolvería una posición perfectamente creíble y
    equivocada, sin lanzar ningún error.
    """
    turno = _rotativo(ROT321_PAT, ANCLA_VACIA)
    assert ancla_valida(turno) is False
    with pytest.raises(TurnoCicloError) as exc:
        posicion_en_ciclo(turno, date(2026, 8, 11))
    assert exc.value.motivo == "ANCLA_INVALIDA"


def test_un_turno_fijo_siempre_tiene_ancla_valida():
    assert ancla_valida(_fijo((0,) * 7, ("005A",) * 7)) is True


# ───────────────────────────── adaptador desde el modelo ─────────────────────────────


@pytest.mark.asyncio
async def test_el_adaptador_normaliza_el_relleno_del_catalogo(db):
    from tests.conftest import make_turno

    modelo = await make_turno(
        db,
        "ROT321",
        "3a2a1a",
        rit_pat=ROT321_PAT,
        rit_ini=datetime(2020, 3, 9),
        hors=("001", "002", "003", "", "", "", ""),
    )
    turno = turno_tress_desde_modelo(modelo)
    assert turno.codigo == "ROT321"
    assert turno.rit_ini == ROT321_INI
    assert longitud_ciclo(turno) == 21
