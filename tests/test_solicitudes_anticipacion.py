"""Anticipación mínima al crear vacaciones y home office.

Regla: `fecha_inicio >= hoy + 1` (hoy = `business_today()`, zona América/México).
Solo aplica a vacaciones y home office; solo RH (scope global) queda exento.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from app.services import solicitud_service as ss
from tests.conftest import (
    auth_headers,
    make_empleado,
    make_empleado_home_office,
    make_solicitud,
)

HOY = date(2026, 5, 4)  # lunes
MANANA = "2026-05-05"
AYER = "2026-05-03"


@pytest.fixture(autouse=True)
def _hoy_fijo(monkeypatch):
    monkeypatch.setattr(ss, "business_today", lambda: HOY)


def _payload(tipo: str, fecha: str, **extra):
    return {"tipo": tipo, "fecha_inicio": fecha, "fecha_fin": fecha, **extra}


@pytest.mark.asyncio
async def test_empleado_vacaciones_hoy_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="ant001@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes", json=_payload("vacaciones", HOY.isoformat()), headers=headers
    )
    assert r.status_code == 422
    assert "anticipación" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_empleado_vacaciones_ayer_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="ant002@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post("/api/v1/solicitudes", json=_payload("vacaciones", AYER), headers=headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_empleado_vacaciones_manana_retorna_201(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="ant003@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post("/api/v1/solicitudes", json=_payload("vacaciones", MANANA), headers=headers)
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_empleado_home_office_hoy_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado_home_office(db, email="ant004@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes", json=_payload("home_office", HOY.isoformat()), headers=headers
    )
    assert r.status_code == 422
    assert "anticipación" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_supervisor_para_subordinado_hoy_retorna_422(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="ant005_sup@leoni.test")
    sub = await make_empleado(
        db, rol="empleado", email="ant005_sub@leoni.test", lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, supervisor)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", HOY.isoformat(), empleado_id=sub.id),
        headers=headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_rh_puede_registrar_fecha_pasada(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="ant006_rh@leoni.test")
    colaborador = await make_empleado(db, rol="empleado", email="ant006_col@leoni.test")
    headers = await auth_headers(client, rh)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", AYER, empleado_id=colaborador.id),
        headers=headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_permiso_sin_goce_no_aplica_regla(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="ant007_sup@leoni.test")
    sub = await make_empleado(
        db, rol="empleado", email="ant007_sub@leoni.test", lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, supervisor)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("permiso_sin_goce_sueldo", AYER, empleado_id=sub.id, motivo="Asunto personal"),
        headers=headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_reenvio_changes_requested_con_fecha_hoy_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="ant008@leoni.test")
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="changes_requested",
        fecha_inicio=date(2026, 5, 12),
        fecha_fin=date(2026, 5, 12),
    )
    headers = await auth_headers(client, empleado)
    r = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={"fecha_inicio": HOY.isoformat(), "fecha_fin": HOY.isoformat()},
        headers=headers,
    )
    assert r.status_code == 422
    assert "anticipación" in r.json()["detail"].lower()
