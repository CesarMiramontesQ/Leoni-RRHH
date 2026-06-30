"""Unit tests para app.services.calificacion_comparador_service."""

import pytest

from app.models.talento import MetodoCalificacion, OpcionCalificacion
from app.services.calificacion_comparador_service import evaluar_cumplimiento


def _metodo(comparador: str, tipo: str = "lista_ordenada") -> MetodoCalificacion:
    return MetodoCalificacion(
        id=1,
        nombre="Test",
        tipo=tipo,
        config={"comparador": comparador},
        activo=True,
    )


def _opciones_escolaridad() -> list[OpcionCalificacion]:
    data = [
        ("primaria", 1),
        ("secundaria", 2),
        ("preparatoria", 3),
        ("licenciatura", 4),
    ]
    return [
        OpcionCalificacion(
            id=i + 1,
            metodo_calificacion_id=1,
            etiqueta=v,
            valor=v,
            orden=i,
            peso=p,
            activo=True,
        )
        for i, (v, p) in enumerate(data)
    ]


def test_ordinal_gte_cumple():
    metodo = _metodo("ordinal_gte")
    opciones = _opciones_escolaridad()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"opcion_valor": "secundaria"},
        {"opcion_valor": "licenciatura"},
    ) is True


def test_ordinal_gte_no_cumple():
    metodo = _metodo("ordinal_gte")
    opciones = _opciones_escolaridad()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"opcion_valor": "licenciatura"},
        {"opcion_valor": "primaria"},
    ) is False


def test_numeric_gte_cumple():
    metodo = _metodo("numeric_gte", "anios_experiencia")
    assert evaluar_cumplimiento(
        metodo,
        [],
        {"min_anios": 3},
        {"anios": 5},
    ) is True


def test_boolean_yes_cumple():
    metodo = _metodo("boolean_yes", "si_no")
    opciones = [
        OpcionCalificacion(
            id=1, metodo_calificacion_id=1, etiqueta="Cumple", valor="si", orden=1, peso=1, activo=True
        )
    ]
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"opcion_valor": "si"},
        {"opcion_valor": "si"},
    ) is True


def _opciones_experiencia() -> list[OpcionCalificacion]:
    """Método numérico con opciones tipo '1 año'..'3 años' y peso None."""
    data = [
        ("1", "1 año"),
        ("2", "2 año"),
        ("3", "3 años"),
    ]
    return [
        OpcionCalificacion(
            id=i + 1,
            metodo_calificacion_id=2,
            etiqueta=etq,
            valor=val,
            orden=i,
            peso=None,
            activo=True,
        )
        for i, (val, etq) in enumerate(data)
    ]


def test_ordinal_gte_criterio_texto_resuelve_por_etiqueta():
    """Criterio guardado como texto libre ('Licenciatura') debe resolver a la opción."""
    metodo = _metodo("ordinal_gte")
    opciones = _opciones_escolaridad()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"texto": "Licenciatura"},
        {"opcion_valor": "licenciatura"},
    ) is True


def test_ordinal_gte_texto_case_insensitive():
    metodo = _metodo("ordinal_gte")
    opciones = _opciones_escolaridad()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"texto": "licenciatura"},
        {"texto": "LICENCIATURA"},
    ) is True


def test_numeric_gte_capturado_opcion_se_deriva_a_numero():
    """Si la captura guardó una opción ('2 año') en vez de años, derivar el número."""
    metodo = _metodo("numeric_gte", "escala_numerica")
    opciones = _opciones_experiencia()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"min_anios": 1},
        {"opcion_valor": "2"},
    ) is True


def test_numeric_gte_criterio_opcion_sin_min_anios():
    metodo = _metodo("numeric_gte", "escala_numerica")
    opciones = _opciones_experiencia()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"opcion_valor": "1"},
        {"anios": 2},
    ) is True


def test_numeric_gte_opcion_no_cumple():
    metodo = _metodo("numeric_gte", "escala_numerica")
    opciones = _opciones_experiencia()
    assert evaluar_cumplimiento(
        metodo,
        opciones,
        {"min_anios": 3},
        {"opcion_valor": "1"},
    ) is False


def test_na_siempre_cumple():
    metodo = _metodo("ordinal_gte")
    assert evaluar_cumplimiento(
        metodo,
        _opciones_escolaridad(),
        {"na": True},
        {"opcion_valor": "primaria"},
    ) is True


def test_none_sin_captura():
    metodo = _metodo("ordinal_gte")
    assert evaluar_cumplimiento(
        metodo,
        _opciones_escolaridad(),
        {"opcion_valor": "secundaria"},
        None,
    ) is None
