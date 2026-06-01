"""Tests unitarios de validación para import_importadas_historico."""

from datetime import date

from app.scripts.import_importadas_historico import validar_fila_importadas_historico


def test_validar_fila_ok():
    ok, motivo, payload = validar_fila_importadas_historico(
        {
            "bono_id": 10,
            "no_empleado": "4295",
            "tipo_inc": "FI",
            "tipo_descripcion": "Falta Injustificada",
            "area_nombre": "Cables Especiales",
            "subarea_nombre": "Extrusoras",
        }
    )
    assert ok is True
    assert motivo is None
    assert payload is not None
    assert payload["tipo"] == "Falta Injustificada"
    assert payload["categoria"] == "FI"
    assert payload["detalle"] == "Falta Injustificada"


def test_validar_fila_mapea_fecha_incidencia():
    ok, _, payload = validar_fila_importadas_historico(
        {
            "bono_id": 13,
            "no_empleado": "4295",
            "tipo_inc": "FI",
            "tipo_descripcion": "Falta Injustificada",
            "fecha_incidencia": "2023-11-20",
        }
    )
    assert ok is True
    assert payload is not None
    assert payload["fecha"] == date(2023, 11, 20)


def test_validar_fila_fecha_incidencia_invalida_queda_none():
    ok, _, payload = validar_fila_importadas_historico(
        {
            "bono_id": 14,
            "no_empleado": "4295",
            "tipo_inc": "FI",
            "tipo_descripcion": "Falta Injustificada",
            "fecha_incidencia": "",
        }
    )
    assert ok is True
    assert payload is not None
    assert payload["fecha"] is None


def test_validar_fila_rechaza_tipo_inc_sin_ponderacion():
    ok, motivo, _ = validar_fila_importadas_historico(
        {
            "bono_id": 11,
            "no_empleado": "100",
            "tipo_inc": "XXX",
            "tipo_descripcion": None,
        }
    )
    assert ok is False
    assert motivo is not None
    assert "ponderaciones" in motivo


def test_validar_fila_rechaza_sin_no_empleado():
    ok, motivo, _ = validar_fila_importadas_historico(
        {
            "bono_id": 12,
            "no_empleado": "",
            "tipo_inc": "FI",
            "tipo_descripcion": "Falta Injustificada",
        }
    )
    assert ok is False
    assert motivo == "no_empleado ausente o inválido"
