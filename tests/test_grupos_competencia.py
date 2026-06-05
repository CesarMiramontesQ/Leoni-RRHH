# tests/test_grupos_competencia.py
"""Tests del catalogo de grupos de competencia."""

import pytest

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_grupo_competencia, make_tipo_competencia


@pytest.mark.asyncio
async def test_crear_grupo_competencia_success(client, db):
    rh = await make_empleado(db, rol="rh", email="gc_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/grupos-competencia",
        json={"nombre": "Liderazgo", "categoria": "blanda"},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Liderazgo"
    assert data["categoria"] == "blanda"


@pytest.mark.asyncio
async def test_crear_grupo_competencia_duplicado(client, db):
    rh = await make_empleado(db, rol="rh", email="gc_dup@leoni.test")
    await make_grupo_competencia(db, nombre="Grupo Duplicado")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/grupos-competencia",
        json={"nombre": "Grupo Duplicado", "categoria": "tecnica"},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_grupo_competencia_en_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="gc_del@leoni.test")
    grupo = await make_grupo_competencia(db, nombre="Grupo En Uso")
    await make_tipo_competencia(db, nombre="Tipo En Grupo", grupo_competencia_id=grupo.id)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/grupos-competencia/{grupo.id}",
        headers=headers,
    )

    assert response.status_code == 409
