"""
Configuración de acceso a vistas por rol (`levelup_vistas_rol`).

Los cambios de configuración se hacen SIEMPRE por la API (`PUT /vistas-rol/config`),
igual que en producción: escribir con la sesión del fixture entre dos llamadas HTTP es
frágil porque el cliente commitea sobre la conexión compartida.

Endpoints usados como sonda, elegidos por no depender de datos ni de la BD Bono:
- `GET /api/v1/viajes-laborales/estados` → vista `viajes-laborales`, apagada por defecto
  para todos: prueba que encenderla AMPLÍA el acceso (`role_checker(["operativo"])` no
  incluye ningún rol base).
- `GET /api/v1/ciclo-desempeno/ciclos` → vista `ciclo-desempeno`, encendida por defecto
  para supervisor y gerente: prueba que apagarla RESTRINGE.
"""

import pytest
from httpx import AsyncClient

from app.core import vista_rol_cache
from app.core.vista_rol_registry import (
    ROLES_CONFIGURABLES,
    VISTAS_ROL,
    all_vista_keys,
    catalogo_para_api,
    defaults_por_rol,
    nav_item_to_vista_key,
    resolve_vista_from_api_path,
    resolve_vista_from_hash,
    validate_roles,
    validate_vista_keys,
)
from app.utils.seed_vistas_rol import ensure_vistas_rol_defaults
from tests.conftest import _get_or_create_rol, auth_headers, make_empleado

VIAJES_URL = "/api/v1/viajes-laborales/estados"
CICLOS_URL = "/api/v1/ciclo-desempeno/ciclos"
CONFIG_URL = "/api/v1/vistas-rol/config"


@pytest.fixture(autouse=True)
def _limpiar_cache_vistas():
    """El caché es global de proceso: sin esto un test vería la config del anterior."""
    vista_rol_cache.invalidate()
    yield
    vista_rol_cache.invalidate()


async def _sembrar_defaults(db) -> None:
    """Crea los tres roles configurables y siembra su configuración por defecto."""
    for rol in ROLES_CONFIGURABLES:
        await _get_or_create_rol(db, rol)
    await ensure_vistas_rol_defaults(db)
    await db.flush()
    vista_rol_cache.invalidate()


async def _make_admin(db, email: str):
    return await make_empleado(
        db, rol="supervisor", email=email, puede_administrar_permisos_rh=True
    )


async def _configurar(client: AsyncClient, headers: dict, cambios: list[dict]):
    res = await client.put(CONFIG_URL, headers=headers, json={"cambios": cambios})
    assert res.status_code == 200, res.text
    return res.json()


# ─────────────────────────── catálogo (sin BD) ───────────────────────────


def test_defaults_replican_el_acceso_actual_de_cada_rol():
    """El seed inicial no debe cambiar lo que ve nadie al desplegar."""
    defaults = defaults_por_rol()
    assert set(defaults) == set(ROLES_CONFIGURABLES)

    # Menú del empleado (EMPLEADO_VISIBLE_NAV_IDS en shellNavPolicy.ts).
    for key in (
        "dashboard", "solicitudes", "comedor", "mis-encuestas", "mis-encuestas-rh",
        "mis-firmas", "mis-aprobaciones-opl", "mis-metas", "mi-desempeno",
        "mis-evaluaciones",
    ):
        assert defaults["empleado"][key] is True, key

    # Menú de supervisor/gerente (SUPERVISOR_VISIBLE_NAV_IDS + rutas permitidas).
    for rol in ("supervisor", "gerente"):
        for key in (
            "dashboard", "metricas", "incidencias", "faltas-retardos", "solicitudes",
            "empleados", "comedor", "metas", "dashboard-talento", "ciclo-desempeno",
            "historial-objetivo", "evaluaciones", "pdi-gestion",
        ):
            assert defaults[rol][key] is True, f"{rol}/{key}"

    # Lo que hoy NO ve ningún rol base sigue apagado.
    for rol in ROLES_CONFIGURABLES:
        for key in ("actas", "nominas-ajustes", "puestos", "organigrama", "viajes-laborales"):
            assert defaults[rol][key] is False, f"{rol}/{key}"

    # Supervisor y gerente comparten política hoy: mismo default.
    assert defaults["supervisor"] == defaults["gerente"]

    # Toda vista del catálogo tiene entrada para todos los roles configurables.
    for rol in ROLES_CONFIGURABLES:
        assert set(defaults[rol]) == set(all_vista_keys())


def test_resolve_vista_from_api_path_gana_el_prefijo_mas_largo():
    assert resolve_vista_from_api_path("/api/v1/viajes-laborales/estados") == "viajes-laborales"
    assert resolve_vista_from_api_path("/api/v1/metas/ciclos") == "metas"
    # El autoservicio no puede quedar bajo la vista de gestión del mismo dominio.
    assert resolve_vista_from_api_path("/api/v1/metas/mis-metas") == "mis-metas"
    assert resolve_vista_from_api_path("/api/v1/ciclo-desempeno/mis-resultados") == "mi-desempeno"
    assert resolve_vista_from_api_path("/api/v1/encuestas-rh/mis-encuestas") == "mis-encuestas-rh"
    assert (
        resolve_vista_from_api_path("/api/v1/level-up/opls/mis-aprobaciones")
        == "mis-aprobaciones-opl"
    )


def test_rutas_exentas_no_resuelven_a_vista():
    for path in (
        "/api/v1/auth/login",
        "/api/v1/notificaciones",
        "/api/v1/rh-permisos/me",
        "/api/v1/vistas-rol/config",
    ):
        assert resolve_vista_from_api_path(path) is None, path


def test_resolve_vista_from_hash_y_nav_item():
    assert resolve_vista_from_hash("#/") == "dashboard"
    assert resolve_vista_from_hash("#/comedor") == "comedor"
    assert resolve_vista_from_hash("#/comedor/gestion") == "comedor-gestion"
    assert resolve_vista_from_hash("#/talento/mis-metas") == "mis-metas"
    assert nav_item_to_vista_key("mis-firmas") == "mis-firmas"
    assert nav_item_to_vista_key("no-existe") is None


def test_catalogo_expone_los_campos_del_registro():
    items = catalogo_para_api()
    assert len(items) == len(VISTAS_ROL)
    por_key = {i["key"]: i for i in items}
    dashboard = por_key["dashboard"]
    assert dashboard["label"]
    assert dashboard["grupo"]
    assert dashboard["activa"] is True
    assert dashboard["roles"] == list(ROLES_CONFIGURABLES)
    # Toda vista debe declarar descripción y ruta: son campos del catálogo, no adorno.
    for item in items:
        assert item["descripcion"], item["key"]
        assert item["ruta"], item["key"]


def test_validaciones_de_claves_y_roles():
    assert validate_vista_keys(["dashboard", "no-existe"]) == ["no-existe"]
    assert validate_roles(["supervisor", "director", "rh"]) == ["director", "rh"]


# ─────────────────────────── gate de acceso ───────────────────────────


@pytest.mark.asyncio
async def test_vista_habilitada_amplia_el_acceso_del_rol(client: AsyncClient, db):
    """Encender una vista da acceso real al API, no solo al menú."""
    admin = await _make_admin(db, "admin_amplia@test.com")
    sup = await make_empleado(db, rol="supervisor", email="sup_amplia@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    sup_h = await auth_headers(client, sup)

    # Por defecto `viajes-laborales` está apagada: sin acceso.
    assert (await client.get(VIAJES_URL, headers=sup_h)).status_code == 403

    await _configurar(
        client, admin_h,
        [{"rol": "supervisor", "vista_key": "viajes-laborales", "habilitado": True}],
    )
    assert (await client.get(VIAJES_URL, headers=sup_h)).status_code == 200


@pytest.mark.asyncio
async def test_vista_deshabilitada_rechaza_aunque_entre_por_url(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_apaga@test.com")
    sup = await make_empleado(db, rol="supervisor", email="sup_apaga@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    sup_h = await auth_headers(client, sup)

    assert (await client.get(CICLOS_URL, headers=sup_h)).status_code == 200

    await _configurar(
        client, admin_h,
        [{"rol": "supervisor", "vista_key": "ciclo-desempeno", "habilitado": False}],
    )
    res = await client.get(CICLOS_URL, headers=sup_h)
    assert res.status_code == 403
    assert "deshabilitada" in res.json()["detail"]


@pytest.mark.asyncio
async def test_empleado_supervisor_y_gerente_se_configuran_por_separado(
    client: AsyncClient, db
):
    admin = await _make_admin(db, "admin_indep@test.com")
    emp = await make_empleado(db, rol="empleado", email="emp_indep@test.com")
    sup = await make_empleado(db, rol="supervisor", email="sup_indep@test.com")
    ger = await make_empleado(db, rol="gerente", email="ger_indep@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    emp_h = await auth_headers(client, emp)
    sup_h = await auth_headers(client, sup)
    ger_h = await auth_headers(client, ger)

    # Encender solo para gerente no debe alcanzar a los otros dos.
    await _configurar(
        client, admin_h,
        [{"rol": "gerente", "vista_key": "viajes-laborales", "habilitado": True}],
    )
    assert (await client.get(VIAJES_URL, headers=ger_h)).status_code == 200
    assert (await client.get(VIAJES_URL, headers=sup_h)).status_code == 403
    assert (await client.get(VIAJES_URL, headers=emp_h)).status_code == 403

    # Apagar para gerente tampoco debe tocar a supervisor.
    await _configurar(
        client, admin_h,
        [{"rol": "gerente", "vista_key": "ciclo-desempeno", "habilitado": False}],
    )
    assert (await client.get(CICLOS_URL, headers=ger_h)).status_code == 403
    assert (await client.get(CICLOS_URL, headers=sup_h)).status_code == 200


@pytest.mark.asyncio
async def test_empleado_gana_acceso_a_una_vista_de_gestion(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_emp@test.com")
    emp = await make_empleado(db, rol="empleado", email="emp_amplia@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    emp_h = await auth_headers(client, emp)

    assert (await client.get(VIAJES_URL, headers=emp_h)).status_code == 403
    await _configurar(
        client, admin_h,
        [{"rol": "empleado", "vista_key": "viajes-laborales", "habilitado": True}],
    )
    assert (await client.get(VIAJES_URL, headers=emp_h)).status_code == 200


@pytest.mark.asyncio
async def test_tener_la_vista_de_fabrica_no_abre_sus_endpoints_de_administracion(
    client: AsyncClient, db
):
    """Una vista encendida de origen no amplía nada: sus endpoints de gestión siguen
    reservados a quien su `role_checker` diga."""
    sup = await make_empleado(db, rol="supervisor", email="sup_noadmin_ciclo@test.com")
    await _sembrar_defaults(db)
    sup_h = await auth_headers(client, sup)

    # `ciclo-desempeno` está encendida por defecto para supervisor…
    assert (await client.get(CICLOS_URL, headers=sup_h)).status_code == 200
    # …pero crear ciclos sigue siendo exclusivo de RH.
    res = await client.post(
        CICLOS_URL,
        headers=sup_h,
        json={"nombre": "Ciclo X", "anio": 2026, "fecha_inicio": "2026-01-01",
              "fecha_fin": "2026-12-31"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_apagar_una_vista_ya_apagada_de_fabrica_no_cierra_el_api_del_rol(
    client: AsyncClient, db
):
    """El gate solo retira lo que concedió: no cierra accesos que vienen de `role_checker`."""
    admin = await _make_admin(db, "admin_noop@test.com")
    sup = await make_empleado(db, rol="supervisor", email="sup_noop@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    sup_h = await auth_headers(client, sup)

    # `comedor-gestion` está apagada de fábrica para supervisor, pero su
    # `role_checker` sí lo admite: apagarla explícitamente no debe cambiar eso.
    await _configurar(
        client, admin_h,
        [{"rol": "supervisor", "vista_key": "comedor-gestion", "habilitado": False}],
    )
    res = await client.get("/api/v1/comedor/comedores", headers=sup_h)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_admin_rh_conserva_acceso_con_todo_apagado(client: AsyncClient, db):
    """Requisito 8: los permisos administrativos no dependen de esta configuración."""
    admin = await _make_admin(db, "admin_vistas@test.com")
    await _sembrar_defaults(db)
    admin_h = await auth_headers(client, admin)

    await _configurar(
        client, admin_h,
        [
            {"rol": rol, "vista_key": key, "habilitado": False}
            for rol in ROLES_CONFIGURABLES
            for key in all_vista_keys()
        ],
    )

    assert (await client.get(CICLOS_URL, headers=admin_h)).status_code == 200
    assert (await client.get(CONFIG_URL, headers=admin_h)).status_code == 200


@pytest.mark.asyncio
async def test_autoservicio_y_gestion_son_vistas_distintas(client: AsyncClient, db):
    """«Mi desempeño» y «Ciclo de desempeño» comparten dominio pero no permiso."""
    admin = await _make_admin(db, "admin_self@test.com")
    emp = await make_empleado(db, rol="empleado", email="emp_self@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    emp_h = await auth_headers(client, emp)
    MIS_RESULTADOS = "/api/v1/ciclo-desempeno/mis-resultados"

    # Apagar la vista de gestión no toca el autoservicio.
    await _configurar(
        client, admin_h,
        [{"rol": "empleado", "vista_key": "ciclo-desempeno", "habilitado": False}],
    )
    assert (await client.get(MIS_RESULTADOS, headers=emp_h)).status_code == 200

    # Apagar «Mi desempeño» sí lo cierra: es justo la vista que se retiró.
    await _configurar(
        client, admin_h,
        [{"rol": "empleado", "vista_key": "mi-desempeno", "habilitado": False}],
    )
    assert (await client.get(MIS_RESULTADOS, headers=emp_h)).status_code == 403


@pytest.mark.asyncio
async def test_rol_no_configurable_no_se_ve_afectado(client: AsyncClient, db):
    """`director` queda fuera del alcance: su acceso no cambia."""
    admin = await _make_admin(db, "admin_dir@test.com")
    director = await make_empleado(db, rol="director", email="dir_vistas@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    dir_h = await auth_headers(client, director)

    await _configurar(
        client, admin_h,
        [
            {"rol": rol, "vista_key": key, "habilitado": False}
            for rol in ROLES_CONFIGURABLES
            for key in all_vista_keys()
        ],
    )

    me = (await client.get("/api/v1/vistas-rol/me", headers=dir_h)).json()
    assert me["configurable"] is False
    assert all(me["vistas"].values())
    # Y su acceso real sigue intacto.
    assert (await client.get("/api/v1/solicitudes", headers=dir_h)).status_code == 200


# ─────────────────────────── API de administración ───────────────────────────


@pytest.mark.asyncio
async def test_config_solo_para_admin_rh(client: AsyncClient, db):
    sup = await make_empleado(db, rol="supervisor", email="sup_noadmin@test.com")
    await _sembrar_defaults(db)
    headers = await auth_headers(client, sup)

    assert (await client.get(CONFIG_URL, headers=headers)).status_code == 403
    assert (await client.get("/api/v1/vistas-rol/catalogo", headers=headers)).status_code == 403
    res = await client.put(
        CONFIG_URL,
        headers=headers,
        json={"cambios": [{"rol": "empleado", "vista_key": "actas", "habilitado": True}]},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_guarda_y_la_configuracion_persiste(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_guarda@test.com")
    await _sembrar_defaults(db)
    headers = await auth_headers(client, admin)

    body = await _configurar(
        client, headers,
        [
            {"rol": "empleado", "vista_key": "actas", "habilitado": True},
            {"rol": "supervisor", "vista_key": "metricas", "habilitado": False},
        ],
    )
    assert body["config"]["empleado"]["actas"] is True
    assert body["config"]["supervisor"]["metricas"] is False

    # Persistido: una lectura nueva devuelve lo guardado.
    leido = (await client.get(CONFIG_URL, headers=headers)).json()
    assert leido["config"]["empleado"]["actas"] is True
    assert leido["config"]["supervisor"]["metricas"] is False
    assert leido["roles"] == list(ROLES_CONFIGURABLES)


@pytest.mark.asyncio
async def test_guardar_rechaza_claves_y_roles_invalidos(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_valida@test.com")
    await _sembrar_defaults(db)
    headers = await auth_headers(client, admin)

    res = await client.put(
        CONFIG_URL,
        headers=headers,
        json={"cambios": [{"rol": "empleado", "vista_key": "no-existe", "habilitado": True}]},
    )
    assert res.status_code == 400
    assert "no-existe" in res.json()["detail"]

    res = await client.put(
        CONFIG_URL,
        headers=headers,
        json={"cambios": [{"rol": "director", "vista_key": "actas", "habilitado": True}]},
    )
    assert res.status_code == 400
    assert "director" in res.json()["detail"]


@pytest.mark.asyncio
async def test_restaurar_defaults_vuelve_al_acceso_original(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_restaura@test.com")
    await _sembrar_defaults(db)
    headers = await auth_headers(client, admin)

    await _configurar(
        client, headers,
        [{"rol": "empleado", "vista_key": "actas", "habilitado": True}],
    )
    res = await client.post("/api/v1/vistas-rol/config/restaurar", headers=headers)
    assert res.status_code == 200
    assert res.json()["config"] == defaults_por_rol()


@pytest.mark.asyncio
async def test_me_devuelve_las_vistas_del_rol(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_me@test.com")
    sup = await make_empleado(db, rol="supervisor", email="sup_me@test.com")
    await _sembrar_defaults(db)

    admin_h = await auth_headers(client, admin)
    await _configurar(
        client, admin_h,
        [{"rol": "supervisor", "vista_key": "metricas", "habilitado": False}],
    )

    body = (
        await client.get("/api/v1/vistas-rol/me", headers=await auth_headers(client, sup))
    ).json()
    assert body["rol"] == "supervisor"
    assert body["configurable"] is True
    assert body["vistas"]["metricas"] is False
    assert body["vistas"]["ciclo-desempeno"] is True


@pytest.mark.asyncio
async def test_me_de_admin_no_es_configurable(client: AsyncClient, db):
    admin = await _make_admin(db, "admin_me2@test.com")
    await _sembrar_defaults(db)
    headers = await auth_headers(client, admin)

    await _configurar(
        client, headers,
        [
            {"rol": rol, "vista_key": key, "habilitado": False}
            for rol in ROLES_CONFIGURABLES
            for key in all_vista_keys()
        ],
    )
    body = (await client.get("/api/v1/vistas-rol/me", headers=headers)).json()
    assert body["configurable"] is False
    assert all(body["vistas"].values())


# ─────────────────────────── seed ───────────────────────────


@pytest.mark.asyncio
async def test_seed_es_idempotente_y_no_pisa_lo_configurado(client: AsyncClient, db):
    from sqlalchemy import func, select

    from app.models.roles import Rol
    from app.models.vistas_rol import VistaRol

    admin = await _make_admin(db, "admin_seed@test.com")
    for rol in ROLES_CONFIGURABLES:
        await _get_or_create_rol(db, rol)

    creadas = await ensure_vistas_rol_defaults(db)
    assert creadas == len(all_vista_keys()) * len(ROLES_CONFIGURABLES)
    await db.flush()

    headers = await auth_headers(client, admin)
    await _configurar(
        client, headers, [{"rol": "empleado", "vista_key": "actas", "habilitado": True}]
    )

    # Volver a sembrar no crea nada ni pisa lo que el admin configuró.
    assert await ensure_vistas_rol_defaults(db) == 0
    total = (await db.execute(select(func.count()).select_from(VistaRol))).scalar_one()
    assert total == creadas

    rol_id = (await db.execute(select(Rol.id).where(Rol.nombre == "empleado"))).scalar_one()
    sigue = (
        await db.execute(
            select(VistaRol.habilitado).where(
                VistaRol.rol_id == rol_id, VistaRol.vista_key == "actas"
            )
        )
    ).scalar_one()
    assert sigue is True
