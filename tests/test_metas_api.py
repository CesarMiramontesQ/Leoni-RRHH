# tests/test_metas_api.py
"""Tests HTTP del modulo Metas (Tarea 3): router + registro de modulo + scoping.

La logica de dominio (formulas de avance/cumplimiento, ciclo de vida, roll-up)
ya esta cubierta a nivel service en tests/test_metas_service.py (Tarea 2);
aqui se ejercita el router end-to-end via `client`: permisos (RH por modulo,
jefe con scoping de equipo, self-service), serializacion y mapeo de errores.
"""

from datetime import date, timedelta

import pytest

from tests.conftest import auth_headers, make_empleado

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/metas"


def _fechas():
    hoy = date.today()
    return hoy.isoformat(), (hoy + timedelta(days=90)).isoformat()


async def _crear_ciclo_activo(client, headers_rh, nombre="Ciclo Q1"):
    inicio, fin = _fechas()
    resp = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": nombre, "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers_rh,
    )
    assert resp.status_code == 201, resp.text
    ciclo = resp.json()
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text
    return resp_act.json()


async def _rh(db, **kw):
    return await make_empleado(db, rol="rh", modulos_rh={"metas": True}, **kw)


async def _jefe(db, **kw):
    return await make_empleado(db, rol="supervisor", **kw)


async def _empleado_de(db, jefe, **kw):
    return await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id, **kw)


# ══════════════════════════════════════════════════════════════════════════
# Flujo feliz completo: RH crea ciclo -> activa -> jefe crea meta con 2 RC
# para su equipo -> empleado ve/actualiza -> jefe califica -> RH cierra ciclo
# -> cumplimiento ponderado.
# ══════════════════════════════════════════════════════════════════════════
async def test_flujo_completo_ciclo_meta_checkin_cierre_cumplimiento(client, db):
    rh = await _rh(db, email="metasrh1@leoni.test")
    jefe = await _jefe(db, email="metasjefe1@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp1@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_emp = await auth_headers(client, empleado)

    ciclo = await _crear_ciclo_activo(client, headers_rh)
    assert ciclo["estado"] == "activo"

    # Jefe crea meta individual con 2 RC para un miembro de su equipo.
    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Mejorar calidad",
            "peso": 100,
            "asignada_por_id": 999999,  # debe ser ignorado/sobreescrito por el token
            "resultados_clave": [
                {
                    "orden": 1,
                    "titulo": "Reducir defectos",
                    "tipo_metrica": "numero",
                    "direccion": "bajar",
                    "valor_inicial": 100,
                    "valor_objetivo": 0,
                },
                {
                    "orden": 2,
                    "titulo": "Aumentar produccion",
                    "tipo_metrica": "numero",
                    "direccion": "subir",
                    "valor_inicial": 0,
                    "valor_objetivo": 200,
                },
            ],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta = resp_meta.json()
    assert meta["asignada_por_id"] == jefe.empleado_id
    rc1_id = meta["resultados_clave"][0]["id"]

    # La meta aparece en /mis-metas del empleado.
    resp_mis = await client.get(f"{BASE}/mis-metas", headers=headers_emp)
    assert resp_mis.status_code == 200, resp_mis.text
    ids_mis_metas = [m["id"] for m in resp_mis.json()]
    assert meta["id"] in ids_mis_metas

    # Empleado hace check-in sobre el primer RC (bajar 100 -> 50): avance sube.
    resp_checkin = await client.post(
        f"{BASE}/mis-metas/resultados/{rc1_id}/checkin",
        json={"valor": 50, "nota": "Avance parcial"},
        headers=headers_emp,
    )
    assert resp_checkin.status_code == 201, resp_checkin.text
    checkin = resp_checkin.json()
    assert checkin["avance_resultante"] == 50.0
    assert checkin["autor_id"] == empleado.empleado_id

    # Jefe cierra la meta con calificacion.
    resp_cerrar_meta = await client.post(
        f"{BASE}/metas/{meta['id']}/cerrar",
        json={"calificacion": 90, "comentario": "Buen desempeno"},
        headers=headers_jefe,
    )
    assert resp_cerrar_meta.status_code == 200, resp_cerrar_meta.text
    assert resp_cerrar_meta.json()["estado"] == "cerrada"

    # RH cierra el ciclo (ya no quedan metas individuales sin calificar).
    resp_cerrar_ciclo = await client.post(
        f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh
    )
    assert resp_cerrar_ciclo.status_code == 200, resp_cerrar_ciclo.text
    assert resp_cerrar_ciclo.json()["estado"] == "cerrado"

    # /empleados/{id}/cumplimiento refleja el ponderado (unica meta, peso=100,
    # calificacion=90 -> cumplimiento=90).
    resp_cumpl = await client.get(
        f"{BASE}/empleados/{empleado.empleado_id}/cumplimiento",
        params={"ciclo_id": ciclo["id"]},
        headers=headers_jefe,
    )
    assert resp_cumpl.status_code == 200, resp_cumpl.text
    cumpl = resp_cumpl.json()
    assert cumpl["cumplimiento"] == 90.0
    assert cumpl["metas_consideradas"] == 1


# ══════════════════════════════════════════════════════════════════════════
# Regresion: el frontend NO envia asignada_por_id (sale del token). El campo
# debe ser opcional en el schema para no forzar un 422 antes de que el router
# lo sobreescriba con current_user.empleado_id.
# ══════════════════════════════════════════════════════════════════════════
async def test_crear_meta_sin_asignada_por_id_en_el_body_no_da_422(client, db):
    rh = await _rh(db, email="metasrh_sinasig@leoni.test")
    jefe = await _jefe(db, email="metasjefe_sinasig@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp_sinasig@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo sin asignada_por_id")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta sin asignada_por_id en el body",
            "peso": 100,
            "resultados_clave": [],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    assert resp_meta.json()["asignada_por_id"] == jefe.empleado_id


# ══════════════════════════════════════════════════════════════════════════
# Permisos — scoping de equipo
# ══════════════════════════════════════════════════════════════════════════
async def test_jefe_de_otro_equipo_no_puede_crear_meta_para_empleado_ajeno(client, db):
    rh = await _rh(db, email="metasrh2@leoni.test")
    jefe = await _jefe(db, email="metasjefe2@leoni.test")
    otro_jefe = await _jefe(db, email="metasotrojefe2@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp2@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_otro_jefe = await auth_headers(client, otro_jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo scope 1")

    resp = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta ajena",
            "peso": 100,
            "asignada_por_id": otro_jefe.empleado_id,
            "resultados_clave": [],
        },
        headers=headers_otro_jefe,
    )
    assert resp.status_code == 403, resp.text


async def test_jefe_de_otro_equipo_403_al_gestionar_meta_existente(client, db):
    rh = await _rh(db, email="metasrh3@leoni.test")
    jefe = await _jefe(db, email="metasjefe3@leoni.test")
    otro_jefe = await _jefe(db, email="metasotrojefe3@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp3@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_otro_jefe = await auth_headers(client, otro_jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo scope 2")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta del equipo de jefe",
            "peso": 100,
            "asignada_por_id": jefe.empleado_id,
            "resultados_clave": [],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta_id = resp_meta.json()["id"]

    # GET puntual.
    resp_get = await client.get(f"{BASE}/metas/{meta_id}", headers=headers_otro_jefe)
    assert resp_get.status_code == 403, resp_get.text

    # PUT.
    resp_put = await client.put(
        f"{BASE}/metas/{meta_id}", json={"titulo": "Hackeo"}, headers=headers_otro_jefe
    )
    assert resp_put.status_code == 403, resp_put.text

    # Cerrar.
    resp_cerrar = await client.post(
        f"{BASE}/metas/{meta_id}/cerrar",
        json={"calificacion": 100},
        headers=headers_otro_jefe,
    )
    assert resp_cerrar.status_code == 403, resp_cerrar.text

    # Cumplimiento del empleado ajeno.
    resp_cumpl = await client.get(
        f"{BASE}/empleados/{empleado.empleado_id}/cumplimiento",
        params={"ciclo_id": ciclo["id"]},
        headers=headers_otro_jefe,
    )
    assert resp_cumpl.status_code == 403, resp_cumpl.text

    # El jefe dueño SI puede.
    resp_get_ok = await client.get(f"{BASE}/metas/{meta_id}", headers=headers_jefe)
    assert resp_get_ok.status_code == 200, resp_get_ok.text


async def test_empleado_sin_modulo_403_en_gestion_pero_self_service_ok(client, db):
    empleado = await make_empleado(db, rol="empleado", email="metasemp4@leoni.test")
    headers = await auth_headers(client, empleado)

    # Gestion de ciclos: 403 (rol empleado, sin modulo 'metas').
    inicio, fin = _fechas()
    resp = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": "Ciclo prohibido", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers,
    )
    assert resp.status_code == 403, resp.text

    # Self-service: mis-metas SI accesible (lista vacia, no 403).
    resp_mis = await client.get(f"{BASE}/mis-metas", headers=headers)
    assert resp_mis.status_code == 200, resp_mis.text
    assert resp_mis.json() == []


async def test_checkin_selfservice_ignora_empleado_id_del_body(client, db):
    rh = await _rh(db, email="metasrh5@leoni.test")
    jefe = await _jefe(db, email="metasjefe5@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp5@leoni.test")
    otro_empleado = await make_empleado(db, rol="empleado", email="metasotroemp5@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_emp = await auth_headers(client, empleado)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo checkin")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta con checkin",
            "peso": 100,
            "asignada_por_id": jefe.empleado_id,
            "resultados_clave": [
                {
                    "orden": 1,
                    "titulo": "RC unico",
                    "tipo_metrica": "numero",
                    "direccion": "subir",
                    "valor_inicial": 0,
                    "valor_objetivo": 10,
                }
            ],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    rc_id = resp_meta.json()["resultados_clave"][0]["id"]

    # El body intenta suplantar a otro empleado; debe ignorarse (schema no
    # tiene ese campo, y el autor real es el del token).
    resp_checkin = await client.post(
        f"{BASE}/mis-metas/resultados/{rc_id}/checkin",
        json={"valor": 5, "nota": "avance", "empleado_id": otro_empleado.empleado_id},
        headers=headers_emp,
    )
    assert resp_checkin.status_code == 201, resp_checkin.text
    assert resp_checkin.json()["autor_id"] == empleado.empleado_id

    # El otro empleado NO puede hacer checkin sobre un RC que no es suyo.
    resp_ajeno = await client.post(
        f"{BASE}/mis-metas/resultados/{rc_id}/checkin",
        json={"valor": 6},
        headers=await auth_headers(client, otro_empleado),
    )
    assert resp_ajeno.status_code == 404, resp_ajeno.text


async def test_rh_con_modulo_gestiona_metas_de_cualquier_equipo(client, db):
    rh = await _rh(db, email="metasrh6@leoni.test")
    jefe = await _jefe(db, email="metasjefe6@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp6@leoni.test")

    headers_rh = await auth_headers(client, rh)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo RH global")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta creada por RH",
            "peso": 100,
            "asignada_por_id": rh.empleado_id,
            "resultados_clave": [],
        },
        headers=headers_rh,
    )
    assert resp_meta.status_code == 201, resp_meta.text

    resp_list = await client.get(
        f"{BASE}/metas",
        params={"ciclo_id": ciclo["id"]},
        headers=headers_rh,
    )
    assert resp_list.status_code == 200, resp_list.text
    assert len(resp_list.json()) == 1


# ══════════════════════════════════════════════════════════════════════════
# Fixes post-revision — PUT /ciclos/{id} (Fix 1)
# ══════════════════════════════════════════════════════════════════════════
async def test_jefe_de_otro_equipo_403_en_subrutas_de_resultados_clave_y_delete_meta(client, db):
    """Hueco senalado en revision: T3 solo probo GET/PUT/cerrar/cumplimiento
    para el scoping negativo de un jefe de OTRO equipo; faltaban las
    sub-rutas de resultados clave (crear/editar/eliminar), el ajuste de
    avance del jefe y el DELETE de la meta."""
    rh = await _rh(db, email="metasrh9@leoni.test")
    jefe = await _jefe(db, email="metasjefe9@leoni.test")
    otro_jefe = await _jefe(db, email="metasotrojefe9@leoni.test")
    empleado = await _empleado_de(db, jefe, email="metasemp9@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)
    headers_otro_jefe = await auth_headers(client, otro_jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo scope subrutas")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado.empleado_id,
            "titulo": "Meta con RC para scoping",
            "peso": 100,
            "asignada_por_id": jefe.empleado_id,
            "resultados_clave": [
                {
                    "orden": 1,
                    "titulo": "RC existente",
                    "tipo_metrica": "numero",
                    "direccion": "subir",
                    "valor_inicial": 0,
                    "valor_objetivo": 10,
                }
            ],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta_id = resp_meta.json()["id"]
    rc_id = resp_meta.json()["resultados_clave"][0]["id"]

    # POST /metas/{id}/resultados — crear un RC nuevo.
    resp_crear_rc = await client.post(
        f"{BASE}/metas/{meta_id}/resultados",
        json={
            "orden": 2,
            "titulo": "RC ajeno",
            "tipo_metrica": "numero",
            "direccion": "subir",
            "valor_inicial": 0,
            "valor_objetivo": 5,
        },
        headers=headers_otro_jefe,
    )
    assert resp_crear_rc.status_code == 403, resp_crear_rc.text

    # PUT /metas/{id}/resultados/{rc_id}.
    resp_put_rc = await client.put(
        f"{BASE}/metas/{meta_id}/resultados/{rc_id}",
        json={"titulo": "Hackeo RC"},
        headers=headers_otro_jefe,
    )
    assert resp_put_rc.status_code == 403, resp_put_rc.text

    # DELETE /metas/{id}/resultados/{rc_id}.
    resp_del_rc = await client.delete(
        f"{BASE}/metas/{meta_id}/resultados/{rc_id}", headers=headers_otro_jefe
    )
    assert resp_del_rc.status_code == 403, resp_del_rc.text

    # POST /resultados/{rc_id}/checkin (ajuste jefe).
    resp_ajuste = await client.post(
        f"{BASE}/resultados/{rc_id}/checkin",
        json={"valor": 3, "nota": "ajuste ajeno"},
        headers=headers_otro_jefe,
    )
    assert resp_ajuste.status_code == 403, resp_ajuste.text

    # DELETE /metas/{id}.
    resp_del_meta = await client.delete(
        f"{BASE}/metas/{meta_id}", headers=headers_otro_jefe
    )
    assert resp_del_meta.status_code == 403, resp_del_meta.text

    # El jefe dueno SI puede ejercer las mismas acciones (sanity del scope).
    resp_ajuste_ok = await client.post(
        f"{BASE}/resultados/{rc_id}/checkin",
        json={"valor": 3, "nota": "ajuste dueno"},
        headers=headers_jefe,
    )
    assert resp_ajuste_ok.status_code == 201, resp_ajuste_ok.text


async def test_put_meta_equipo_no_permite_reasignar_lider_id_fuera_del_scope(client, db):
    """Hueco senalado en revision: el fix de Tarea 3 (revalidar scope al
    reasignar) solo se probo con `empleado_id` de meta individual; faltaba
    el caso de reasignar `lider_id` en una meta de NIVEL EQUIPO."""
    rh = await _rh(db, email="metasrh10@leoni.test")
    jefe = await _jefe(db, email="metasjefe10@leoni.test")
    otro_jefe = await _jefe(db, email="metasotrojefe10@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo scope lider_id")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "equipo",
            "area_id": 1,
            "lider_id": jefe.empleado_id,
            "titulo": "Meta de equipo reasignable",
            "peso": 100,
            "asignada_por_id": jefe.empleado_id,
            "resultados_clave": [],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta_id = resp_meta.json()["id"]

    # Reasignar el liderazgo de la meta de equipo a OTRO jefe -> 403.
    resp_403 = await client.put(
        f"{BASE}/metas/{meta_id}",
        json={"lider_id": otro_jefe.empleado_id},
        headers=headers_jefe,
    )
    assert resp_403.status_code == 403, resp_403.text

    # El jefe se mantiene como lider (sin cambios) tras el intento rechazado.
    resp_get = await client.get(f"{BASE}/metas/{meta_id}", headers=headers_jefe)
    assert resp_get.status_code == 200, resp_get.text
    assert resp_get.json()["lider_id"] == jefe.empleado_id


async def test_put_ciclo_edita_borrador_y_activo_y_rechaza_fechas_invertidas(client, db):
    rh = await _rh(db, email="metasrh7@leoni.test")
    headers_rh = await auth_headers(client, rh)

    inicio, fin = _fechas()
    resp = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": "Ciclo editable", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers_rh,
    )
    assert resp.status_code == 201, resp.text
    ciclo = resp.json()

    # Editar en borrador: solo nombre.
    resp_borrador = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"nombre": "Ciclo editado (borrador)"},
        headers=headers_rh,
    )
    assert resp_borrador.status_code == 200, resp_borrador.text
    assert resp_borrador.json()["nombre"] == "Ciclo editado (borrador)"

    # Activar y editar en activo: fechas.
    resp_act = await client.post(f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_rh)
    assert resp_act.status_code == 200, resp_act.text

    nueva_fin = (date.today() + timedelta(days=120)).isoformat()
    resp_activo = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"fecha_fin": nueva_fin},
        headers=headers_rh,
    )
    assert resp_activo.status_code == 200, resp_activo.text
    assert resp_activo.json()["fecha_fin"] == nueva_fin

    # fecha_fin < fecha_inicio -> 422.
    resp_422 = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"fecha_inicio": nueva_fin, "fecha_fin": inicio},
        headers=headers_rh,
    )
    assert resp_422.status_code == 422, resp_422.text

    # Cerrar el ciclo (sin metas individuales pendientes) y editar -> 409.
    resp_cerrar = await client.post(f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_rh)
    assert resp_cerrar.status_code == 200, resp_cerrar.text

    resp_409 = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"nombre": "No deberia poder"},
        headers=headers_rh,
    )
    assert resp_409.status_code == 409, resp_409.text


# ══════════════════════════════════════════════════════════════════════════
# Fixes post-revision — PUT /metas/{id} revalida scope al reasignar (Fix 2)
# ══════════════════════════════════════════════════════════════════════════
async def test_put_meta_no_permite_reasignar_fuera_del_scope_del_jefe(client, db):
    rh = await _rh(db, email="metasrh8@leoni.test")
    jefe = await _jefe(db, email="metasjefe8@leoni.test")
    empleado_propio = await _empleado_de(db, jefe, email="metasemp8a@leoni.test")
    otro_empleado_propio = await _empleado_de(db, jefe, email="metasemp8c@leoni.test")
    otro_jefe = await _jefe(db, email="metasotrojefe8@leoni.test")
    empleado_ajeno = await _empleado_de(db, otro_jefe, email="metasemp8b@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo scope reasignacion")

    resp_meta = await client.post(
        f"{BASE}/metas",
        json={
            "ciclo_id": ciclo["id"],
            "nivel": "individual",
            "empleado_id": empleado_propio.empleado_id,
            "titulo": "Meta reasignable",
            "peso": 100,
            "asignada_por_id": jefe.empleado_id,
            "resultados_clave": [],
        },
        headers=headers_jefe,
    )
    assert resp_meta.status_code == 201, resp_meta.text
    meta_id = resp_meta.json()["id"]

    # Reasignar a un empleado FUERA de su equipo -> 403.
    resp_403 = await client.put(
        f"{BASE}/metas/{meta_id}",
        json={"empleado_id": empleado_ajeno.empleado_id},
        headers=headers_jefe,
    )
    assert resp_403.status_code == 403, resp_403.text

    # Reasignar a un miembro DE su equipo -> OK.
    resp_ok = await client.put(
        f"{BASE}/metas/{meta_id}",
        json={"empleado_id": otro_empleado_propio.empleado_id},
        headers=headers_jefe,
    )
    assert resp_ok.status_code == 200, resp_ok.text
    assert resp_ok.json()["empleado_id"] == otro_empleado_propio.empleado_id


# ══════════════════════════════════════════════════════════════════════════
# Tarea 1 (gestion de metas para jefes) — GET /ciclos abierto a jefes con
# scoping (`_gestion_or_equipo`); administracion de ciclos sigue solo-RH.
# ══════════════════════════════════════════════════════════════════════════
async def test_supervisor_puede_listar_y_ver_ciclos(client, db):
    rh = await _rh(db, email="metasrh9@leoni.test")
    jefe = await _jefe(db, email="metasjefe9@leoni.test")
    await _empleado_de(db, jefe, email="metasemp9@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo lectura jefe")

    resp_list = await client.get(f"{BASE}/ciclos", headers=headers_jefe)
    assert resp_list.status_code == 200, resp_list.text
    assert any(c["id"] == ciclo["id"] for c in resp_list.json())

    resp_get = await client.get(f"{BASE}/ciclos/{ciclo['id']}", headers=headers_jefe)
    assert resp_get.status_code == 200, resp_get.text
    assert resp_get.json()["id"] == ciclo["id"]


async def test_supervisor_no_puede_administrar_ciclos(client, db):
    rh = await _rh(db, email="metasrh10@leoni.test")
    jefe = await _jefe(db, email="metasjefe10@leoni.test")

    headers_rh = await auth_headers(client, rh)
    headers_jefe = await auth_headers(client, jefe)

    ciclo = await _crear_ciclo_activo(client, headers_rh, nombre="Ciclo admin jefe")
    inicio, fin = _fechas()

    resp_create = await client.post(
        f"{BASE}/ciclos",
        json={"nombre": "Ciclo intento jefe", "fecha_inicio": inicio, "fecha_fin": fin},
        headers=headers_jefe,
    )
    assert resp_create.status_code == 403, resp_create.text

    resp_activar = await client.post(
        f"{BASE}/ciclos/{ciclo['id']}/activar", headers=headers_jefe
    )
    assert resp_activar.status_code == 403, resp_activar.text

    resp_cerrar = await client.post(
        f"{BASE}/ciclos/{ciclo['id']}/cerrar", headers=headers_jefe
    )
    assert resp_cerrar.status_code == 403, resp_cerrar.text

    resp_put = await client.put(
        f"{BASE}/ciclos/{ciclo['id']}",
        json={"nombre": "Ciclo renombrado por jefe"},
        headers=headers_jefe,
    )
    assert resp_put.status_code == 403, resp_put.text
