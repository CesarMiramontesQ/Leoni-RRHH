"""RH: alta de comedores."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

CREAR_COMEDOR_URL = "/api/v1/comedor/comedores"


@pytest.mark.asyncio
async def test_crear_comedor_rh_ok(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_comedor_crear@test.leoni", password="RhC0med0r!")
    hdrs = await auth_headers(client, rh, password="RhC0med0r!")
    r = await client.post(
        CREAR_COMEDOR_URL,
        json={
            "nombre": "Comedor prueba RH",
            "ubicacion": "Planta 2",
            "capacidad": 80,
            "activo": True,
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nombre"] == "Comedor prueba RH"
    assert body["activo"] is True
    assert body["id"] >= 1


@pytest.mark.asyncio
async def test_crear_comedor_empleado_403(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="emp_comedor_crear@test.leoni", password="EmpC0m!")
    hdrs = await auth_headers(client, emp, password="EmpC0m!")
    r = await client.post(
        CREAR_COMEDOR_URL,
        json={"nombre": "No debe existir", "activo": True},
        headers=hdrs,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_editar_comedor_rh_ok(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_comedor_editar@test.leoni", password="RhEditC0m!")
    hdrs = await auth_headers(client, rh, password="RhEditC0m!")
    creado = await client.post(
        CREAR_COMEDOR_URL,
        json={
            "nombre": "Comedor a editar",
            "ubicacion": "Planta baja",
            "capacidad": 100,
            "activo": True,
        },
        headers=hdrs,
    )
    assert creado.status_code == 200, creado.text
    comedor_id = creado.json()["id"]

    actualizado = await client.put(
        f"{CREAR_COMEDOR_URL}/{comedor_id}",
        json={
            "nombre": "Comedor editado RH",
            "ubicacion": "Planta alta",
            "capacidad": 120,
            "activo": False,
        },
        headers=hdrs,
    )
    assert actualizado.status_code == 200, actualizado.text
    body = actualizado.json()
    assert body["id"] == comedor_id
    assert body["nombre"] == "Comedor editado RH"
    assert body["ubicacion"] == "Planta alta"
    assert body["capacidad"] == 120
    assert body["activo"] is False


@pytest.mark.asyncio
async def test_editar_comedor_empleado_403(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_comedor_base@test.leoni", password="RhBaseC0m!")
    hdrs_rh = await auth_headers(client, rh, password="RhBaseC0m!")
    creado = await client.post(
        CREAR_COMEDOR_URL,
        json={"nombre": "Comedor protegido", "activo": True},
        headers=hdrs_rh,
    )
    assert creado.status_code == 200, creado.text
    comedor_id = creado.json()["id"]

    emp = await make_empleado(db, rol="empleado", email="emp_comedor_editar@test.leoni", password="EmpEditC0m!")
    hdrs_emp = await auth_headers(client, emp, password="EmpEditC0m!")
    r = await client.put(
        f"{CREAR_COMEDOR_URL}/{comedor_id}",
        json={"nombre": "Intento inválido", "ubicacion": None, "capacidad": 10, "activo": True},
        headers=hdrs_emp,
    )
    assert r.status_code == 403
