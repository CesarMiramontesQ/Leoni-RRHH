# tests/test_grados_puesto.py
"""Tests del catalogo de grados de puesto."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    get_default_grado,
    make_competencia,
    make_competencia_requisito,
    make_grado_puesto,
    make_perfil_funciones,
    make_puesto_perfil,
)


@pytest.mark.asyncio
async def test_crear_grado_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/grados-puesto",
        json={"nombre": "Grado Especial", "orden": 10},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Grado Especial"
    assert data["orden"] == 10
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_grado_puesto_duplicado_nombre(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_dup@leoni.test")
    await make_grado_puesto(db, nombre="Grado Dup Test", orden=11)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/grados-puesto",
        json={"nombre": "Grado Dup Test", "orden": 12},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_listar_grados_puesto(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_list@leoni.test")
    await make_grado_puesto(db, nombre="Grado List A", orden=21)
    await make_grado_puesto(db, nombre="Grado List B", orden=22)
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/grados-puesto", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2


@pytest.mark.asyncio
async def test_eliminar_grado_puesto_en_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_del_use@leoni.test")
    grado = await make_grado_puesto(db, nombre="Grado En Uso", orden=31)
    perfil = await make_puesto_perfil(db, nombre="Perfil con grado")
    comp = await make_competencia(db, nombre="Comp Grado", categoria="tecnica")
    await make_competencia_requisito(
        db,
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
    )
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/grados-puesto/{grado.id}",
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_grado_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_del_ok@leoni.test")
    grado = await make_grado_puesto(db, nombre="Grado Libre", orden=41)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/grados-puesto/{grado.id}",
        headers=headers,
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_competencias_por_grado_y_gap_filtrado(client: AsyncClient, db):
    """Requisitos distintos por grado y gap filtrado por grado de asignacion."""
    rh = await make_empleado(db, rol="rh", email="gp_gap@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="gp_emp@leoni.test")
    headers = await auth_headers(client, rh)

    grado1 = await get_default_grado(db)
    grado2 = await make_grado_puesto(db, nombre="Grado 2 Test", orden=2)
    perfil = await make_puesto_perfil(db, nombre="Puesto Grados")
    comp1 = await make_competencia(db, nombre="Comp G1", categoria="tecnica")
    comp2 = await make_competencia(db, nombre="Comp G2", categoria="tecnica")

    await make_competencia_requisito(
        db, competencia_id=comp1.id, puesto_perfil_id=perfil.id, grado_id=grado1.id
    )
    await make_competencia_requisito(
        db, competencia_id=comp2.id, puesto_perfil_id=perfil.id, grado_id=grado2.id
    )

    asignacion = await make_perfil_funciones(
        db,
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        grado_id=grado2.id,
    )

    resp_g1 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado1.id}",
        headers=headers,
    )
    resp_g2 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado2.id}",
        headers=headers,
    )
    assert resp_g1.status_code == 200
    assert resp_g2.status_code == 200
    assert len(resp_g1.json()) == 1
    assert len(resp_g2.json()) == 1
    assert resp_g1.json()[0]["competencia_nombre"] == "Comp G1"
    assert resp_g2.json()[0]["competencia_nombre"] == "Comp G2"

    gap_resp = await client.get(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        headers=headers,
    )
    assert gap_resp.status_code == 200
    gap = gap_resp.json()
    assert len(gap["gap_competencias"]) == 1
    assert gap["gap_competencias"][0]["competencia_nombre"] == "Comp G2"
    assert gap["asignacion"]["grado_id"] == grado2.id


@pytest.mark.asyncio
async def test_sync_competencias_no_borra_otro_grado(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="gp_sync@leoni.test")
    headers = await auth_headers(client, rh)

    grado1 = await get_default_grado(db)
    grado2 = await make_grado_puesto(db, nombre="Grado 2 Sync", orden=3)
    perfil = await make_puesto_perfil(db, nombre="Puesto Sync Grado")
    from tests.conftest_talento import make_tipo_competencia

    tipo = await make_tipo_competencia(db, nombre="Tipo Sync Grado")
    tipo_id = tipo.id
    comp_a = await make_competencia(
        db, nombre="Sync A", categoria="tecnica", tipo_competencia_id=tipo_id
    )
    comp_b = await make_competencia(
        db, nombre="Sync B", categoria="tecnica", tipo_competencia_id=tipo_id
    )

    await make_competencia_requisito(
        db, competencia_id=comp_a.id, puesto_perfil_id=perfil.id, grado_id=grado1.id
    )
    await make_competencia_requisito(
        db, competencia_id=comp_b.id, puesto_perfil_id=perfil.id, grado_id=grado2.id
    )

    sync_resp = await client.put(
        f"/api/v1/perfiles/{perfil.id}/competencias/sync",
        json={
            "grado_id": grado1.id,
            "tipo_competencia_id": tipo_id,
            "competencias": [{"competencia_id": comp_a.id, "nivel_requerido": 2}],
        },
        headers=headers,
    )
    assert sync_resp.status_code == 200

    still_g2 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado2.id}",
        headers=headers,
    )
    assert still_g2.status_code == 200
    assert len(still_g2.json()) == 1
    assert still_g2.json()[0]["competencia_id"] == comp_b.id
