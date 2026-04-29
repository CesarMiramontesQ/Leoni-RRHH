# tests/test_directorio_jerarquia.py
"""Directorio según rol: gerente ve subárbol completo; supervisor solo reportes directos."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_directorio_gerente_cuenta_subarbol_completo(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", nombre="Ger Test", empleado_id=91001, no_empleado="DIR-G-1")
    sup = await make_empleado(
        db,
        rol="supervisor",
        nombre="Sup Test",
        lider_id=gerente.id,
        empleado_id=91002,
        no_empleado="DIR-S-1",
    )
    emp = await make_empleado(
        db,
        rol="empleado",
        nombre="Emp Test",
        lider_id=sup.id,
        empleado_id=91003,
        no_empleado="DIR-E-1",
    )
    await make_empleado(db, rol="empleado", nombre="Otro", empleado_id=91004, no_empleado="DIR-X-1")

    headers = await auth_headers(client, gerente)
    response = await client.get(
        "/api/v1/empleados",
        params={"activo": "true", "page": "1", "page_size": "1"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["total"] == 3
    ids = {sup.id, emp.id, gerente.id}
    first = response.json()["items"][0]
    assert first["id"] in ids


@pytest.mark.asyncio
async def test_directorio_supervisor_cuenta_solo_directos(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", nombre="Ger2", empleado_id=91011, no_empleado="DIR2-G")
    sup = await make_empleado(
        db,
        rol="supervisor",
        nombre="Sup2",
        lider_id=gerente.id,
        empleado_id=91012,
        no_empleado="DIR2-S",
    )
    await make_empleado(
        db,
        rol="empleado",
        nombre="Emp2",
        lider_id=sup.id,
        empleado_id=91013,
        no_empleado="DIR2-E",
    )

    headers = await auth_headers(client, sup)
    response = await client.get(
        "/api/v1/empleados",
        params={"activo": "true", "page": "1", "page_size": "10"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["total"] == 2
