"""Tests del flujo de encuestas post curso (Level Up).

Cubre: habilitar solo sesiones finalizadas, responder solo asistentes, una respuesta
por (sesión, empleado), bloqueo por encuesta cerrada, promedio del curso sobre todas
las sesiones, pendientes del empleado y resumen por sesión.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import Curso, CursoEmpleado, CursoSesion, EstadoSesion
from tests.conftest import auth_headers, make_empleado


async def _make_curso(db: AsyncSession, nombre: str) -> Curso:
    curso = Curso(nombre=nombre, obligatorio=False)
    db.add(curso)
    await db.flush()
    return curso


async def _make_sesion(
    db: AsyncSession, curso_id: int, estado: EstadoSesion = EstadoSesion.completada
) -> CursoSesion:
    from datetime import date

    sesion = CursoSesion(curso_id=curso_id, fecha_inicio=date(2026, 1, 10), estado=estado)
    db.add(sesion)
    await db.flush()
    return sesion


async def _inscribir(
    db: AsyncSession, curso_id: int, sesion_id: int, empleado_id: int, asistio: bool
) -> CursoEmpleado:
    ce = CursoEmpleado(
        curso_id=curso_id, sesion_id=sesion_id, empleado_id=empleado_id, asistio=asistio
    )
    db.add(ce)
    await db.flush()
    return ce


RESPUESTA = {
    "score_general": 5,
    "score_instructor": 4,
    "score_contenido": 5,
    "score_aplicabilidad": 4,
    "comentario": "Excelente curso",
}


@pytest.mark.asyncio
async def test_no_habilitar_si_sesion_no_finalizada(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="enc_rh1@leoni.test")
    curso = await _make_curso(db, "Curso enc no finalizada")
    sesion = await _make_sesion(db, curso.id, estado=EstadoSesion.programada)
    headers = await auth_headers(client, rh)

    resp = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={},
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_habilitar_y_estado(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="enc_rh2@leoni.test")
    curso = await _make_curso(db, "Curso enc habilitar")
    sesion = await _make_sesion(db, curso.id)
    await _inscribir(db, curso.id, sesion.id, (await make_empleado(
        db, rol="empleado", email="enc_a1@leoni.test", empleado_id=771001
    )).empleado_id, asistio=True)
    headers = await auth_headers(client, rh)

    resp = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["estado_efectivo"] == "activa"
    assert data["total_asistentes"] == 1
    assert data["respondidas"] == 0
    assert data["pendientes"] == 1

    # Duplicado -> 409
    dup = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={},
        headers=headers,
    )
    assert dup.status_code == 409, dup.text


@pytest.mark.asyncio
async def test_responder_solo_asistentes_y_sin_duplicados(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="enc_rh3@leoni.test")
    curso = await _make_curso(db, "Curso enc responder")
    sesion = await _make_sesion(db, curso.id)
    asistente = await make_empleado(db, rol="empleado", email="enc_asis@leoni.test", empleado_id=772001)
    ausente = await make_empleado(db, rol="empleado", email="enc_aus@leoni.test", empleado_id=772002)
    await _inscribir(db, curso.id, sesion.id, asistente.empleado_id, asistio=True)
    await _inscribir(db, curso.id, sesion.id, ausente.empleado_id, asistio=False)

    rh_headers = await auth_headers(client, rh)
    hab = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={},
        headers=rh_headers,
    )
    encuesta_id = hab.json()["id"]

    # Ausente -> 422
    aus_headers = await auth_headers(client, ausente)
    r_aus = await client.post(
        f"/api/v1/level-up/encuestas/{encuesta_id}/respuesta",
        json=RESPUESTA,
        headers=aus_headers,
    )
    assert r_aus.status_code == 422, r_aus.text

    # Asistente -> 201
    asis_headers = await auth_headers(client, asistente)
    r1 = await client.post(
        f"/api/v1/level-up/encuestas/{encuesta_id}/respuesta",
        json=RESPUESTA,
        headers=asis_headers,
    )
    assert r1.status_code == 201, r1.text

    # Duplicado -> 409
    r2 = await client.post(
        f"/api/v1/level-up/encuestas/{encuesta_id}/respuesta",
        json=RESPUESTA,
        headers=asis_headers,
    )
    assert r2.status_code == 409, r2.text


@pytest.mark.asyncio
async def test_no_responder_si_cerrada(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="enc_rh4@leoni.test")
    curso = await _make_curso(db, "Curso enc cerrada")
    sesion = await _make_sesion(db, curso.id)
    asistente = await make_empleado(db, rol="empleado", email="enc_cerr@leoni.test", empleado_id=773001)
    await _inscribir(db, curso.id, sesion.id, asistente.empleado_id, asistio=True)

    rh_headers = await auth_headers(client, rh)
    hab = await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={},
        headers=rh_headers,
    )
    encuesta_id = hab.json()["id"]

    cerrar = await client.patch(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta",
        json={"estado": "cerrada"},
        headers=rh_headers,
    )
    assert cerrar.status_code == 200, cerrar.text
    assert cerrar.json()["estado_efectivo"] == "cerrada"

    asis_headers = await auth_headers(client, asistente)
    resp = await client.post(
        f"/api/v1/level-up/encuestas/{encuesta_id}/respuesta",
        json=RESPUESTA,
        headers=asis_headers,
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_promedio_curso_sobre_todas_las_sesiones(
    client: AsyncClient, db: AsyncSession
):
    rh = await make_empleado(db, rol="rh", email="enc_rh5@leoni.test")
    curso = await _make_curso(db, "Curso enc promedio")
    s1 = await _make_sesion(db, curso.id)
    s2 = await _make_sesion(db, curso.id)

    emp1 = await make_empleado(db, rol="empleado", email="enc_p1@leoni.test", empleado_id=774001)
    emp2 = await make_empleado(db, rol="empleado", email="enc_p2@leoni.test", empleado_id=774002)
    await _inscribir(db, curso.id, s1.id, emp1.empleado_id, asistio=True)
    await _inscribir(db, curso.id, s2.id, emp2.empleado_id, asistio=True)

    rh_headers = await auth_headers(client, rh)
    enc1 = (await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{s1.id}/encuesta", json={}, headers=rh_headers
    )).json()["id"]
    enc2 = (await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{s2.id}/encuesta", json={}, headers=rh_headers
    )).json()["id"]

    # Sesión 1: score_general 4 ; Sesión 2: score_general 2 -> promedio curso = 3.0
    await client.post(
        f"/api/v1/level-up/encuestas/{enc1}/respuesta",
        json={**RESPUESTA, "score_general": 4},
        headers=await auth_headers(client, emp1),
    )
    # Tras una sola respuesta, promedio = 4.0
    detalle = (await client.get(f"/api/v1/level-up/cursos/{curso.id}", headers=rh_headers)).json()
    assert detalle["total_evaluaciones"] == 1
    assert detalle["calificacion_promedio"] == 4.0

    await client.post(
        f"/api/v1/level-up/encuestas/{enc2}/respuesta",
        json={**RESPUESTA, "score_general": 2},
        headers=await auth_headers(client, emp2),
    )

    detalle = (await client.get(f"/api/v1/level-up/cursos/{curso.id}", headers=rh_headers)).json()
    assert detalle["total_evaluaciones"] == 2
    assert detalle["calificacion_promedio"] == 3.0

    # Resumen por curso: tasa de participación y comparativo por sesión
    resumen = (await client.get(
        f"/api/v1/level-up/cursos/{curso.id}/encuestas/resumen", headers=rh_headers
    )).json()
    assert resumen["total_evaluaciones"] == 2
    assert resumen["calificacion_promedio"] == 3.0
    assert len(resumen["sesiones"]) == 2
    for s in resumen["sesiones"]:
        assert s["tasa_participacion"] == 1.0


@pytest.mark.asyncio
async def test_pendientes_empleado(client: AsyncClient, db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="enc_rh6@leoni.test")
    curso = await _make_curso(db, "Curso enc pendientes")
    sesion = await _make_sesion(db, curso.id)
    emp = await make_empleado(db, rol="empleado", email="enc_pend@leoni.test", empleado_id=775001)
    await _inscribir(db, curso.id, sesion.id, emp.empleado_id, asistio=True)

    rh_headers = await auth_headers(client, rh)
    enc = (await client.post(
        f"/api/v1/level-up/cursos/{curso.id}/sesiones/{sesion.id}/encuesta", json={}, headers=rh_headers
    )).json()["id"]

    emp_headers = await auth_headers(client, emp)
    pend = (await client.get("/api/v1/level-up/encuestas/pendientes", headers=emp_headers)).json()
    assert pend["total"] == 1
    assert pend["items"][0]["encuesta_id"] == enc

    await client.post(
        f"/api/v1/level-up/encuestas/{enc}/respuesta", json=RESPUESTA, headers=emp_headers
    )
    pend2 = (await client.get("/api/v1/level-up/encuestas/pendientes", headers=emp_headers)).json()
    assert pend2["total"] == 0
