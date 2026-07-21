"""Tests directos de RhModulePermissionMiddleware para el hueco de self-service.

`rh_claims_for_token` (app/core/rh_module_registry.py) no setea el claim
`rh_enrolled` para inscritos que no tienen el rol legacy `rh` (solo lo setea
si `rol == "rh"`), asi que hoy el gate por modulo del middleware nunca se
activa via login normal para esos usuarios. Pero el disparador real del
gate es el claim `rh_enrolled`/`rh_modulos`, no el mecanismo de login, y
nada impide que ese gap se cierre a futuro (o que un JWT se emita con esos
claims por otra via). El bug reportado (self-service bloqueado para
inscritos no-RH) se reproduce fabricando el JWT directamente con
`jose.jwt.encode` (mismo patron que `test_auth.py::test_acceso_con_token_expirado`),
para ejercer el contrato real del middleware sin depender de ese gap.
"""

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from tests.conftest import make_empleado

pytestmark = pytest.mark.asyncio


def _make_token(empleado, **extra_claims) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(empleado.id),
        "rol": extra_claims.pop("rol", "supervisor"),
        "num": empleado.no_empleado,
        "jti": f"test-jti-mw-{empleado.id}",
        "iat": now,
        "exp": now + timedelta(minutes=30),
        "type": "access",
        **extra_claims,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def test_self_service_no_bloqueado_para_inscrito_no_rh_con_guard_activo(client, db):
    """Un token con `rh_enrolled=True` + rol no-rh + SIN el modulo
    'encuestas-rh' otorgado no debe recibir 403 en una ruta self-service."""
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="mw_fix1_sup@leoni.test",
        inscrito_modulos_rh=True,
    )
    token = _make_token(
        supervisor,
        rol="supervisor",
        rh_enrolled=True,
        rh_modulos={"actas": True},  # NO incluye "encuestas-rh"
    )
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/encuestas-rh/mis-encuestas", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


async def test_gestion_sigue_bloqueada_para_el_mismo_token(client, db):
    """El mismo usuario (self-service liberado) sigue sin poder gestionar."""
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="mw_fix1_sup2@leoni.test",
        inscrito_modulos_rh=True,
    )
    token = _make_token(
        supervisor,
        rol="supervisor",
        rh_enrolled=True,
        rh_modulos={"actas": True},
    )
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/encuestas-rh/encuestas", headers=headers)
    assert resp.status_code == 403
