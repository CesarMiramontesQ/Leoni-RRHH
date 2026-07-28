# tests/test_clasificacion_puesto.py
"""Tests de los catalogos de clasificacion de puesto (Career Path, Funcion, Disciplina)."""

import pytest

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_career_path,
    make_disciplina_puesto,
    make_funcion_puesto,
    make_grado_puesto,
)

BASE = "/api/v1/clasificacion-puesto"


# ── Career Paths ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_career_path_success(client, db):
    rh = await make_empleado(db, rol="rh", email="cp_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/career-paths",
        json={"codigo": "T", "nombre": "Technical", "orden": 7},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["codigo"] == "T"
    assert data["nombre"] == "Technical"
    assert data["orden"] == 7
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_career_path_codigo_duplicado_409(client, db):
    rh = await make_empleado(db, rol="rh", email="cp_dup@leoni.test")
    await make_career_path(db, codigo="P")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/career-paths",
        json={"codigo": "P", "nombre": "Otro", "orden": 50},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_listar_career_paths(client, db):
    rh = await make_empleado(db, rol="rh", email="cp_list@leoni.test")
    await make_career_path(db, codigo="P")
    await make_career_path(db, codigo="M", nombre="Management")
    headers = await auth_headers(client, rh)

    response = await client.get(f"{BASE}/career-paths", headers=headers)

    assert response.status_code == 200
    codigos = [i["codigo"] for i in response.json()["items"]]
    assert "P" in codigos and "M" in codigos


@pytest.mark.asyncio
async def test_eliminar_career_path_con_career_levels_409(client, db):
    rh = await make_empleado(db, rol="rh", email="cp_del@leoni.test")
    career_path = await make_career_path(db, codigo="P")
    await make_grado_puesto(db, nombre="P1", orden=1, career_path_id=career_path.id)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"{BASE}/career-paths/{career_path.id}", headers=headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_empleado_sin_modulo_no_puede_crear_career_path(client, db):
    empleado = await make_empleado(db, rol="empleado", email="cp_emp@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        f"{BASE}/career-paths",
        json={"codigo": "X", "nombre": "Prohibido", "orden": 60},
        headers=headers,
    )

    assert response.status_code in (401, 403)


# ── Funciones ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_funcion_success(client, db):
    rh = await make_empleado(db, rol="rh", email="fn_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/funciones",
        json={"codigo": "ENG", "nombre": "Ingenieria"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["codigo"] == "ENG"


@pytest.mark.asyncio
async def test_crear_funcion_nombre_duplicado_409(client, db):
    rh = await make_empleado(db, rol="rh", email="fn_dup@leoni.test")
    await make_funcion_puesto(db, codigo="QUA", nombre="Calidad")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/funciones",
        json={"codigo": "QUA2", "nombre": "Calidad"},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_funcion_con_disciplinas_409(client, db):
    rh = await make_empleado(db, rol="rh", email="fn_del@leoni.test")
    funcion = await make_funcion_puesto(db)
    await make_disciplina_puesto(db, funcion_id=funcion.id)
    headers = await auth_headers(client, rh)

    response = await client.delete(f"{BASE}/funciones/{funcion.id}", headers=headers)

    assert response.status_code == 409


# ── Disciplinas ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_disciplina_success(client, db):
    rh = await make_empleado(db, rol="rh", email="disc_crear@leoni.test")
    funcion = await make_funcion_puesto(db, codigo="ENG2", nombre="Ingenieria 2")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/disciplinas",
        json={"funcion_id": funcion.id, "nombre": "Automatizacion"},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Automatizacion"
    assert data["funcion_id"] == funcion.id
    assert data["funcion_nombre"] == "Ingenieria 2"


@pytest.mark.asyncio
async def test_crear_disciplina_funcion_inexistente_404(client, db):
    rh = await make_empleado(db, rol="rh", email="disc_404@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/disciplinas",
        json={"funcion_id": 999999, "nombre": "Fantasma"},
        headers=headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mismo_nombre_de_disciplina_en_funciones_distintas(client, db):
    """'Manufactura' puede existir en Ingenieria y en Calidad: la unicidad es por funcion."""
    rh = await make_empleado(db, rol="rh", email="disc_dos@leoni.test")
    funcion_a = await make_funcion_puesto(db, codigo="FA", nombre="Funcion A")
    funcion_b = await make_funcion_puesto(db, codigo="FB", nombre="Funcion B")
    await make_disciplina_puesto(db, funcion_id=funcion_a.id, nombre="Manufactura")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/disciplinas",
        json={"funcion_id": funcion_b.id, "nombre": "Manufactura"},
        headers=headers,
    )
    assert response.status_code == 201

    duplicado = await client.post(
        f"{BASE}/disciplinas",
        json={"funcion_id": funcion_b.id, "nombre": "Manufactura"},
        headers=headers,
    )
    assert duplicado.status_code == 409


@pytest.mark.asyncio
async def test_listar_disciplinas_filtra_por_funcion(client, db):
    rh = await make_empleado(db, rol="rh", email="disc_filtro@leoni.test")
    funcion_a = await make_funcion_puesto(db, codigo="FC", nombre="Funcion C")
    funcion_b = await make_funcion_puesto(db, codigo="FD", nombre="Funcion D")
    await make_disciplina_puesto(db, funcion_id=funcion_a.id, nombre="Disc A")
    await make_disciplina_puesto(db, funcion_id=funcion_b.id, nombre="Disc B")
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"{BASE}/disciplinas?funcion_id={funcion_a.id}", headers=headers
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["nombre"] for i in items] == ["Disc A"]


@pytest.mark.asyncio
async def test_actualizar_disciplina_cambia_de_funcion(client, db):
    rh = await make_empleado(db, rol="rh", email="disc_upd@leoni.test")
    funcion_a = await make_funcion_puesto(db, codigo="FE", nombre="Funcion E")
    funcion_b = await make_funcion_puesto(db, codigo="FF", nombre="Funcion F")
    disciplina = await make_disciplina_puesto(
        db, funcion_id=funcion_a.id, nombre="Movible"
    )
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"{BASE}/disciplinas/{disciplina.id}",
        json={"funcion_id": funcion_b.id, "nombre": "Movible"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["funcion_id"] == funcion_b.id
