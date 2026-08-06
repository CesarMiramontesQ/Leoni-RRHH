"""Refresco de la caché de home office tras aprobar una solicitud.

El fixture `client` mockea `sincronizar_homeoffice_empleado_background` (necesitaría
datos-analisis); aquí se inspeccionan sus llamadas para comprobar CUÁNDO se dispara.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.repositories.datos_analisis_home_office_write_repository import (
    InsertarHomeOfficeResult,
)
from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION_PAYLOAD = {"accion": "approve", "nivel": 1, "comentario": "ok"}
RECHAZO_PAYLOAD = {"accion": "reject", "nivel": 1, "comentario": "no procede"}


@pytest.fixture
def sync_mock(monkeypatch):
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "app.services.solicitud_service.sincronizar_homeoffice_empleado_background",
        mock,
    )
    return mock


@pytest.fixture
def tress_ok(monkeypatch):
    """El INSERT en dbo.PERMISO que precede a la aprobación, simulado con éxito."""
    registrar = AsyncMock(
        return_value=InsertarHomeOfficeResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=88
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress", registrar
    )
    return registrar


async def _equipo(db, sufijo: str, *, no_empleado: int | None = None):
    supervisor = await make_empleado(
        db, rol="supervisor", email=f"ho-sync-sup-{sufijo}@test"
    )
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email=f"ho-sync-sub-{sufijo}@test",
        lider_id=supervisor.empleado_id,
        no_empleado=no_empleado,
    )
    return supervisor, subordinado


async def _solicitud_home_office(db, empleado_id: int, estado: str = "pending"):
    return await make_solicitud(
        db,
        empleado_id=empleado_id,
        tipo="home_office",
        estado=estado,
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 15),
    )


@pytest.mark.asyncio
async def test_aprobar_dispara_el_sync_del_empleado(
    client: AsyncClient, db, sync_mock, tress_ok
):
    supervisor, subordinado = await _equipo(db, "ok", no_empleado=66611)
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["estado"] == "approved"
    # Solo el empleado de la solicitud, y con la solicitud para poder rastrear el log.
    sync_mock.assert_awaited_once_with(66611, solicitud.id)


@pytest.mark.asyncio
async def test_rechazar_no_dispara_el_sync(client: AsyncClient, db, sync_mock, tress_ok):
    supervisor, subordinado = await _equipo(db, "rej")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["estado"] == "rejected"
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancelar_una_pendiente_no_dispara_el_sync(
    client: AsyncClient, db, sync_mock
):
    """Nunca llegó a dbo.PERMISO: no hay nada que recalcular."""
    _, subordinado = await _equipo(db, "can")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=await auth_headers(client, subordinado),
    )

    assert res.status_code == 200
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_si_falla_el_insert_en_tress_no_se_sincroniza(
    client: AsyncClient, db, sync_mock, monkeypatch
):
    """Sin aprobación confirmada no hay nada que reflejar en la caché."""
    from app.core.exceptions import ServiceUnavailableError

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        AsyncMock(side_effect=ServiceUnavailableError(detail="TRESS caido")),
    )
    supervisor, subordinado = await _equipo(db, "fallo")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code >= 400
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_aprobar_vacaciones_no_dispara_el_sync_de_home_office(
    client: AsyncClient, db, sync_mock
):
    supervisor, subordinado = await _equipo(db, "vac")
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
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
