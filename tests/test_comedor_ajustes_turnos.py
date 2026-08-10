"""Ajustes Comedor: horario de comida por turno (`levelup_comedor_horarios_turno`).

Cubre las dos mitades del requerimiento: que el CRUD funcione sobre el catálogo
replicado `levelup_turnos` y que los **dos** sistemas de autorización lo protejan
(módulos RH por usuario y vistas por rol), no solo el menú del frontend.
"""

import pytest
from httpx import AsyncClient

from app.core import vista_rol_cache
from app.core.vista_rol_registry import ROLES_CONFIGURABLES
from app.utils.seed_vistas_rol import ensure_vistas_rol_defaults
from tests.conftest import (
    _get_or_create_rol,
    auth_headers,
    make_empleado,
    make_turno,
    make_turno_uso,
    reset_turnos_horario,
)

LISTA_URL = "/api/v1/comedor/turnos-horario"
CONFIG_VISTAS_URL = "/api/v1/vistas-rol/config"


def guardar_url(tu_codigo: str) -> str:
    return f"{LISTA_URL}/{tu_codigo}"


@pytest.fixture(autouse=True)
async def _reset(db):
    """El listado es estado global y el cliente commitea sobre la conexión compartida."""
    await reset_turnos_horario(db)
    vista_rol_cache.invalidate()
    yield
    vista_rol_cache.invalidate()


async def _sembrar_defaults_vistas(db) -> None:
    for rol in ROLES_CONFIGURABLES:
        await _get_or_create_rol(db, rol)
    await ensure_vistas_rol_defaults(db)
    await db.flush()
    vista_rol_cache.invalidate()


# ───────────────────────────── consulta y guardado ─────────────────────────────


@pytest.mark.asyncio
async def test_rh_lista_turnos_sin_horario_asignado(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino - 06:00-14:00")
    await make_turno(db, "02", "Vespertino - 14:00-22:00")
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_list@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    res = await client.get(LISTA_URL, headers=hdrs)
    assert res.status_code == 200, res.text
    items = res.json()
    assert [i["tu_codigo"] for i in items] == ["01", "02"]
    assert items[0]["descripcion"] == "Matutino - 06:00-14:00"
    assert items[0]["activo"] is True
    # Sin horario configurado los campos llegan vacíos para que la UI los muestre así.
    assert items[0]["hora_inicio_comida"] is None
    assert items[0]["hora_fin_comida"] is None
    assert items[0]["actualizado_en"] is None


@pytest.mark.asyncio
async def test_rh_guarda_y_actualiza_el_horario_de_un_turno(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino")
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_save@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    res = await client.put(
        guardar_url("01"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["hora_inicio_comida"] == "13:00:00"
    assert res.json()["hora_fin_comida"] == "14:00:00"

    listado = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert listado[0]["hora_inicio_comida"] == "13:00:00"
    assert listado[0]["actualizado_en"] is not None

    # Segundo guardado: actualiza la misma fila, no crea otra.
    res = await client.put(
        guardar_url("01"),
        headers=hdrs,
        json={"hora_inicio_comida": "14:00", "hora_fin_comida": "15:30"},
    )
    assert res.status_code == 200, res.text
    listado = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert len(listado) == 1
    assert listado[0]["hora_inicio_comida"] == "14:00:00"
    assert listado[0]["hora_fin_comida"] == "15:30:00"


@pytest.mark.asyncio
async def test_codigo_con_relleno_de_espacios_resuelve_al_mismo_turno(
    client: AsyncClient, db
):
    """`tu_codigo` es CHAR(6) y en TRESS viene como `'01    '`; la API recibe `'01'`."""
    turno = await make_turno(db, "01", "Matutino")
    assert turno.tu_codigo == "01    "
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_pad@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    res = await client.put(
        guardar_url("01"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["tu_codigo"] == "01"


@pytest.mark.asyncio
async def test_turno_inexistente_devuelve_404(client: AsyncClient, db):
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_404@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    res = await client.put(
        guardar_url("ZZ"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 404, res.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"hora_inicio_comida": "14:00", "hora_fin_comida": "13:00"},
        {"hora_inicio_comida": "13:00", "hora_fin_comida": "13:00"},
        {"hora_fin_comida": "14:00"},
        {"hora_inicio_comida": "13:00"},
    ],
    ids=["inicio_mayor", "inicio_igual", "falta_inicio", "falta_fin"],
)
async def test_rango_invalido_devuelve_422(client: AsyncClient, db, payload):
    await make_turno(db, "01", "Matutino")
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_422@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    res = await client.put(guardar_url("01"), headers=hdrs, json=payload)
    assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_filtro_de_turnos_inactivos(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino", activo="S")
    await make_turno(db, "09", "Turno retirado", activo="N")
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_filtro@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    solo_activos = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert [i["tu_codigo"] for i in solo_activos] == ["01"]

    todos = (
        await client.get(f"{LISTA_URL}?incluir_inactivos=true", headers=hdrs)
    ).json()
    assert [i["tu_codigo"] for i in todos] == ["01", "09"]
    assert todos[1]["activo"] is False


# ───────────────────────── filtro por turnos en uso ─────────────────────────


@pytest.mark.asyncio
async def test_por_defecto_solo_lista_turnos_con_personal(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino")
    await make_turno(db, "77", "Turno sin gente")
    await make_turno_uso(db, "01", 181)
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_uso@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    items = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert [i["tu_codigo"] for i in items] == ["01"]
    assert items[0]["empleados_activos"] == 181

    todos = (await client.get(f"{LISTA_URL}?solo_en_uso=false", headers=hdrs)).json()
    assert [i["tu_codigo"] for i in todos] == ["01", "77"]
    # Sin fila en la caché el conteo es desconocido, que no es lo mismo que cero.
    assert todos[1]["empleados_activos"] is None


@pytest.mark.asyncio
async def test_cache_vacia_no_filtra_nada(client: AsyncClient, db):
    """Antes de la primera corrida del sync, filtrar dejaría la pantalla sin turnos."""
    await make_turno(db, "01", "Matutino")
    await make_turno(db, "77", "Otro")
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_cachevacia@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    items = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert [i["tu_codigo"] for i in items] == ["01", "77"]


@pytest.mark.asyncio
async def test_un_turno_con_horario_no_se_oculta_aunque_se_quede_sin_gente(
    client: AsyncClient, db
):
    """Esconder un dato ya capturado sería peor que mostrar una fila de más."""
    await make_turno(db, "01", "Matutino")
    await make_turno(db, "77", "Turno vaciado")
    await make_turno_uso(db, "01", 181)
    await make_turno_uso(db, "77", 0)
    rh = await make_empleado(
        db, rol="rh", email="rh_turnos_conservar@test.leoni", password="RhTurn0s!"
    )
    hdrs = await auth_headers(client, rh, password="RhTurn0s!")

    assert [i["tu_codigo"] for i in (await client.get(LISTA_URL, headers=hdrs)).json()] == ["01"]

    res = await client.put(
        guardar_url("77"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 200, res.text

    items = (await client.get(LISTA_URL, headers=hdrs)).json()
    assert [i["tu_codigo"] for i in items] == ["01", "77"]


# ───────────────────────────── permisos RH por módulo ─────────────────────────────


@pytest.mark.asyncio
async def test_empleado_sin_permiso_no_consulta_ni_guarda(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino")
    emp = await make_empleado(
        db, rol="empleado", email="emp_turnos_403@test.leoni", password="Emp0Turn!"
    )
    hdrs = await auth_headers(client, emp, password="Emp0Turn!")

    assert (await client.get(LISTA_URL, headers=hdrs)).status_code == 403
    res = await client.put(
        guardar_url("01"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_modulo_comedor_ajustes_concede_acceso(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino")
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_turnos_modulo@test.leoni",
        password="Emp0Turn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-ajustes": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Turn!")

    assert (await client.get(LISTA_URL, headers=hdrs)).status_code == 200
    res = await client.put(
        guardar_url("01"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_otro_modulo_de_comedor_no_alcanza(client: AsyncClient, db):
    """Los otros módulos de la sección no dan acceso a los ajustes.

    Tener Registro Comedor o Planeación no basta: la administración de comedores y el
    horario de comida son un permiso aparte (`comedor-ajustes`).
    """
    await make_turno(db, "01", "Matutino")
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_turnos_otromod@test.leoni",
        password="Emp0Turn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-registro": True, "comedor-planear": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Turn!")

    assert (await client.get(LISTA_URL, headers=hdrs)).status_code == 403


@pytest.mark.asyncio
async def test_el_mismo_permiso_cubre_comedores_y_horarios(client: AsyncClient, db):
    """La pantalla fusionó ambas pestañas, así que un solo módulo abre las dos APIs."""
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_turnos_fusion@test.leoni",
        password="Emp0Turn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-ajustes": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Turn!")

    assert (await client.get(LISTA_URL, headers=hdrs)).status_code == 200
    res = await client.post(
        "/api/v1/comedor/comedores",
        headers=hdrs,
        json={"nombre": "Comedor fusión", "ubicacion": None, "capacidad": 50, "activo": True},
    )
    assert res.status_code == 200, res.text


# ───────────────────────────── vistas por rol ─────────────────────────────


@pytest.mark.asyncio
async def test_vista_por_rol_habilita_y_retira_el_acceso(client: AsyncClient, db):
    await make_turno(db, "01", "Matutino")
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_turnos_vista@test.leoni",
        puede_administrar_permisos_rh=True,
    )
    sup = await make_empleado(db, rol="supervisor", email="sup_turnos_vista@test.leoni")
    await _sembrar_defaults_vistas(db)

    admin_h = await auth_headers(client, admin)
    sup_h = await auth_headers(client, sup)

    # Nace apagada para todos los roles configurables.
    assert (await client.get(LISTA_URL, headers=sup_h)).status_code == 403

    res = await client.put(
        CONFIG_VISTAS_URL,
        headers=admin_h,
        json={
            "cambios": [
                {"rol": "supervisor", "vista_key": "comedor-ajustes", "habilitado": True}
            ]
        },
    )
    assert res.status_code == 200, res.text
    assert (await client.get(LISTA_URL, headers=sup_h)).status_code == 200

    res = await client.put(
        CONFIG_VISTAS_URL,
        headers=admin_h,
        json={
            "cambios": [
                {"rol": "supervisor", "vista_key": "comedor-ajustes", "habilitado": False}
            ]
        },
    )
    assert res.status_code == 200, res.text
    assert (await client.get(LISTA_URL, headers=sup_h)).status_code == 403
