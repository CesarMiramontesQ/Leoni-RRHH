"""RH: registros de reporte por rango de fechas (inclusive)."""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

URL = "/api/v1/comedor/accesos/rh/registros-reporte"


@pytest.mark.asyncio
async def test_rh_registros_reporte_incluye_pasado_y_respeta_rango(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 6, 10)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C-Reporte", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="rep_rh_emp@test.leoni", password="SecretP!")
    rh = await make_empleado(db, rol="rh", email="rep_rh@test.leoni", password="RhRep!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    pasado = hoy - timedelta(days=3)
    futuro = hoy + timedelta(days=5)
    for fecha in (pasado, hoy, futuro):
        db.add(
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=fecha,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            )
        )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhRep!!")
    r = await client.get(
        URL,
        params={
            "desde": pasado.isoformat(),
            "hasta": hoy.isoformat(),
            "page": 1,
            "page_size": 50,
            "filtro_estado": "todos",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 2
    fechas = {row["fecha_servicio"] for row in data["items"]}
    assert pasado.isoformat() in fechas or str(pasado) in fechas
    assert hoy.isoformat() in fechas or str(hoy) in fechas


@pytest.mark.asyncio
async def test_rh_registros_reporte_incluye_repetido_en_todos(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 7, 8)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C-RepRepet", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="rep_repet_emp@test.leoni", password="SecretP!")
    rh = await make_empleado(db, rol="rh", email="rep_repet_rh@test.leoni", password="RhRep!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    db.add(
        ComedorAcceso(
            empleado_id=emp.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg.id,
            fecha_servicio=hoy,
            tipo_comida=ComedorTipoComida.casera,
            estado_acceso=ComedorAccesoEstado.REPETIDO,
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhRep!!")
    r = await client.get(
        URL,
        params={
            "desde": hoy.isoformat(),
            "hasta": hoy.isoformat(),
            "page": 1,
            "page_size": 50,
            "filtro_estado": "todos",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["estado_acceso"] == "REPETIDO"


@pytest.mark.asyncio
async def test_rh_registros_reporte_rango_invalido(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rep_inv@test.leoni", password="RhInv!!")
    hdrs = await auth_headers(client, rh, password="RhInv!!")
    r = await client.get(
        URL,
        params={
            "desde": "2030-06-15",
            "hasta": "2030-06-01",
            "page": 1,
            "page_size": 10,
        },
        headers=hdrs,
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_empleado_no_puede_registros_reporte(client: AsyncClient, db):
    emp = await make_empleado(db, email="rep_no@test.leoni", password="SecretN!")
    hdrs = await auth_headers(client, emp, password="SecretN!")
    r = await client.get(
        URL,
        params={
            "desde": "2030-06-01",
            "hasta": "2030-06-30",
            "page": 1,
            "page_size": 10,
        },
        headers=hdrs,
    )
    assert r.status_code == 403
