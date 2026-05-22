"""Tests unitarios de validación para import_evaluacion_historica_gral."""

from app.scripts.import_evaluacion_historica_gral import validar_fila_evaluacion_historica_gral


def test_validar_fila_ok_con_comentarios():
    ok, motivo, payload = validar_fila_evaluacion_historica_gral(
        {
            "bono_id": 1,
            "bono_empleado_id": 272,
            "id_ponderacion": 247,
            "ponderacion_descripcion": "No cumplir Mtto Preventivo",
            "comentarios": "no realize preventivo",
            "area_nombre": "Mantenimiento",
            "subarea_nombre": "Emomex",
        }
    )
    assert ok is True
    assert motivo is None
    assert payload is not None
    assert payload["tipo"] == "Evaluacion"
    assert payload["subtipo"] == "No cumplir Mtto Preventivo"
    assert payload["tipo"] != payload["categoria"]
    assert payload["detalle"] == "no realize preventivo"
    assert payload["categoria"] == "247"


def test_validar_fila_ok_sin_comentarios_usa_descripcion():
    ok, _, payload = validar_fila_evaluacion_historica_gral(
        {
            "bono_id": 2,
            "bono_empleado_id": 100,
            "id_ponderacion": 10,
            "ponderacion_descripcion": "Orden y limpieza",
            "comentarios": None,
        }
    )
    assert ok is True
    assert payload is not None
    assert payload["detalle"] == "Orden y limpieza"


def test_validar_fila_rechaza_ponderacion_inexistente():
    ok, motivo, _ = validar_fila_evaluacion_historica_gral(
        {
            "bono_id": 3,
            "bono_empleado_id": 100,
            "id_ponderacion": 99999,
            "ponderacion_descripcion": None,
        }
    )
    assert ok is False
    assert motivo is not None
    assert "ponderaciones_general" in motivo
