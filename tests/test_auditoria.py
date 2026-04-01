# tests/test_auditoria.py
"""
Tests del modulo de auditoria — Plataforma RH Leoni Cable.

Cubre:
  - log_action() persiste AuditLog en DB tras flush
  - audit_background() encola BackgroundTask correctamente
  - GET /api/v1/auditoria/logs requiere rol rh → otros roles → 403
  - Filtros: modulo, usuario_id, fecha_desde/hasta
  - GET /api/v1/auditoria/logs/{id} — acceso y not-found
  - log_action() propaga excepcion si la DB falla
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auditoria import AuditLog
from app.utils.audit_logger import audit_background, log_action
from tests.conftest import auth_headers, make_empleado

LOGS_ENDPOINT = "/api/v1/auditoria/logs"


# ---------------------------------------------------------------------------
# TC-AUD-001: log_action() persiste en DB tras flush
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_action_persiste_en_db(db: AsyncSession):
    await log_action(
        db=db,
        accion="TEST_ACTION",
        modulo="test",
        usuario_id=None,
        entidad_id=42,
        datos_antes={"estado": "pending"},
        datos_despues={"estado": "approved"},
        ip_address="192.168.1.100",
    )

    result = await db.execute(
        select(AuditLog).where(AuditLog.accion == "TEST_ACTION")
    )
    log = result.scalar_one_or_none()

    assert log is not None
    assert log.modulo == "test"
    assert log.entidad_id == 42
    assert log.datos_antes == {"estado": "pending"}
    assert log.datos_despues == {"estado": "approved"}
    assert log.ip_address == "192.168.1.100"


# ---------------------------------------------------------------------------
# TC-AUD-002: log_action() con usuario_id → se guarda correctamente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_action_con_usuario_id(db: AsyncSession):
    empleado = await make_empleado(db, rol="empleado", email="aud002@leoni.test")

    await log_action(
        db=db,
        accion="LOGIN",
        modulo="auth",
        usuario_id=empleado.id,
    )

    result = await db.execute(
        select(AuditLog).where(
            AuditLog.accion == "LOGIN",
            AuditLog.usuario_id == empleado.id,
        )
    )
    log = result.scalar_one_or_none()
    assert log is not None
    assert log.usuario_id == empleado.id
    assert log.modulo == "auth"


# ---------------------------------------------------------------------------
# TC-AUD-003: log_action() propaga excepcion si DB falla
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_action_propaga_excepcion_si_db_falla(db: AsyncSession):
    with patch.object(db, "flush", new_callable=AsyncMock, side_effect=Exception("DB Error")):
        with pytest.raises(Exception, match="DB Error"):
            await log_action(
                db=db,
                accion="SHOULD_FAIL",
                modulo="test",
            )


# ---------------------------------------------------------------------------
# TC-AUD-004: audit_background() encola BackgroundTask correctamente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_audit_background_encola_task(db: AsyncSession):
    from fastapi import BackgroundTasks

    bg_tasks = BackgroundTasks()
    # Debe encolar sin lanzar excepcion
    audit_background(
        background_tasks=bg_tasks,
        db=db,
        accion="SOLICITUD_CREATED",
        modulo="solicitudes",
        usuario_id=1,
        entidad_id=10,
        datos_despues={"tipo": "vacaciones", "estado": "pending"},
    )

    # Verificar que se encoló exactamente 1 tarea
    assert len(bg_tasks.tasks) == 1


# ---------------------------------------------------------------------------
# TC-AUD-005: audit_background() task es callable y recibe los args correctos
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_audit_background_task_tiene_args_correctos(db: AsyncSession):
    from fastapi import BackgroundTasks

    bg_tasks = BackgroundTasks()
    audit_background(
        background_tasks=bg_tasks,
        db=db,
        accion="SOLICITUD_APPROVED",
        modulo="solicitudes",
        usuario_id=5,
        entidad_id=99,
    )

    task = bg_tasks.tasks[0]
    # BackgroundTask almacena kwargs
    assert task.kwargs.get("accion") == "SOLICITUD_APPROVED"
    assert task.kwargs.get("modulo") == "solicitudes"
    assert task.kwargs.get("usuario_id") == 5
    assert task.kwargs.get("entidad_id") == 99


# ---------------------------------------------------------------------------
# TC-AUD-006: GET /auditoria/logs requiere rol rh → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_rol_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud006rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(LOGS_ENDPOINT, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body


# ---------------------------------------------------------------------------
# TC-AUD-007: GET /auditoria/logs con rol empleado → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_rol_empleado_retorna_403(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="aud007emp@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.get(LOGS_ENDPOINT, headers=headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-AUD-008: GET /auditoria/logs con rol supervisor → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_rol_supervisor_retorna_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="aud008sup@leoni.test")
    headers = await auth_headers(client, supervisor)

    response = await client.get(LOGS_ENDPOINT, headers=headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-AUD-009: GET /auditoria/logs con rol director → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_rol_director_retorna_403(client: AsyncClient, db):
    director = await make_empleado(db, rol="director", email="aud009dir@leoni.test")
    headers = await auth_headers(client, director)

    response = await client.get(LOGS_ENDPOINT, headers=headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-AUD-010: GET /auditoria/logs sin token → 401
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_sin_token_retorna_401(client: AsyncClient, db):
    response = await client.get(LOGS_ENDPOINT)
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# TC-AUD-011: Filtro por modulo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_filtro_por_modulo(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud011rh@leoni.test")

    # Insertar logs con diferentes modulos
    await log_action(db=db, accion="A1", modulo="solicitudes", usuario_id=rh.id)
    await log_action(db=db, accion="A2", modulo="auth", usuario_id=rh.id)

    headers = await auth_headers(client, rh)
    response = await client.get(f"{LOGS_ENDPOINT}?modulo=solicitudes", headers=headers)

    assert response.status_code == 200
    items = response.json()["items"]
    for item in items:
        assert item["modulo"] == "solicitudes"


# ---------------------------------------------------------------------------
# TC-AUD-012: Filtro por usuario_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_filtro_por_usuario_id(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud012rh@leoni.test")
    otro = await make_empleado(db, rol="empleado", email="aud012otro@leoni.test")

    await log_action(db=db, accion="USER_ACTION", modulo="test", usuario_id=rh.id)
    await log_action(db=db, accion="OTHER_ACTION", modulo="test", usuario_id=otro.id)

    headers = await auth_headers(client, rh)
    response = await client.get(
        f"{LOGS_ENDPOINT}?usuario_id={rh.id}",
        headers=headers,
    )

    assert response.status_code == 200
    items = response.json()["items"]
    for item in items:
        assert item["usuario_id"] == rh.id


# ---------------------------------------------------------------------------
# TC-AUD-013: Filtro por fecha_desde — excluye registros anteriores
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_logs_filtro_por_fecha_desde(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud013rh@leoni.test")
    headers = await auth_headers(client, rh)

    # La fecha de corte es "manana" — ningun log anterior deberia aparecer si el
    # servicio filtra correctamente
    future_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.get(
        f"{LOGS_ENDPOINT}?fecha_desde={future_date}",
        headers=headers,
    )

    assert response.status_code == 200
    # Con fecha_desde en el futuro, no deberia haber resultados
    assert response.json()["total"] == 0


# ---------------------------------------------------------------------------
# TC-AUD-014: GET /auditoria/logs/{id} — log existente → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_log_por_id_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud014rh@leoni.test")

    # Crear log directamente en DB
    log = AuditLog(
        accion="DIRECT_LOG",
        modulo="test",
        usuario_id=rh.id,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)

    headers = await auth_headers(client, rh)
    response = await client.get(f"{LOGS_ENDPOINT}/{log.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == log.id
    assert response.json()["accion"] == "DIRECT_LOG"


# ---------------------------------------------------------------------------
# TC-AUD-015: GET /auditoria/logs/{id} inexistente → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_log_inexistente_retorna_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="aud015rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(f"{LOGS_ENDPOINT}/99999999", headers=headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# TC-AUD-016: Parametrize — roles sin acceso a logs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("rol", ["empleado", "supervisor", "gerente", "director"])
async def test_roles_sin_acceso_a_logs(rol, client: AsyncClient, db):
    import uuid
    email = f"aud016_{rol}_{uuid.uuid4().hex[:6]}@leoni.test"
    usuario = await make_empleado(db, rol=rol, email=email)
    headers = await auth_headers(client, usuario)

    response = await client.get(LOGS_ENDPOINT, headers=headers)
    assert response.status_code == 403
