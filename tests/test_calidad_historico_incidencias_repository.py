"""Tests del filtro de tipo en repositorio calidad_historico."""

from app.repositories.calidad_historico_incidencias_repository import _tipo_incluye_calidad


def test_tipo_vacio_incluye_calidad():
    assert _tipo_incluye_calidad(None) is True
    assert _tipo_incluye_calidad("") is True


def test_tipo_calidad_incluye():
    assert _tipo_incluye_calidad("Calidad") is True
    assert _tipo_incluye_calidad("calidad") is True


def test_tipo_seguridad_excluye_en_fase_calidad():
    assert _tipo_incluye_calidad("Seguridad") is False
    assert _tipo_incluye_calidad("retardo") is False
