"""Tests del módulo Viajes laborales."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

VIAJE_PAYLOAD = {
    "fecha_salida": "2026-08-01",
    "fecha_regreso": "2026-08-05",
    "lugar_origen": "Cuauhtémoc, Chihuahua",
    "lugar_destino": "Ciudad de México",
    "motivo": "Capacitación técnica",
    "descripcion": "Curso de certificación",
    "medio_transporte": "Avión",
    "hospedaje": "Hotel corporativo",
    "viaticos_estimados": 8500.50,
}


@pytest.mark.asyncio
async def test_create_viaje_laboral_borrador(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Viajes")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Uno")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["empleado_id"] == empleado.empleado_id
    assert data["estado"] == "borrador"
    assert data["lugar_destino"] == "Ciudad de México"
    assert data["registrado_por_id"] == rh.empleado_id


@pytest.mark.asyncio
async def test_create_viaje_fecha_regreso_invalida(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Validacion")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Dos")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            **VIAJE_PAYLOAD,
            "fecha_salida": "2026-08-10",
            "fecha_regreso": "2026-08-05",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_flujo_borrador_pendiente_aprobado(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Aprobador")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Tres")
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )
    assert create.status_code == 201
    viaje_id = create.json()["id"]

    enviar = await client.put(
        f"/api/v1/viajes-laborales/{viaje_id}/enviar",
        headers=headers,
    )
    assert enviar.status_code == 200
    assert enviar.json()["estado"] == "pendiente"

    aprobar = await client.put(
        f"/api/v1/viajes-laborales/{viaje_id}/aprobar",
        headers=headers,
    )
    assert aprobar.status_code == 200
    assert aprobar.json()["estado"] == "aprobado"
    assert aprobar.json()["aprobado_por_id"] == rh.empleado_id


@pytest.mark.asyncio
async def test_rechazar_requiere_motivo(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Rechazo")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Cuatro")
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )
    viaje_id = create.json()["id"]
    await client.put(f"/api/v1/viajes-laborales/{viaje_id}/enviar", headers=headers)

    rechazar = await client.put(
        f"/api/v1/viajes-laborales/{viaje_id}/rechazar",
        headers=headers,
        json={"motivo_rechazo": "Presupuesto no autorizado"},
    )
    assert rechazar.status_code == 200
    assert rechazar.json()["estado"] == "rechazado"
    assert rechazar.json()["motivo_rechazo"] == "Presupuesto no autorizado"


@pytest.mark.asyncio
async def test_supervisor_fuera_alcance_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", nombre="Supervisor Viajes")
    subordinado = await make_empleado(
        db, rol="empleado", nombre="Subordinado", lider_id=supervisor.empleado_id
    )
    ajeno = await make_empleado(db, rol="empleado", nombre="Ajeno")
    headers = await auth_headers(client, supervisor)

    res = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": ajeno.empleado_id, **VIAJE_PAYLOAD},
    )
    assert res.status_code == 403

    ok = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": subordinado.empleado_id, **VIAJE_PAYLOAD},
    )
    assert ok.status_code == 201, ok.text


@pytest.mark.asyncio
async def test_delete_solo_borrador(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Delete")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Cinco")
    headers = await auth_headers(client, rh)

    create = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )
    viaje_id = create.json()["id"]

    delete_ok = await client.delete(
        f"/api/v1/viajes-laborales/{viaje_id}",
        headers=headers,
    )
    assert delete_ok.status_code == 204

    create2 = await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )
    viaje_id2 = create2.json()["id"]
    await client.put(f"/api/v1/viajes-laborales/{viaje_id2}/enviar", headers=headers)

    delete_fail = await client.delete(
        f"/api/v1/viajes-laborales/{viaje_id2}",
        headers=headers,
    )
    assert delete_fail.status_code == 409


@pytest.mark.asyncio
async def test_list_viajes_con_filtros(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Lista")
    empleado = await make_empleado(db, rol="empleado", nombre="Viajero Seis")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/viajes-laborales",
        headers=headers,
        json={"empleado_id": empleado.empleado_id, **VIAJE_PAYLOAD},
    )

    res = await client.get(
        "/api/v1/viajes-laborales",
        headers=headers,
        params={
            "empleado_id": empleado.empleado_id,
            "destino": "México",
            "estado": "borrador",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert all(item["estado"] == "borrador" for item in data["items"])
