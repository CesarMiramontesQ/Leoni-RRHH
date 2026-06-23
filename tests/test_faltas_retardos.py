"""Tests del módulo Faltas y retardos."""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_list_faltas_retardos_vacio(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Faltas")
    headers = await auth_headers(client, rh)
    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["items"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_create_falta_retardo_retardo(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Creador")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Afectado")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "retardo",
            "fecha_evento": "2026-06-20",
            "observaciones": "Llegó 15 min tarde",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["empleado_id"] == empleado.empleado_id
    assert data["tipo"] == "retardo"
    assert data["fecha_evento"] == "2026-06-20"
    assert data["registrado_por_id"] == rh.empleado_id


@pytest.mark.asyncio
async def test_create_incapacidad_requiere_fecha_fin(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Validacion")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Incap")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "incapacidad",
            "fecha_evento": "2026-06-01",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_incapacidad_con_rango(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Incap")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Rango")
    headers = await auth_headers(client, rh)

    res = await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "incapacidad",
            "fecha_evento": "2026-06-01",
            "fecha_fin": "2026-06-05",
            "observaciones": "Incapacidad IMSS",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["fecha_fin"] == "2026-06-05"


@pytest.mark.asyncio
async def test_list_con_filtro_busqueda(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Filtro")
    empleado = await make_empleado(db, rol="empleado", nombre="JUAN PEREZ LOPEZ")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/faltas-retardos",
        headers=headers,
        json={
            "empleado_id": empleado.empleado_id,
            "tipo": "falta_injustificada",
            "fecha_evento": str(date.today()),
        },
    )

    res = await client.get(
        "/api/v1/faltas-retardos?busqueda=JUAN",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["total"] >= 1
