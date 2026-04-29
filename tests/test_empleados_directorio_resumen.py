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
        lider_id=sup.id,
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
