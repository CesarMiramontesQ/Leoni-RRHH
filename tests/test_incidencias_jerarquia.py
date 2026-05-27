"""Alcance de incidencias por rol: gerente ve subárbol completo; supervisor solo reportes directos."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_incidencia


@pytest.mark.asyncio
async def test_listar_incidencias_gerente_incluye_subarbol(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="inc_jer_g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer_s@leoni.test", lider_id=gerente.id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="inc_jer_e@leoni.test", lider_id=supervisor.id
    )
    incidencia = await make_incidencia(db, empleado_id=empleado.id)

    headers = await auth_headers(client, gerente)
    response = await client.get("/api/v1/incidencias", headers=headers)
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert incidencia.id in ids


@pytest.mark.asyncio
async def test_listar_incidencias_supervisor_solo_reportes_directos(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="inc_jer2_g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer2_s@leoni.test", lider_id=gerente.id
    )
    otro_supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer2_s2@leoni.test", lider_id=gerente.id
    )
    empleado_indirecto = await make_empleado(
        db, rol="empleado", email="inc_jer2_e@leoni.test", lider_id=otro_supervisor.id
    )
    incidencia_indirecta = await make_incidencia(db, empleado_id=empleado_indirecto.id)

    headers = await auth_headers(client, supervisor)
    response = await client.get("/api/v1/incidencias", headers=headers)
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert incidencia_indirecta.id not in ids
