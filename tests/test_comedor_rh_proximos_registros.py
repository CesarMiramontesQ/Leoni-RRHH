"""RH: próximos registros de comedor paginados (fecha >= hoy)."""

from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, reset_comedor_transaccional

URL = "/api/v1/comedor/accesos/rh/proximos-registros"
URL_FUTUROS_SEMANA = "/api/v1/comedor/accesos/rh/registros-futuros-por-semana"


@pytest_asyncio.fixture(autouse=True)
async def _reset_comedor_global(db):
    """Aísla los conteos globales de comedor de la contaminación entre tests."""
    await reset_comedor_transaccional(db)


@pytest.mark.asyncio
async def test_rh_proximos_registros_paginacion_y_filtro_fecha(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 6, 2)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C1", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="prox_rh_emp@test.leoni", password="SecretP!")
    rh = await make_empleado(db, rol="rh", email="prox_rh@test.leoni", password="RhProx!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    pasado = hoy - timedelta(days=1)
    futuro1 = hoy
    futuro2 = hoy + timedelta(days=1)
    for fecha in (pasado, futuro1, futuro2):
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

    hdrs = await auth_headers(client, rh, password="RhProx!!")
    r = await client.get(URL, params={"page": 1, "page_size": 10}, headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    fechas = {row["fecha_servicio"] for row in data["items"]}
    assert str(futuro1) in fechas or futuro1.isoformat() in fechas
    assert str(futuro2) in fechas or futuro2.isoformat() in fechas


@pytest.mark.asyncio
async def test_rh_proximos_registros_rechaza_page_size_invalido(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="prox_rh_ps@test.leoni", password="RhProx2!!")
    hdrs = await auth_headers(client, rh, password="RhProx2!!")
    r = await client.get(URL, params={"page": 1, "page_size": 25}, headers=hdrs)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_empleado_no_puede_proximos_registros(client: AsyncClient, db):
    emp = await make_empleado(db, email="prox_no@test.leoni", password="SecretN!")
    hdrs = await auth_headers(client, emp, password="SecretN!")
    r = await client.get(URL, params={"page": 1, "page_size": 10}, headers=hdrs)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_rh_proximos_registros_filtro_estado_y_buscar(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 6, 2)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C1", activo=True)
    db.add(comedor)
    await db.flush()

    emp_a = await make_empleado(
        db,
        email="prox_f_a@test.leoni",
        password="SecretA!",
        nombre="LOPEZ GARCIA, ANA MARIA",
        no_empleado=7000045,
    )
    emp_b = await make_empleado(
        db,
        email="prox_f_b@test.leoni",
        password="SecretB!",
        nombre="MARTINEZ RUIZ, BETO",
        no_empleado=7000046,
    )
    rh = await make_empleado(db, rol="rh", email="prox_f_rh@test.leoni", password="RhFiltr!!")

    semana_lunes = hoy - timedelta(days=hoy.weekday())
    reg_a = ComedorRegistro(
        empleado_id=emp_a.id,
        comedor_id=comedor.id,
        semana=semana_lunes,
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    reg_b = ComedorRegistro(
        empleado_id=emp_b.id,
        comedor_id=comedor.id,
        semana=semana_lunes,
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add_all([reg_a, reg_b])
    await db.flush()

    f1 = hoy
    f2 = hoy + timedelta(days=1)
    db.add_all(
        [
            ComedorAcceso(
                empleado_id=emp_a.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_a.id,
                fecha_servicio=f1,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
            ComedorAcceso(
                empleado_id=emp_b.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_b.id,
                fecha_servicio=f2,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.ACCEDIDO,
            ),
            ComedorAcceso(
                empleado_id=emp_a.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_a.id,
                fecha_servicio=f2,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.EXPIRADO,
            ),
        ]
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhFiltr!!")

    r_todos = await client.get(
        URL,
        params={"page": 1, "page_size": 10, "filtro_estado": "todos", "buscar": "700004"},
        headers=hdrs,
    )
    assert r_todos.status_code == 200
    assert r_todos.json()["total"] == 2

    r_conf = await client.get(
        URL,
        params={"page": 1, "page_size": 10, "filtro_estado": "confirmado", "buscar": "700004"},
        headers=hdrs,
    )
    assert r_conf.status_code == 200
    data_conf = r_conf.json()
    assert data_conf["total"] == 1
    assert data_conf["items"][0]["estado_acceso"] == "ACCEDIDO"

    r_canc = await client.get(
        URL,
        params={"page": 1, "page_size": 10, "filtro_estado": "cancelado", "buscar": "700004"},
        headers=hdrs,
    )
    assert r_canc.status_code == 200
    data_canc = r_canc.json()
    assert data_canc["total"] == 1
    assert data_canc["items"][0]["estado_acceso"] == "EXPIRADO"

    r_bus = await client.get(
        URL,
        params={"page": 1, "page_size": 10, "buscar": 7000046, "filtro_estado": "todos"},
        headers=hdrs,
    )
    assert r_bus.status_code == 200
    assert r_bus.json()["total"] == 1
    assert r_bus.json()["items"][0]["no_empleado"] == 7000046


@pytest.mark.asyncio
async def test_rh_registros_futuros_por_semana_agrupa_y_orden_asc(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 6, 3)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C1", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="fut_sem_emp@test.leoni", password="SecretF!")
    rh = await make_empleado(db, rol="rh", email="fut_sem_rh@test.leoni", password="RhFut!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    semana_actual = hoy - timedelta(days=hoy.weekday())
    semana_sig = semana_actual + timedelta(days=7)
    for fecha in (hoy, hoy + timedelta(days=1), semana_sig, semana_sig + timedelta(days=2)):
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

    hdrs = await auth_headers(client, rh, password="RhFut!!")
    r = await client.get(URL_FUTUROS_SEMANA, params={"semanas": 8}, headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 2
    assert data[0]["total"] == 2
    assert data[1]["total"] == 2
    assert data[0]["semana_inicio"] <= data[1]["semana_inicio"]
