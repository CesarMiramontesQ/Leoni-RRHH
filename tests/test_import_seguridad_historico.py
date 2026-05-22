"""Tests unitarios de validación para import_seguridad_historico (sin BD externa)."""

from datetime import date

from app.scripts.import_seguridad_historico import validar_fila_seguridad_historico


def test_validar_fila_ok():
    ok, motivo, payload = validar_fila_seguridad_historico(
        {
            "bono_id": 99,
            "id_empleado": 2001,
            "fecha": date(2025, 8, 1),
            "observaciones": "No uso de EPP",
            "area_empleado": "Producción",
            "subarea_empleado": "L2",
        }
    )
    assert ok is True
    assert motivo is None
    assert payload is not None
    assert payload["observaciones"] == "No uso de EPP"
    assert payload["bono_id"] == 99


def test_validar_fila_rechaza_sin_observaciones():
    ok, motivo, _ = validar_fila_seguridad_historico(
        {
            "bono_id": 100,
            "id_empleado": 2001,
            "fecha": "2025-08-01",
            "observaciones": "  ",
            "area_empleado": "A",
            "subarea_empleado": "B",
        }
    )
    assert ok is False
    assert motivo == "observaciones vacías"


def test_validar_fila_rechaza_sin_id():
    ok, motivo, _ = validar_fila_seguridad_historico(
        {
            "bono_id": None,
            "id_empleado": 2001,
            "fecha": "2025-08-01",
            "observaciones": "Incidente",
        }
    )
    assert ok is False
    assert motivo == "id ausente o inválido"
