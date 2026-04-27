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
