"""Bloqueo de API para rol supervisor en actas y reporte comedor (middleware + role_checker)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_supervisor_no_puede_listar_actas_middleware_y_role_checker(
    client: AsyncClient, db
):
    sup = await make_empleado(db, rol="supervisor", email="sup_actas@leoni.test")
    headers = await auth_headers(client, sup)

    r = await client.get("/api/v1/actas", headers=headers)
    assert r.status_code == 403
    assert "supervisor" in r.json().get("detail", "").lower() or "acceso denegado" in r.json().get(
        "detail", ""
    ).lower()


@pytest.mark.asyncio
async def test_gerente_puede_listar_actas(client: AsyncClient, db):
    ger = await make_empleado(db, rol="gerente", email="ger_actas@leoni.test")
    headers = await auth_headers(client, ger)

    r = await client.get("/api/v1/actas", headers=headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_supervisor_no_puede_comedor_estadisticas(client: AsyncClient, db):
    sup = await make_empleado(db, rol="supervisor", email="sup_est@leoni.test")
    headers = await auth_headers(client, sup)

    r = await client.get("/api/v1/comedor/estadisticas", headers=headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_no_puede_comedor_proyecciones(client: AsyncClient, db):
    sup = await make_empleado(db, rol="supervisor", email="sup_proj@leoni.test")
    headers = await auth_headers(client, sup)

    r = await client.get("/api/v1/comedor/proyecciones", headers=headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_puede_comedor_menu(client: AsyncClient, db):
    """Rutas de comedor no restringidas siguen permitidas."""
    sup = await make_empleado(db, rol="supervisor", email="sup_menu@leoni.test")
    headers = await auth_headers(client, sup)

    r = await client.get("/api/v1/comedor/comedores", headers=headers)
    assert r.status_code == 200
