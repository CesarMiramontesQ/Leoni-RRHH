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
async def test_admin_can_add_non_rh_employee(client: AsyncClient, db):
    """RH puede inscribir a cualquier usuario sin cambiar su rol."""
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
    item = add_res.json()
    assert item["empleado_id"] == gerente.empleado_id
    assert item["rol_nombre"] == "gerente"  # el rol no cambia

    # Queda inscrito y aparece en la lista de gestionados.
    list_res = await client.get(
        "/api/v1/rh-permisos/usuarios",
        headers=await auth_headers(client, admin),
    )
    ids = {u["empleado_id"] for u in list_res.json()}
    assert gerente.empleado_id in ids

    await db.refresh(gerente)
    assert gerente.inscrito_modulos_rh is True

    # Reintentar agregarlo da conflicto (ya inscrito).
    dup = await client.post(
        f"/api/v1/rh-permisos/usuarios/{gerente.empleado_id}",
        headers=await auth_headers(client, admin),
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_non_rh_without_enrollment_not_listed(client: AsyncClient, db):
    """Tener modulos_rh sin estar inscrito no incluye al usuario en la lista."""
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin3@test.com",
        puede_administrar_permisos_rh=True,
    )
    gerente = await make_empleado(
        db,
        rol="gerente",
        email="gerente_modulos@test.com",
        modulos_rh={"comedor": True},
    )

    list_res = await client.get(
        "/api/v1/rh-permisos/usuarios",
        headers=await auth_headers(client, admin),
    )
    assert list_res.status_code == 200
    ids = {u["empleado_id"] for u in list_res.json()}
    assert gerente.empleado_id not in ids


@pytest.mark.asyncio
async def test_admin_grants_module_to_non_rh_user(client: AsyncClient, db):
    """RH otorga un acceso a un no-RH; queda inscrito con el grant, sin tocar el rol."""
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_grant@test.com",
        puede_administrar_permisos_rh=True,
    )
    director = await make_empleado(db, rol="director", email="dir_grant@test.com")

    from app.core.rh_module_registry import all_module_keys

    modulos = {key: False for key in all_module_keys()}
    modulos["nominas"] = True

    put_res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{director.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": modulos},
    )
    assert put_res.status_code == 200
    assert put_res.json()["modulos"]["nominas"] is True

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.empleados import Empleado

    reloaded = (
        await db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.empleado_id == director.empleado_id)
        )
    ).scalar_one()
    assert reloaded.inscrito_modulos_rh is True
    assert reloaded.rol.nombre == "director"  # el rol no cambia
    assert user_has_module(reloaded, "nominas") is True
    assert user_has_module(reloaded, "comedor") is False

    # El propio usuario ve su inscripción y módulos vía /me.
    me = await client.get(
        "/api/v1/rh-permisos/me", headers=await auth_headers(client, director)
    )
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["inscrito"] is True
    assert me_data["modulos"]["nominas"] is True


@pytest.mark.asyncio
async def test_enrolled_non_rh_keeps_base_role_access(client: AsyncClient, db):
    """Un no-RH inscrito conserva el acceso de su rol base (modelo aditivo)."""
    sup = await make_empleado(
        db,
        rol="supervisor",
        email="sup_enrolled@test.com",
        inscrito_modulos_rh=True,
        modulos_rh={"nominas": True},
    )
    res = await client.get(
        "/api/v1/solicitudes",
        headers=await auth_headers(client, sup),
    )
    assert res.status_code in (200, 404)


@pytest.mark.asyncio
async def test_search_returns_any_active_employee(client: AsyncClient, db):
    """La búsqueda localiza empleados de cualquier rol, no solo RH."""
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_search@test.com",
        puede_administrar_permisos_rh=True,
    )
    emp = await make_empleado(
        db,
        rol="empleado",
        email="busca.este@test.com",
        nombre="Buscame Empleado",
    )

    res = await client.get(
        "/api/v1/rh-permisos/empleados-buscar",
        headers=await auth_headers(client, admin),
        params={"q": "Buscame"},
    )
    assert res.status_code == 200
    ids = {u["empleado_id"] for u in res.json()}
    assert emp.empleado_id in ids


@pytest.mark.asyncio
async def test_admin_can_remove_non_rh_from_permisos(client: AsyncClient, db):
    """Eliminar de permisos: quita inscripción y accesos, sin tocar rol ni cuenta."""
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_del@test.com",
        puede_administrar_permisos_rh=True,
    )
    gerente = await make_empleado(
        db,
        rol="gerente",
        email="gerente_del@test.com",
        inscrito_modulos_rh=True,
        modulos_rh={"nominas": True},
    )
    headers = await auth_headers(client, admin)

    del_res = await client.delete(
        f"/api/v1/rh-permisos/usuarios/{gerente.empleado_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Ya no aparece en la lista de gestionados.
    list_res = await client.get("/api/v1/rh-permisos/usuarios", headers=headers)
    ids = {u["empleado_id"] for u in list_res.json()}
    assert gerente.empleado_id not in ids

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.empleados import Empleado

    reloaded = (
        await db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.empleado_id == gerente.empleado_id)
        )
    ).scalar_one()
    assert reloaded.inscrito_modulos_rh is False
    assert reloaded.modulos_rh == {}
    assert reloaded.rol.nombre == "gerente"  # rol intacto
    assert reloaded.email == "gerente_del@test.com"  # cuenta intacta


@pytest.mark.asyncio
async def test_can_remove_rh_user_keeps_role_drops_access(client: AsyncClient, db):
    """Quitar a un RH: conserva rol RH (y toggle), pierde acceso a módulos y sale de la lista."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.core.rh_module_registry import user_has_module
    from app.models.empleados import Empleado

    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_del2@test.com",
        puede_administrar_permisos_rh=True,
    )
    rh_target = await make_empleado(db, rol="rh", email="rh_target_del@test.com")
    headers = await auth_headers(client, admin)

    del_res = await client.delete(
        f"/api/v1/rh-permisos/usuarios/{rh_target.empleado_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Sale de la lista de gestionados.
    list_res = await client.get("/api/v1/rh-permisos/usuarios", headers=headers)
    ids = {u["empleado_id"] for u in list_res.json()}
    assert rh_target.empleado_id not in ids

    reloaded = (
        await db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.empleado_id == rh_target.empleado_id)
        )
    ).scalar_one()
    assert reloaded.rol.nombre == "rh"  # rol intacto (conserva toggle)
    assert reloaded.acceso_rh_removido is True
    # Sin acceso a módulos RH (vista empleado).
    assert user_has_module(reloaded, "comedor") is False
    assert user_has_module(reloaded, "solicitudes") is False

    # Doble baja -> 404.
    again = await client.delete(
        f"/api/v1/rh-permisos/usuarios/{rh_target.empleado_id}",
        headers=headers,
    )
    assert again.status_code == 404


@pytest.mark.asyncio
async def test_removed_rh_user_can_be_readded(client: AsyncClient, db):
    """Un RH removido puede re-incluirse en la lista sin tocar su rol."""
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_readd@test.com",
        puede_administrar_permisos_rh=True,
    )
    rh_target = await make_empleado(
        db,
        rol="rh",
        email="rh_readd@test.com",
        acceso_rh_removido=True,
        modulos_rh={},
    )
    headers = await auth_headers(client, admin)

    add_res = await client.post(
        f"/api/v1/rh-permisos/usuarios/{rh_target.empleado_id}",
        headers=headers,
    )
    assert add_res.status_code == 201

    list_res = await client.get("/api/v1/rh-permisos/usuarios", headers=headers)
    ids = {u["empleado_id"] for u in list_res.json()}
    assert rh_target.empleado_id in ids


@pytest.mark.asyncio
async def test_cannot_remove_permisos_admin(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_del4@test.com",
        puede_administrar_permisos_rh=True,
    )
    otro_admin = await make_empleado(
        db,
        rol="rh",
        email="rh_otro_admin@test.com",
        puede_administrar_permisos_rh=True,
    )

    res = await client.delete(
        f"/api/v1/rh-permisos/usuarios/{otro_admin.empleado_id}",
        headers=await auth_headers(client, admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_remove_non_enrolled_returns_404(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_del3@test.com",
        puede_administrar_permisos_rh=True,
    )
    emp = await make_empleado(db, rol="empleado", email="emp_no_inscrito@test.com")

    res = await client.delete(
        f"/api/v1/rh-permisos/usuarios/{emp.empleado_id}",
        headers=await auth_headers(client, admin),
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_catalog_includes_nominas_module(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_catalog@test.com",
        puede_administrar_permisos_rh=True,
    )
    res = await client.get(
        "/api/v1/rh-permisos/modulos",
        headers=await auth_headers(client, admin),
    )
    assert res.status_code == 200
    keys = {m["key"] for m in res.json()}
    assert "nominas" in keys


@pytest.mark.asyncio
async def test_list_includes_all_rh_with_and_without_custom_modulos(client: AsyncClient, db):
    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_list@test.com",
        puede_administrar_permisos_rh=True,
    )
    rh_plain = await make_empleado(db, rol="rh", email="rh_plain_list@test.com")
    rh_custom = await make_empleado(
        db,
        rol="rh",
        email="rh_custom_list@test.com",
        modulos_rh={"comedor": True},
    )

    list_res = await client.get(
        "/api/v1/rh-permisos/usuarios",
        headers=await auth_headers(client, admin),
    )
    assert list_res.status_code == 200
    by_id = {u["empleado_id"]: u for u in list_res.json()}
    assert rh_plain.empleado_id in by_id
    assert rh_custom.empleado_id in by_id
    assert by_id[rh_plain.empleado_id]["permisos_personalizados"] is False
    assert by_id[rh_custom.empleado_id]["permisos_personalizados"] is True


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
async def test_rh_self_service_comedor_without_gestion_module(client: AsyncClient, db):
    from app.core.rh_module_registry import all_module_keys

    modulos = {key: False for key in all_module_keys()}
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_self_comedor@test.com",
        modulos_rh=modulos,
    )
    headers = await auth_headers(client, rh)

    res_personal = await client.get(
        "/api/v1/comedor/accesos/mis-proximas-reservas",
        headers=headers,
        params={"limite": 5},
    )
    assert res_personal.status_code != 403

    res_gestion = await client.get(
        "/api/v1/comedor/accesos/rh/proximos-registros",
        headers=headers,
        params={"page": 1, "page_size": 10},
    )
    assert res_gestion.status_code == 403


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
