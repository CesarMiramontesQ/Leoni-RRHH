"""Ajustes Comedor: API de jornadas, turnos y validación empleado+fecha.

Cubre las dos mitades del requerimiento: que el CRUD funcione sobre los catálogos
replicados (`levelup_turnos`, `levelup_horarios`) y que los **dos** sistemas de
autorización protejan los endpoints (módulos RH por usuario y vistas por rol), no solo el
menú del frontend. Sustituye a la versión por turno de esta misma suite; los casos de
permisos se conservan tal cual, apuntando a las rutas nuevas.
"""

from datetime import datetime, time

import pytest
from httpx import AsyncClient

from app.core import vista_rol_cache
from app.core.vista_rol_registry import ROLES_CONFIGURABLES
from app.utils.seed_vistas_rol import ensure_vistas_rol_defaults
from tests.conftest import (
    _get_or_create_rol,
    auth_headers,
    make_empleado,
    make_horario,
    make_turno,
    make_turno_empleado,
    make_turno_uso,
    make_ventana_comida,
    reset_turnos_horario,
)

JORNADAS_URL = "/api/v1/comedor/jornadas-comida"
TURNOS_URL = "/api/v1/comedor/turnos-comida"
VENTANA_URL = "/api/v1/comedor/ventana-comida"
CONFIG_VISTAS_URL = "/api/v1/vistas-rol/config"

ROT_PAT = "5:003,2:002,5:002,0,1:006,1:002,6:001,1:001"
ROT_INI = datetime(2020, 3, 9)


def guardar_url(ho_codigo: str) -> str:
    return f"{JORNADAS_URL}/{ho_codigo}"


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


async def _catalogo_minimo(db):
    await make_horario(db, "001", "Matutino 6:00 - 14:00", intime="0600", outtime="1400")
    await make_horario(db, "003", "Nocturno 22:00 - 06:00", intime="2200", outtime="0600")
    await make_turno(db, "01", "Matutino", tips=(0, 0, 0, 0, 0, 0, 2), hors=("001",) * 7)


# ───────────────────────────── consulta y guardado ─────────────────────────────


@pytest.mark.asyncio
async def test_rh_lista_jornadas_sin_ventana_asignada(client: AsyncClient, db):
    await _catalogo_minimo(db)
    rh = await make_empleado(
        db, rol="rh", email="rh_jorn_list@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(JORNADAS_URL, headers=hdrs)

    assert res.status_code == 200, res.text
    jornadas = {j["ho_codigo"]: j for j in res.json()}
    assert "001" in jornadas
    assert jornadas["001"]["hora_inicio_comida"] is None
    assert jornadas["001"]["turnos"] == ["01"]


@pytest.mark.asyncio
async def test_rh_guarda_y_actualiza_la_ventana_de_una_jornada(client: AsyncClient, db):
    await _catalogo_minimo(db)
    rh = await make_empleado(
        db, rol="rh", email="rh_jorn_save@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.put(
        guardar_url("001"),
        headers=hdrs,
        json={"hora_inicio_comida": "10:00", "hora_fin_comida": "10:30"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["hora_inicio_comida"] == "10:00:00"

    res = await client.put(
        guardar_url("001"),
        headers=hdrs,
        json={"hora_inicio_comida": "11:00", "hora_fin_comida": "11:30"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["hora_inicio_comida"] == "11:00:00"


@pytest.mark.asyncio
async def test_una_ventana_que_cruza_medianoche_se_acepta(client: AsyncClient, db):
    """La jornada de noche come cerca de las 00:00; exigir inicio < fin la bloquearía."""
    await _catalogo_minimo(db)
    rh = await make_empleado(
        db, rol="rh", email="rh_jorn_media@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.put(
        guardar_url("003"),
        headers=hdrs,
        json={"hora_inicio_comida": "23:30", "hora_fin_comida": "00:30"},
    )

    assert res.status_code == 200, res.text
    assert res.json()["hora_fin_comida"] == "00:30:00"


@pytest.mark.asyncio
async def test_una_ventana_de_duracion_cero_se_rechaza(client: AsyncClient, db):
    await _catalogo_minimo(db)
    rh = await make_empleado(
        db, rol="rh", email="rh_jorn_cero@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.put(
        guardar_url("001"),
        headers=hdrs,
        json={"hora_inicio_comida": "10:00", "hora_fin_comida": "10:00"},
    )

    assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_jornada_inexistente_devuelve_404(client: AsyncClient, db):
    await _catalogo_minimo(db)
    rh = await make_empleado(
        db, rol="rh", email="rh_jorn_404@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.put(
        guardar_url("NOPE"),
        headers=hdrs,
        json={"hora_inicio_comida": "10:00", "hora_fin_comida": "10:30"},
    )

    assert res.status_code == 404, res.text


@pytest.mark.asyncio
async def test_el_resumen_distingue_turno_fijo_de_rotativo(client: AsyncClient, db):
    await _catalogo_minimo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    rh = await make_empleado(
        db, rol="rh", email="rh_turn_tipo@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(f"{TURNOS_URL}?solo_en_uso=false", headers=hdrs)

    assert res.status_code == 200, res.text
    turnos = {t["tu_codigo"]: t for t in res.json()}
    assert turnos["01"]["tipo_turno"] == "FIJO"
    assert turnos["ROT321"]["tipo_turno"] == "ROTATIVO"
    assert turnos["ROT321"]["longitud_ciclo"] == 21
    assert len(turnos["ROT321"]["bloques"]) == 7


# ───────────────────────────── filtro por uso ─────────────────────────────


@pytest.mark.asyncio
async def test_por_defecto_solo_se_listan_los_turnos_con_personal(client: AsyncClient, db):
    await _catalogo_minimo(db)
    await make_turno(db, "77", "Turno sin gente", hors=("001",) * 7)
    await make_turno_uso(db, "01", 181)
    rh = await make_empleado(
        db, rol="rh", email="rh_turn_uso@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(TURNOS_URL, headers=hdrs)

    codigos = {t["tu_codigo"] for t in res.json()}
    assert codigos == {"01"}


@pytest.mark.asyncio
async def test_con_la_cache_vacia_no_se_filtra_nada(client: AsyncClient, db):
    """Antes de la primera corrida del sync, filtrar dejaría la pantalla sin turnos."""
    await _catalogo_minimo(db)
    await make_turno(db, "77", "Turno sin gente", hors=("001",) * 7)
    rh = await make_empleado(
        db, rol="rh", email="rh_turn_cache@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(TURNOS_URL, headers=hdrs)

    assert {t["tu_codigo"] for t in res.json()} == {"01", "77"}


@pytest.mark.asyncio
async def test_una_jornada_ya_configurada_no_se_oculta_al_quedarse_sin_gente(
    client: AsyncClient, db
):
    """Esconder un dato que alguien capturó sería peor que una fila de más.

    La salvaguarda vive en la lista de **jornadas**, que es donde se captura el dato. En
    la de turnos no aplica: como la configuración cuelga de la jornada y las jornadas se
    comparten, exentar del filtro a todo turno que herede una jornada configurada haría
    que «solo turnos en uso» no filtrara nada.
    """
    await _catalogo_minimo(db)
    await make_ventana_comida(db, "001", time(10, 0), time(10, 30))
    await make_turno_uso(db, "99", 5)  # la caché existe, pero no cubre al turno 01
    rh = await make_empleado(
        db, rol="rh", email="rh_turn_conf@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(JORNADAS_URL, headers=hdrs)
    assert "001" in {j["ho_codigo"] for j in res.json()}

    # El turno sin personal sí desaparece del resumen.
    res = await client.get(TURNOS_URL, headers=hdrs)
    assert "01" not in {t["tu_codigo"] for t in res.json()}


@pytest.mark.asyncio
async def test_los_turnos_inactivos_se_ocultan_salvo_que_se_pidan(client: AsyncClient, db):
    await _catalogo_minimo(db)
    await make_turno(db, "09", "Turno retirado", activo="N", hors=("001",) * 7)
    rh = await make_empleado(
        db, rol="rh", email="rh_turn_inac@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(TURNOS_URL, headers=hdrs)
    assert "09" not in {t["tu_codigo"] for t in res.json()}

    res = await client.get(f"{TURNOS_URL}?incluir_inactivos=true", headers=hdrs)
    assert "09" in {t["tu_codigo"] for t in res.json()}


# ───────────────────────────── validación empleado + fecha ─────────────────────────────


@pytest.mark.asyncio
async def test_la_validacion_devuelve_turno_posicion_y_ventana(client: AsyncClient, db):
    await _catalogo_minimo(db)
    await make_ventana_comida(db, "003", time(1, 0), time(1, 30))
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    rh = await make_empleado(
        db, rol="rh", email="rh_valida@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    res = await client.get(
        f"{VENTANA_URL}?no_empleado=80&fecha=2020-03-09", headers=hdrs
    )

    assert res.status_code == 200, res.text
    cuerpo = res.json()
    assert cuerpo["tu_codigo"] == "ROT321"
    assert cuerpo["tipo_turno"] == "ROTATIVO"
    assert cuerpo["posicion_ciclo"] == 1
    assert cuerpo["longitud_ciclo"] == 21
    assert cuerpo["ho_codigo"] == "003"
    assert cuerpo["hora_inicio_comida"] == "01:00:00"


@pytest.mark.asyncio
async def test_la_validacion_de_un_dia_de_descanso_explica_el_motivo(
    client: AsyncClient, db
):
    await _catalogo_minimo(db)
    await make_turno(db, "ROT321", "3a2a1a", rit_pat=ROT_PAT, rit_ini=ROT_INI)
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    rh = await make_empleado(
        db, rol="rh", email="rh_valida_desc@test.leoni", password="RhJorn4s!"
    )
    hdrs = await auth_headers(client, rh, password="RhJorn4s!")

    # Día 6 del ciclo.
    res = await client.get(
        f"{VENTANA_URL}?no_empleado=80&fecha=2020-03-14", headers=hdrs
    )

    cuerpo = res.json()
    assert cuerpo["estatus"] == "DESCANSO"
    assert cuerpo["motivo_sin_ventana"] == "DESCANSO"
    assert cuerpo["hora_inicio_comida"] is None


# ───────────────────────────── permisos RH por módulo ─────────────────────────────


@pytest.mark.asyncio
async def test_empleado_sin_permiso_no_consulta_ni_guarda(client: AsyncClient, db):
    await _catalogo_minimo(db)
    emp = await make_empleado(
        db, rol="empleado", email="emp_jorn_403@test.leoni", password="Emp0Jorn!"
    )
    hdrs = await auth_headers(client, emp, password="Emp0Jorn!")

    assert (await client.get(JORNADAS_URL, headers=hdrs)).status_code == 403
    assert (await client.get(TURNOS_URL, headers=hdrs)).status_code == 403
    # La herramienta de validación expone la misma información y va con el mismo candado.
    res = await client.get(f"{VENTANA_URL}?no_empleado=80&fecha=2026-08-11", headers=hdrs)
    assert res.status_code == 403, res.text
    res = await client.put(
        guardar_url("001"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_modulo_comedor_ajustes_concede_acceso(client: AsyncClient, db):
    await _catalogo_minimo(db)
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_jorn_modulo@test.leoni",
        password="Emp0Jorn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-ajustes": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Jorn!")

    assert (await client.get(JORNADAS_URL, headers=hdrs)).status_code == 200
    assert (await client.get(TURNOS_URL, headers=hdrs)).status_code == 200
    res = await client.get(f"{VENTANA_URL}?no_empleado=80&fecha=2026-08-11", headers=hdrs)
    assert res.status_code == 200, res.text
    res = await client.put(
        guardar_url("001"),
        headers=hdrs,
        json={"hora_inicio_comida": "13:00", "hora_fin_comida": "14:00"},
    )
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_otro_modulo_de_comedor_no_alcanza(client: AsyncClient, db):
    """Los otros módulos de la sección no dan acceso a los ajustes."""
    await _catalogo_minimo(db)
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_jorn_otromod@test.leoni",
        password="Emp0Jorn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-registro": True, "comedor-planear": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Jorn!")

    assert (await client.get(JORNADAS_URL, headers=hdrs)).status_code == 403
    assert (await client.get(TURNOS_URL, headers=hdrs)).status_code == 403


@pytest.mark.asyncio
async def test_el_mismo_permiso_cubre_comedores_y_jornadas(client: AsyncClient, db):
    """La pantalla fusionó ambas pestañas, así que un solo módulo abre las dos APIs."""
    operador = await make_empleado(
        db,
        rol="empleado",
        email="emp_jorn_fusion@test.leoni",
        password="Emp0Jorn!",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-ajustes": True},
    )
    hdrs = await auth_headers(client, operador, password="Emp0Jorn!")

    assert (await client.get(JORNADAS_URL, headers=hdrs)).status_code == 200
    res = await client.post(
        "/api/v1/comedor/comedores",
        headers=hdrs,
        json={"nombre": "Comedor fusión", "ubicacion": None, "capacidad": 50, "activo": True},
    )
    assert res.status_code == 200, res.text


# ───────────────────────────── vistas por rol ─────────────────────────────


@pytest.mark.asyncio
async def test_vista_por_rol_habilita_y_retira_el_acceso(client: AsyncClient, db):
    await _catalogo_minimo(db)
    admin = await make_empleado(
        db,
        rol="supervisor",
        email="admin_jorn_vista@test.leoni",
        puede_administrar_permisos_rh=True,
    )
    sup = await make_empleado(db, rol="supervisor", email="sup_jorn_vista@test.leoni")
    await _sembrar_defaults_vistas(db)

    admin_h = await auth_headers(client, admin)
    sup_h = await auth_headers(client, sup)

    # Nace apagada para todos los roles configurables.
    assert (await client.get(JORNADAS_URL, headers=sup_h)).status_code == 403

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
    assert (await client.get(JORNADAS_URL, headers=sup_h)).status_code == 200
    assert (await client.get(TURNOS_URL, headers=sup_h)).status_code == 200

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
    assert (await client.get(JORNADAS_URL, headers=sup_h)).status_code == 403
