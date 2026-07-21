# tests/test_encuestas_rh_api.py
"""Tests HTTP del modulo Encuestas RH (Tarea 3): router + registro de modulo.

La logica de dominio ya esta cubierta a nivel service en
tests/test_encuestas_rh_service.py (Tarea 2); aqui se ejercita el router
(permisos, serializacion, mapeo de excepciones) end-to-end via `client`.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models.encuestas_rh import EncuestaPlantilla
from tests.conftest import auth_headers, make_empleado

pytestmark = pytest.mark.asyncio


BASE = "/api/v1/encuestas-rh"


def _fecha_cierre(dias: int = 7) -> str:
    return (date.today() + timedelta(days=dias)).isoformat()


async def _crear_encuesta_con_pregunta(client, headers, tipo_pregunta="likert"):
    resp = await client.post(
        f"{BASE}/encuestas",
        json={
            "titulo": "Clima Q3",
            "descripcion": "Encuesta de clima laboral",
            "tipo": "clima",
            "es_anonima": False,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    encuesta = resp.json()

    resp_p = await client.post(
        f"{BASE}/encuestas/{encuesta['id']}/preguntas",
        json={
            "orden": 1,
            "tipo": tipo_pregunta,
            "texto": "Como calificas el ambiente laboral?",
            "requerida": True,
        },
        headers=headers,
    )
    assert resp_p.status_code == 201, resp_p.text
    return encuesta["id"], resp_p.json()["id"]


# ══════════════════════════════════════════════════════════════════════════
# Flujo feliz completo: crear -> preguntas -> publicar -> mis-encuestas ->
# responder -> participantes refleja "respondida".
# ══════════════════════════════════════════════════════════════════════════
async def test_flujo_completo_crear_publicar_responder(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh1@leoni.test")
    participante = await make_empleado(db, rol="empleado", email="encrh_emp1@leoni.test")
    headers_rh = await auth_headers(client, rh)

    encuesta_id, pregunta_id = await _crear_encuesta_con_pregunta(client, headers_rh)

    # Filtramos por rol "empleado" para aislar un unico participante esperado
    # (el creador rh no calificaria de todas formas, pero asi es explicito).
    resp_pub = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers_rh,
    )
    assert resp_pub.status_code == 200, resp_pub.text
    assert resp_pub.json()["estado"] == "publicada"

    headers_emp = await auth_headers(client, participante)
    resp_mis = await client.get(f"{BASE}/mis-encuestas", headers=headers_emp)
    assert resp_mis.status_code == 200
    items = resp_mis.json()
    assert len(items) == 1
    assert items[0]["encuesta_id"] == encuesta_id
    assert items[0]["participante_estado"] == "pendiente"

    resp_detalle = await client.get(f"{BASE}/mis-encuestas/{encuesta_id}", headers=headers_emp)
    assert resp_detalle.status_code == 200
    assert resp_detalle.json()["preguntas"][0]["id"] == pregunta_id

    resp_responder = await client.post(
        f"{BASE}/mis-encuestas/{encuesta_id}/responder",
        json={"respuestas": [{"pregunta_id": pregunta_id, "valor_likert": 4}]},
        headers=headers_emp,
    )
    assert resp_responder.status_code == 204

    resp_mis2 = await client.get(f"{BASE}/mis-encuestas", headers=headers_emp)
    assert resp_mis2.json()[0]["participante_estado"] == "respondida"

    resp_part = await client.get(
        f"{BASE}/encuestas/{encuesta_id}/participantes", headers=headers_rh
    )
    assert resp_part.status_code == 200
    participantes = resp_part.json()
    assert len(participantes) == 1
    assert participantes[0]["empleado_id"] == participante.empleado_id
    assert participantes[0]["estado"] == "respondida"
    assert participantes[0]["fecha_respuesta"] is not None
    # Nunca se exponen respuestas individuales en el listado de participantes.
    assert "respuestas" not in participantes[0]


# ══════════════════════════════════════════════════════════════════════════
# Permisos: gestion exige modulo; self-service no.
# ══════════════════════════════════════════════════════════════════════════
async def test_sin_modulo_403_en_gestion_pero_self_service_ok(client, db):
    sin_modulo = await make_empleado(db, rol="empleado", email="encrh_emp2@leoni.test")
    headers = await auth_headers(client, sin_modulo)

    resp_gestion = await client.get(f"{BASE}/encuestas", headers=headers)
    assert resp_gestion.status_code == 403

    resp_self = await client.get(f"{BASE}/mis-encuestas", headers=headers)
    assert resp_self.status_code == 200
    assert resp_self.json() == []


async def test_usuario_con_modulo_otorgado_puede_gestionar(client, db):
    """Empleado (rol no-rh) con `modulos_rh={"encuestas-rh": True}` puede
    usar la gestion via el fallback resolve_module_from_api_path/user_has_module."""
    grantee = await make_empleado(
        db,
        rol="empleado",
        email="encrh_grantee@leoni.test",
        modulos_rh={"encuestas-rh": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, grantee)

    resp = await client.get(f"{BASE}/encuestas", headers=headers)
    assert resp.status_code == 200


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida por HTTP
# ══════════════════════════════════════════════════════════════════════════
async def test_delete_encuesta_publicada_da_error(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh2@leoni.test")
    await make_empleado(db, rol="empleado", email="encrh_emp3@leoni.test")
    headers = await auth_headers(client, rh)

    encuesta_id, _ = await _crear_encuesta_con_pregunta(client, headers)
    resp_pub = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers,
    )
    assert resp_pub.status_code == 200

    resp_del = await client.delete(f"{BASE}/encuestas/{encuesta_id}", headers=headers)
    assert resp_del.status_code == 409


async def test_editar_pregunta_de_encuesta_publicada_da_error(client, db):
    """El brief anticipaba 400; el mapeo real del proyecto para este caso es
    ConflictError -> 409 (misma familia que "no se puede borrar publicada"),
    ya que `_get_encuesta_borrador` valida el estado antes que cualquier otra
    cosa. Se prueba el comportamiento real, documentado en el reporte."""
    rh = await make_empleado(db, rol="rh", email="encrh_rh3@leoni.test")
    await make_empleado(db, rol="empleado", email="encrh_emp4@leoni.test")
    headers = await auth_headers(client, rh)

    encuesta_id, pregunta_id = await _crear_encuesta_con_pregunta(client, headers)
    resp_pub = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers,
    )
    assert resp_pub.status_code == 200

    resp_edit = await client.put(
        f"{BASE}/encuestas/{encuesta_id}/preguntas/{pregunta_id}",
        json={"texto": "Nuevo texto"},
        headers=headers,
    )
    assert resp_edit.status_code == 409


async def test_responder_dos_veces_conflicto(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh4@leoni.test")
    participante = await make_empleado(db, rol="empleado", email="encrh_emp5@leoni.test")
    headers_rh = await auth_headers(client, rh)

    encuesta_id, pregunta_id = await _crear_encuesta_con_pregunta(client, headers_rh)
    await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers_rh,
    )

    headers_emp = await auth_headers(client, participante)
    payload = {"respuestas": [{"pregunta_id": pregunta_id, "valor_likert": 3}]}
    resp1 = await client.post(
        f"{BASE}/mis-encuestas/{encuesta_id}/responder", json=payload, headers=headers_emp
    )
    assert resp1.status_code == 204

    resp2 = await client.post(
        f"{BASE}/mis-encuestas/{encuesta_id}/responder", json=payload, headers=headers_emp
    )
    assert resp2.status_code == 409


async def test_responder_sin_ser_participante_da_error(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh5@leoni.test")
    await make_empleado(db, rol="empleado", email="encrh_emp6@leoni.test")
    # Rol distinto al filtro de audiencia ("empleado") para que quede fuera
    # de los participantes materializados al publicar.
    ajeno = await make_empleado(db, rol="supervisor", email="encrh_ajeno@leoni.test")
    headers_rh = await auth_headers(client, rh)

    encuesta_id, pregunta_id = await _crear_encuesta_con_pregunta(client, headers_rh)
    await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers_rh,
    )

    headers_ajeno = await auth_headers(client, ajeno)
    resp = await client.post(
        f"{BASE}/mis-encuestas/{encuesta_id}/responder",
        json={"respuestas": [{"pregunta_id": pregunta_id, "valor_likert": 3}]},
        headers=headers_ajeno,
    )
    assert resp.status_code == 403


async def test_responder_ignora_empleado_id_del_body(client, db):
    """El endpoint self-service jamas debe usar un empleado_id enviado por el
    cliente: siempre usa el del token (`current_user.empleado_id`)."""
    rh = await make_empleado(db, rol="rh", email="encrh_rh6@leoni.test")
    participante = await make_empleado(db, rol="empleado", email="encrh_emp7@leoni.test")
    headers_rh = await auth_headers(client, rh)

    encuesta_id, pregunta_id = await _crear_encuesta_con_pregunta(client, headers_rh)
    await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={"filtros": {"roles": ["empleado"]}, "fecha_cierre_programada": _fecha_cierre()},
        headers=headers_rh,
    )

    headers_emp = await auth_headers(client, participante)
    resp = await client.post(
        f"{BASE}/mis-encuestas/{encuesta_id}/responder",
        json={
            "empleado_id": 999999,
            "respuestas": [{"pregunta_id": pregunta_id, "valor_likert": 5}],
        },
        headers=headers_emp,
    )
    assert resp.status_code == 204

    resp_part = await client.get(
        f"{BASE}/encuestas/{encuesta_id}/participantes", headers=headers_rh
    )
    participantes = resp_part.json()
    assert len(participantes) == 1
    assert participantes[0]["empleado_id"] == participante.empleado_id
    assert participantes[0]["estado"] == "respondida"


# ══════════════════════════════════════════════════════════════════════════
# Audiencia preview
# ══════════════════════════════════════════════════════════════════════════
async def test_preview_audiencia_por_rol(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh7@leoni.test")
    await make_empleado(db, rol="empleado", email="encrh_emp8@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.get(f"{BASE}/audiencia/preview?roles=empleado", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1


# ══════════════════════════════════════════════════════════════════════════
# Plantillas
# ══════════════════════════════════════════════════════════════════════════
async def test_listar_plantillas_y_crear_encuesta_desde_plantilla(client, db):
    """Las plantillas semilla no existen en SQLite (sin migracion); se crean
    aqui directamente con el modelo, como indica el brief."""
    p1 = EncuestaPlantilla(
        nombre="Clima laboral estandar",
        descripcion="Plantilla predefinida de clima",
        tipo="clima",
        es_predefinida=True,
        definicion=[
            {"orden": 1, "tipo": "likert", "texto": "Como calificas tu ambiente laboral?"},
        ],
    )
    p2 = EncuestaPlantilla(
        nombre="Pulso rapido",
        descripcion="Plantilla predefinida de pulso",
        tipo="pulso",
        es_predefinida=True,
        definicion=[{"orden": 1, "tipo": "texto", "texto": "Algun comentario?"}],
    )
    db.add_all([p1, p2])
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="encrh_rh8@leoni.test")
    headers = await auth_headers(client, rh)

    resp_list = await client.get(f"{BASE}/plantillas", headers=headers)
    assert resp_list.status_code == 200
    assert len(resp_list.json()) == 2

    resp_crear = await client.post(
        f"{BASE}/plantillas/{p1.id}/crear-encuesta",
        json={"es_anonima": True},
        headers=headers,
    )
    assert resp_crear.status_code == 201, resp_crear.text
    creada = resp_crear.json()
    assert creada["estado"] == "borrador"
    assert creada["es_anonima"] is True
    assert len(creada["preguntas"]) == 1


async def test_crear_encuesta_desde_plantilla_exige_es_anonima_explicito(client, db):
    """Decision de revision Tarea 2: `es_anonima` es obligatorio en el body,
    no se depende del default silencioso True del service."""
    p1 = EncuestaPlantilla(
        nombre="Clima laboral estandar",
        tipo="clima",
        es_predefinida=True,
        definicion=[{"orden": 1, "tipo": "likert", "texto": "..."}],
    )
    db.add(p1)
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="encrh_rh9@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.post(f"{BASE}/plantillas/{p1.id}/crear-encuesta", json={}, headers=headers)
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════
# Reordenar preguntas (endpoint requerido por el brief; sin metodo de service
# en la Tarea 2 — se agrego `EncuestasRhService.reordenar_preguntas` en esta
# tarea, ver reporte).
# ══════════════════════════════════════════════════════════════════════════
async def test_reordenar_preguntas(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rh10@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.post(
        f"{BASE}/encuestas",
        json={"titulo": "Encuesta reorden", "tipo": "otra", "es_anonima": False},
        headers=headers,
    )
    encuesta_id = resp.json()["id"]

    ids = []
    for i in range(1, 3):
        r = await client.post(
            f"{BASE}/encuestas/{encuesta_id}/preguntas",
            json={"orden": i, "tipo": "texto", "texto": f"Pregunta {i}", "requerida": False},
            headers=headers,
        )
        ids.append(r.json()["id"])

    resp_reorder = await client.put(
        f"{BASE}/encuestas/{encuesta_id}/preguntas/reordenar",
        json={"pregunta_ids": [ids[1], ids[0]]},
        headers=headers,
    )
    assert resp_reorder.status_code == 200
    reordenadas = resp_reorder.json()
    assert [p["id"] for p in reordenadas] == [ids[1], ids[0]]


# ══════════════════════════════════════════════════════════════════════════
# Validacion de input (fix post-revision)
# ══════════════════════════════════════════════════════════════════════════
async def test_preview_audiencia_areas_no_numerico_422(client, db):
    """GET /audiencia/preview?areas=abc (no numérico) debe devolver 422,
    no 500. Fix: capturar ValueError en el router y lanzar DomainValidationError."""
    rh = await make_empleado(db, rol="rh", email="encrh_rh11@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.get(f"{BASE}/audiencia/preview?areas=abc", headers=headers)
    assert resp.status_code == 422
    body = resp.json()
    assert "areas" in body["detail"].lower()


async def test_reordenar_preguntas_lista_incompleta_422(client, db):
    """PUT /encuestas/{id}/preguntas/reordenar con lista incompleta de ids
    debe devolver 422, no 500. El service ya lanza DomainValidationError;
    se verifica el status correcto."""
    rh = await make_empleado(db, rol="rh", email="encrh_rh12@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.post(
        f"{BASE}/encuestas",
        json={"titulo": "Encuesta para reorden", "tipo": "otra", "es_anonima": False},
        headers=headers,
    )
    encuesta_id = resp.json()["id"]

    ids = []
    for i in range(1, 4):  # 3 preguntas
        r = await client.post(
            f"{BASE}/encuestas/{encuesta_id}/preguntas",
            json={"orden": i, "tipo": "texto", "texto": f"Pregunta {i}", "requerida": False},
            headers=headers,
        )
        ids.append(r.json()["id"])

    # Enviar solo 2 ids en vez de 3 → DomainValidationError -> 422
    resp_reorder = await client.put(
        f"{BASE}/encuestas/{encuesta_id}/preguntas/reordenar",
        json={"pregunta_ids": [ids[0], ids[1]]},
        headers=headers,
    )
    assert resp_reorder.status_code == 422
    body = resp_reorder.json()
    assert "exactamente" in body["detail"].lower()
