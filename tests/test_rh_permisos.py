# tests/test_rh_permisos.py
"""Tests del sistema de permisos por módulo para usuarios RH."""

import pytest
from httpx import AsyncClient

from app.core.rh_module_registry import effective_modules, user_has_module
from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_rh_permisos_me_default_full_access(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_base@test.com")
    res = await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, rh))
    assert res.status_code == 200
    data = res.json()
    assert data["rol"] == "rh"
    assert data["inscrito"] is True
    assert data["puede_administrar_permisos_rh"] is False
    assert data["modulos"]["comedor"] is True
    assert data["modulos"]["solicitudes"] is True


@pytest.mark.asyncio
async def test_rh_permisos_me_non_rh_not_enrolled(client: AsyncClient, db):
    emp = await make_empleado(db, rol="empleado", email="emp_perm@test.com")
    res = await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, emp))
    assert res.status_code == 200
    data = res.json()
    assert data["inscrito"] is False
    assert data["modulos"] == {}


@pytest.mark.asyncio
async def test_admin_can_add_gerente_and_assign_modules(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin2@test.com",
        puede_administrar_permisos_rh=True,
    )
    gerente = await make_empleado(db, rol="gerente", email="gerente_perm@test.com")

    add_res = await client.post(
        f"/api/v1/rh-permisos/usuarios/{gerente.empleado_id}",
        headers=await auth_headers(client, admin),
    )
    assert add_res.status_code == 201

    modulos = {key: False for key in __import__("app.core.rh_module_registry", fromlist=["all_module_keys"]).all_module_keys()}
    modulos["comedor"] = True
    modulos["reportes"] = True

    put_res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{gerente.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": modulos},
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["rol_nombre"] == "gerente"
    assert updated["modulos"]["comedor"] is True


@pytest.mark.asyncio
async def test_admin_can_list_and_update_other_rh(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin@test.com",
        puede_administrar_permisos_rh=True,
    )
    target = await make_empleado(db, rol="rh", email="rh_target@test.com")

    list_res = await client.get(
        "/api/v1/rh-permisos/usuarios",
        headers=await auth_headers(client, admin),
    )
    assert list_res.status_code == 200
    usuarios = list_res.json()
    assert any(u["empleado_id"] == target.empleado_id for u in usuarios)

    modulos = effective_modules({})
    modulos["comedor"] = False
    modulos["solicitudes"] = True

    put_res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{target.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": modulos},
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["modulos"]["comedor"] is False
    assert updated["modulos"]["solicitudes"] is True


@pytest.mark.asyncio
async def test_rh_without_admin_flag_cannot_manage(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_plain@test.com")
    res = await client.get("/api/v1/rh-permisos/usuarios", headers=await auth_headers(client, rh))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_edit_own_permissions(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_self@test.com",
        puede_administrar_permisos_rh=True,
    )
    modulos = effective_modules({})
    modulos["comedor"] = False

    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{admin.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": modulos},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_invalid_module_keys_rejected(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_invalid@test.com",
        puede_administrar_permisos_rh=True,
    )
    target = await make_empleado(db, rol="rh", email="rh_target2@test.com")

    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{target.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": {"modulo_inexistente": True}},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_middleware_blocks_rh_without_module(client: AsyncClient, db):
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_blocked@test.com",
        modulos_rh={"comedor": False, "solicitudes": True},
    )

    res_comedor = await client.get(
        "/api/v1/comedor/comedores",
        headers=await auth_headers(client, rh),
    )
    assert res_comedor.status_code == 403

    res_solicitudes = await client.get(
        "/api/v1/solicitudes",
        headers=await auth_headers(client, rh),
    )
    assert res_solicitudes.status_code in (200, 404)


@pytest.mark.asyncio
async def test_admin_bypasses_module_restrictions(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_bypass@test.com",
        puede_administrar_permisos_rh=True,
        modulos_rh={"comedor": False},
    )

    res = await client.get(
        "/api/v1/comedor/comedores",
        headers=await auth_headers(client, admin),
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_supervisor_not_affected_by_rh_middleware(client: AsyncClient, db):
    sup = await make_empleado(db, rol="supervisor", email="sup@test.com")
    res = await client.get(
        "/api/v1/solicitudes",
        headers=await auth_headers(client, sup),
    )
    assert res.status_code in (200, 404)


def test_effective_modules_empty_means_full_access():
    effective = effective_modules({})
    assert effective["comedor"] is True
    assert effective["level-up"] is True


@pytest.mark.asyncio
async def test_user_has_module_with_explicit_denial(db):
    from app.core.rh_module_registry import all_module_keys

    modulos = {key: True for key in all_module_keys()}
    modulos["actas"] = False
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_unit@test.com",
        modulos_rh=modulos,
    )
    assert user_has_module(rh, "actas") is False
    assert user_has_module(rh, "solicitudes") is True
