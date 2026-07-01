# tests/test_evaluacion360.py
"""
Tests del modulo Evaluacion 360 (Level Up) — Fase 1.

Cubre:
  - Escalas y banco de preguntas (CRUD basico).
  - Config: get (lazy init) y update con validacion de pesos.
  - Campanas: crear, validacion pesos=100%, activar -> genera evaluaciones con
    evaluadores correctos (auto/jefe/subordinado/par via lider_id/subarea_id).
  - Responder evaluacion (borrador -> enviar) con validaciones.
  - Calculo de resultados y brechas al cerrar la campana.
  - Permisos: empleado normal no gestiona campanas (403) pero si responde.
"""

import pytest
from httpx import AsyncClient

from app.models.empleados import Empleado
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_competencia


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _crear_competencia_con_preguntas(
    client: AsyncClient, db, headers, *, nombre: str, n_preguntas: int = 2
):
    comp = await make_competencia(db, nombre=nombre, categoria="blanda")
    for i in range(n_preguntas):
        res = await client.post(
            "/api/v1/evaluacion-360/preguntas",
            json={"competencia_id": comp.id, "texto": f"{nombre} item {i}", "orden": i},
            headers=headers,
        )
        assert res.status_code == 201, res.text
    return comp


def _campana_payload(comp_id: int, empleado_ids: list[int]) -> dict:
    return {
        "nombre": "Campana Q3 2026",
        "descripcion": "Evaluacion de competencias",
        "objetivo": "Medir comportamientos",
        "competencias": [
            {"competencia_id": comp_id, "peso": 100, "num_preguntas": 2,
             "nivel_esperado": 3, "obligatoria": True, "orden": 0},
        ],
        "evaluador_tipos": [
            {"tipo": "autoevaluacion", "peso": 20, "activo": True},
            {"tipo": "jefe", "peso": 40, "activo": True},
            {"tipo": "subordinado", "peso": 20, "activo": True},
            {"tipo": "par", "peso": 20, "activo": True},
        ],
        "empleado_ids": empleado_ids,
        "config": {"anonima": False, "comentarios_obligatorios": False,
                   "permitir_borradores": True, "mostrar_progreso": True},
    }


# ══════════════════════════════════════════════════════════════════════════════
# Escalas + preguntas + config
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_config_lazy_init_y_update(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_cfg@leoni.test")
    headers = await auth_headers(client, rh)

    res = await client.get("/api/v1/evaluacion-360/config", headers=headers)
    assert res.status_code == 200, res.text
    cfg = res.json()
    assert cfg["escala_id"] is not None  # escala por defecto creada

    res = await client.put(
        "/api/v1/evaluacion-360/config",
        json={"pesos_evaluadores": {"jefe": 50, "par": 50}},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["pesos_evaluadores"] == {"jefe": 50, "par": 50}


@pytest.mark.asyncio
async def test_config_pesos_invalidos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_cfg2@leoni.test")
    headers = await auth_headers(client, rh)
    res = await client.put(
        "/api/v1/evaluacion-360/config",
        json={"pesos_evaluadores": {"jefe": 50, "par": 30}},
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_preguntas_crud(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_preg@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await make_competencia(db, nombre="Comunicacion", categoria="blanda")

    res = await client.post(
        "/api/v1/evaluacion-360/preguntas",
        json={"competencia_id": comp.id, "texto": "Escucha activamente"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    pid = res.json()["id"]

    res = await client.get(
        f"/api/v1/evaluacion-360/preguntas?competencia_id={comp.id}", headers=headers
    )
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = await client.put(
        f"/api/v1/evaluacion-360/preguntas/{pid}",
        json={"texto": "Escucha con atencion"}, headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["texto"] == "Escucha con atencion"


# ══════════════════════════════════════════════════════════════════════════════
# Campanas
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_create_campana_success(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_camp@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Liderazgo")
    empleado = await make_empleado(db, rol="empleado", email="e360_eval1@leoni.test")

    res = await client.post(
        "/api/v1/evaluacion-360/campanas",
        json=_campana_payload(comp.id, [empleado.empleado_id]),
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["estado"] == "borrador"
    assert body["participantes"] == 1
    assert len(body["competencias"]) == 1
    assert len(body["evaluador_tipos"]) == 4


@pytest.mark.asyncio
async def test_create_campana_pesos_invalidos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_camp2@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Trabajo en equipo")
    empleado = await make_empleado(db, rol="empleado", email="e360_eval2@leoni.test")

    payload = _campana_payload(comp.id, [empleado.empleado_id])
    payload["evaluador_tipos"] = [
        {"tipo": "jefe", "peso": 40, "activo": True},
        {"tipo": "par", "peso": 40, "activo": True},
    ]  # suman 80
    res = await client.post(
        "/api/v1/evaluacion-360/campanas", json=payload, headers=headers
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_activar_campana_genera_evaluaciones(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_act@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Organizacion")

    # Jerarquia: jefe -> evaluado -> subordinado; par en misma subarea.
    jefe = await make_empleado(db, rol="supervisor", email="e360_jefe@leoni.test")
    evaluado = await make_empleado(
        db, rol="empleado", email="e360_evaluado@leoni.test", lider_id=jefe.empleado_id
    )
    subordinado = await make_empleado(
        db, rol="empleado", email="e360_sub@leoni.test", lider_id=evaluado.empleado_id
    )
    par = await make_empleado(db, rol="empleado", email="e360_par@leoni.test")
    # Colocar evaluado y par en la misma subarea.
    evaluado.subarea_id = 777
    par.subarea_id = 777
    await db.flush()

    res = await client.post(
        "/api/v1/evaluacion-360/campanas",
        json=_campana_payload(comp.id, [evaluado.empleado_id]),
        headers=headers,
    )
    assert res.status_code == 201, res.text
    campana_id = res.json()["id"]

    res = await client.post(
        f"/api/v1/evaluacion-360/campanas/{campana_id}/activar", headers=headers
    )
    assert res.status_code == 200, res.text
    assert res.json()["estado"] == "activa"

    # El jefe debe tener una evaluacion asignada (tipo jefe).
    jefe_headers = await auth_headers(client, jefe)
    res = await client.get("/api/v1/evaluacion-360/mis-evaluaciones", headers=jefe_headers)
    assert res.status_code == 200, res.text
    tipos = [e["tipo_evaluador"] for e in res.json()]
    assert "jefe" in tipos

    # Se generaron auto/jefe/subordinado/par (4 evaluadores distintos).
    res = await client.get(
        f"/api/v1/evaluacion-360/campanas/{campana_id}/participantes", headers=headers
    )
    assert res.status_code == 200
    part = res.json()[0]
    assert part["evaluaciones_total"] >= 4


@pytest.mark.asyncio
async def test_responder_y_enviar_evaluacion(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_resp@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Adaptabilidad")
    evaluado = await make_empleado(db, rol="empleado", email="e360_resp_ev@leoni.test")

    res = await client.post(
        "/api/v1/evaluacion-360/campanas",
        json=_campana_payload(comp.id, [evaluado.empleado_id]),
        headers=headers,
    )
    campana_id = res.json()["id"]
    await client.post(f"/api/v1/evaluacion-360/campanas/{campana_id}/activar", headers=headers)

    # El propio evaluado tiene su autoevaluacion.
    ev_headers = await auth_headers(client, evaluado)
    res = await client.get("/api/v1/evaluacion-360/mis-evaluaciones", headers=ev_headers)
    assert res.status_code == 200, res.text
    auto = next(e for e in res.json() if e["tipo_evaluador"] == "autoevaluacion")
    eval_id = auto["id"]

    # Detalle con preguntas.
    res = await client.get(f"/api/v1/evaluacion-360/evaluaciones/{eval_id}", headers=ev_headers)
    assert res.status_code == 200, res.text
    preguntas = res.json()["competencias"][0]["preguntas"]
    assert len(preguntas) == 2

    # Guardar borrador (parcial).
    res = await client.put(
        f"/api/v1/evaluacion-360/evaluaciones/{eval_id}/borrador",
        json={"respuestas": [{"pregunta_id": preguntas[0]["pregunta_id"], "valor": 4}]},
        headers=ev_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["estado"] == "en_progreso"

    # Enviar incompleto -> 422.
    res = await client.post(
        f"/api/v1/evaluacion-360/evaluaciones/{eval_id}/enviar",
        json={"respuestas": []}, headers=ev_headers,
    )
    assert res.status_code == 422

    # Enviar completo.
    res = await client.post(
        f"/api/v1/evaluacion-360/evaluaciones/{eval_id}/enviar",
        json={"respuestas": [
            {"pregunta_id": preguntas[0]["pregunta_id"], "valor": 4},
            {"pregunta_id": preguntas[1]["pregunta_id"], "valor": 5},
        ]},
        headers=ev_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["estado"] == "completada"


@pytest.mark.asyncio
async def test_resultados_y_brechas(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_res@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Innovacion")
    evaluado = await make_empleado(db, rol="empleado", email="e360_res_ev@leoni.test")

    res = await client.post(
        "/api/v1/evaluacion-360/campanas",
        json=_campana_payload(comp.id, [evaluado.empleado_id]),
        headers=headers,
    )
    campana_id = res.json()["id"]
    await client.post(f"/api/v1/evaluacion-360/campanas/{campana_id}/activar", headers=headers)

    ev_headers = await auth_headers(client, evaluado)
    auto = next(
        e for e in (await client.get("/api/v1/evaluacion-360/mis-evaluaciones", headers=ev_headers)).json()
        if e["tipo_evaluador"] == "autoevaluacion"
    )
    detalle = (await client.get(f"/api/v1/evaluacion-360/evaluaciones/{auto['id']}", headers=ev_headers)).json()
    preguntas = detalle["competencias"][0]["preguntas"]
    await client.post(
        f"/api/v1/evaluacion-360/evaluaciones/{auto['id']}/enviar",
        json={"respuestas": [
            {"pregunta_id": preguntas[0]["pregunta_id"], "valor": 5},
            {"pregunta_id": preguntas[1]["pregunta_id"], "valor": 5},
        ]},
        headers=ev_headers,
    )

    # Cerrar campana -> calcula resultados.
    res = await client.post(
        f"/api/v1/evaluacion-360/campanas/{campana_id}/cerrar", headers=headers
    )
    assert res.status_code == 200, res.text
    assert res.json()["estado"] == "cerrada"

    res = await client.get(
        f"/api/v1/evaluacion-360/campanas/{campana_id}/resultados", headers=headers
    )
    assert res.status_code == 200, res.text
    resultado = res.json()[0]
    assert resultado["calificacion_general"] is not None
    comp_res = resultado["competencias"][0]
    # Autoevaluacion 5/5 en escala 1-5 supera nivel esperado 3 -> cumple.
    assert comp_res["autoevaluacion"] == 5
    assert comp_res["estado_brecha"] == "cumple"


# ══════════════════════════════════════════════════════════════════════════════
# Permisos
# ══════════════════════════════════════════════════════════════════════════════
async def _campana_respondida_y_cerrada(client, db, headers, evaluado, comp):
    """Helper: crea campaña, activa, responde autoevaluación 5/5 y cierra."""
    res = await client.post(
        "/api/v1/evaluacion-360/campanas",
        json=_campana_payload(comp.id, [evaluado.empleado_id]),
        headers=headers,
    )
    campana_id = res.json()["id"]
    await client.post(f"/api/v1/evaluacion-360/campanas/{campana_id}/activar", headers=headers)
    ev_headers = await auth_headers(client, evaluado)
    auto = next(
        e for e in (await client.get("/api/v1/evaluacion-360/mis-evaluaciones", headers=ev_headers)).json()
        if e["tipo_evaluador"] == "autoevaluacion"
    )
    detalle = (await client.get(f"/api/v1/evaluacion-360/evaluaciones/{auto['id']}", headers=ev_headers)).json()
    preg = detalle["competencias"][0]["preguntas"]
    await client.post(
        f"/api/v1/evaluacion-360/evaluaciones/{auto['id']}/enviar",
        json={
            "respuestas": [{"pregunta_id": p["pregunta_id"], "valor": 5} for p in preg],
            "comentarios": [{"competencia_id": comp.id, "texto": "Excelente desempeño", "tipo": "fortaleza"}],
        },
        headers=ev_headers,
    )
    await client.post(f"/api/v1/evaluacion-360/campanas/{campana_id}/cerrar", headers=headers)
    return campana_id


@pytest.mark.asyncio
async def test_reporte_individual(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_rep@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Servicio")
    evaluado = await make_empleado(db, rol="empleado", email="e360_rep_ev@leoni.test")
    campana_id = await _campana_respondida_y_cerrada(client, db, headers, evaluado, comp)

    parts = (await client.get(f"/api/v1/evaluacion-360/campanas/{campana_id}/participantes", headers=headers)).json()
    pid = parts[0]["id"]
    res = await client.get(f"/api/v1/evaluacion-360/participantes/{pid}/reporte", headers=headers)
    assert res.status_code == 200, res.text
    rep = res.json()
    assert rep["calificacion_general"] is not None
    assert rep["promedio_autoevaluacion"] == 5
    assert len(rep["comentarios"]) == 1
    assert rep["comentarios"][0]["tipo_evaluador"] == "autoevaluacion"
    # Evolución: al menos la campaña actual.
    assert any(e["campana_id"] == campana_id for e in rep["evolucion"])


@pytest.mark.asyncio
async def test_export_reporte_y_resultados(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="e360_exp@leoni.test")
    headers = await auth_headers(client, rh)
    comp = await _crear_competencia_con_preguntas(client, db, headers, nombre="Responsabilidad")
    evaluado = await make_empleado(db, rol="empleado", email="e360_exp_ev@leoni.test")
    campana_id = await _campana_respondida_y_cerrada(client, db, headers, evaluado, comp)
    pid = (await client.get(f"/api/v1/evaluacion-360/campanas/{campana_id}/participantes", headers=headers)).json()[0]["id"]

    # Reporte individual PDF y Excel.
    res = await client.get(f"/api/v1/evaluacion-360/participantes/{pid}/reporte/export?formato=pdf", headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content[:4] == b"%PDF"

    res = await client.get(f"/api/v1/evaluacion-360/participantes/{pid}/reporte/export?formato=excel", headers=headers)
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    assert res.content[:2] == b"PK"  # xlsx = zip

    # Resultados de campaña Excel.
    res = await client.get(f"/api/v1/evaluacion-360/campanas/{campana_id}/resultados/export?formato=excel", headers=headers)
    assert res.status_code == 200
    assert res.content[:2] == b"PK"


@pytest.mark.asyncio
async def test_empleado_no_puede_gestionar_campanas(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="e360_noauth@leoni.test")
    headers = await auth_headers(client, empleado)
    res = await client.get("/api/v1/evaluacion-360/campanas", headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_empleado_accede_a_sus_evaluaciones(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="e360_self@leoni.test")
    headers = await auth_headers(client, empleado)
    res = await client.get("/api/v1/evaluacion-360/mis-evaluaciones", headers=headers)
    assert res.status_code == 200
    assert res.json() == []
