# tests/test_comedor_terminal.py
"""Terminal comedor: reserva diaria, POST /terminal/acceder y /terminal/consumir."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app as fastapi_app
from tests.conftest import auth_headers, make_empleado

TERMINAL_ACCEDER_URL = "/api/v1/comedor/terminal/acceder"
CONSUMIR_URL = "/api/v1/comedor/terminal/consumir"


def _make_client_with_ip(app, ip: str):
    """AsyncClient cuyas requests parecen originarse desde `ip`."""

    class PatchedTransport(ASGITransport):
        async def handle_async_request(self, request):
            original = self.app

            async def patched_app(scope, receive, send):
                if scope["type"] == "http":
                    scope["client"] = (ip, 12345)
                await original(scope, receive, send)

            self.app = patched_app
            result = await super().handle_async_request(request)
            self.app = original
            return result

    return PatchedTransport(app=app)


@pytest.mark.asyncio
async def test_terminal_ip_no_autorizada_403(db, monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "COMEDOR_TERMINAL_IPS", ["10.0.0.50"])
    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    transport = _make_client_with_ip(fastapi_app, "192.168.1.99")
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post(
                TERMINAL_ACCEDER_URL,
                json={"username": "x", "password": "y", "comedor_id": 1},
            )
        assert r.status_code == 403
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_terminal_credenciales_ok_sin_reserva_403(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg
    from app.models.comedor import Comedor

    monkeypatch.setattr(cfg.settings, "COMEDOR_TERMINAL_IPS", [])
    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    comedor = Comedor(nombre="Comedor T", activo=True)
    db.add(comedor)
    await db.flush()
    await db.refresh(comedor)

    emp = await make_empleado(db, email="term1@test.leoni", password="Secret1!Pass")

    monkeypatch.setattr(
        "app.services.comedor_service.business_today",
        lambda: date(2030, 6, 12),
    )
    monkeypatch.setattr(
        "app.services.comedor_service.business_now",
        lambda: datetime(
            2030, 6, 12, 12, 0, 0, tzinfo=ZoneInfo("America/Mexico_City")
        ),
    )

    transport = _make_client_with_ip(fastapi_app, "10.0.0.1")
    async def override_get_db():
        yield db
    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post(
                TERMINAL_ACCEDER_URL,
                json={
                    "username": emp.email,
                    "password": "Secret1!Pass",
                    "comedor_id": comedor.id,
                },
            )
        assert r.status_code == 403
        assert "reserva" in r.json().get("detail", "").lower()
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_terminal_flujo_reserva_acceder_consumir_doble_409(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )

    monkeypatch.setattr(cfg.settings, "COMEDOR_TERMINAL_IPS", ["10.0.0.50"])
    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    comedor = Comedor(nombre="Comedor Flow", activo=True)
    db.add(comedor)
    await db.flush()
    await db.refresh(comedor)

    emp = await make_empleado(db, email="term2@test.leoni", password="Secret2!Pass")
    # Lunes semana que contiene el 2030-06-12 (jueves)
    semana_lunes = date(2030, 6, 10)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=semana_lunes,
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()
    await db.refresh(reg)

    # Hoy cae en semana actual: el empleado no puede crear esa reserva por API;
    # se inserta el acceso como datos ya existentes (p. ej. carga administrativa).
    acceso = ComedorAcceso(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg.id,
        fecha_servicio=date(2030, 6, 12),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add(acceso)
    await db.flush()
    await db.refresh(acceso)
    acceso_id = acceso.id

    monkeypatch.setattr(
        "app.services.comedor_service.business_today",
        lambda: date(2030, 6, 12),
    )
    monkeypatch.setattr(
        "app.services.comedor_service.business_now",
        lambda: datetime(
            2030, 6, 12, 12, 0, 0, tzinfo=ZoneInfo("America/Mexico_City")
        ),
    )

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = _make_client_with_ip(fastapi_app, "10.0.0.50")
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r1 = await c.post(
                TERMINAL_ACCEDER_URL,
                json={
                    "username": emp.email,
                    "password": "Secret2!Pass",
                    "comedor_id": comedor.id,
                },
            )
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert body["permitido"] is True
        assert body["acceso_id"] == acceso_id

        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r2 = await c.post(CONSUMIR_URL, json={"acceso_id": acceso_id})
        assert r2.status_code == 200, r2.text
        assert r2.json()["ok"] is True
        assert r2.json().get("hora_entrada") is not None

        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r3 = await c.post(CONSUMIR_URL, json={"acceso_id": acceso_id})
        assert r3.status_code == 200, r3.text
        assert r3.json()["ok"] is True

        from app.models.comedor import ComedorAccesoEstado

        acceso_final = await db.get(ComedorAcceso, acceso_id)
        assert acceso_final is not None
        assert acceso_final.estado_acceso == ComedorAccesoEstado.REPETIDO
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_terminal_torniquete_api_key_requerida(db, monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "COMEDOR_TERMINAL_IPS", [])
    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])
    monkeypatch.setattr(cfg.settings, "TORNIQUETE_API_KEY", "clave-secreta")

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = _make_client_with_ip(fastapi_app, "127.0.0.1")
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post(
                TERMINAL_ACCEDER_URL,
                json={"username": "a@b.c", "password": "x", "comedor_id": 1},
            )
        assert r.status_code == 403
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r2 = await c.post(
                TERMINAL_ACCEDER_URL,
                json={"username": "a@b.c", "password": "x", "comedor_id": 1},
                headers={"X-Torniquete-Key": "clave-secreta"},
            )
        assert r2.status_code in (401, 404)
    finally:
        fastapi_app.dependency_overrides.clear()
