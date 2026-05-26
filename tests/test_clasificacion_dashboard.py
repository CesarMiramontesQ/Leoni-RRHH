"""Mapeo de clasificacion_empleado (códigos IT: D, A, I) a gráficas del dashboard RH."""

from app.services.usuario_service import (
    _clasificacion_display_label,
    _tipo_clasificacion_dashboard,
)


def test_tipo_desde_codigo_it():
    assert _tipo_clasificacion_dashboard("D", "Directo") == "directo"
    assert _tipo_clasificacion_dashboard("A", "Administrativo") == "administrativo"
    assert _tipo_clasificacion_dashboard("I", "Indirecto") == "indirecto"


def test_tipo_desde_texto_largo():
    assert _tipo_clasificacion_dashboard("Directo", None) == "directo"
    assert _tipo_clasificacion_dashboard("Indirecto", None) == "indirecto"


def test_tipo_nd_no_mapea():
    assert _tipo_clasificacion_dashboard("#N/D", "No determinado") is None


def test_display_label_codigo_y_significado():
    assert _clasificacion_display_label("D", "Directo") == "D — Directo"
