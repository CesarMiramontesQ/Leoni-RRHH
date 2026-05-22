"""Tests unitarios de validación para import_calidad_historico (sin BD externa)."""

from datetime import date

from app.scripts.import_calidad_historico import validar_fila_calidad_historico


def test_validar_fila_ok_con_categoria():
    ok, motivo, payload = validar_fila_calidad_historico(
        {
            "bono_id": 10,
            "id_empleado": 1001,
            "motivo": "Defecto en línea",
            "fecha": date(2025, 6, 15),
            "area_empleado": "Producción",
            "subarea_empleado": "L1",
            "incidencia_categoria_id": 3,
            "categoria_nombre": "Calidad menor",
        }
    )
    assert ok is True
    assert motivo is None
    assert payload is not None
    assert payload["categoria"] == "Calidad menor"
    assert payload["motivo"] == "Defecto en línea"


def test_validar_fila_rechaza_categoria_inexistente():
    ok, motivo, _ = validar_fila_calidad_historico(
        {
            "bono_id": 11,
            "id_empleado": 1001,
            "motivo": "Motivo",
            "fecha": "2025-01-10",
            "incidencia_categoria_id": 999,
            "categoria_nombre": None,
        }
    )
    assert ok is False
    assert motivo is not None
    assert "categoría inexistente" in motivo


def test_validar_fila_rechaza_sin_motivo():
    ok, motivo, _ = validar_fila_calidad_historico(
        {
            "bono_id": 12,
            "id_empleado": 1001,
            "motivo": "   ",
            "fecha": "2025-01-10",
            "incidencia_categoria_id": None,
            "categoria_nombre": None,
        }
    )
    assert ok is False
    assert motivo == "motivo vacío"
