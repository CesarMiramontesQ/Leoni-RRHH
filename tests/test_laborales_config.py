"""Configuración laborales — reglas de home office por área."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.auditoria import AuditLog
from tests.conftest import auth_headers, make_area, make_empleado, make_homeoffice_regla_area

URL = "/api/v1/laborales-config/home-office/areas"


@pytest.mark.asyncio
async def test_reglas_ho_solo_rh(
    client: AsyncClient, db, empleado_base, empleado_supervisor, empleado_gerente, empleado_director
):
    area = await make_area(db, descripcion="Compras")
    for empleado in (empleado_base, empleado_supervisor, empleado_gerente, empleado_director):
        headers = await auth_headers(client, empleado)
        assert (await client.get(URL, headers=headers)).status_code == 403
        r = await client.put(
            f"{URL}/{area.area_id}",
            headers=headers,
            json={"dias_permitidos": 1, "periodo_semanas": 1, "activo": True},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_reglas_ho_modulo_asignado_desde_permisos_rh(client: AsyncClient, db):
    """Un no-RH con el módulo `laborales-configuracion` accede sin ser admin."""
    con_modulo = await make_empleado(
        db,
        rol="supervisor",
        modulos_rh={"laborales-configuracion": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, con_modulo)
    headers["X-RH-UI-Mode"] = "operativo"
    r = await client.get(URL, headers=headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_reglas_ho_lista_todas_las_areas_activas_con_o_sin_regla(
    client: AsyncClient, db, empleado_rh
):
    con_regla = await make_area(db, descripcion="Calidad")
    sin_regla = await make_area(db, descripcion="Producción")
    inactiva = await make_area(db, descripcion="Área vieja", estatus_id=2)
    await make_homeoffice_regla_area(
        db, area_id=con_regla.area_id, dias_permitidos=1, periodo_semanas=2
    )
    headers = await auth_headers(client, empleado_rh)
    r = await client.get(URL, headers=headers)
    assert r.status_code == 200
    body = r.json()
    por_id = {i["area_id"]: i for i in body["items"]}
    assert body["total"] == len(body["items"])
    assert por_id[con_regla.area_id]["dias_permitidos"] == 1
    assert por_id[con_regla.area_id]["periodo_semanas"] == 2
    assert por_id[con_regla.area_id]["activo"] is True
    assert por_id[sin_regla.area_id]["dias_permitidos"] is None
    assert por_id[sin_regla.area_id]["activo"] is False
    assert inactiva.area_id not in por_id


@pytest.mark.asyncio
async def test_reglas_ho_upsert_y_auditoria(client: AsyncClient, db, empleado_rh):
    area = await make_area(db, descripcion="Sistemas")
    headers = await auth_headers(client, empleado_rh)

    creado = await client.put(
        f"{URL}/{area.area_id}",
        headers=headers,
        json={"dias_permitidos": 1, "periodo_semanas": 2, "activo": True},
    )
    assert creado.status_code == 200
    body = creado.json()
    assert body["area_id"] == area.area_id
    assert body["periodo_semanas"] == 2
    assert body["actualizado_por"] == empleado_rh.nombre
    assert body["actualizado_en"] is not None

    apagado = await client.put(
        f"{URL}/{area.area_id}",
        headers=headers,
        json={"dias_permitidos": 1, "periodo_semanas": 2, "activo": False},
    )
    assert apagado.status_code == 200
    assert apagado.json()["activo"] is False

    logs = (
        await db.execute(
            select(AuditLog).where(
                AuditLog.modulo == "laborales_config", AuditLog.entidad_id == area.area_id
            )
        )
    ).scalars().all()
    assert len(logs) == 2
    assert logs[0].datos_antes is None
    assert logs[1].datos_antes == {"dias_permitidos": 1, "periodo_semanas": 2, "activo": True}
    assert logs[1].datos_despues["activo"] is False


@pytest.mark.asyncio
async def test_reglas_ho_valida_rangos(client: AsyncClient, db, empleado_rh):
    area = await make_area(db, descripcion="Logística")
    headers = await auth_headers(client, empleado_rh)
    for body in (
        {"dias_permitidos": 0, "periodo_semanas": 1},
        {"dias_permitidos": 6, "periodo_semanas": 1},
        {"dias_permitidos": 1, "periodo_semanas": 0},
        {"dias_permitidos": 1, "periodo_semanas": 5},
    ):
        r = await client.put(f"{URL}/{area.area_id}", headers=headers, json=body)
        assert r.status_code == 422, body


@pytest.mark.asyncio
async def test_reglas_ho_area_inexistente_o_inactiva_404(client: AsyncClient, db, empleado_rh):
    inactiva = await make_area(db, descripcion="Cerrada", estatus_id=2)
    headers = await auth_headers(client, empleado_rh)
    body = {"dias_permitidos": 1, "periodo_semanas": 1}
    assert (await client.put(f"{URL}/999999999", headers=headers, json=body)).status_code == 404
    assert (
        await client.put(f"{URL}/{inactiva.area_id}", headers=headers, json=body)
    ).status_code == 404
