import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_listar_instructores_internos_sin_auth_401(client: AsyncClient):
    resp = await client.get("/api/v1/level-up/catalogos/instructores-internos")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_crear_instructor_interno_rh_201(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_inst_int1@leoni.test")
    instructor = await make_empleado(db, rol="empleado", email="inst_int1@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.post(
        "/api/v1/level-up/catalogos/instructores-internos",
        json={"empleado_id": instructor.empleado_id, "especialidad": "Seguridad industrial"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["empleado_id"] == instructor.empleado_id
    assert data["nombre_empleado"] == instructor.nombre
    assert data["especialidad"] == "Seguridad industrial"
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_instructor_interno_duplicado_409(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="rh_inst_int2@leoni.test")
    instructor = await make_empleado(db, rol="empleado", email="inst_int2@leoni.test")
    headers = await auth_headers(client, rh)
    payload = {"empleado_id": instructor.empleado_id}

    resp1 = await client.post(
        "/api/v1/level-up/catalogos/instructores-internos",
        json=payload,
        headers=headers,
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        "/api/v1/level-up/catalogos/instructores-internos",
        json=payload,
        headers=headers,
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_desactivar_y_reactivar_instructor_interno(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="rh_inst_int3@leoni.test")
    instructor = await make_empleado(db, rol="empleado", email="inst_int3@leoni.test")
    headers = await auth_headers(client, rh)

    create_resp = await client.post(
        "/api/v1/level-up/catalogos/instructores-internos",
        json={"empleado_id": instructor.empleado_id, "especialidad": "Lean"},
        headers=headers,
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    delete_resp = await client.delete(
        f"/api/v1/level-up/catalogos/instructores-internos/{item_id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    reactivate_resp = await client.post(
        "/api/v1/level-up/catalogos/instructores-internos",
        json={"empleado_id": instructor.empleado_id, "especialidad": "Lean Six Sigma"},
        headers=headers,
    )
    assert reactivate_resp.status_code == 201
    data = reactivate_resp.json()
    assert data["id"] == item_id
    assert data["especialidad"] == "Lean Six Sigma"
    assert data["activo"] is True
