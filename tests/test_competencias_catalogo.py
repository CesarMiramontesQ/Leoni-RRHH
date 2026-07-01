# tests/test_competencias_catalogo.py
"""
Tests CRUD del catalogo de Competencias — tipo de competencia.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_competencia, make_tipo_competencia


@pytest.mark.asyncio
async def test_crear_competencia(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="cat_crear@leoni.test")
    tipo = await make_tipo_competencia(db, nombre="Tipo Soldadura", categoria="tecnica")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Soldadura MIG",
        "tipo_competencia_id": tipo.id,
        "descripcion": "Proceso de soldadura con gas inerte",
    }
    resp = await client.post("/api/v1/competencias", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["nombre"] == "Soldadura MIG"
    assert body["categoria"] == "tecnica"
    assert body["tipo_competencia_id"] == tipo.id
    assert body["tipo_nombre"] == "Tipo Soldadura"
    assert body["activo"] is True


@pytest.mark.asyncio
async def test_crear_competencia_duplicada(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="cat_dup@leoni.test")
    tipo = await make_tipo_competencia(db, nombre="Tipo Dup Cat", categoria="blanda")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Competencia Duplicada Cat",
        "tipo_competencia_id": tipo.id,
        "descripcion": "Prueba de duplicado",
    }

    r1 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_listar_competencias(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="cat_list@leoni.test")
    headers = await auth_headers(client, rh)

    await make_competencia(db, nombre="Comp Listar A", categoria="tecnica")
    await make_competencia(db, nombre="Comp Listar B", categoria="blanda")
    await make_competencia(db, nombre="Comp Listar C", categoria="tecnica")

    resp = await client.get("/api/v1/competencias?page=1&page_size=10", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 3


@pytest.mark.asyncio
async def test_actualizar_competencia(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="cat_upd@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await make_competencia(db, nombre="Nombre Original Cat", categoria="tecnica")

    resp = await client.put(
        f"/api/v1/competencias/{comp.id}",
        json={"nombre": "Nombre Actualizado Cat"},
        headers=headers,
    )

    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Nombre Actualizado Cat"


@pytest.mark.asyncio
async def test_crear_competencia_con_tipo(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="cat_tipo@leoni.test")
    tipo = await make_tipo_competencia(db, nombre="Informática Test", categoria="tecnica")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Python Avanzado",
        "tipo_competencia_id": tipo.id,
        "descripcion": "Programacion avanzada en Python",
    }
    resp = await client.post("/api/v1/competencias", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["tipo_competencia_id"] == tipo.id
    assert body["tipo_nombre"] == "Informática Test"
