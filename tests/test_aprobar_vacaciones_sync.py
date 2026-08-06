"""Refresco de la caché de saldos tras aprobar una solicitud de vacaciones.

El fixture `client` mockea `sincronizar_vacaciones_empleado_background` (necesitaría
datos-analisis); aquí se inspeccionan sus llamadas para comprobar CUÁNDO se dispara.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION_PAYLOAD = {"accion": "approve", "nivel": 1, "comentario": "ok"}
RECHAZO_PAYLOAD = {"accion": "reject", "nivel": 1, "comentario": "no procede"}


@pytest.fixture
def sync_mock(monkeypatch):
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "app.services.solicitud_service.sincronizar_vacaciones_empleado_background",
        mock,
    )
    return mock


async def _equipo(db, sufijo: str, *, no_empleado: int | None = None):
    supervisor = await make_empleado(db, rol="supervisor", email=f"sync-sup-{sufijo}@test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email=f"sync-sub-{sufijo}@test",
        lider_id=supervisor.empleado_id,
        no_empleado=no_empleado,
    )
    return supervisor, subordinado


async def _solicitud_vacaciones(db, empleado_id: int):
    return await make_solicitud(
        db,
        empleado_id=empleado_id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
    )


@pytest.mark.asyncio
async def test_aprobar_dispara_el_sync_del_empleado(client: AsyncClient, db, sync_mock):
    supervisor, subordinado = await _equipo(db, "ok", no_empleado=55511)
    solicitud = await _solicitud_vacaciones(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )
    assert res.status_code == 200
    assert res.json()["estado"] == "approved"
    # Se sincroniza solo al empleado de la solicitud, no toda la plantilla.
    sync_mock.assert_awaited_once_with(55511)


@pytest.mark.asyncio
async def test_rechazar_no_dispara_el_sync(client: AsyncClient, db, sync_mock):
    supervisor, subordinado = await _equipo(db, "rej")
    solicitud = await _solicitud_vacaciones(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )
    assert res.status_code == 200
    assert res.json()["estado"] == "rejected"
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancelar_no_dispara_el_sync(client: AsyncClient, db, sync_mock):
    _, subordinado = await _equipo(db, "can")
    solicitud = await _solicitud_vacaciones(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=await auth_headers(client, subordinado),
    )
    assert res.status_code == 200
    assert res.json()["estado"] == "cancelled"
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_solicitud_pendiente_no_dispara_el_sync(client: AsyncClient, db, sync_mock):
    """Crear la solicitud no mueve el saldo en TRESS: nada que sincronizar."""
    _, subordinado = await _equipo(db, "pend")

    res = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-06",
            "fecha_fin": "2026-07-08",
            "comentarios": "test",
        },
        headers=await auth_headers(client, subordinado),
    )
    assert res.status_code == 201
    assert res.json()["estado"] == "pending"
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_aprobar_otro_tipo_no_dispara_el_sync(client: AsyncClient, db, sync_mock):
    """Solo las vacaciones mueven el saldo; un permiso sin goce no."""
    supervisor, subordinado = await _equipo(db, "otro")
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="permiso_sin_goce_sueldo",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
    )

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )
    assert res.status_code == 200
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_si_el_sync_falla_la_aprobacion_no_se_revierte(
    client: AsyncClient, db, monkeypatch
):
    """La solicitud ya está guardada: una caché rancia no justifica deshacerla.

    Corre el sync **real** (sin el mock del fixture) contra una datos-analisis ausente:
    la protección vive dentro de `sincronizar_vacaciones_empleado_background`, así que
    mockearlo aquí no probaría nada.
    """
    from app.services.sync_vacaciones_disponibles_service import (
        sincronizar_vacaciones_empleado_background,
    )

    monkeypatch.setattr(
        "app.services.solicitud_service.sincronizar_vacaciones_empleado_background",
        sincronizar_vacaciones_empleado_background,
    )
    monkeypatch.setattr(
        "app.services.sync_vacaciones_disponibles_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )
    supervisor, subordinado = await _equipo(db, "falla")
    solicitud = await _solicitud_vacaciones(db, subordinado.id)
    headers = await auth_headers(client, supervisor)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["estado"] == "approved"

    detalle = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers)
    assert detalle.json()["estado"] == "approved"
