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
        no_empleado=7000018,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="rh_sum_ina@leoni.test",
        estado_id=2,
        empleado_id=88002,
        no_empleado=7000006,
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
        no_empleado=7000008,
    )
    inactivo = await make_empleado(
        db,
        rol="empleado",
        email="rh_f_ina@leoni.test",
        estado_id=2,
        empleado_id=88011,
        no_empleado=7000013,
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
        no_empleado=7000009,
    )
    inactivo = await make_empleado(
        db,
        rol="empleado",
        email="rh_g_ina@leoni.test",
        estado_id=2,
        empleado_id=88021,
        no_empleado=7000017,
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


@pytest.mark.asyncio
async def test_list_empleados_rh_solo_sin_lider_coincide_con_resumen(
    client: AsyncClient, db, empleado_rh
):
    """Filtro solo_sin_lider: activos sin lider_id (mismo criterio que KPI sin_lider_asignado)."""
    sin_lider = await make_empleado(
        db,
        rol="empleado",
        email="rh_sl_1@leoni.test",
        estado_id=1,
        empleado_id=88030,
        no_empleado=7000016,
        lider_id=None,
    )
    con_lider = await make_empleado(
        db,
        rol="supervisor",
        email="rh_sl_sup@leoni.test",
        estado_id=1,
        empleado_id=88031,
        no_empleado=7000004,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="rh_sl_2@leoni.test",
        estado_id=1,
        empleado_id=88032,
        no_empleado=7000007,
        lider_id=con_lider.empleado_id,
    )
    inactivo_sin_lider = await make_empleado(
        db,
        rol="empleado",
        email="rh_sl_ina@leoni.test",
        estado_id=2,
        empleado_id=88033,
        no_empleado=7000010,
        lider_id=None,
    )

    headers = await auth_headers(client, empleado_rh)
    resumen = await client.get("/api/v1/empleados/resumen", headers=headers)
    assert resumen.status_code == 200
    kpi_count = resumen.json()["sin_lider_asignado"]

    response = await client.get(
        "/api/v1/empleados",
        params={"solo_sin_lider": "true", "page_size": 100},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert sin_lider.id in ids
    assert inactivo_sin_lider.id not in ids
    assert body["total"] >= 1
    assert sin_lider.id in ids


@pytest.mark.asyncio
async def test_resumen_rh_incluye_sin_email_administrativo(
    client: AsyncClient, db, empleado_rh
):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    await make_empleado(
        db,
        rol="empleado",
        email="   ",
        estado_id=1,
        empleado_id=88040,
        no_empleado=7000014,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    await make_empleado(
        db,
        rol="empleado",
        email="rh_se_ok@leoni.test",
        estado_id=1,
        empleado_id=88041,
        no_empleado=7000015,
        clasificacion_id=cl_admin.clasificacion_id,
    )

    headers = await auth_headers(client, empleado_rh)
    resumen = await client.get("/api/v1/empleados/resumen", headers=headers)
    assert resumen.status_code == 200
    assert "sin_email_administrativo" in resumen.json()
    assert resumen.json()["sin_email_administrativo"] >= 1


@pytest.mark.asyncio
async def test_resumen_rh_sin_email_administrativo_no_infla_por_cross_join(
    client: AsyncClient, db, empleado_rh
):
    """El KPI no debe multiplicar filas core sin email (join explícito empleado↔core)."""
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    for i, eid in enumerate((88100, 88101)):
        await make_empleado(
            db,
            rol="empleado",
            email=" " * (i + 1),
            estado_id=1,
            empleado_id=eid,
            no_empleado=7000100 + i,
            clasificacion_id=cl_admin.clasificacion_id,
        )
    # Otros activos sin email (no administrativos): no deben sumar al KPI ni inflarlo.
    await make_empleado(
        db,
        rol="empleado",
        email="   ",
        estado_id=1,
        empleado_id=88102,
        no_empleado=7000102,
    )

    headers = await auth_headers(client, empleado_rh)
    resumen = await client.get("/api/v1/empleados/resumen", headers=headers)
    assert resumen.status_code == 200
    assert resumen.json()["sin_email_administrativo"] == 2


@pytest.mark.asyncio
async def test_list_empleados_rh_solo_contratos_por_vencer_lee_cache_tress(
    client: AsyncClient, db, empleado_rh
):
    """La tarjeta «Contratos por vencer» de RH filtra con el mismo criterio que el KPI."""
    from datetime import date, timedelta

    from tests.conftest import make_empleado_tress

    hoy = date.today()
    por_vencer = await make_empleado(db, rol="empleado", estado_id=1, no_empleado=7000301)
    await make_empleado_tress(db, 7000301, contrato_dias=90, fecha_vencimiento_contrato=hoy + timedelta(days=20))
    lejano = await make_empleado(db, rol="empleado", estado_id=1, no_empleado=7000302)
    await make_empleado_tress(db, 7000302, contrato_dias=90, fecha_vencimiento_contrato=hoy + timedelta(days=45))
    indefinido = await make_empleado(db, rol="empleado", estado_id=1, no_empleado=7000303)
    await make_empleado_tress(db, 7000303, contrato_dias=0)
    baja = await make_empleado(db, rol="empleado", estado_id=2, no_empleado=7000304)
    await make_empleado_tress(db, 7000304, contrato_dias=90, fecha_vencimiento_contrato=hoy + timedelta(days=5))
    # Sin fila en levelup_empleados_config (caso real en Bono): debe aparecer igual.
    from app.models.empleados_rh import EmpleadoRhConfig
    from sqlalchemy import delete

    sin_config = await make_empleado(db, rol="empleado", estado_id=1, no_empleado=7000305)
    await db.execute(delete(EmpleadoRhConfig).where(EmpleadoRhConfig.empleado_id == sin_config.empleado_id))
    await make_empleado_tress(db, 7000305, contrato_dias=90, fecha_vencimiento_contrato=hoy + timedelta(days=3))
    await db.commit()

    headers = await auth_headers(client, empleado_rh)
    r = await client.get(
        "/api/v1/empleados",
        params={"solo_contratos_por_vencer": "true", "page_size": 100},
        headers=headers,
    )
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()["items"]}
    assert por_vencer.id in ids and sin_config.id in ids
    assert lejano.id not in ids and indefinido.id not in ids and baja.id not in ids
    assert r.json()["total"] == 2


@pytest.mark.asyncio
async def test_list_empleados_rh_solo_sin_email_administrativo(
    client: AsyncClient, db, empleado_rh
):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    sin_email = await make_empleado(
        db,
        rol="empleado",
        email="  ",
        estado_id=1,
        empleado_id=88050,
        no_empleado=7000011,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    con_email = await make_empleado(
        db,
        rol="empleado",
        email="rh_se_f_ok@leoni.test",
        estado_id=1,
        empleado_id=88051,
        no_empleado=7000003,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    inactivo_sin_email = await make_empleado(
        db,
        rol="empleado",
        email="    ",
        estado_id=2,
        empleado_id=88054,
        no_empleado=7000005,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    directo_sin_email = await make_empleado(
        db,
        rol="empleado",
        email=" ",
        estado_id=1,
        empleado_id=88052,
        no_empleado=7000012,
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"solo_sin_email": "true", "page_size": 100},
        headers=headers,
    )
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert sin_email.id in ids
    assert con_email.id not in ids
    assert inactivo_sin_email.id not in ids
    assert directo_sin_email.id not in ids
