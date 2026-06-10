# tests/test_niveles_puesto.py
"""Tests del catalogo de niveles de puesto."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_nivel_puesto, make_puesto_perfil


@pytest.mark.asyncio
async def test_crear_nivel_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="np_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/niveles-puesto",
        json={"nombre": "Especialista"},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Especialista"
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_nivel_puesto_duplicado(client, db):
    rh = await make_empleado(db, rol="rh", email="np_dup@leoni.test")
    await make_nivel_puesto(db, nombre="Operativo Test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/niveles-puesto",
        json={"nombre": "Operativo Test"},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_crear_nivel_puesto_unauthorized(client, db):
    emp = await make_empleado(db, rol="empleado", email="np_noauth@leoni.test")
    headers = await auth_headers(client, emp)

    response = await client.post(
        "/api/v1/niveles-puesto",
        json={"nombre": "Sin permiso"},
        headers=headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_listar_niveles_puesto(client, db):
    rh = await make_empleado(db, rol="rh", email="np_list@leoni.test")
    await make_nivel_puesto(db, nombre="Nivel List A")
    await make_nivel_puesto(db, nombre="Nivel List B")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/niveles-puesto", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2
    assert len(body["items"]) >= 2


@pytest.mark.asyncio
async def test_actualizar_nivel_puesto(client, db):
    rh = await make_empleado(db, rol="rh", email="np_upd@leoni.test")
    nivel = await make_nivel_puesto(db, nombre="Antes Update")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/niveles-puesto/{nivel.id}",
        json={"nombre": "Despues Update"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["nombre"] == "Despues Update"


@pytest.mark.asyncio
async def test_eliminar_nivel_puesto_en_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="np_del_use@leoni.test")
    nivel = await make_nivel_puesto(db, nombre="Nivel En Uso")
    await make_puesto_perfil(db, nombre="Perfil con nivel", nivel_id=nivel.id)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/niveles-puesto/{nivel.id}",
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_nivel_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="np_del_ok@leoni.test")
    nivel = await make_nivel_puesto(db, nombre="Nivel Libre")
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/niveles-puesto/{nivel.id}",
        headers=headers,
    )

    assert response.status_code == 204

    get_resp = await client.get(
        f"/api/v1/niveles-puesto/{nivel.id}",
        headers=headers,
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_puesto_sin_nivel_id(client, db):
    rh = await make_empleado(db, rol="rh", email="np_no_nivel@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={"nombre": "Perfil sin nivel"},
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_puesto_nivel_inexistente(client, db):
    rh = await make_empleado(db, rol="rh", email="np_bad_nivel@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={"nombre": "Perfil mal nivel", "nivel_id": 999999},
        headers=headers,
    )

    assert response.status_code == 404
