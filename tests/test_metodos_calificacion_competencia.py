# tests/test_metodos_calificacion_competencia.py
"""Tests del catalogo de metodos de calificacion de competencias."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    ensure_metodos_calificacion_competencia,
    make_competencia,
    make_competencia_requisito,
    make_puesto_perfil,
)


@pytest.mark.asyncio
async def test_listar_metodos_calificacion_competencia(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_list@leoni.test")
    await ensure_metodos_calificacion_competencia(db)
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/metodos-calificacion-competencia",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    nombres = {item["nombre"] for item in body["items"]}
    assert "Planeado" in nombres
    assert "Experto" in nombres


@pytest.mark.asyncio
async def test_crear_metodo_calificacion_competencia(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_create@leoni.test")
    await ensure_metodos_calificacion_competencia(db)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/metodos-calificacion-competencia",
        json={"nombre": "Maestro", "orden": 5},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Maestro"
    assert data["orden"] == 5
    assert data["valor"] == 5
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_desactivar_metodo_sin_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_del@leoni.test")
    metodos = await ensure_metodos_calificacion_competencia(db)
    metodo = next(m for m in metodos if m.valor == 4)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/metodos-calificacion-competencia/{metodo.id}",
        headers=headers,
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_desactivar_metodo_en_uso_falla(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_del_use@leoni.test")
    metodos = await ensure_metodos_calificacion_competencia(db)
    metodo = next(m for m in metodos if m.valor == 3)
    perfil = await make_puesto_perfil(db, nombre="Perfil MCC uso")
    comp = await make_competencia(db, nombre="Comp uso MCC", categoria="tecnica")
    await make_competencia_requisito(
        db,
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        nivel_requerido=3,
    )
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/metodos-calificacion-competencia/{metodo.id}",
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_actualizar_metodo_calificacion_competencia(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_upd@leoni.test")
    metodos = await ensure_metodos_calificacion_competencia(db)
    metodo = next(m for m in metodos if m.valor == 1)
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/metodos-calificacion-competencia/{metodo.id}",
        json={"nombre": "Planeado actualizado", "orden": 1},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nombre"] == "Planeado actualizado"
    assert data["valor"] == 1


@pytest.mark.asyncio
async def test_actualizar_metodo_duplicado_nombre(client, db):
    rh = await make_empleado(db, rol="rh", email="mcc_dup@leoni.test")
    metodos = await ensure_metodos_calificacion_competencia(db)
    metodo = next(m for m in metodos if m.valor == 1)
    otro = next(m for m in metodos if m.valor == 2)
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/metodos-calificacion-competencia/{metodo.id}",
        json={"nombre": otro.nombre, "orden": 1},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_multihabilidades_incluye_metodos_calificacion(client: AsyncClient, db):
    """La matriz de multihabilidad expone los metodos de calificacion actualizados."""
    rh = await make_empleado(db, rol="rh", email="mcc_matriz@leoni.test")
    metodos = await ensure_metodos_calificacion_competencia(db)
    metodo = next(m for m in metodos if m.valor == 3)
    metodo.nombre = "Certificado Plus"
    await db.flush()

    perfil = await make_puesto_perfil(db, nombre="Perfil Matriz MCC")
    comp = await make_competencia(db, nombre="Comp Matriz MCC", categoria="tecnica")
    await make_competencia_requisito(
        db,
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        nivel_requerido=3,
    )
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/competencias/multihabilidades?puesto_perfil_id={perfil.id}",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["metodos_calificacion"]) == 4
    certificado = next(m for m in data["metodos_calificacion"] if m["valor"] == 3)
    assert certificado["nombre"] == "Certificado Plus"
