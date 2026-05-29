# tests/test_auth.py
"""
Tests del dominio autenticacion — Plataforma RH Leoni Cable.

Cubre:
  - Login exitoso / credenciales invalidas / empleado inactivo
  - Acceso con token valido / expirado / mal formado / sin token
  - Refresh de access token
  - Logout + blacklist JTI
  - Endpoint protegido GET /me
  - Tipo de token incorrecto (refresh usado como access)
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


# ---------------------------------------------------------------------------
# TC-AUTH-001: Login exitoso
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_exitoso_retorna_access_y_refresh_token(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="login_ok@leoni.test")

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "login_ok@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    # Los tokens no deben estar vacios
    assert len(body["access_token"]) > 20
    assert len(body["refresh_token"]) > 20


# ---------------------------------------------------------------------------
# TC-AUTH-002: Login con password incorrecto
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_password_incorrecto_retorna_401(client: AsyncClient, db):
    await make_empleado(db, rol="empleado", email="login_bad@leoni.test")

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "login_bad@leoni.test", "password": "WrongPass999"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 401
    assert "Credenciales" in response.json().get("detail", "")


# ---------------------------------------------------------------------------
# TC-AUTH-003: Login con email inexistente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_email_inexistente_retorna_401(client: AsyncClient, db):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "noexiste@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Login por campo usuario (sin @ en el identificador)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_usuario_exitoso_retorna_tokens(client: AsyncClient, db):
    await make_empleado(
        db,
        rol="empleado",
        email="por_usuario@leoni.test",
        usuario="jdoe.leoni",
    )

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "jdoe.leoni", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_usuario_case_insensitive(client: AsyncClient, db):
    await make_empleado(
        db,
        rol="empleado",
        email="case_user@leoni.test",
        usuario="MiUsuario",
    )

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "miusuario", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_login_usuario_inexistente_retorna_401(client: AsyncClient, db):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "no_existe_usuario", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_no_empleado_exitoso_retorna_tokens(client: AsyncClient, db):
    await make_empleado(
        db,
        rol="empleado",
        email="por_numero@leoni.test",
        no_empleado="1234.0",
    )

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "1234", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_por_email_empleado_exitoso_y_me_retorna_email(
    client: AsyncClient, db
):
    await make_empleado(
        db,
        rol="empleado",
        email="alterno@leoni.test",
        no_empleado="EMP-ALT-01",
    )

    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "alterno@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]

    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "alterno@leoni.test"


@pytest.mark.asyncio
async def test_login_legacy_password_texto_plano_en_columna(client: AsyncClient, db):
    """BD legada: `password_hash` puede ser la contraseña inicial en claro (p. ej. no_empleado)."""
    empleado = await make_empleado(db, rol="empleado", email="legacy_plain@leoni.test")
    empleado.password_hash = "RH-7777"
    await db.flush()

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "legacy_plain@leoni.test", "password": "RH-7777"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_login_legacy_texto_plano_incorrecto_retorna_401(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="legacy_wrong@leoni.test")
    empleado.password_hash = "solo_esto"
    await db.flush()

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "legacy_wrong@leoni.test", "password": "otra_cosa"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-004: Login empleado inactivo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_empleado_inactivo_retorna_403(client: AsyncClient, db):
    await make_empleado(
        db, rol="empleado", email="inactivo@leoni.test", estado_id=2
    )

    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "inactivo@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 403
    assert "inactivo" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-AUTH-005: Acceso a endpoint protegido con token valido
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_acceso_con_token_valido_retorna_200(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="valido@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "valido@leoni.test"
    assert body["id"] == empleado.id


# ---------------------------------------------------------------------------
# TC-AUTH-006: Acceso sin token retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_acceso_sin_token_retorna_401(client: AsyncClient, db):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-007: Acceso con token mal formado retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_acceso_con_token_malformado_retorna_401(client: AsyncClient, db):
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer esto.no.es.un.jwt.valido"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-008: Acceso con token expirado retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_acceso_con_token_expirado_retorna_401(client: AsyncClient, db):
    from app.core.security import create_access_token
    from app.core.config import settings
    from jose import jwt

    empleado = await make_empleado(db, rol="empleado", email="expired@leoni.test")

    # Fabricar token con exp en el pasado
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(empleado.id),
        "rol": "empleado",
        "dept": "",
        "num": empleado.no_empleado,
        "jti": "test-jti-expired",
        "iat": now - timedelta(minutes=30),
        "exp": now - timedelta(minutes=15),
        "type": "access",
    }
    expired_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-009: Refresh token valido genera nuevo access token
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_token_valido_retorna_nuevo_access_token(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="refresh@leoni.test")

    # Login para obtener refresh token
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "refresh@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]
    original_access = login_resp.json()["access_token"]

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["access_token"] != original_access


# ---------------------------------------------------------------------------
# TC-AUTH-010: Refresh con access token (tipo incorrecto) retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_con_access_token_retorna_401(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="badrefresh@leoni.test")

    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "badrefresh@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    access_token = login_resp.json()["access_token"]

    # Intentar usar el ACCESS token como refresh token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )

    assert response.status_code == 401
    assert "tipo" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-AUTH-011: Logout invalida el token — siguiente request retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout_invalida_token_siguiente_request_es_401(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="logout@leoni.test")
    headers = await auth_headers(client, empleado)

    # Verificar que el token funciona
    me_before = await client.get("/api/v1/auth/me", headers=headers)
    assert me_before.status_code == 200

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert "cerrada" in logout_resp.json().get("message", "").lower()

    # El mismo token ya no debe funcionar
    me_after = await client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401
    assert "revocado" in me_after.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-AUTH-012: Logout sin token retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout_sin_token_retorna_401(client: AsyncClient, db):
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-013: Uso de refresh token revocado retorna 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_token_revocado_retorna_401(client: AsyncClient, db):
    from app.models.auditoria import TokenBlacklist
    from app.core.security import decode_token

    empleado = await make_empleado(db, rol="empleado", email="revokedrefresh@leoni.test")

    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "revokedrefresh@leoni.test", "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    # Revocar el refresh token manualmente en la DB
    payload = decode_token(refresh_token)
    jti = payload["jti"]
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.add(TokenBlacklist(jti=jti, expires_at=exp))
    await db.flush()

    # Intentar usar el refresh token revocado
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUTH-014: Endpoint sync-it requiere rol rh
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_it_sin_rol_rh_retorna_403(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="norch@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post("/api/v1/auth/sync-it", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_sync_it_con_rol_rh_retorna_200(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="rh", email="rhsync@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post("/api/v1/auth/sync-it", headers=headers)
    assert response.status_code == 200


def test_verify_password_bcrypt_y_texto_plano():
    from app.core.security import hash_password, verify_password

    h = hash_password("Secr3t!")
    assert verify_password("Secr3t!", h)
    assert not verify_password("Otro", h)

    assert verify_password("12345", "12345")
    assert not verify_password("12346", "12345")
    assert verify_password("  RH-01  ", "RH-01")

    assert not verify_password("x", "$2b$12$PLACEHOLDER_NO_VALIDO_COMO_BCRYPT")
