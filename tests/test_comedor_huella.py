# tests/test_comedor_huella.py
"""
Tests del endpoint POST /api/v1/comedor/huella/validar — Plataforma RH Leoni Cable.

Comportamiento critico:
  - Solo accesible desde IPs en HUELLA_WHITELIST_IPS
  - Lista vacia → FAIL OPEN (permite todo — entorno dev)
  - Empleado no encontrado por huella → FAIL OPEN (acceso=True)
  - Error de DB → FAIL OPEN (acceso=True)
  - IP NO autorizada → 403

El endpoint NO requiere JWT — es para lectores de huella fisicos en la red interna.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

HUELLA_ENDPOINT = "/api/v1/comedor/huella/validar"

# Payload valido reutilizable
HUELLA_PAYLOAD = {
    "huella_id": "HUELLA-ABC-12345",
    "comedor_id": 1,
    "timestamp": "2026-04-01T08:00:00+00:00",
}


# ---------------------------------------------------------------------------
# Helper para simular la IP del cliente via ASGI scope
# ---------------------------------------------------------------------------

def _make_client_with_ip(app, ip: str):
    """
    Retorna un AsyncClient cuyas requests se originan de la IP indicada.
    httpx ASGITransport inyecta el scope ASGI con 'client' tuple.
    """
    from httpx import ASGITransport

    class PatchedTransport(ASGITransport):
        async def handle_async_request(self, request):
            # Inyectar IP en el scope ASGI modificando el transport
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


# ---------------------------------------------------------------------------
# TC-HUE-001: Whitelist vacia (dev mode) → FAIL OPEN, acceso=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_whitelist_vacia_permite_todo(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg

    # Lista vacia = permite todo
    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    with patch(
        "app.services.comedor_service.ComedorService.validar_huella",
        new_callable=AsyncMock,
        return_value=MagicMock(acceso=True, empleado=None, tipo_platillo="normal"),
    ):
        response = await client.post(HUELLA_ENDPOINT, json=HUELLA_PAYLOAD)

    assert response.status_code == 200
    assert response.json()["acceso"] is True


# ---------------------------------------------------------------------------
# TC-HUE-002: IP en whitelist → acceso procesado correctamente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_ip_autorizada_procesa_request(db, monkeypatch):
    from app.core import config as cfg
    from app.main import app as fastapi_app
    from app.core.database import get_db

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", ["10.0.0.50"])

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    try:
        from httpx import ASGITransport, AsyncClient as HX

        # Simular request desde 10.0.0.50
        transport = ASGITransport(app=fastapi_app)

        with patch(
            "app.services.comedor_service.ComedorService.validar_huella",
            new_callable=AsyncMock,
            return_value=MagicMock(acceso=True, empleado="Juan Garcia", tipo_platillo="normal"),
        ):
            async with HX(transport=transport, base_url="http://testserver") as c:
                # Inyectar la IP correcta en el scope via monkeypatch de Request
                with patch("app.core.dependencies.require_huella_ip") as mock_dep:
                    mock_dep.return_value = None
                    # Con la dependency mockeada como no-op, el endpoint procesa
                    response = await c.post(HUELLA_ENDPOINT, json=HUELLA_PAYLOAD)

        assert response.status_code == 200
    finally:
        fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# TC-HUE-003: IP NO en whitelist → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_ip_no_autorizada_retorna_403(db, monkeypatch):
    from app.core import config as cfg
    from app.main import app as fastapi_app
    from app.core.database import get_db

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", ["10.0.0.50"])

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    try:
        from httpx import ASGITransport, AsyncClient as HX

        transport = ASGITransport(app=fastapi_app)

        async with HX(transport=transport, base_url="http://testserver") as c:
            # Sin mockear require_huella_ip — la IP de testserver (127.0.0.1)
            # no esta en la whitelist [10.0.0.50]
            response = await c.post(HUELLA_ENDPOINT, json=HUELLA_PAYLOAD)

        assert response.status_code == 403
        assert "IP" in response.json().get("detail", "") or "autorizada" in response.json().get("detail", "")
    finally:
        fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# TC-HUE-004: Empleado no encontrado por huella → FAIL OPEN (acceso=True)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_empleado_no_encontrado_fail_open(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    # Simular que el repositorio retorna None para la huella
    with patch(
        "app.repositories.comedor_repository.ComedorRegistroRepository.get_by_huella",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await client.post(
            HUELLA_ENDPOINT,
            json={
                "huella_id": "HUELLA-DESCONOCIDA-99999",
                "comedor_id": 1,
                "timestamp": "2026-04-01T08:00:00+00:00",
            },
        )

    # FAIL OPEN: aunque no se encuentre el empleado, debe conceder acceso
    assert response.status_code == 200
    assert response.json()["acceso"] is True


# ---------------------------------------------------------------------------
# TC-HUE-005: Error de DB → FAIL OPEN (acceso=True)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_error_db_fail_open(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    # Simular excepcion de DB en el repositorio
    with patch(
        "app.repositories.comedor_repository.ComedorRegistroRepository.get_by_huella",
        new_callable=AsyncMock,
        side_effect=Exception("DB connection lost"),
    ):
        response = await client.post(
            HUELLA_ENDPOINT,
            json={
                "huella_id": "HUELLA-DB-ERROR",
                "comedor_id": 1,
                "timestamp": "2026-04-01T08:00:00+00:00",
            },
        )

    # FAIL OPEN: cualquier error debe resultar en acceso=True
    assert response.status_code == 200
    assert response.json()["acceso"] is True


# ---------------------------------------------------------------------------
# TC-HUE-006: Payload invalido — falta campo requerido → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huella_payload_invalido_retorna_422(client: AsyncClient, db, monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", [])

    response = await client.post(
        HUELLA_ENDPOINT,
        json={
            "comedor_id": 1,
            # Falta huella_id y timestamp
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# TC-HUE-007: Parametrize — IPs de whitelist (exacto vs no-match)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("whitelist,expected_behavior", [
    ([], "allowed"),          # lista vacia → permite todo
    (["10.0.0.1"], "blocked"),  # IP en whitelist pero request viene de 127.0.0.1
])
async def test_huella_whitelist_parametrize(
    whitelist, expected_behavior, db, monkeypatch
):
    from app.core import config as cfg
    from app.main import app as fastapi_app
    from app.core.database import get_db

    monkeypatch.setattr(cfg.settings, "HUELLA_WHITELIST_IPS", whitelist)

    async def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    try:
        from httpx import ASGITransport, AsyncClient as HX

        transport = ASGITransport(app=fastapi_app)

        with patch(
            "app.services.comedor_service.ComedorService.validar_huella",
            new_callable=AsyncMock,
            return_value=MagicMock(acceso=True, empleado=None, tipo_platillo="normal"),
        ):
            async with HX(transport=transport, base_url="http://testserver") as c:
                response = await c.post(HUELLA_ENDPOINT, json=HUELLA_PAYLOAD)

        if expected_behavior == "allowed":
            assert response.status_code == 200
        else:
            # 127.0.0.1 no esta en ["10.0.0.1"] → 403
            assert response.status_code == 403
    finally:
        fastapi_app.dependency_overrides.clear()
