# tests/test_ciclo_desempeno_api.py
"""Tests HTTP del modulo Ciclo de Desempeno (Tarea 5): router + registro de
modulo + scoping por equipo + self-service.

La logica de dominio (formulas de combinacion de senales, ciclo de vida,
9-Box, snapshot) ya esta cubierta a nivel service en
tests/test_ciclo_desempeno_service.py (Tarea 4); aqui se ejercita el router
end-to-end via `client`: permisos (RH por modulo, jefe con scoping de
equipo, self-service), serializacion y mapeo de errores.

Las senales de Metas/Evaluacion 360 se arman igual que en
tests/test_ciclo_desempeno_service.py: Metas via su propia API/servicio
(flujo real), Evaluacion 360 directo via ORM (el flujo completo de
campana ya esta cubierto en tests/test_evaluacion360.py).
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models.evaluacion360 import Eval360Campana, Eval360Escala, Eval360Participante, Eval360Resultado
from tests.conftest import auth_headers, make_empleado

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/ciclo-desempeno"
METAS_BASE = "/api/v1/metas"


def _fechas():
    hoy = date.today()
    return hoy.isoformat(), (hoy + timedelta(days=90)).isoformat()


async def _rh(db, **kw):
    # También se concede 'metas' porque los helpers de este módulo arman la
    # señal de Metas via la API real de /api/v1/metas (ver
    # _crear_meta_ciclo_cerrado_con_metas) con el mismo usuario RH.
    return await make_empleado(
        db, rol="rh", modulos_rh={"ciclo-desempeno": True, "metas": True}, **kw
    )


async def _jefe(db, **kw):
    return await make_empleado(db, rol="supervisor", **kw)


async def _empleado_de(db, jefe, **kw):
    return await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id, **kw)


# ══════════════════════════════════════════════════════════════════════════
# Helpers — Metas (senal 1), via API real de /api/v1/metas
# ══════════════════════════════════════════════════════════════════════════
async def _crear_meta_ciclo_cerrado_con_metas(client, headers_rh, headers_jefe, empleado, *, calificacion=80):
    """Crea un MetaCiclo, activa, el jefe crea una meta individual cerrada
    con `calificacion`, y RH cierra el ciclo de metas -- deja el meta_ciclo
    en estado "cerrado" (requisito de cierre no forzado de ciclo desempeno)."""
    inicio, fin = _fechas()
    resp = await client.post(
        f"{METAS_BASE}/ciclos",
        json={"nombre": "Metas para ciclo desempeno", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers_rh,
    )
    assert resp.status_code == 201, resp.text
    meta_ciclo = resp.json()
    resp_act = await client.post(f"{METAS_BASE}/ciclos/{meta_ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    resp_meta = await client.post(
        f"{METAS_BASE}/metas",
        json={
            "ciclo_id": meta_ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta calidad",
            "peso": 100,
            "resultados_clave": [],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta_id = resp_meta.json()["id"]

    resp_cerrar_meta = await client.post(
        f"{METAS_BASE}/metas/{meta_id}/cerrar",
        json={"calificacion": calificacion},
        headers=headers_jefe,
    )
    assert resp_cerrar_meta.status_code == 200, resp_cerrar_meta.text

    resp_cerrar_ciclo = await client.post(
        f"{METAS_BASE}/ciclos/{meta_ciclo['id']}/cerrar", headers=headers_rh
    )
    assert resp_cerrar_ciclo.status_code == 200, resp_cerrar_ciclo.text
    return meta_ciclo["id"]


# ══════════════════════════════════════════════════════════════════════════
# Helpers — Evaluacion 360 (senal 2), directo via ORM (ver docstring modulo)
# ══════════════════════════════════════════════════════════════════════════
async def _crear_campana_360(db, *, estado="activa", vmin=1, vmax=5) -> Eval360Campana:
    escala = Eval360Escala(nombre=f"Escala {vmin}-{vmax}", valor_min=vmin, valor_max=vmax)
    db.add(escala)
    await db.flush()
    campana = Eval360Campana(nombre="Campana 360 ciclo desempeno", estado=estado, escala_id=escala.id)
    db.add(campana)
    await db.flush()
    return campana


async def _agregar_participante_360(db, campana_id: int, empleado_id: int, *, calificacion_general=None):
    participante = Eval360Participante(
        campana_id=campana_id, empleado_id=empleado_id, estado="completada",
    )
    db.add(participante)
    await db.flush()
    if calificacion_general is not None:
        db.add(Eval360Resultado(
            participante_id=participante.id, competencia_id=None,
            calificacion_general=calificacion_general,
        ))
        await db.flush()


async def _crear_cd_ciclo(client, headers_rh, *, meta_ciclo_id=None, eval360_campana_id=None, nombre="Ciclo Desempeno"):
    inicio, fin = _fechas()
    resp = await client.post(
        f"{BASE}/ciclos",
        json={
            "nombre": nombre,
            "fecha_inicio": inicio,
            "fecha_fin": fin,
            "meta_ciclo_id": meta_ciclo_id,
            "eval360_campana_id": eval360_campana_id,
        },
        headers=headers_rh,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ══════════════════════════════════════════════════════════════════════════
# Flujo feliz: RH crea ciclo (metas + 360) -> activa -> jefe/RH capturan
# potencial -> RH cierra -> resultados con score, 9box, self-service.
# ══════════════════════════════════════════════════════════════════════════
async def test_flujo_completo_rh_jefe_empleado_end_to_end(client, db):
    rh = await _rh(db, email="cdrh1@leoni.test")
    jefe = await _jefe(db, email="cdjefe1@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp1@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_emp = await auth_headers(client, empleado)

    meta_ciclo_id = await _crear_meta_ciclo_cerrado_con_metas(
        client, headers_rh, headers_jefe, empleado, calificacion=80
    )
    campana = await _crear_campana_360(db, estado="cerrada")
    await _agregar_participante_360(db, campana.id, empleado.empleado_id, calificacion_general=4)

    ciclo = await _crear_cd_ciclo(
        client, headers_rh, meta_ciclo_id=meta_ciclo_id, eval360_campana_id=campana.id
    )
    assert ciclo["estado"] == "borrador"

    resp_activar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_activar.status_code == 200, resp_activar.text
    activado = resp_activar.json()
    assert activado["estado"] == "activo"
    assert activado["total_participantes"] == 1

    # Jefe (con scoping de su equipo) captura el potencial del empleado.
    resp_potencial = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}/potencial",
        json={"items": [{"empleado_id": empleado.empleado_id, "potencial": 90}]},
        headers=headers_jefe,
    )
    assert resp_potencial.status_code == 200, resp_potencial.text
    resultado_potencial = resp_potencial.json()[0]
    assert resultado_potencial["potencial"] == "90.00"
    assert resultado_potencial["banda_potencial"] == "alto"

    # 9box en vivo (antes de cerrar) refleja el segmento.
    resp_9box = await client.get(f"{BASE}/ciclos/{ciclo['id']}/9box", headers=headers_rh)
    assert resp_9box.status_code == 200, resp_9box.text
    nueve_box = resp_9box.json()
    assert nueve_box["ciclo_id"] == ciclo["id"]
    assert len(nueve_box["celdas"]) == 9

    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh)
    assert resp_cerrar.status_code == 200, resp_cerrar.text
    assert resp_cerrar.json()["estado"] == "cerrado"

    resp_resultados = await client.get(f"{BASE}/ciclos/{ciclo['id']}/resultados", headers=headers_rh)
    assert resp_resultados.status_code == 200, resp_resultados.text
    resultados = resp_resultados.json()
    assert len(resultados) == 1
    r = resultados[0]
    assert r["empleado_id"] == empleado.empleado_id
    assert r["calificacion_desempeno"] is not None
    assert r["banda_desempeno"] is not None
    assert r["potencial"] == "90.00"

    # Self-service: el empleado ve su propio resultado del ciclo cerrado.
    resp_mis = await client.get(f"{BASE}/mis-resultados", headers=headers_emp)
    assert resp_mis.status_code == 200, resp_mis.text
    mis_resultados = resp_mis.json()
    assert len(mis_resultados) == 1
    assert mis_resultados[0]["ciclo_id"] == ciclo["id"]
    assert mis_resultados[0]["calificacion_desempeno"] is not None
    # El potencial NO se expone en la vista self-service (schema no lo incluye).
    assert "potencial" not in mis_resultados[0]


# ══════════════════════════════════════════════════════════════════════════
# Permisos — scoping de equipo
# ══════════════════════════════════════════════════════════════════════════
async def test_jefe_de_otro_equipo_scope_vacio_en_resultados_y_9box_y_403_en_potencial(client, db):
    rh = await _rh(db, email="cdrh2@leoni.test")
    jefe = await _jefe(db, email="cdjefe2@leoni.test")
    otro_jefe = await _jefe(db, email="cdotrojefe2@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp2@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_otro_jefe = await auth_headers(client, otro_jefe)

    meta_ciclo_id = await _crear_meta_ciclo_cerrado_con_metas(
        client, headers_rh, headers_jefe, empleado, calificacion=70
    )
    ciclo = await _crear_cd_ciclo(client, headers_rh, meta_ciclo_id=meta_ciclo_id, nombre="Ciclo scope")

    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    # El jefe de OTRO equipo ve la lista de resultados vacia (scope no incluye
    # al empleado) en vez de un 403 -- es un filtro, no una prohibicion total.
    resp_resultados = await client.get(
        f"{BASE}/ciclos/{ciclo['id']}/resultados", headers=headers_otro_jefe
    )
    assert resp_resultados.status_code == 200, resp_resultados.text
    assert resp_resultados.json() == []

    resp_9box = await client.get(f"{BASE}/ciclos/{ciclo['id']}/9box", headers=headers_otro_jefe)
    assert resp_9box.status_code == 200, resp_9box.text
    for celda in resp_9box.json()["celdas"]:
        assert celda["empleados"] == []

    # Intentar capturar potencial de un empleado fuera de su scope -> 403.
    resp_potencial = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}/potencial",
        json={"items": [{"empleado_id": empleado.empleado_id, "potencial": 50}]},
        headers=headers_otro_jefe,
    )
    assert resp_potencial.status_code == 403, resp_potencial.text

    # El jefe dueno SI puede.
    resp_potencial_ok = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}/potencial",
        json={"items": [{"empleado_id": empleado.empleado_id, "potencial": 50}]},
        headers=headers_jefe,
    )
    assert resp_potencial_ok.status_code == 200, resp_potencial_ok.text


async def test_empleado_sin_modulo_403_en_gestion_pero_self_service_ok(client, db):
    empleado = await make_empleado(db, rol="empleado", email="cdemp3@leoni.test")
    headers = await auth_headers(client, empleado)

    inicio, fin = _fechas()
    resp = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": "Ciclo prohibido", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers,
    )
    assert resp.status_code == 403, resp.text

    resp_mis = await client.get(f"{BASE}/mis-resultados", headers=headers)
    assert resp_mis.status_code == 200, resp_mis.text
    assert resp_mis.json() == []


# ══════════════════════════════════════════════════════════════════════════
# Self-service: /mis-resultados usa siempre el token, solo ciclos cerrados.
# ══════════════════════════════════════════════════════════════════════════
async def test_mis_resultados_solo_ciclos_cerrados_y_usa_el_token(client, db):
    rh = await _rh(db, email="cdrh4@leoni.test")
    jefe = await _jefe(db, email="cdjefe4@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp4@leoni.test")
    otro_empleado = await make_empleado(db, rol="empleado", email="cdotroemp4@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_emp = await auth_headers(client, empleado)

    meta_ciclo_id = await _crear_meta_ciclo_cerrado_con_metas(
        client, headers_rh, headers_jefe, empleado, calificacion=60
    )
    ciclo = await _crear_cd_ciclo(client, headers_rh, meta_ciclo_id=meta_ciclo_id, nombre="Ciclo self-service")
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    # Mientras el ciclo esta activo (no cerrado), self-service no lo muestra.
    resp_mis_activo = await client.get(f"{BASE}/mis-resultados", headers=headers_emp)
    assert resp_mis_activo.status_code == 200, resp_mis_activo.text
    assert resp_mis_activo.json() == []

    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh)
    assert resp_cerrar.status_code == 200, resp_cerrar.text

    resp_mis = await client.get(f"{BASE}/mis-resultados", headers=headers_emp)
    assert resp_mis.status_code == 200, resp_mis.text
    assert len(resp_mis.json()) == 1

    # Otro empleado (sin resultado en el ciclo) obtiene lista vacia -- el
    # self-service jamas mezcla resultados de otro empleado_id.
    resp_otro = await client.get(
        f"{BASE}/mis-resultados", headers=await auth_headers(client, otro_empleado)
    )
    assert resp_otro.status_code == 200, resp_otro.text
    assert resp_otro.json() == []


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida por HTTP
# ══════════════════════════════════════════════════════════════════════════
async def test_activar_ciclo_sin_senal_vinculada_falla_422(client, db):
    rh = await _rh(db, email="cdrh5@leoni.test")
    headers_rh = await auth_headers(client, rh)

    ciclo = await _crear_cd_ciclo(client, headers_rh, nombre="Ciclo sin senal")
    resp = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp.status_code == 422, resp.text


async def test_cerrar_ciclo_con_360_no_finalizada_falla_422_y_forzar_true_ok(client, db):
    rh = await _rh(db, email="cdrh6@leoni.test")
    jefe = await _jefe(db, email="cdjefe6@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp6@leoni.test")
    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    campana = await _crear_campana_360(db, estado="activa")  # no finalizada/cerrada
    await _agregar_participante_360(db, campana.id, empleado.empleado_id, calificacion_general=3)

    ciclo = await _crear_cd_ciclo(client, headers_rh, eval360_campana_id=campana.id, nombre="Ciclo 360 sin cerrar")
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh)
    assert resp_cerrar.status_code == 422, resp_cerrar.text

    resp_forzar = await client.post(
        f"{BASE}/ciclos/{ciclo['id']}/cerrar", json={"forzar": True}, headers=headers_rh
    )
    assert resp_forzar.status_code == 200, resp_forzar.text
    assert resp_forzar.json()["estado"] == "cerrado"


async def test_set_potencial_en_ciclo_cerrado_falla_409(client, db):
    rh = await _rh(db, email="cdrh7@leoni.test")
    jefe = await _jefe(db, email="cdjefe7@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp7@leoni.test")
    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    meta_ciclo_id = await _crear_meta_ciclo_cerrado_con_metas(
        client, headers_rh, headers_jefe, empleado, calificacion=85
    )
    ciclo = await _crear_cd_ciclo(client, headers_rh, meta_ciclo_id=meta_ciclo_id, nombre="Ciclo potencial cerrado")
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh)
    assert resp_cerrar.status_code == 200, resp_cerrar.text

    resp_potencial = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}/potencial",
        json={"items": [{"empleado_id": empleado.empleado_id, "potencial": 40}]},
        headers=headers_rh,
    )
    assert resp_potencial.status_code == 409, resp_potencial.text


async def test_rh_con_modulo_gestiona_ciclos_de_cualquier_equipo(client, db):
    rh = await _rh(db, email="cdrh8@leoni.test")
    jefe = await _jefe(db, email="cdjefe8@leoni.test")
    await _empleado_de(db, jefe, email="cdemp8@leoni.test")

    headers_rh = await auth_headers(client, rh)
    ciclo = await _crear_cd_ciclo(client, headers_rh, nombre="Ciclo RH global")

    resp_list = await client.get(f"{BASE}/ciclos", headers=headers_rh)
    assert resp_list.status_code == 200, resp_list.text
    assert any(c["id"] == ciclo["id"] for c in resp_list.json())


async def test_supervisor_no_puede_administrar_ciclos(client, db):
    rh = await _rh(db, email="cdrh9@leoni.test")
    jefe = await _jefe(db, email="cdjefe9@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_cd_ciclo(client, headers_rh, nombre="Ciclo admin jefe")
    inicio, fin = _fechas()

    resp_create = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": "Ciclo intento jefe", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers_jefe,
    )
    assert resp_create.status_code == 403, resp_create.text

    resp_activar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_jefe)
    assert resp_activar.status_code == 403, resp_activar.text

    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_jefe)
    assert resp_cerrar.status_code == 403, resp_cerrar.text

    resp_put = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"nombre": "Ciclo renombrado por jefe"},
        headers=headers_jefe,
    )
    assert resp_put.status_code == 403, resp_put.text


async def test_supervisor_puede_listar_y_ver_ciclos(client, db):
    rh = await _rh(db, email="cdrh10@leoni.test")
    jefe = await _jefe(db, email="cdjefe10@leoni.test")
    await _empleado_de(db, jefe, email="cdemp10@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_cd_ciclo(client, headers_rh, nombre="Ciclo lectura jefe")

    resp_list = await client.get(f"{BASE}/ciclos", headers=headers_jefe)
    assert resp_list.status_code == 200, resp_list.text
    assert any(c["id"] == ciclo["id"] for c in resp_list.json())

    resp_get = await client.get(f"{BASE}/ciclos/{ciclo['id']}", headers=headers_jefe)
    assert resp_get.status_code == 200, resp_get.text
    assert resp_get.json()["id"] == ciclo["id"]


async def test_export_excel_devuelve_xlsx(client, db):
    rh = await _rh(db, email="cdrh11@leoni.test")
    jefe = await _jefe(db, email="cdjefe11@leoni.test")
    empleado = await _empleado_de(db, jefe, email="cdemp11@leoni.test")
    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    meta_ciclo_id = await _crear_meta_ciclo_cerrado_con_metas(
        client, headers_rh, headers_jefe, empleado, calificacion=75
    )
    ciclo = await _crear_cd_ciclo(client, headers_rh, meta_ciclo_id=meta_ciclo_id, nombre="Ciclo export")
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    resp_export = await client.get(f"{BASE}/ciclos/{ciclo['id']}/export/excel", headers=headers_rh)
    assert resp_export.status_code == 200, resp_export.text
    assert resp_export.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ══════════════════════════════════════════════════════════════════════════
# Filtro por area — recorta el scope, nunca lo amplia
# ══════════════════════════════════════════════════════════════════════════
async def _area(db, descripcion="Arneses"):
    import uuid
    from app.models.catalogos import Area

    area_id = int(uuid.uuid4().hex[:6], 16) % 900000 + 100000
    area = Area(area_id=area_id, descripcion=descripcion, estatus_id=1)
    db.add(area)
    await db.flush()
    return area


async def test_filtro_por_area_recorta_pero_no_amplia_el_scope_del_jefe(client, db):
    """`area_id` es un recorte sobre el scope YA resuelto: un jefe que pide un
    area donde tambien hay gente de otro jefe sigue viendo solo su equipo."""
    area_a = await _area(db, "Arneses A")
    area_b = await _area(db, "Arneses B")
    rh = await _rh(db, email="cdarea_rh@leoni.test")
    jefe = await _jefe(db, email="cdarea_jefe@leoni.test")
    mio = await _empleado_de(db, jefe, email="cdarea_mio@leoni.test")
    ajeno = await make_empleado(db, rol="empleado", email="cdarea_ajeno@leoni.test")
    otro_area = await _empleado_de(db, jefe, email="cdarea_otra@leoni.test")
    mio.area_id = area_a.area_id
    ajeno.area_id = area_a.area_id  # misma area, pero NO reporta al jefe
    otro_area.area_id = area_b.area_id
    await db.flush()

    campana = await _crear_campana_360(db, estado="cerrada")
    for emp in (mio, ajeno, otro_area):
        await _agregar_participante_360(db, campana.id, emp.empleado_id, calificacion_general=4)

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    ciclo = await _crear_cd_ciclo(client, headers_rh, eval360_campana_id=campana.id)
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    url = f"{BASE}/ciclos/{ciclo['id']}/resultados"

    # RH (scope global) filtrando por area A: los dos empleados del area.
    resp = await client.get(f"{url}?area_id={area_a.area_id}", headers=headers_rh)
    assert resp.status_code == 200, resp.text
    assert {r["empleado_id"] for r in resp.json()} == {mio.empleado_id, ajeno.empleado_id}

    # El jefe pide la MISMA area: solo su reporte, el ajeno no se cuela.
    resp_jefe = await client.get(f"{url}?area_id={area_a.area_id}", headers=headers_jefe)
    assert resp_jefe.status_code == 200, resp_jefe.text
    assert {r["empleado_id"] for r in resp_jefe.json()} == {mio.empleado_id}

    # Sin filtro, el jefe ve su equipo completo (las dos areas).
    resp_sin = await client.get(url, headers=headers_jefe)
    assert {r["empleado_id"] for r in resp_sin.json()} == {mio.empleado_id, otro_area.empleado_id}

    # Un area sin participantes devuelve vacio, no el universo.
    area_vacia = await _area(db, "Almacen")
    resp_vacia = await client.get(f"{url}?area_id={area_vacia.area_id}", headers=headers_rh)
    assert resp_vacia.json() == []

    # Y para el jefe, un area donde no tiene reportes tampoco abre la puerta.
    resp_jefe_ajena = await client.get(f"{url}?area_id={area_vacia.area_id}", headers=headers_jefe)
    assert resp_jefe_ajena.json() == []


async def test_filtro_por_area_aplica_a_9box_y_distribucion(client, db):
    """Los tres bloques de la pestana de resultados leen la misma poblacion:
    si la tabla se recorta por area, el 9-Box y la distribucion tambien."""
    area_a = await _area(db, "Arneses A")
    rh = await _rh(db, email="cdarea2_rh@leoni.test")
    dentro = await make_empleado(db, rol="empleado", email="cdarea2_in@leoni.test")
    fuera = await make_empleado(db, rol="empleado", email="cdarea2_out@leoni.test")
    dentro.area_id = area_a.area_id
    await db.flush()

    campana = await _crear_campana_360(db, estado="cerrada")
    for emp in (dentro, fuera):
        await _agregar_participante_360(db, campana.id, emp.empleado_id, calificacion_general=4)

    headers_rh = await auth_headers(client, rh)
    ciclo = await _crear_cd_ciclo(client, headers_rh, eval360_campana_id=campana.id)
    await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)

    resp_box = await client.get(
        f"{BASE}/ciclos/{ciclo['id']}/9box?area_id={area_a.area_id}", headers=headers_rh
    )
    assert resp_box.status_code == 200, resp_box.text
    en_box = {e["empleado_id"] for c in resp_box.json()["celdas"] for e in c["empleados"]}
    assert fuera.empleado_id not in en_box

    resp_dist = await client.get(
        f"{BASE}/ciclos/{ciclo['id']}/distribucion?area_id={area_a.area_id}", headers=headers_rh
    )
    assert resp_dist.status_code == 200, resp_dist.text
    assert resp_dist.json()["actual"]["total"] == 1

    # Sin filtro, la misma distribucion cuenta a los dos participantes.
    resp_todos = await client.get(f"{BASE}/ciclos/{ciclo['id']}/distribucion", headers=headers_rh)
    assert resp_todos.json()["actual"]["total"] == 2


async def test_resultados_traen_el_area_del_empleado(client, db):
    """El area viaja en el resultado: la tabla la muestra y el selector de la
    pantalla arma sus opciones con ella, sin un endpoint extra de catalogo."""
    area = await _area(db, "Arneses A")
    rh = await _rh(db, email="cdarea3_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="cdarea3_emp@leoni.test")
    emp.area_id = area.area_id
    await db.flush()

    campana = await _crear_campana_360(db, estado="cerrada")
    await _agregar_participante_360(db, campana.id, emp.empleado_id, calificacion_general=4)

    headers_rh = await auth_headers(client, rh)
    ciclo = await _crear_cd_ciclo(client, headers_rh, eval360_campana_id=campana.id)
    await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)

    resp = await client.get(f"{BASE}/ciclos/{ciclo['id']}/resultados", headers=headers_rh)
    assert resp.status_code == 200, resp.text
    r = resp.json()[0]
    assert r["area_id"] == area.area_id
    assert r["area_nombre"] == "Arneses A"
