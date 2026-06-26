"""Admin (`puede_administrar_permisos_rh`) sin rol BD `rh`: alcance y acceso API."""

import pytest
from httpx import AsyncClient

from app.core.data_scope import effective_data_scope_rol
from app.core.rh_gestor_registry import resolve_rh_gestor_alcance
from app.core.rh_module_registry import is_modulos_rh_enrolled, rh_claims_for_token
from app.core.rh_ui_mode import is_rh_operativo_ui_mode
from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_admin_supervisor_tiene_scope_rh_operativo(db):
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_scope@test.leoni",
        puede_administrar_permisos_rh=True,
    )
    assert effective_data_scope_rol(admin, "operativo") == "rh"
    assert is_rh_operativo_ui_mode(admin, "operativo") is True
    assert is_modulos_rh_enrolled(admin) is True


@pytest.mark.asyncio
async def test_admin_supervisor_jwt_incluye_rh_admin(db):
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_jwt@test.leoni",
        puede_administrar_permisos_rh=True,
    )
    claims = rh_claims_for_token(admin)
    assert claims.get("rh_admin") is True
    assert "rh_enrolled" not in claims or claims.get("rh_enrolled") is not True


@pytest.mark.asyncio
async def test_admin_con_puesto_gestor_resuelve_alcance(db):
    from app.models.catalogos import Puesto

    puesto = Puesto(puesto_id=880001, descripcion="Gerente de recursos humanos", estatus_id=1)
    db.add(puesto)
    await db.flush()
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_gestor@test.leoni",
        puesto_id=puesto.puesto_id,
        puede_administrar_permisos_rh=True,
    )
    await db.refresh(admin, attribute_names=["puesto"])
    assert resolve_rh_gestor_alcance(admin) == "gerente"


@pytest.mark.asyncio
async def test_role_checker_acepta_operativo_y_legacy_rh(client: AsyncClient, db):
    """Endpoints con role_checker(['operativo']) admiten admin operativo y rol BD rh."""
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_operativo_chk@test.leoni",
        puede_administrar_permisos_rh=True,
        modulos_rh={"organigrama": True},
    )
    headers = await auth_headers(client, admin)
    headers["X-RH-UI-Mode"] = "operativo"
    res = await client.get("/api/v1/organigrama", headers=headers)
    assert res.status_code == 200

    legacy = await make_empleado(db, rol="rh", email="legacy_rh_org@test.leoni")
    res2 = await client.get("/api/v1/organigrama", headers=await auth_headers(client, legacy))
    assert res2.status_code == 200


@pytest.mark.asyncio
async def test_admin_supervisor_accede_actas_en_modo_operativo(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_actas@test.leoni",
        puede_administrar_permisos_rh=True,
        modulos_rh={"actas": True},
    )
    headers = await auth_headers(client, admin)
    headers["X-RH-UI-Mode"] = "operativo"
    res = await client.get("/api/v1/actas", headers=headers)
    assert res.status_code == 200
