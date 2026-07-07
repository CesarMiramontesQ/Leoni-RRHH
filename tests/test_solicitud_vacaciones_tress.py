"""Solicitud de vacaciones con saldo desde TRESS (datos-analisis).

`obtener_saldo_gozo_tress` está mockeada en el fixture `client` (conftest) a 999 por defecto;
aquí se sobreescribe con monkeypatch para probar saldo bajo / servicio caído.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from app.core.exceptions import ServiceUnavailableError
from tests.conftest import auth_headers, make_empleado, make_solicitud


@pytest.fixture
def set_saldo_tress(monkeypatch):
    def _apply(valor):
        async def _fake(no_empleado):  # noqa: ANN001
            return valor

        monkeypatch.setattr(
            "app.services.vacaciones_service.obtener_saldo_gozo_tress", _fake
        )

    return _apply


@pytest.fixture
def tress_caido(monkeypatch):
    async def _fake(no_empleado):  # noqa: ANN001
        raise ServiceUnavailableError("No se pudo verificar el saldo de vacaciones.")

    monkeypatch.setattr(
        "app.services.vacaciones_service.obtener_saldo_gozo_tress", _fake
    )


@pytest.mark.asyncio
async def test_disponible_endpoint_sin_comprometidos(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="disp-a@test", dias_vacaciones=0)
    headers = await auth_headers(client, emp)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud", headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["saldo_tress"] == 999.0
    assert body["dias_comprometidos"] == 0
    assert body["dias_disponibles"] == 999.0


@pytest.mark.asyncio
async def test_disponible_resta_solicitudes_en_curso(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="disp-b@test", dias_vacaciones=0)
    # 3 días naturales pendientes (comprometidos).
    await make_solicitud(
        db,
        empleado_id=emp.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 3),
    )
    headers = await auth_headers(client, emp)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/vacaciones-disponibles-solicitud", headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["dias_comprometidos"] == 3
    assert body["dias_disponibles"] == 996.0


@pytest.mark.asyncio
async def test_crear_bloquea_saldo_insuficiente(client: AsyncClient, db, set_saldo_tress):
    set_saldo_tress(3.0)
    emp = await make_empleado(db, rol="empleado", email="insuf@test", dias_vacaciones=0)
    headers = await auth_headers(client, emp)

    res = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-06",
            "fecha_fin": "2026-07-10",  # 5 días naturales > 3 disponibles
            "comentarios": "test",
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert "insuficiente" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_crear_bloquea_tress_caido(client: AsyncClient, db, tress_caido):
    emp = await make_empleado(db, rol="empleado", email="caido@test", dias_vacaciones=0)
    headers = await auth_headers(client, emp)

    res = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-06",
            "fecha_fin": "2026-07-08",
            "comentarios": "test",
        },
        headers=headers,
    )
    assert res.status_code == 503
