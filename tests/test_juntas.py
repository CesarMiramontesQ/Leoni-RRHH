"""Tests del modulo Juntas (Level Up / Cursos).

Cubren el flujo: crear junta con asistentes, listar (conteo), detalle (lista de
asistentes cargada sin MissingGreenlet) y control de acceso por rol.
"""

import pytest

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_crear_junta_con_asistentes(client, db):
    rh = await make_empleado(db, rol="rh", email="junta_crear@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="junta_a1@leoni.test", nombre="Ana Lopez")
    emp2 = await make_empleado(db, rol="empleado", email="junta_a2@leoni.test", nombre="Beto Ruiz")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/juntas",
        json={
            "nombre": "Junta de seguridad mensual",
            "motivo": "Revisar incidentes del mes",
            "categoria": "Seguridad",
            "asistente_ids": [emp1.empleado_id, emp2.empleado_id],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nombre"] == "Junta de seguridad mensual"
    assert body["categoria"] == "Seguridad"
    assert body["estado"] == "registrada"
    assert body["asistentes_count"] == 2
    nombres = {a["nombre"] for a in body["asistentes"]}
    assert nombres == {"Ana Lopez", "Beto Ruiz"}


@pytest.mark.asyncio
async def test_crear_junta_ignora_asistentes_inexistentes(client, db):
    rh = await make_empleado(db, rol="rh", email="junta_ign@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="junta_ign_a1@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/juntas",
        json={
            "nombre": "Junta sin uno",
            "asistente_ids": [emp1.empleado_id, 99999999],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["asistentes_count"] == 1


@pytest.mark.asyncio
async def test_listar_juntas(client, db):
    rh = await make_empleado(db, rol="rh", email="junta_list@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="junta_list_a1@leoni.test")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/juntas",
        json={"nombre": "Junta A", "categoria": "Calidad", "asistente_ids": [emp1.empleado_id]},
        headers=headers,
    )

    response = await client.get("/api/v1/juntas", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] >= 1
    junta = next(j for j in body["items"] if j["nombre"] == "Junta A")
    assert junta["asistentes_count"] == 1
    assert junta["categoria"] == "Calidad"
    assert "created_at" in junta


@pytest.mark.asyncio
async def test_detalle_junta(client, db):
    rh = await make_empleado(db, rol="rh", email="junta_det@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="junta_det_a1@leoni.test", nombre="Carla Diaz")
    headers = await auth_headers(client, rh)

    created = await client.post(
        "/api/v1/juntas",
        json={"nombre": "Junta detalle", "asistente_ids": [emp1.empleado_id]},
        headers=headers,
    )
    junta_id = created.json()["id"]

    response = await client.get(f"/api/v1/juntas/{junta_id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == junta_id
    assert len(body["asistentes"]) == 1
    assert body["asistentes"][0]["nombre"] == "Carla Diaz"
    assert body["asistentes"][0]["empleado_id"] == emp1.empleado_id


@pytest.mark.asyncio
async def test_junta_no_encontrada(client, db):
    rh = await make_empleado(db, rol="rh", email="junta_404@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/juntas/99999999", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_crear_junta_sin_permisos(client, db):
    emp = await make_empleado(db, rol="empleado", email="junta_noauth@leoni.test")
    headers = await auth_headers(client, emp)

    response = await client.post(
        "/api/v1/juntas",
        json={"nombre": "Junta prohibida", "asistente_ids": []},
        headers=headers,
    )
    assert response.status_code == 403
