# tests/test_categorias_tarea.py
"""Tests del catalogo de categorias de tarea."""

import pytest

from app.models.talento import TareaCatalogo
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_categoria_tarea

BASE = "/api/v1/categorias-tarea"


@pytest.mark.asyncio
async def test_crear_categoria_tarea_success(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        BASE, json={"nombre": "Operativa"}, headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Operativa"
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_categoria_tarea_duplicada_409(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_dup@leoni.test")
    await make_categoria_tarea(db, nombre="Estrategica")
    headers = await auth_headers(client, rh)

    response = await client.post(
        BASE, json={"nombre": "Estrategica"}, headers=headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_listar_categorias_tarea(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_list@leoni.test")
    await make_categoria_tarea(db, nombre="Cat A")
    await make_categoria_tarea(db, nombre="Cat B")
    headers = await auth_headers(client, rh)

    response = await client.get(BASE, headers=headers)

    assert response.status_code == 200
    nombres = [i["nombre"] for i in response.json()["items"]]
    assert "Cat A" in nombres and "Cat B" in nombres


@pytest.mark.asyncio
async def test_actualizar_categoria_tarea(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_upd@leoni.test")
    categoria = await make_categoria_tarea(db, nombre="Vieja")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"{BASE}/{categoria.id}", json={"nombre": "Nueva"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["nombre"] == "Nueva"


@pytest.mark.asyncio
async def test_eliminar_categoria_tarea_en_uso_409(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_del@leoni.test")
    categoria = await make_categoria_tarea(db, nombre="En Uso")
    db.add(
        TareaCatalogo(
            nombre="Tarea con categoria",
            categoria_tarea_id=categoria.id,
            activo=True,
        )
    )
    await db.flush()
    headers = await auth_headers(client, rh)

    response = await client.delete(f"{BASE}/{categoria.id}", headers=headers)

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_categoria_tarea_libre_204(client, db):
    rh = await make_empleado(db, rol="rh", email="ct_del_ok@leoni.test")
    categoria = await make_categoria_tarea(db, nombre="Libre")
    headers = await auth_headers(client, rh)

    response = await client.delete(f"{BASE}/{categoria.id}", headers=headers)

    assert response.status_code == 204

    detalle = await client.get(f"{BASE}/{categoria.id}", headers=headers)
    assert detalle.status_code == 404


@pytest.mark.asyncio
async def test_empleado_sin_modulo_no_puede_crear_categoria(client, db):
    empleado = await make_empleado(db, rol="empleado", email="ct_emp@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        BASE, json={"nombre": "Prohibida"}, headers=headers
    )

    assert response.status_code in (401, 403)
