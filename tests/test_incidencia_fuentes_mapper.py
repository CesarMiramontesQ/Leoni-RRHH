"""Tests del mapper de fuentes de incidencias."""

from datetime import date

from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
)
from app.services.incidencia_fuentes.mapper import map_calidad_historico_row


def test_map_calidad_historico_row_marca_tipo_incidencia_calidad():
    row = {
        "origen_id": 42,
        "empleado_id": 1001,
        "no_empleado": "E-1001",
        "nombre": "PEREZ, JUAN",
        "fecha": date(2026, 1, 15),
        "categoria": "Defecto de producto",
        "detalle": "Pieza fuera de especificación",
        "area": "Producción",
        "subarea": "Línea 3",
    }
    item = map_calidad_historico_row(row)
    assert item.id == 42
    assert item.origen_id == 42
    assert item.origen == ORIGEN_CALIDAD_HISTORICO
    assert item.tipo == TIPO_INCIDENCIA_CALIDAD
    assert item.tipo_incidencia == TIPO_INCIDENCIA_CALIDAD
    assert item.categoria == "Defecto de producto"
    assert item.subtipo == "Defecto de producto"
    assert item.detalle == "Pieza fuera de especificación"
    assert item.fecha == date(2026, 1, 15)
