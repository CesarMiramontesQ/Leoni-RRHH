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
    modulos["nominas-horas-extra"] = True

    put_res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{director.empleado_id}",
        headers=await auth_headers(client, admin),
        json={"modulos": modulos},
    )
    assert put_res.status_code == 200
    assert put_res.json()["modulos"]["nominas-horas-extra"] is True

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.empleados import Empleado

    reloaded = (
        await db.execute(
            select(Empleado)
            .options(selectinload(Empleado.core))
            .where(Empleado.empleado_id == director.empleado_id)
        )
    ).scalar_one()
    assert reloaded.inscrito_modulos_rh is True
    assert reloaded.rol.nombre == "director"  # el rol no cambia
    assert user_has_module(reloaded, "nominas-horas-extra") is True
    assert user_has_module(reloaded, "comedor") is False

    # El propio usuario ve su inscripción y módulos vía /me.
    me = await client.get(
        "/api/v1/rh-permisos/me", headers=await auth_headers(client, director)
    )
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["inscrito"] is True
    assert me_data["modulos"]["nominas-horas-extra"] is True


@pytest.mark.asyncio
async def test_enrolled_non_rh_keeps_base_role_access(client: AsyncClient, db):
    """Un no-RH inscrito conserva el acceso de su rol base (modelo aditivo)."""
    sup = await make_empleado(
        db,
        rol="supervisor",
        email="sup_enrolled@test.com",
        inscrito_modulos_rh=True,
        modulos_rh={"nominas-horas-extra": True},
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
async def test_search_finds_employee_without_core_row(client: AsyncClient, db):
    """La búsqueda debe localizar empleados de Bono que aún no tienen fila en
    levelup_empleados_core (la mayoría: ``ensure_core`` es perezoso). El INNER JOIN
    contra core/rol los excluía, dejando "sin coincidencias" al agregar empleados."""
    from app.models.empleados import Empleado

    admin = await make_empleado(
        db,
        rol="rh",
        email="rh_admin_nocore@test.com",
        puede_administrar_permisos_rh=True,
    )

    # Empleado "pelón": existe en Bono (activo) pero nunca tocó el proyecto, así
    # que no tiene EmpleadoCore (ni rol propio).
    sin_core = Empleado(
        empleado_id=987654,
        no_empleado=987654,
        nombre="Sincore Empleado",
        email="sincore@test.com",
        estado_id=1,
    )
    db.add(sin_core)
    await db.flush()

    res = await client.get(
        "/api/v1/rh-permisos/empleados-buscar",
        headers=await auth_headers(client, admin),
        params={"q": "Sincore"},
    )
    assert res.status_code == 200
    payload = res.json()
    ids = {u["empleado_id"] for u in payload}
    assert sin_core.empleado_id in ids
    hit = next(u for u in payload if u["empleado_id"] == sin_core.empleado_id)
    assert hit["rol_nombre"] == "empleado"  # rol por defecto cuando no hay core


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
        modulos_rh={"nominas-horas-extra": True},
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
            .options(selectinload(Empleado.core))
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
            .options(selectinload(Empleado.core))
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
async def test_me_en_lista_permisos_flag(client: AsyncClient, db):
    """/me distingue 'en la lista' de 'inscrito' (RH removido sigue inscrito pero fuera de la lista)."""
    rh = await make_empleado(db, rol="rh", email="rh_lista@test.com")
    res = await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, rh))
    assert res.json()["en_lista_permisos"] is True

    removido = await make_empleado(
        db,
        rol="rh",
        email="rh_removido_me@test.com",
        acceso_rh_removido=True,
        modulos_rh={},
    )
    data2 = (
        await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, removido))
    ).json()
    assert data2["en_lista_permisos"] is False
    assert data2["inscrito"] is True  # sigue inscrito para denegar acceso

    ger_inscrito = await make_empleado(
        db,
        rol="gerente",
        email="ger_lista@test.com",
        inscrito_modulos_rh=True,
        modulos_rh={"nominas-horas-extra": True},
    )
    data3 = (
        await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, ger_inscrito))
    ).json()
    assert data3["en_lista_permisos"] is True

    emp_no = await make_empleado(db, rol="empleado", email="emp_no_lista@test.com")
    data4 = (
        await client.get("/api/v1/rh-permisos/me", headers=await auth_headers(client, emp_no))
    ).json()
    assert data4["en_lista_permisos"] is False


def test_validate_rh_ui_mode_relaxed_for_removed_rh(monkeypatch):
    """Un RH removido puede usar modo empleado aunque tenga gestor alcance (sin 422)."""
    import app.core.rh_ui_mode as uimod
    from fastapi import HTTPException

    monkeypatch.setattr(uimod, "resolve_rh_gestor_alcance", lambda _user: "gerente")

    class _Rol:
        nombre = "rh"

    class _User:
        rol = _Rol()

        def __init__(self, removido: bool) -> None:
            self.acceso_rh_removido = removido

    # Removido: no lanza, aunque tenga alcance gerente y pida modo empleado.
    uimod.validate_rh_ui_mode_for_user(_User(removido=True), uimod.RH_UI_MODE_EMPLEADO)

    # Control: el mismo usuario NO removido sí es rechazado (debe usar modo gerente).
    with pytest.raises(HTTPException):
        uimod.validate_rh_ui_mode_for_user(_User(removido=False), uimod.RH_UI_MODE_EMPLEADO)


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
    assert "nominas-horas-extra" in keys


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


@pytest.mark.asyncio
async def test_non_rh_granted_reaches_rh_exclusive_modules(db):
    """Un no-RH inscrito y con el módulo otorgado accede a páginas antes
    exclusivas de rol RH (actas, ajustes de nómina, talento); sin el módulo no.
    Alinea el frontend (gating por permiso) con el enforcement del backend."""
    from app.core.rh_module_registry import all_module_keys

    modulos = {key: False for key in all_module_keys()}
    for key in ("actas", "nominas-ajustes", "puestos", "competencias", "level-up"):
        modulos[key] = True

    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_rh_exclusivo@test.com",
        inscrito_modulos_rh=True,
        modulos_rh=modulos,
    )

    # Otorgados → acceso, sin rol RH.
    assert user_has_module(emp, "actas") is True
    assert user_has_module(emp, "nominas-ajustes") is True
    assert user_has_module(emp, "puestos") is True
    assert user_has_module(emp, "competencias") is True
    assert user_has_module(emp, "level-up") is True
    # No otorgado → bloqueado aunque esté inscrito.
    assert user_has_module(emp, "organigrama") is False


@pytest.mark.asyncio
async def test_non_rh_not_enrolled_has_no_rh_exclusive_modules(db):
    """Sin inscripción no hay acceso a módulos RH, aunque el rol base no sea empleado."""
    director = await make_empleado(
        db,
        rol="director",
        email="dir_sin_inscripcion@test.com",
    )
    assert user_has_module(director, "actas") is False
    assert user_has_module(director, "nominas-ajustes") is False
    assert user_has_module(director, "puestos") is False


# ── Administración del flag puede_administrar_permisos_rh (UI + auditoría) ──


async def _count_audit(db, accion: str) -> int:
    from sqlalchemy import func, select

    from app.models.auditoria import AuditLog

    return int(
        (
            await db.execute(
                select(func.count()).select_from(AuditLog).where(AuditLog.accion == accion)
            )
        ).scalar_one()
    )


@pytest.mark.asyncio
async def test_admin_grant_admin_flag_audits(client: AsyncClient, db):
    admin = await make_empleado(
        db, rol="rh", email="rh_grant_admin@test.com", puede_administrar_permisos_rh=True
    )
    target = await make_empleado(db, rol="gerente", email="grant_target@test.com")

    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{target.empleado_id}/admin",
        headers=await auth_headers(client, admin),
        json={"conceder": True},
    )
    assert res.status_code == 200
    assert res.json()["puede_administrar_permisos_rh"] is True

    await db.refresh(target)
    assert target.puede_administrar_permisos_rh is True
    assert await _count_audit(db, "RH_PERMISOS_ADMIN_GRANTED") >= 1


@pytest.mark.asyncio
async def test_admin_revoke_admin_flag(client: AsyncClient, db):
    admin = await make_empleado(
        db, rol="rh", email="rh_revoker@test.com", puede_administrar_permisos_rh=True
    )
    other = await make_empleado(
        db, rol="rh", email="rh_revokee@test.com", puede_administrar_permisos_rh=True
    )

    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{other.empleado_id}/admin",
        headers=await auth_headers(client, admin),
        json={"conceder": False},
    )
    assert res.status_code == 200
    assert res.json()["puede_administrar_permisos_rh"] is False

    await db.refresh(other)
    assert other.puede_administrar_permisos_rh is False
    assert await _count_audit(db, "RH_PERMISOS_ADMIN_REVOKED") >= 1


@pytest.mark.asyncio
async def test_cannot_change_own_admin_flag(client: AsyncClient, db):
    admin = await make_empleado(
        db, rol="rh", email="rh_self_admin@test.com", puede_administrar_permisos_rh=True
    )
    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{admin.empleado_id}/admin",
        headers=await auth_headers(client, admin),
        json={"conceder": False},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_non_admin_cannot_grant_admin_flag(client: AsyncClient, db):
    rh_no_admin = await make_empleado(db, rol="rh", email="rh_noadmin@test.com")
    target = await make_empleado(db, rol="gerente", email="noadmin_target@test.com")
    res = await client.put(
        f"/api/v1/rh-permisos/usuarios/{target.empleado_id}/admin",
        headers=await auth_headers(client, rh_no_admin),
        json={"conceder": True},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_bootstrap_rh_admins_recovery_semantics(db, monkeypatch):
    """ensure_bootstrap_rh_admins: no-op si ya hay admins; otorga si no hay."""
    from app.core.config import settings
    from app.utils.seed import ensure_bootstrap_rh_admins

    cand = await make_empleado(db, rol="empleado", email="bootstrap_cand@test.com")
    monkeypatch.setattr(
        settings, "seed_rh_permisos_admin_empleado_ids_env", str(cand.empleado_id)
    )

    # Sin admins → otorga al candidato del .env.
    await ensure_bootstrap_rh_admins(db)
    await db.refresh(cand)
    assert cand.puede_administrar_permisos_rh is True

    # Con un admin existente, un segundo candidato NO se otorga (recuperación).
    cand2 = await make_empleado(db, rol="empleado", email="bootstrap_cand2@test.com")
    monkeypatch.setattr(
        settings, "seed_rh_permisos_admin_empleado_ids_env", str(cand2.empleado_id)
    )
    await ensure_bootstrap_rh_admins(db)
    await db.refresh(cand2)
    assert cand2.puede_administrar_permisos_rh is False
