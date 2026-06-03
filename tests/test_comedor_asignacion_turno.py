"""Asignación automática de comedor desde turnos_empleados al reservar comida."""

from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient

from app.models.comedor import Comedor, ComedorRegistro
from tests.conftest import auth_headers, link_turno_comedor_empleado, make_empleado

RESERVAR_URL = "/api/v1/comedor/accesos/reservar"
ASIGNADO_URL = "/api/v1/comedor/mi-comedor-asignado"
REGISTRO_URL = "/api/v1/comedor/registro"


@pytest.fixture(autouse=True)
def _fijar_business_now(monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(
        cs,
        "business_now",
        lambda: datetime(2026, 4, 23, 12, 0, 0, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_mi_comedor_asignado_desde_turnos(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Comedor Norte", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="asig@test.leoni", password="SecretA1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)

    hdrs = await auth_headers(client, emp, password="SecretA1!")
    r = await client.get(ASIGNADO_URL, headers=hdrs)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["comedor_id"] == comedor.id
    assert body["comedor_nombre"] == "Comedor Norte"


@pytest.mark.asyncio
async def test_reservar_sin_turno_rechaza(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C sin turno", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="sin_turno@test.leoni", password="SecretB1!")
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretB1!")
    r = await client.post(
        RESERVAR_URL,
        json={"fecha_servicio": "2026-04-28", "tipo_comida": "casera"},
        headers=hdrs,
    )
    assert r.status_code == 409
    assert "comedor asignado" in (r.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_reservar_comedor_incorrecto_rechaza(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor_a = Comedor(nombre="A", activo=True)
    comedor_b = Comedor(nombre="B", activo=True)
    db.add_all([comedor_a, comedor_b])
    await db.flush()

    emp = await make_empleado(db, email="mismatch@test.leoni", password="SecretC1!")
    await link_turno_comedor_empleado(db, emp, comedor_a.id)

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor_a.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretC1!")
    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor_b.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 409
    assert "no coincide" in (r.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_reservar_sin_comedor_id_usa_turno(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Auto", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="auto@test.leoni", password="SecretD1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretD1!")
    r = await client.post(
        RESERVAR_URL,
        json={"fecha_servicio": "2026-04-28", "tipo_comida": "casera"},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    assert r.json()["comedor_id"] == comedor.id


@pytest.mark.asyncio
async def test_registrar_seleccion_asigna_comedor_automatico(client: AsyncClient, db):
    comedor = Comedor(nombre="Sel auto", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="sel_auto@test.leoni", password="SecretE1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    hdrs = await auth_headers(client, emp, password="SecretE1!")

    r = await client.post(
        REGISTRO_URL,
        json={"semana": "2026-04-27", "tipo_platillo": "normal"},
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    assert r.json()["comedor_id"] == comedor.id
