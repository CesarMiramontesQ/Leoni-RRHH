"""Resumen de directorio: métricas por alcance (supervisor/gerente) y contratos por vencer."""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_resumen_supervisor_colaboradores_y_contratos_en_equipo(
    client: AsyncClient, db
):
    hoy = date.today()
    fin_contrato = hoy + timedelta(days=12)

    sup = await make_empleado(
        db,
        rol="supervisor",
        email="sup_resumen@leoni.test",
        empleado_id=91001,
        no_empleado="SUP-R-01",
        estado_id=1,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="sub_resumen@leoni.test",
        empleado_id=91002,
        no_empleado="SUB-R-01",
        estado_id=1,
        lider_id=sup.empleado_id,
        fecha_fin_contrato=fin_contrato,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="otro_resumen@leoni.test",
        empleado_id=91003,
        no_empleado="OTR-R-01",
        estado_id=1,
        lider_id=None,
        fecha_fin_contrato=fin_contrato,
    )

    headers = await auth_headers(client, sup)
    response = await client.get("/api/v1/empleados/resumen", headers=headers)

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["colaboradores_total"] == 2
    assert data["contratos_por_vencer"] == 1


@pytest.mark.asyncio
async def test_list_directorio_filtro_estatus_permiso_supervisor(client: AsyncClient, db):
    sup = await make_empleado(
        db,
        rol="supervisor",
        email="sup_perm@leoni.test",
        empleado_id=92001,
        no_empleado="SUP-P-01",
        estado_id=1,
    )
    suspendido = await make_empleado(
        db,
        rol="empleado",
        email="sub_perm@leoni.test",
        empleado_id=92002,
        no_empleado="SUB-P-01",
        estado_id=3,
        lider_id=sup.empleado_id,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="sub_act@leoni.test",
        empleado_id=92003,
        no_empleado="SUB-P-A",
        estado_id=1,
        lider_id=sup.empleado_id,
    )

    headers = await auth_headers(client, sup)
    response = await client.get(
        "/api/v1/empleados",
        params={"estatus": "permiso", "page_size": 50},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    ids = {item["id"] for item in response.json()["items"]}
    assert suspendido.id in ids
    assert sup.id not in ids
