# tests/test_tipos_competencia.py
"""Tests del catalogo de tipos de competencia."""

import pytest

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_competencia, make_grupo_competencia, make_tipo_competencia


@pytest.mark.asyncio
async def test_crear_tipo_competencia_success(client, db):
    rh = await make_empleado(db, rol="rh", email="tc_crear@leoni.test")
    grupo = await make_grupo_competencia(db, nombre="Técnica")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/tipos-competencia",
        json={"nombre": "Certificaciones", "grupo_competencia_id": grupo.id},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Certificaciones"
    assert data["grupo_competencia_id"] == grupo.id
    assert data["grupo_nombre"] == "Técnica"


@pytest.mark.asyncio
async def test_crear_tipo_competencia_duplicado(client, db):
    rh = await make_empleado(db, rol="rh", email="tc_dup@leoni.test")
    await make_tipo_competencia(db, nombre="Tipo Duplicado")
    grupo = await make_grupo_competencia(db)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/tipos-competencia",
        json={"nombre": "Tipo Duplicado", "grupo_competencia_id": grupo.id},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_tipo_competencia_en_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="tc_del@leoni.test")
    tipo = await make_tipo_competencia(db, nombre="Tipo En Uso")
    await make_competencia(db, nombre="Comp En Uso", tipo_competencia_id=tipo.id)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/tipos-competencia/{tipo.id}",
        headers=headers,
    )

    assert response.status_code == 409
