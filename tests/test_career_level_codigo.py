"""
Regla del codigo de un career level: el codigo de su career path + un numero.

Modulo de reglas puro, asi que estos tests no tocan BD ni API. La cobertura de
extremo a extremo (422 del endpoint) vive en `tests/test_grados_puesto.py`.
"""

import pytest

from app.utils.career_level_codigo import (
    normalizar_codigo,
    numero_de,
    siguiente_numero,
)


@pytest.mark.parametrize(
    "prefijo,codigo,esperado",
    [
        ("P", "P1", "P1"),
        ("P", "P10", "P10"),
        ("M", "M3", "M3"),
        # El prefijo se compara sin distinguir mayusculas, pero se ALMACENA con
        # el codigo exacto del career path.
        ("P", "p10", "P10"),
        ("P", "  P10  ", "P10"),
        # Prefijos de mas de una letra funcionan igual.
        ("TEC", "TEC7", "TEC7"),
    ],
)
def test_normaliza_codigos_validos(prefijo, codigo, esperado):
    assert normalizar_codigo(prefijo, codigo) == esperado


@pytest.mark.parametrize(
    "prefijo,codigo,motivo",
    [
        ("P", "M7", "el prefijo es de otro career path"),
        ("P", "Nivel 3", "no empieza con el prefijo"),
        ("P", "P", "falta el numero"),
        ("P", "P0", "el numero debe ser >= 1"),
        # 'P01' y 'P1' significarian lo mismo y serian dos filas distintas.
        ("P", "P01", "ceros a la izquierda"),
        ("P", "P1.5", "no es un entero"),
        ("P", "P 1", "espacio entre prefijo y numero"),
        ("P", "P1A", "sufijo no numerico"),
        ("P", "", "codigo vacio"),
        ("", "P1", "career path sin codigo"),
    ],
)
def test_rechaza_codigos_invalidos(prefijo, codigo, motivo):
    with pytest.raises(ValueError):
        normalizar_codigo(prefijo, codigo)


def test_rechaza_codigo_que_no_cabe_en_la_columna():
    """`levelup_grados_puesto.codigo` es VARCHAR(10)."""
    with pytest.raises(ValueError, match="10 caracteres"):
        normalizar_codigo("PROFESSION", "PROFESSION1")


def test_el_mensaje_de_error_dice_como_corregirlo():
    with pytest.raises(ValueError) as e:
        normalizar_codigo("M", "Nivel 3")
    detalle = str(e.value)
    assert "'M'" in detalle
    assert "M1" in detalle
    assert "Nivel 3" in detalle


@pytest.mark.parametrize(
    "prefijo,codigo,esperado",
    [
        ("P", "P10", 10),
        ("P", "p10", 10),
        ("P", "M10", None),
        ("P", "P01", None),
    ],
)
def test_numero_de(prefijo, codigo, esperado):
    assert numero_de(prefijo, codigo) == esperado


def test_siguiente_numero_toma_el_mayor_no_el_conteo():
    # Con huecos (falta P2) el siguiente sigue siendo 4: reusar el hueco
    # chocaria con el codigo de un nivel desactivado.
    assert siguiente_numero("P", ["P1", "P3"]) == 4


def test_siguiente_numero_ignora_los_codigos_de_otro_path():
    assert siguiente_numero("M", ["P1", "P2", "P9"]) == 1


def test_siguiente_numero_sin_codigos_empieza_en_uno():
    assert siguiente_numero("P", []) == 1
