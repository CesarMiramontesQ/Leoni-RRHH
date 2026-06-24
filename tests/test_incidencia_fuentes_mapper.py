"""Tests del mapper de fuentes de incidencias."""

from datetime import date

from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    ORIGEN_SEGURIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)
from app.services.incidencia_fuentes.mapper import (
    map_calidad_historico_row,
    map_historico_row,
    map_seguridad_historico_row,
    synthetic_incidencia_id,
)


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
    assert item.id == synthetic_incidencia_id(ORIGEN_CALIDAD_HISTORICO, 42)
    assert item.origen_id == 42
    assert item.origen == ORIGEN_CALIDAD_HISTORICO
    assert item.tipo == TIPO_INCIDENCIA_CALIDAD
    assert item.tipo_incidencia == TIPO_INCIDENCIA_CALIDAD
    assert item.categoria == "Defecto de producto"
    assert item.detalle == "Pieza fuera de especificación"


def test_map_seguridad_historico_row_marca_tipo_incidencia_seguridad():
    row = {
        "origen_id": 15,
        "empleado_id": 2002,
        "no_empleado": "E-2002",
        "nombre": "LOPEZ, MARIA",
        "fecha": date(2026, 3, 10),
        "categoria": "EPP",
        "detalle": "Sin casco en área restringida",
        "area": "Planta",
        "subarea": "Almacén",
    }
    item = map_seguridad_historico_row(row)
    assert item.id == synthetic_incidencia_id(ORIGEN_SEGURIDAD_HISTORICO, 15)
    assert item.origen == ORIGEN_SEGURIDAD_HISTORICO
    assert item.tipo_incidencia == TIPO_INCIDENCIA_SEGURIDAD
    assert item.detalle == "Sin casco en área restringida"


def test_map_historico_row_unificado():
    row = {
        "origen_id": 9,
        "origen": ORIGEN_SEGURIDAD_HISTORICO,
        "tipo_incidencia": TIPO_INCIDENCIA_SEGURIDAD,
        "empleado_id": 3003,
        "no_empleado": "E-3003",
        "nombre": "GARCIA, LUIS",
        "fecha": date(2026, 4, 1),
        "categoria": "Conducta",
        "detalle": "Incumplimiento de procedimiento",
        "area": "Mantenimiento",
        "subarea": None,
    }
    item = map_historico_row(row)
    assert item.tipo_incidencia == TIPO_INCIDENCIA_SEGURIDAD
    assert item.origen == ORIGEN_SEGURIDAD_HISTORICO
