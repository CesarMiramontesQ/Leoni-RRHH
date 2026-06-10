"""Listado de Horas Extra: empleados reales con centro de costo y líder."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_horas_extra_lista_empleados_reales_con_centro_costo(
    client: AsyncClient, db, empleado_rh
):
    lider = await make_empleado(
        db,
        rol="supervisor",
        email="he_lider@leoni.test",
        empleado_id=99001,
        no_empleado="HE-LIDER",
        nombre="Fernando Aguirre Lozano",
    )
    con_cc = await make_empleado(
        db,
        rol="empleado",
        email="he_cc@leoni.test",
        empleado_id=99002,
        no_empleado="HE-001",
        nombre="María López García",
        lider_id=lider.empleado_id,
    )
    con_cc.centrocosto_id = 301
    await db.flush()

    sin_cc = await make_empleado(
        db,
        rol="empleado",
        email="he_sin@leoni.test",
        empleado_id=99003,
        no_empleado="HE-002",
        nombre="Pedro Sin Centro",
        lider_id=lider.empleado_id,
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get("/api/v1/nominas/horas-extra", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["semana_actual"] == 19
    assert "resumen" in data
    assert "tabs" in data
    assert "filter_options" in data

    numeros = {item["empleado"]["no_empleado"] for item in data["items"]}
    assert "HE-001" in numeros
    assert "HE-002" not in numeros

    fila = next(i for i in data["items"] if i["empleado"]["no_empleado"] == "HE-001")
    assert fila["empleado"]["centrocosto_id"] == 301
    assert fila["empleado"]["lider"]["nombre"] == "Fernando Aguirre Lozano"
    assert fila["empleado"]["lider"]["empleado_id"] == lider.empleado_id
    assert fila["simulado"]["semana"] == 19
    assert fila["simulado"]["estado_aprobacion"] in ("pendiente", "aprobado", "rechazado")

    response2 = await client.get("/api/v1/nominas/horas-extra", headers=headers)
    fila2 = next(
        i for i in response2.json()["items"] if i["empleado"]["no_empleado"] == "HE-001"
    )
    assert fila2["simulado"] == fila["simulado"]


@pytest.mark.asyncio
async def test_horas_extra_rechaza_empleado(client: AsyncClient, empleado_base):
    headers = await auth_headers(client, empleado_base)
    response = await client.get("/api/v1/nominas/horas-extra", headers=headers)
    assert response.status_code == 403
