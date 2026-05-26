# tests/test_empleados_rh.py
"""Resumen y listado de empleados para rol RH (inactivos, filtro activo)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_resumen_rh_devuelve_inactivos(client: AsyncClient, db, empleado_rh):
    await make_empleado(
        db,
        rol="empleado",
        email="rh_sum_act@leoni.test",
        estado_id=1,
        empleado_id=88001,
        no_empleado="RH-S-A1",
    )
    await make_empleado(
        db,
        rol="empleado",
        email="rh_sum_ina@leoni.test",
        estado_id=2,
        empleado_id=88002,
        no_empleado="RH-S-I1",
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get("/api/v1/empleados/resumen", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert "inactivos" in data
    assert data["colaboradores_total"] == data["activos"]
    assert "contratos_por_vencer" in data
    assert "capacitacion_pendiente" not in data
    assert data["inactivos"] >= 1
    assert data["activos"] >= 1
    assert data["total_plantilla"] >= data["activos"]
    assert "empleados_por_clasificacion_y_area" in data
    series = data["empleados_por_clasificacion_y_area"]
    assert isinstance(series, list)
    assert len(series) == 3
    tipos = {item["tipo"] for item in series}
    assert tipos == {"administrativo", "directo", "indirecto"}
    for item in series:
        assert item["tipo"] in tipos
        assert "clasificacion_descripcion" in item
        assert "por_area" in item
        assert isinstance(item["por_area"], list)


@pytest.mark.asyncio
async def test_list_empleados_rh_activo_true_excluye_inactivos(
    client: AsyncClient, db, empleado_rh
):
    await make_empleado(
        db,
        rol="empleado",
        email="rh_f_act@leoni.test",
        estado_id=1,
        empleado_id=88010,
        no_empleado="RH-F-A",
    )
    inactivo = await make_empleado(
        db,
        rol="empleado",
        email="rh_f_ina@leoni.test",
        estado_id=2,
        empleado_id=88011,
        no_empleado="RH-F-I",
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"activo": "true", "page_size": 100},
        headers=headers,
    )

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert inactivo.id not in ids


@pytest.mark.asyncio
async def test_list_empleados_rh_activo_false_solo_inactivos(
    client: AsyncClient, db, empleado_rh
):
    activo = await make_empleado(
        db,
        rol="empleado",
        email="rh_g_act@leoni.test",
        estado_id=1,
        empleado_id=88020,
        no_empleado="RH-G-A",
    )
    inactivo = await make_empleado(
        db,
        rol="empleado",
        email="rh_g_ina@leoni.test",
        estado_id=2,
        empleado_id=88021,
        no_empleado="RH-G-I",
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"activo": "false", "page_size": 100},
        headers=headers,
    )

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert inactivo.id in ids
    assert activo.id not in ids
