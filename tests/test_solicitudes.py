# tests/test_solicitudes.py
"""
Tests del dominio solicitudes — Plataforma RH Leoni Cable.

Cubre:
  - Crear solicitud (todos los roles permitidos)
  - Duplicado solicitud pending → 409
  - Validacion de esquema (fecha_fin < fecha_inicio, tipo invalido) → 422
  - Listado con filtrado por rol (empleado, supervisor, rh)
  - Aprobacion: supervisor directo aprueba → ok
  - Aprobacion: empleado intenta aprobar → 403 (rol)
  - Aprobacion: supervisor no-directo intenta aprobar → 403 (jerarquia)
  - Override: director/rh aprueban sin jerarquia
  - Cancelar: dueno cancela PENDING → ok
  - Cancelar: otro empleado intenta cancelar → 403
  - Cancelar: solicitud no-pending → 409
  - Rechazar → estado REJECTED
  - GET solicitud por ID con acceso/no-acceso
  - Aprobar solicitud ya aprobada → 409
"""

import pytest
from datetime import date
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_solicitud

# Payload de solicitud valido reutilizable
SOLICITUD_VACACIONES = {
    "tipo": "vacaciones",
    "fecha_inicio": "2026-05-05",
    "fecha_fin": "2026-05-09",
    "comentarios": "Vacaciones de prueba",
}

APROBACION_PAYLOAD = {
    "accion": "approve",
    "nivel": 1,
    "comentario": "Aprobado por supervisor",
}

RECHAZO_PAYLOAD = {
    "accion": "reject",
    "nivel": 1,
    "comentario": "No hay cobertura",
}


# ---------------------------------------------------------------------------
# TC-SOL-001: Crear solicitud como empleado → 201
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_empleado_retorna_201(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol001@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "vacaciones"
    assert body["estado"] == "pending"
    assert body["empleado_id"] == empleado.id
    assert body["nivel_actual"] == 1


# ---------------------------------------------------------------------------
# TC-SOL-002: Crear solicitud como supervisor → 201
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_supervisor_retorna_201(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol002@leoni.test")
    headers = await auth_headers(client, supervisor)

    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# TC-SOL-003: Crear solicitud como rh → 201
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_rh_retorna_201(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sol003@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# TC-SOL-004: Solicitud duplicada pending → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_duplicada_pending_retorna_409(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol004@leoni.test")
    # Crear primera solicitud directamente en DB
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="pending",
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )

    assert response.status_code == 409
    assert "pendiente" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-005: Tipo invalido → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_tipo_invalido_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol005@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "permiso_medico",  # tipo no valido
            "fecha_inicio": "2026-05-05",
            "fecha_fin": "2026-05-06",
        },
        headers=headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# TC-SOL-006: fecha_fin < fecha_inicio → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_fechas_invalidas_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol006@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-05-10",
            "fecha_fin": "2026-05-05",  # anterior a inicio
        },
        headers=headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# TC-SOL-007: Listar solicitudes — empleado solo ve las suyas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_empleado_solo_ve_las_suyas(client: AsyncClient, db):
    emp_a = await make_empleado(db, rol="empleado", email="sol007a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="sol007b@leoni.test")

    # Crear solicitud para cada empleado
    await make_solicitud(db, empleado_id=emp_a.id)
    await make_solicitud(db, empleado_id=emp_b.id)

    headers_a = await auth_headers(client, emp_a)
    response = await client.get("/api/v1/solicitudes", headers=headers_a)

    assert response.status_code == 200
    items = response.json()["items"]
    # Empleado A solo debe ver sus propias solicitudes
    for item in items:
        assert item["empleado_id"] == emp_a.id


# ---------------------------------------------------------------------------
# TC-SOL-008: Listar solicitudes — rh ve todas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_rh_ve_todas(client: AsyncClient, db):
    emp_a = await make_empleado(db, rol="empleado", email="sol008a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="sol008b@leoni.test")
    rh = await make_empleado(db, rol="rh", email="sol008rh@leoni.test")

    await make_solicitud(db, empleado_id=emp_a.id)
    await make_solicitud(db, empleado_id=emp_b.id)

    headers_rh = await auth_headers(client, rh)
    response = await client.get("/api/v1/solicitudes", headers=headers_rh)

    assert response.status_code == 200
    items = response.json()["items"]
    empleado_ids = {item["empleado_id"] for item in items}
    # RH debe ver solicitudes de ambos empleados
    assert emp_a.id in empleado_ids
    assert emp_b.id in empleado_ids


# ---------------------------------------------------------------------------
# TC-SOL-009: Listar solicitudes — supervisor ve las de su equipo directo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_supervisor_ve_equipo(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol009sup@leoni.test")
    # Subordinado del supervisor
    subordinado = await make_empleado(
        db, rol="empleado", email="sol009sub@leoni.test",
        lider_id=supervisor.id,
    )
    # Empleado de otro equipo
    otro = await make_empleado(db, rol="empleado", email="sol009otro@leoni.test")

    await make_solicitud(db, empleado_id=subordinado.id)
    await make_solicitud(db, empleado_id=otro.id)

    headers_sup = await auth_headers(client, supervisor)
    response = await client.get("/api/v1/solicitudes", headers=headers_sup)

    assert response.status_code == 200
    items = response.json()["items"]
    empleado_ids = {item["empleado_id"] for item in items}
    # Supervisor ve a su subordinado, no al empleado de otro equipo
    assert subordinado.id in empleado_ids
    assert otro.id not in empleado_ids


# ---------------------------------------------------------------------------
# TC-SOL-010: Aprobar solicitud — supervisor directo aprueba → ok
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_supervisor_directo_ok(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol010sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol010sub@leoni.test",
        lider_id=supervisor.id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "approved"


# ---------------------------------------------------------------------------
# TC-SOL-011: Aprobar solicitud — empleado intenta aprobar → 403 por rol
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_empleado_retorna_403(client: AsyncClient, db):
    empleado_a = await make_empleado(db, rol="empleado", email="sol011a@leoni.test")
    empleado_b = await make_empleado(db, rol="empleado", email="sol011b@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado_b.id, estado="pending")

    headers_a = await auth_headers(client, empleado_a)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_a,
    )

    # El router requiere rol supervisor|gerente|director|rh → 403
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-012: Aprobar solicitud — supervisor no-directo → 403 por jerarquia
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_supervisor_no_directo_retorna_403(client: AsyncClient, db):
    supervisor_a = await make_empleado(db, rol="supervisor", email="sol012supa@leoni.test")
    supervisor_b = await make_empleado(db, rol="supervisor", email="sol012supb@leoni.test")
    # Subordinado de supervisor_b, no de supervisor_a
    subordinado = await make_empleado(
        db, rol="empleado", email="sol012sub@leoni.test",
        lider_id=supervisor_b.id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    # supervisor_a intenta aprobar la solicitud del subordinado de supervisor_b
    headers_a = await auth_headers(client, supervisor_a)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_a,
    )

    assert response.status_code == 403
    assert "supervisor" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-013: Override — director aprueba directamente sin jerarquia
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_override_solicitud_director_ok(client: AsyncClient, db):
    director = await make_empleado(db, rol="director", email="sol013dir@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol013emp@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="pending")

    headers_dir = await auth_headers(client, director)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/override",
        json={"accion": "override", "nivel": 4, "comentario": "Override por director"},
        headers=headers_dir,
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "overridden"


# ---------------------------------------------------------------------------
# TC-SOL-014: Override — rh aprueba directamente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_override_solicitud_rh_ok(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sol014rh@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol014emp@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="pending")

    headers_rh = await auth_headers(client, rh)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/override",
        json={"accion": "override", "nivel": 4, "comentario": "Override RH"},
        headers=headers_rh,
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "overridden"


# ---------------------------------------------------------------------------
# TC-SOL-015: Override — supervisor no puede usar override → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_override_solicitud_supervisor_retorna_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol015sup@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol015emp@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/override",
        json={"accion": "override", "nivel": 4, "comentario": "Intento override"},
        headers=headers_sup,
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-016: Cancelar solicitud — dueno cancela PENDING → ok
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancelar_solicitud_dueno_retorna_200(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol016@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="pending")

    headers = await auth_headers(client, empleado)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "cancelled"


# ---------------------------------------------------------------------------
# TC-SOL-017: Cancelar solicitud — otro empleado intenta cancelar → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancelar_solicitud_otro_empleado_retorna_403(client: AsyncClient, db):
    empleado_a = await make_empleado(db, rol="empleado", email="sol017a@leoni.test")
    empleado_b = await make_empleado(db, rol="empleado", email="sol017b@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado_a.id, estado="pending")

    # empleado_b intenta cancelar la solicitud de empleado_a
    headers_b = await auth_headers(client, empleado_b)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=headers_b,
    )

    assert response.status_code == 403
    assert "propias" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-018: Cancelar solicitud ya aprobada → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancelar_solicitud_aprobada_retorna_409(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol018@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="approved")

    headers = await auth_headers(client, empleado)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=headers,
    )

    assert response.status_code == 409
    assert "pending" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-019: Rechazar solicitud → estado REJECTED
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rechazar_solicitud_supervisor_retorna_rejected(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol019sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019sub@leoni.test",
        lider_id=supervisor.id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=headers_sup,
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "rejected"


# ---------------------------------------------------------------------------
# TC-SOL-020: Rechazar solicitud ya aprobada → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rechazar_solicitud_no_pending_retorna_409(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol020sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol020sub@leoni.test",
        lider_id=supervisor.id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="approved")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=headers_sup,
    )

    assert response.status_code == 409


# ---------------------------------------------------------------------------
# TC-SOL-021: GET solicitud por ID — empleado accede a la suya → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_solicitud_propia_retorna_200(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol021@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers = await auth_headers(client, empleado)
    response = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == solicitud.id


# ---------------------------------------------------------------------------
# TC-SOL-022: GET solicitud por ID — empleado accede a la de otro → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_solicitud_ajena_empleado_retorna_403(client: AsyncClient, db):
    empleado_a = await make_empleado(db, rol="empleado", email="sol022a@leoni.test")
    empleado_b = await make_empleado(db, rol="empleado", email="sol022b@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado_a.id)

    headers_b = await auth_headers(client, empleado_b)
    response = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_b)

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-023: GET solicitud inexistente → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_solicitud_inexistente_retorna_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sol023rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/solicitudes/99999", headers=headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# TC-SOL-024: Aprobar solicitud ya aprobada → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_ya_aprobada_retorna_409(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol024sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol024sub@leoni.test",
        lider_id=supervisor.id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="approved")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )

    assert response.status_code == 409


# ---------------------------------------------------------------------------
# TC-SOL-025: Crear sin token → 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_sin_token_retorna_401(client: AsyncClient, db):
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-SOL-026: Override en solicitud already overridden → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_override_solicitud_ya_overridden_retorna_409(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sol026rh@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol026emp@leoni.test")
    # Solicitud en estado overridden — no pending ni rejected
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="overridden")

    headers_rh = await auth_headers(client, rh)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/override",
        json={"accion": "override", "nivel": 4, "comentario": "Doble override"},
        headers=headers_rh,
    )

    assert response.status_code == 409


# ---------------------------------------------------------------------------
# TC-SOL-027: Parametrize — tipos de solicitud validos
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("tipo", ["vacaciones", "home_office"])
async def test_crear_solicitud_tipos_validos(tipo, client: AsyncClient, db):
    import uuid
    email = f"sol027_{tipo}_{uuid.uuid4().hex[:6]}@leoni.test"
    empleado = await make_empleado(db, rol="empleado", email=email)
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": tipo,
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-06",
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["tipo"] == tipo
