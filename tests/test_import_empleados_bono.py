"""Tests unitarios de import_empleados_bono (sin BD externa).

DESACTIVADO: el proyecto migró a una sola BD (Bono) y lee `empleados` en vivo;
ya no hay sincronización Bono→copia local. El flujo de importación quedó
deshabilitado y estas pruebas, que
validaban el copiado de columnas (incluidas email/password_hash, hoy en
levelup_empleados_core), ya no aplican.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Import Bono→local deshabilitado: BD única Bono")

from app.scripts.import_empleados_bono import (
    _aplicar_payload,
    _normalizar_empleado_id,
    _payload_desde_bono,
    _validar_fila,
    resolver_columnas_importables,
    resolver_columnas_lectura_bono,
)
from app.models.empleados import Empleado


def test_resolver_columnas_importables_copia_todas_las_compartidas():
    bono = {
        "id",
        "empleado_id",
        "no_empleado",
        "nombre",
        "password_hash",
        "rol_id",
        "created_at",
        "lider_id",
        "email",
        "area_id",
        "columna_solo_bono",
    }
    locales = {
        "id",
        "empleado_id",
        "no_empleado",
        "nombre",
        "password_hash",
        "rol_id",
        "created_at",
        "lider_id",
        "email",
        "area_id",
        "fecha_fin_contrato",
    }
    cols = resolver_columnas_importables(bono, locales)
    assert cols == [
        "area_id",
        "created_at",
        "email",
        "empleado_id",
        "lider_id",
        "no_empleado",
        "nombre",
        "password_hash",
        "rol_id",
    ]
    assert "id" not in cols
    assert "fecha_fin_contrato" not in cols
    assert "columna_solo_bono" not in cols


def test_resolver_columnas_importables_mapea_password_bono_a_password_hash():
    bono = {"empleado_id", "no_empleado", "nombre", "password", "email"}
    locales = {"empleado_id", "no_empleado", "nombre", "password_hash", "email"}
    cols = resolver_columnas_importables(bono, locales)
    assert "password_hash" in cols
    assert "password" not in cols
    lectura = resolver_columnas_lectura_bono(cols, bono)
    assert "password" in lectura
    assert "password_hash" not in lectura


def test_payload_desde_bono_mapea_password_a_password_hash():
    row = {
        "empleado_id": 1,
        "no_empleado": "100",
        "nombre": "Ana",
        "password": "$2b$12$hashdesdebono",
    }
    payload = _payload_desde_bono(
        row,
        ["empleado_id", "no_empleado", "nombre", "password_hash"],
    )
    assert payload["password_hash"] == "$2b$12$hashdesdebono"


def test_aplicar_payload_actualiza_password_hash_desde_bono():
    empleado = Empleado(
        empleado_id=1,
        no_empleado="100",
        nombre="Ana",
        password_hash="viejo-hash",
        rol_id=1,
    )
    payload = {"password_hash": "$2b$12$nuevo"}
    assert _aplicar_payload(empleado, payload) is True
    assert empleado.password_hash == "$2b$12$nuevo"


def test_validar_fila_ok():
    ok, motivo = _validar_fila(1001)
    assert ok is True
    assert motivo is None


def test_validar_fila_rechaza_sin_empleado_id():
    ok, motivo = _validar_fila(None)
    assert ok is False
    assert motivo == "empleado_id inválido o ausente"


def test_normalizar_empleado_id():
    assert _normalizar_empleado_id({"empleado_id": "42"}) == 42
    assert _normalizar_empleado_id({"empleado_id": None}) is None


def test_payload_desde_bono_copia_lider_id_tal_cual():
    row = {
        "empleado_id": 1,
        "no_empleado": "E-1",
        "nombre": "Ana",
        "password_hash": "$2b$12$hash",
        "rol_id": 3,
        "lider_id": 500,
    }
    payload = _payload_desde_bono(
        row,
        ["empleado_id", "no_empleado", "nombre", "password_hash", "rol_id", "lider_id"],
    )
    assert payload["password_hash"] == "$2b$12$hash"
    assert payload["rol_id"] == 3
    assert payload["lider_id"] == 500


def test_payload_desde_bono_convierte_no_empleado_entero_a_string():
    row = {
        "empleado_id": 2,
        "no_empleado": 108,
        "nombre": "David",
        "email": "david.barraza@leonicables.com",
    }
    payload = _payload_desde_bono(
        row,
        ["empleado_id", "no_empleado", "nombre", "email"],
    )
    assert payload["no_empleado"] == "108"
    assert isinstance(payload["no_empleado"], str)


def test_payload_desde_bono_normaliza_no_empleado_desde_float_excel():
    row = {"empleado_id": 3, "no_empleado": 108.0, "nombre": "Ana"}
    payload = _payload_desde_bono(row, ["empleado_id", "no_empleado", "nombre"])
    assert payload["no_empleado"] == "108"


def test_aplicar_payload_no_cambia_no_empleado_si_es_equivalente():
    empleado = Empleado(
        empleado_id=2,
        no_empleado="108.0",
        nombre="David",
        password_hash="$2b$12$hash",
        rol_id=1,
        email="david.barraza@leonicables.com",
    )
    payload = {
        "no_empleado": "108",
        "email": "david.barraza@leonicables.com",
        "nombre": "David",
    }
    assert _aplicar_payload(empleado, payload) is False
    assert empleado.no_empleado == "108.0"


def test_payload_desde_bono_normaliza_email():
    row = {
        "empleado_id": 2,
        "no_empleado": "108",
        "nombre": "David",
        "email": "  David.Barraza@LeoniCables.com ",
    }
    payload = _payload_desde_bono(
        row,
        ["empleado_id", "no_empleado", "nombre", "email"],
    )
    assert payload["email"] == "david.barraza@leonicables.com"


def test_payload_desde_bono_email_vacio_queda_none():
    row = {"empleado_id": 4, "no_empleado": "109", "nombre": "Sin Mail", "email": "   "}
    payload = _payload_desde_bono(row, ["empleado_id", "no_empleado", "nombre", "email"])
    assert payload["email"] is None


def test_aplicar_payload_actualiza_email_desde_bono():
    empleado = Empleado(
        empleado_id=2,
        no_empleado="108.0",
        nombre="David",
        password_hash="$2b$12$hash",
        rol_id=1,
        email=None,
    )
    payload = {
        "no_empleado": "108",
        "email": "david.barraza@leonicables.com",
        "nombre": "David",
    }
    assert _aplicar_payload(empleado, payload) is True
    assert empleado.email == "david.barraza@leonicables.com"
    assert empleado.no_empleado == "108.0"


def test_aplicar_payload_actualiza_otros_campos_aunque_no_empleado_sea_equivalente():
    empleado = Empleado(
        empleado_id=2,
        no_empleado="108.0",
        nombre="David",
        password_hash="$2b$12$hash",
        rol_id=1,
    )
    payload = {"no_empleado": "108", "nombre": "David Actualizado"}
    assert _aplicar_payload(empleado, payload) is True
    assert empleado.no_empleado == "108.0"
    assert empleado.nombre == "David Actualizado"


def test_payload_desde_bono_normaliza_booleano_si_no():
    row = {
        "empleado_id": 34,
        "no_empleado": "200",
        "nombre": "Restringido",
        "a_restringido": "N",
        "recibe_bono": "S",
        "requiere_cambio_password": "N",
    }
    payload = _payload_desde_bono(
        row,
        [
            "empleado_id",
            "no_empleado",
            "nombre",
            "a_restringido",
            "recibe_bono",
            "requiere_cambio_password",
        ],
    )
    assert payload["a_restringido"] is False
    assert payload["recibe_bono"] is True
    assert payload["requiere_cambio_password"] is False


def test_payload_desde_bono_booleano_vacio_queda_none():
    row = {
        "empleado_id": 35,
        "no_empleado": "201",
        "nombre": "Sin flag",
        "a_restringido": " ",
    }
    payload = _payload_desde_bono(
        row, ["empleado_id", "no_empleado", "nombre", "a_restringido"]
    )
    assert payload["a_restringido"] is None
