"""Unit tests para app.core.catalogos_cualificacion."""

import pytest

from app.core.catalogos_cualificacion import (
    CATALOGO_ESCOLARIDAD,
    ESCOLARIDAD_KEYS,
    calcular_cumplimiento,
    es_clave_escolaridad_valida,
)


def test_catalogo_tiene_7_niveles():
    assert len(CATALOGO_ESCOLARIDAD) == 7


def test_keys_set_coincide():
    assert ESCOLARIDAD_KEYS == set(CATALOGO_ESCOLARIDAD.keys())


@pytest.mark.parametrize("key", ["ninguno", "primaria", "secundaria", "preparatoria", "licenciatura", "maestria", "doctorado"])
def test_claves_validas(key):
    assert es_clave_escolaridad_valida(key) is True


@pytest.mark.parametrize("key", ["Licenciatura", "MAESTRIA", "ing_industrial", "", "null", "Preparatoria"])
def test_claves_invalidas(key):
    assert es_clave_escolaridad_valida(key) is False


def test_cumplimiento_igual():
    assert calcular_cumplimiento("licenciatura", "licenciatura") is True


def test_cumplimiento_mayor():
    assert calcular_cumplimiento("secundaria", "doctorado") is True


def test_cumplimiento_menor():
    assert calcular_cumplimiento("maestria", "preparatoria") is False


def test_cumplimiento_minimo():
    assert calcular_cumplimiento("ninguno", "ninguno") is True


def test_cumplimiento_maximo_vs_minimo():
    assert calcular_cumplimiento("doctorado", "ninguno") is False


def test_cumplimiento_deseada_invalida():
    assert calcular_cumplimiento("texto_libre", "licenciatura") is None


def test_cumplimiento_actual_invalida():
    assert calcular_cumplimiento("licenciatura", "Ingenieria Industrial") is None


def test_cumplimiento_ambas_invalidas():
    assert calcular_cumplimiento("foo", "bar") is None


def test_pesos_ordenados():
    keys_by_peso = sorted(CATALOGO_ESCOLARIDAD.keys(), key=lambda k: CATALOGO_ESCOLARIDAD[k]["peso"])
    expected = ["ninguno", "primaria", "secundaria", "preparatoria", "licenciatura", "maestria", "doctorado"]
    assert keys_by_peso == expected
