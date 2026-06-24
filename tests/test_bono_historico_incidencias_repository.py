"""Tests del filtro de tipo en repositorio unificado de incidencias históricas."""

from app.repositories.bono_historico_incidencias_repository import _tipos_incluidos
from app.services.incidencia_fuentes.constants import (
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)


def test_tipo_vacio_incluye_ambos():
    assert _tipos_incluidos(None) is None
    assert _tipos_incluidos("") is None


def test_tipo_calidad_solo_calidad():
    assert _tipos_incluidos("Calidad") == {TIPO_INCIDENCIA_CALIDAD}
    assert _tipos_incluidos("calidad") == {TIPO_INCIDENCIA_CALIDAD}


def test_tipo_seguridad_solo_seguridad():
    assert _tipos_incluidos("Seguridad") == {TIPO_INCIDENCIA_SEGURIDAD}
    assert _tipos_incluidos("seguridad") == {TIPO_INCIDENCIA_SEGURIDAD}


def test_tipo_desconocido_sin_resultados():
    assert _tipos_incluidos("retardo") == set()
