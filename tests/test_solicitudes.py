# tests/test_solicitudes.py
"""
Tests del dominio solicitudes — Plataforma RH Leoni Cable.

Cubre:
  - Crear solicitud (todos los roles permitidos)
  - Duplicidad exacta (mismas fechas inicio/fin que solicitud activa) → 409 mensaje fijo
  - Saldo vacaciones insuficiente → 422
  - Validacion de esquema (fecha_fin < fecha_inicio, tipo invalido) → 422
  - Listado con filtrado por rol (empleado, supervisor, gerente, rh)
  - Gerente: acceso por subarbol; GET enriquecido; aprobacion jerarquica en un solo paso (supervisor o gerente)
  - Aprobacion: supervisor directo aprueba → ok
  - Aprobacion: empleado intenta aprobar → 403 (rol)
  - Rechazo: empleado intenta rechazar → 403 (rol)
  - Aprobacion: supervisor no-directo intenta aprobar → 403 (jerarquia)
  - Aprobacion: supervisor o gerente intenta aprobar solicitud propia → 403 (no autopaprobacion)
  - Override: director/rh aprueban sin jerarquia
  - Cancelar: dueno cancela PENDING → ok
  - Cancelar: otro empleado intenta cancelar → 403
  - Cancelar: solicitud no-pending → 409
  - Rechazar → estado REJECTED
  - Solicitar cambios: solo pending; estado changes_requested; notificación; bitácora vía aprobaciones
  - PATCH revision: solo dueño en changes_requested → pending; 403 si no es el creador; 409 si no aplica
  - PATCH revision: notificación in-app al supervisor (tipo_evento solicitud_corregida_reenviada)
  - GET solicitud por ID con acceso/no-acceso
  - Aprobar solicitud ya aprobada → 409
"""

import pytest
from datetime import date
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from sqlalchemy import update

from app.models.empleados import Empleado
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

REQUEST_CHANGES_PAYLOAD = {
    "nivel": 1,
    "comentario": "Ajusta las fechas al calendario de planta.",
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


@pytest.mark.asyncio
async def test_crear_solicitud_supervisor_para_subordinado_usa_empleado_id_objetivo(
    client: AsyncClient, db,
):
    supervisor = await make_empleado(db, rol="supervisor", email="sol002b_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol002b_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    headers = await auth_headers(client, supervisor)

    payload = {**SOLICITUD_VACACIONES, "empleado_id": subordinado.id}
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["empleado_id"] == subordinado.id


@pytest.mark.asyncio
async def test_crear_solicitud_supervisor_para_subordinado_home_office_un_dia_retorna_201(
    client: AsyncClient,
    db,
):
    from tests.conftest import make_empleado_home_office

    supervisor = await make_empleado(db, rol="supervisor", email="sol002b_sup_ho@leoni.test")
    subordinado = await make_empleado_home_office(
        db,
        email="sol002b_sub_ho@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    headers = await auth_headers(client, supervisor)
    payload = {
        "tipo": "home_office",
        "fecha_inicio": "2026-06-03",
        "fecha_fin": "2026-06-03",
        "empleado_id": subordinado.id,
        "motivo": None,
        "comentarios": None,
    }
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "home_office"
    assert body["empleado_id"] == subordinado.id


@pytest.mark.asyncio
async def test_crear_solicitud_empleado_otro_colaborador_retorna_403(client: AsyncClient, db):
    emp_a = await make_empleado(db, rol="empleado", email="sol002c_a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="sol002c_b@leoni.test")
    headers = await auth_headers(client, emp_a)

    payload = {**SOLICITUD_VACACIONES, "empleado_id": emp_b.id}
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_crear_solicitud_gerente_para_subordinado_indirecto_retorna_201(
    client: AsyncClient, db,
):
    """El modo «Equipo» del gerente alcanza todo su subárbol, no solo los directos."""
    gerente = await make_empleado(db, rol="gerente", email="sol002d_ger@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol002d_sup@leoni.test", lider_id=gerente.empleado_id
    )
    nieto = await make_empleado(
        db, rol="empleado", email="sol002d_nieto@leoni.test", lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, gerente)

    payload = {**SOLICITUD_VACACIONES, "empleado_id": nieto.id}
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 201
    assert response.json()["empleado_id"] == nieto.id


@pytest.mark.asyncio
async def test_crear_solicitud_gerente_fuera_de_su_subarbol_retorna_403(
    client: AsyncClient, db,
):
    gerente = await make_empleado(db, rol="gerente", email="sol002e_ger@leoni.test")
    ajeno = await make_empleado(db, rol="empleado", email="sol002e_ajeno@leoni.test")
    headers = await auth_headers(client, gerente)

    payload = {**SOLICITUD_VACACIONES, "empleado_id": ajeno.id}
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_crear_solicitud_supervisor_para_subordinado_indirecto_retorna_403(
    client: AsyncClient, db,
):
    """El supervisor sigue limitado a reportes directos."""
    supervisor = await make_empleado(db, rol="supervisor", email="sol002f_sup@leoni.test")
    medio = await make_empleado(
        db, rol="empleado", email="sol002f_medio@leoni.test", lider_id=supervisor.empleado_id
    )
    nieto = await make_empleado(
        db, rol="empleado", email="sol002f_nieto@leoni.test", lider_id=medio.empleado_id
    )
    headers = await auth_headers(client, supervisor)

    payload = {**SOLICITUD_VACACIONES, "empleado_id": nieto.id}
    response = await client.post("/api/v1/solicitudes", json=payload, headers=headers)

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-002b: Crear solicitud como gerente → 201
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_gerente_retorna_201(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="sol002bger@leoni.test")
    headers = await auth_headers(client, gerente)

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
# TC-SOL-004: Mismas fechas exactas que solicitud activa → 409 mensaje fijo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_solicitud_duplicado_exacto_retorna_409_mensaje_fijo(
    client: AsyncClient, db
):
    empleado = await make_empleado(db, rol="empleado", email="sol004@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 5, 5),
        fecha_fin=date(2026, 5, 9),
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json().get("detail") == "Esta solicitud ya existe"


# ---------------------------------------------------------------------------
# TC-SOL-004a: Duplicidad exacta gana sobre saldo insuficiente (orden 1 antes que 2)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_duplicado_exacto_antes_que_saldo(
    client: AsyncClient, db,
):
    empleado = await make_empleado(
        db, rol="empleado", email="sol004a@leoni.test"
    )
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 5, 5),
        fecha_fin=date(2026, 5, 9),
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )
    assert response.status_code == 409
    assert response.json().get("detail") == "Esta solicitud ya existe"


# ---------------------------------------------------------------------------
# TC-SOL-004b: Dos solicitudes mismo tipo con fechas distintas (sin duplicar) → 201
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_mismo_tipo_sin_solape_retorna_201(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol004b@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 4, 1),
        fecha_fin=date(2026, 4, 3),
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )

    assert response.status_code == 201


# ---------------------------------------------------------------------------
# TC-SOL-004c: Periodos que se solapan (mismo tipo, fechas distintas) → 409
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_periodos_solapados_mismo_tipo_retorna_409(
    client: AsyncClient, db
):
    empleado = await make_empleado(db, rol="empleado", email="sol004c@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 5, 1),
        fecha_fin=date(2026, 5, 10),
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-05-05",
            "fecha_fin": "2026-05-09",
            "comentarios": "Otro tramo",
        },
        headers=headers,
    )
    assert response.status_code == 409
    detail = response.json().get("detail") or ""
    assert "empalma" in detail.lower()
    assert "01/05/2026" in detail
    assert "10/05/2026" in detail


# ---------------------------------------------------------------------------
# TC-SOL-004d: Empalme entre tipos distintos (vacaciones + home_office) → 409
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_empalme_tipos_distintos_retorna_409(
    client: AsyncClient, db
):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol004d-empalme@test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="approved",
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 6, 5),
    )

    headers = await auth_headers(client, empleado)
    # Home Office del empleado debe ser un solo día; cae dentro del rango de vacaciones aprobadas.
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-03",
            "fecha_fin": "2026-06-03",
            "comentarios": "HO durante vacaciones",
        },
        headers=headers,
    )
    assert response.status_code == 409
    detail = response.json().get("detail") or ""
    assert "empalma" in detail.lower()


# ---------------------------------------------------------------------------
# TC-SOL-004e: Empalme contra solicitud cancelada/rechazada → 201 (no bloquea)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_empalme_contra_cancelada_o_rechazada_201(
    client: AsyncClient, db
):
    empleado = await make_empleado(db, rol="empleado", email="sol004e@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="cancelled",
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 10),
    )
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="rejected",
        fecha_inicio=date(2026, 7, 1),
        fecha_fin=date(2026, 7, 10),
    )

    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-07-05",
            "fecha_fin": "2026-07-08",
            "comentarios": "Reintento tras cancelación/rechazo",
        },
        headers=headers,
    )
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# TC-SOL-004e: Vacaciones administrativo — solo días laborales
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_permiso_sin_goce_administrativo_rechaza_fin_de_semana(
    client: AsyncClient, db,
):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    supervisor = await make_empleado(db, rol="supervisor", email="sol004g_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol004g_sub@leoni.test",
        lider_id=supervisor.empleado_id,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    headers = await auth_headers(client, supervisor)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "permiso_sin_goce_sueldo",
            "fecha_inicio": "2026-05-08",
            "fecha_fin": "2026-05-11",
            "empleado_id": subordinado.id,
            "motivo": "Permiso personal",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "entre semana" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_crear_solicitud_permiso_sin_goce_administrativo_entre_semana_ok(
    client: AsyncClient, db,
):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    supervisor = await make_empleado(db, rol="supervisor", email="sol004h_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol004h_sub@leoni.test",
        lider_id=supervisor.empleado_id,
        clasificacion_id=cl_admin.clasificacion_id,
    )
    headers = await auth_headers(client, supervisor)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "permiso_sin_goce_sueldo",
            "fecha_inicio": "2026-05-04",
            "fecha_fin": "2026-05-06",
            "empleado_id": subordinado.id,
            "motivo": "Permiso personal",
        },
        headers=headers,
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_crear_solicitud_vacaciones_administrativo_rechaza_fin_de_semana(
    client: AsyncClient, db,
):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    empleado = await make_empleado(
        db,
        rol="empleado",
        email="sol004e@leoni.test",
        clasificacion_id=cl_admin.clasificacion_id,
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-05-08",
            "fecha_fin": "2026-05-11",
            "comentarios": "Incluye fin de semana",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "entre semana" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_crear_solicitud_vacaciones_administrativo_cuenta_dias_laborales(
    client: AsyncClient, db,
):
    """Un administrativo compromete días LABORALES (lun–vie), no naturales. La solicitud
    pendiente reduce el disponible (saldo TRESS − comprometidos) en esos días laborales."""
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    empleado = await make_empleado(
        db,
        rol="empleado",
        email="sol004f@leoni.test",
        clasificacion_id=cl_admin.clasificacion_id,
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-05-04",  # lunes
            "fecha_fin": "2026-05-08",  # viernes → 5 días laborales
            "comentarios": "Semana laboral",
        },
        headers=headers,
    )
    assert response.status_code == 201

    disp = await client.get(
        f"/api/v1/empleados/{empleado.id}/vacaciones-disponibles-solicitud",
        headers=headers,
    )
    assert disp.status_code == 200
    body = disp.json()
    assert body["dias_comprometidos"] == 5
    assert body["dias_disponibles"] == 999.0 - 5


# TC-SOL-004d: Vacaciones con saldo insuficiente → 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crear_solicitud_vacaciones_sin_dias_disponibles_422(
    client: AsyncClient, db,
):
    empleado = await make_empleado(
        db, rol="empleado", email="sol004c@leoni.test", saldo_vacaciones=0.0
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "vacaciones",
            "fecha_inicio": "2026-05-05",
            "fecha_fin": "2026-05-05",
            "comentarios": "Un solo día",
        },
        headers=headers,
    )
    assert response.status_code == 422
    detail = response.json().get("detail", "")
    assert "días de vacaciones disponibles" in detail.lower()


@pytest.mark.asyncio
async def test_crear_solicitud_vacaciones_saldo_insuficiente_422(
    client: AsyncClient, db,
):
    empleado = await make_empleado(
        db, rol="empleado", email="sol004d@leoni.test", saldo_vacaciones=2.0
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json=SOLICITUD_VACACIONES,
        headers=headers,
    )
    assert response.status_code == 422
    detail = response.json().get("detail", "")
    assert "insuficiente" in detail.lower()
    assert "2" in detail


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
# TC-SOL-007B: Listar solicitudes — empleado solo ve tipos habilitados
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_empleado_oculta_tipos_no_habilitados(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol007c@leoni.test")
    await make_solicitud(db, empleado_id=empleado.id, tipo="vacaciones")
    await make_solicitud(db, empleado_id=empleado.id, tipo="home_office")
    await make_solicitud(db, empleado_id=empleado.id, tipo="permiso_sin_goce_sueldo")
    await make_solicitud(db, empleado_id=empleado.id, tipo="paternidad")

    headers = await auth_headers(client, empleado)
    response = await client.get("/api/v1/solicitudes", headers=headers)

    assert response.status_code == 200
    tipos = {item["tipo"] for item in response.json()["items"]}
    assert tipos.issubset({"vacaciones", "home_office", "permiso_sin_goce_sueldo"})
    assert "paternidad" not in tipos


# ---------------------------------------------------------------------------
# TC-SOL-007C: Listar solicitudes — empleado no recibe estado overridden
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_empleado_oculta_estado_overridden(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol007d@leoni.test")
    await make_solicitud(db, empleado_id=empleado.id, tipo="vacaciones", estado="pending")
    await make_solicitud(db, empleado_id=empleado.id, tipo="vacaciones", estado="overridden")

    headers = await auth_headers(client, empleado)
    response = await client.get("/api/v1/solicitudes", headers=headers)

    assert response.status_code == 200
    estados = {item["estado"] for item in response.json()["items"]}
    assert "pending" in estados
    assert "overridden" not in estados


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


@pytest.mark.asyncio
async def test_listar_solicitudes_rh_modo_empleado_solo_ve_las_suyas(client: AsyncClient, db):
    emp_a = await make_empleado(db, rol="empleado", email="sol008c_a@leoni.test")
    emp_b = await make_empleado(db, rol="empleado", email="sol008c_b@leoni.test")
    rh = await make_empleado(db, rol="rh", email="sol008c_rh@leoni.test")

    await make_solicitud(db, empleado_id=emp_a.id)
    await make_solicitud(db, empleado_id=emp_b.id)
    await make_solicitud(db, empleado_id=rh.id)

    headers_rh = await auth_headers(client, rh)
    headers_rh["X-RH-UI-Mode"] = "empleado"
    response = await client.get("/api/v1/solicitudes", headers=headers_rh)

    assert response.status_code == 200
    items = response.json()["items"]
    empleado_ids = {item["empleado_id"] for item in items}
    assert rh.id in empleado_ids
    assert emp_a.id not in empleado_ids
    assert emp_b.id not in empleado_ids


@pytest.mark.asyncio
async def test_get_solicitud_rh_modo_empleado_otra_solicitud_403(client: AsyncClient, db):
    otro = await make_empleado(db, rol="empleado", email="sol008d_otro@leoni.test")
    rh = await make_empleado(db, rol="rh", email="sol008d_rh@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=otro.id)

    headers_rh = await auth_headers(client, rh)
    headers_rh["X-RH-UI-Mode"] = "empleado"
    response = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_rh)

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-009: Listar solicitudes — supervisor ve las de su equipo directo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_supervisor_ve_equipo(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol009sup@leoni.test")
    # Subordinado del supervisor
    subordinado = await make_empleado(
        db, rol="empleado", email="sol009sub@leoni.test",
        lider_id=supervisor.empleado_id,
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
        lider_id=supervisor.empleado_id,
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


@pytest.mark.asyncio
async def test_aprobar_solicitud_persiste_notificacion_in_app_para_requisitor(client: AsyncClient, db):
    """Al aprobar, la notificacion al requisitor queda en la misma transaccion (tabla notificaciones)."""
    from sqlalchemy import select

    from app.models.notificaciones import Notificacion

    supervisor = await make_empleado(db, rol="supervisor", email="sol_notif_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol_notif_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 200

    result = await db.execute(select(Notificacion).where(Notificacion.user_id == subordinado.id))
    notifs = list(result.scalars().all())
    aprobacion = [n for n in notifs if (n.metadata_json or {}).get("tipo_evento") == "solicitud_aprobada_final"]
    assert len(aprobacion) == 1
    n = aprobacion[0]
    assert n.user_id == subordinado.id
    assert "aprobada" in (n.message or "").lower()
    meta = n.metadata_json or {}
    assert meta.get("solicitud_id") == solicitud.id
    assert meta.get("entidad") == "solicitud"
    assert meta.get("estado") == "approved"


@pytest.mark.asyncio
async def test_aprobar_vacaciones_expira_accesos_comedor_en_rango(client: AsyncClient, db):
    from sqlalchemy import select

    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )

    supervisor = await make_empleado(db, rol="supervisor", email="sol_vac_com_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol_vac_com_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 5, 5),
        fecha_fin=date(2026, 5, 9),
    )

    comedor = Comedor(nombre="Comedor Vac", activo=True)
    db.add(comedor)
    await db.flush()

    registro = ComedorRegistro(
        empleado_id=subordinado.id,
        comedor_id=comedor.id,
        semana=date(2026, 5, 4),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(registro)
    await db.flush()

    acceso_fuera = ComedorAcceso(
        empleado_id=subordinado.id,
        comedor_id=comedor.id,
        comedor_registro_id=registro.id,
        fecha_servicio=date(2026, 5, 3),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    acceso_en_rango_1 = ComedorAcceso(
        empleado_id=subordinado.id,
        comedor_id=comedor.id,
        comedor_registro_id=registro.id,
        fecha_servicio=date(2026, 5, 6),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    acceso_en_rango_2 = ComedorAcceso(
        empleado_id=subordinado.id,
        comedor_id=comedor.id,
        comedor_registro_id=registro.id,
        fecha_servicio=date(2026, 5, 9),
        tipo_comida=ComedorTipoComida.saludable,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add_all([acceso_fuera, acceso_en_rango_1, acceso_en_rango_2])
    await db.flush()

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 200

    result = await db.execute(
        select(ComedorAcceso)
        .where(ComedorAcceso.empleado_id == subordinado.id)
        .order_by(ComedorAcceso.fecha_servicio.asc())
    )
    rows = list(result.scalars().all())
    estados_por_fecha = {row.fecha_servicio.isoformat(): row.estado_acceso.value for row in rows}
    assert estados_por_fecha["2026-05-03"] == "PENDIENTE"
    assert estados_por_fecha["2026-05-06"] == "EXPIRADO"
    assert estados_por_fecha["2026-05-09"] == "EXPIRADO"


@pytest.mark.asyncio
async def test_aprobar_vacaciones_crea_notificacion_cancelacion_comidas(client: AsyncClient, db):
    from sqlalchemy import select

    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.models.notificaciones import Notificacion

    supervisor = await make_empleado(db, rol="supervisor", email="sol_vac_notif_sup@leoni.test")
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol_vac_notif_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 6, 2),
        fecha_fin=date(2026, 6, 6),
    )

    comedor = Comedor(nombre="Comedor Notif", activo=True)
    db.add(comedor)
    await db.flush()

    registro = ComedorRegistro(
        empleado_id=subordinado.id,
        comedor_id=comedor.id,
        semana=date(2026, 6, 1),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(registro)
    await db.flush()

    db.add(
        ComedorAcceso(
            empleado_id=subordinado.id,
            comedor_id=comedor.id,
            comedor_registro_id=registro.id,
            fecha_servicio=date(2026, 6, 4),
            tipo_comida=ComedorTipoComida.casera,
            estado_acceso=ComedorAccesoEstado.PENDIENTE,
        )
    )
    await db.flush()

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 200

    result = await db.execute(select(Notificacion).where(Notificacion.user_id == subordinado.id))
    notifs = list(result.scalars().all())
    cancelaciones = [
        n
        for n in notifs
        if (n.metadata_json or {}).get("tipo_evento") == "comedor_reservas_canceladas_por_vacaciones"
    ]
    assert len(cancelaciones) == 1
    meta = cancelaciones[0].metadata_json or {}
    assert meta.get("solicitud_id") == solicitud.id
    assert meta.get("comidas_canceladas") == 1
    assert meta.get("fecha_inicio") == "2026-06-02"
    assert meta.get("fecha_fin") == "2026-06-06"


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
# TC-SOL-011b: Rechazar solicitud — empleado intenta rechazar → 403 por rol
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rechazar_solicitud_empleado_retorna_403(client: AsyncClient, db):
    empleado_a = await make_empleado(db, rol="empleado", email="sol011reja@leoni.test")
    empleado_b = await make_empleado(db, rol="empleado", email="sol011rejb@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado_b.id, estado="pending")

    headers_a = await auth_headers(client, empleado_a)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=headers_a,
    )

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
        lider_id=supervisor_b.empleado_id,
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
    assert "permiso" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-012b: Supervisor intenta aprobar solicitud propia (jefe directo = sí mismo) → 403
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aprobar_solicitud_supervisor_propia_retorna_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol012bself@leoni.test")
    await db.execute(
        update(Empleado).where(Empleado.id == supervisor.id).values(lider_id=supervisor.empleado_id)
    )
    await db.flush()
    solicitud = await make_solicitud(db, empleado_id=supervisor.id, estado="pending")

    headers = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert response.status_code == 403
    assert "propia" in response.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# TC-SOL-012c: Solicitud del gerente — supervisor aprueba en un paso; segundo intento 409
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aprobar_solicitud_gerente_propia_supervisor_cierra_un_paso(client: AsyncClient, db):
    """
    El gerente es el solicitante; su supervisor aprueba una sola vez y queda approved.
    El gerente no puede «segunda aprobar» (409).
    """
    gerente = await make_empleado(db, rol="gerente", email="sol012cg@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol012cs@leoni.test", lider_id=gerente.empleado_id
    )
    await db.execute(
        update(Empleado).where(Empleado.id == gerente.id).values(lider_id=supervisor.empleado_id)
    )
    await db.flush()

    solicitud = await make_solicitud(db, empleado_id=gerente.id, estado="pending")

    headers_s = await auth_headers(client, supervisor)
    r1 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_s,
    )
    assert r1.status_code == 200
    assert r1.json()["estado"] == "approved"
    assert r1.json()["nivel_actual"] == 1

    headers_g = await auth_headers(client, gerente)
    r2 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_g,
    )
    assert r2.status_code == 409


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
        lider_id=supervisor.empleado_id,
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
        lider_id=supervisor.empleado_id,
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
# TC-SOL-019b: Solicitar cambios — supervisor, pending → changes_requested
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_solicitar_cambios_supervisor_pending_ok(client: AsyncClient, db):
    from sqlalchemy import select

    from app.models.solicitudes import SolicitudAprobacion

    supervisor = await make_empleado(db, rol="supervisor", email="sol019b_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019b_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/request-changes",
        json=REQUEST_CHANGES_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["estado"] == "changes_requested"

    result = await db.execute(
        select(SolicitudAprobacion).where(SolicitudAprobacion.solicitud_id == solicitud.id)
    )
    rows = list(result.scalars().all())
    assert any(a.accion == "request_changes" for a in rows)
    rc = next(a for a in rows if a.accion == "request_changes")
    assert rc.aprobador_id == supervisor.id
    assert rc.comentario == REQUEST_CHANGES_PAYLOAD["comentario"]


@pytest.mark.asyncio
async def test_solicitar_cambios_persiste_notificacion_in_app_para_requisitor(
    client: AsyncClient, db,
):
    from sqlalchemy import select

    from app.models.notificaciones import Notificacion

    supervisor = await make_empleado(db, rol="supervisor", email="sol019c_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019c_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/request-changes",
        json=REQUEST_CHANGES_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 200

    result = await db.execute(select(Notificacion).where(Notificacion.user_id == subordinado.id))
    notifs = list(result.scalars().all())
    cambios = [n for n in notifs if (n.metadata_json or {}).get("tipo_evento") == "solicitud_cambios_solicitados"]
    assert len(cambios) == 1
    n = cambios[0]
    meta = n.metadata_json or {}
    assert meta.get("solicitud_id") == solicitud.id
    assert meta.get("estado") == "changes_requested"
    assert meta.get("aprobador_id") == supervisor.id


@pytest.mark.asyncio
async def test_solicitar_cambios_empleado_retorna_403(client: AsyncClient, db):
    empleado_a = await make_empleado(db, rol="empleado", email="sol019d_a@leoni.test")
    empleado_b = await make_empleado(db, rol="empleado", email="sol019d_b@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado_b.id, estado="pending")

    headers_a = await auth_headers(client, empleado_a)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/request-changes",
        json=REQUEST_CHANGES_PAYLOAD,
        headers=headers_a,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_solicitar_cambios_no_pending_retorna_409(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol019e_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019e_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="approved")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/request-changes",
        json=REQUEST_CHANGES_PAYLOAD,
        headers=headers_sup,
    )
    assert response.status_code == 409
    assert "pending" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_patch_revision_requisitor_changes_requested_ok(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol019f_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019f_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        estado="changes_requested",
        fecha_inicio=date(2026, 5, 5),
        fecha_fin=date(2026, 5, 9),
    )

    headers_sub = await auth_headers(client, subordinado)
    patch_body = {
        "fecha_inicio": "2026-05-12",
        "fecha_fin": "2026-05-16",
        "motivo": "Fechas corregidas según comentario del supervisor.",
    }
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json=patch_body,
        headers=headers_sub,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["estado"] == "pending"
    assert body["nivel_actual"] == 1
    assert body["fecha_inicio"] == patch_body["fecha_inicio"]
    assert body["fecha_fin"] == patch_body["fecha_fin"]
    assert body["motivo"] == patch_body["motivo"]


@pytest.mark.asyncio
async def test_patch_revision_otro_empleado_retorna_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol019g_sup@leoni.test")
    dueno = await make_empleado(
        db, rol="empleado", email="sol019g_own@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    otro = await make_empleado(db, rol="empleado", email="sol019g_otr@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=dueno.id, estado="changes_requested")

    headers_otro = await auth_headers(client, otro)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
        },
        headers=headers_otro,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patch_revision_pending_retorna_409(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol019h@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="pending")

    headers = await auth_headers(client, empleado)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
        },
        headers=headers,
    )
    assert response.status_code == 409
    assert "changes_requested" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_patch_revision_supervisor_retorna_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol019i_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019i_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="changes_requested")

    headers_sup = await auth_headers(client, supervisor)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
        },
        headers=headers_sup,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patch_revision_rh_retorna_403(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sol019j_rh@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol019j_emp@leoni.test")
    solicitud = await make_solicitud(db, empleado_id=empleado.id, estado="changes_requested")

    headers_rh = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
        },
        headers=headers_rh,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patch_revision_notifica_supervisor_corregida_reenviada(client: AsyncClient, db):
    from sqlalchemy import select

    from app.models.notificaciones import Notificacion

    supervisor = await make_empleado(db, rol="supervisor", email="sol019k_sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol019k_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        estado="changes_requested",
        fecha_inicio=date(2026, 6, 2),
        fecha_fin=date(2026, 6, 6),
    )

    headers_sub = await auth_headers(client, subordinado)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": "2026-06-09",
            "fecha_fin": "2026-06-13",
            "motivo": "Corrección aplicada.",
        },
        headers=headers_sub,
    )
    assert response.status_code == 200

    result = await db.execute(select(Notificacion).where(Notificacion.user_id == supervisor.id))
    notifs = list(result.scalars().all())
    reenv = [n for n in notifs if (n.metadata_json or {}).get("tipo_evento") == "solicitud_corregida_reenviada"]
    assert len(reenv) == 1
    meta = reenv[0].metadata_json or {}
    assert meta.get("solicitud_id") == solicitud.id
    assert meta.get("estado") == "pending"
    assert meta.get("empleado_solicitante_id") == subordinado.id


# ---------------------------------------------------------------------------
# TC-SOL-021: GET solicitud por ID — empleado accede a la suya → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_solicitud_propia_retorna_200(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sol021@leoni.test")
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        comentarios="Detalle GET: comentarios del empleado",
    )

    headers = await auth_headers(client, empleado)
    response = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == solicitud.id
    assert body["comentarios"] == "Detalle GET: comentarios del empleado"
    assert body["estado"] == solicitud.estado
    assert body["empleado_id"] == empleado.id
    assert body["fecha_inicio"] == str(solicitud.fecha_inicio)
    assert body["fecha_fin"] == str(solicitud.fecha_fin)


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
# TC-SOL-023b: GET aprobaciones — incluye nombre del aprobador
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_aprobaciones_incluye_nombre_aprobador(client: AsyncClient, db):
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="sol023b_sup@leoni.test",
        nombre="Ana Aprobadora Histórico",
    )
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="sol023b_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await make_solicitud(db, empleado_id=subordinado.id, estado="pending")

    headers_sup = await auth_headers(client, supervisor)
    approve = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_sup,
    )
    assert approve.status_code == 200

    headers_sub = await auth_headers(client, subordinado)
    response = await client.get(
        f"/api/v1/solicitudes/{solicitud.id}/aprobaciones",
        headers=headers_sub,
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["accion"] == "approve"
    assert rows[0]["aprobador_id"] == supervisor.id
    assert rows[0]["aprobador_nombre"] == "Ana Aprobadora Histórico"


# ---------------------------------------------------------------------------
# TC-SOL-024: Aprobar solicitud ya aprobada → 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_ya_aprobada_retorna_409(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sol024sup@leoni.test")
    subordinado = await make_empleado(
        db, rol="empleado", email="sol024sub@leoni.test",
        lider_id=supervisor.empleado_id,
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
@pytest.mark.parametrize("tipo", ["vacaciones"])
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


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_empleado_un_dia_valido(client: AsyncClient, db):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho1@leoni.test")
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-02",
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "home_office"
    assert body["fecha_inicio"] == "2026-06-02"
    assert body["fecha_fin"] == "2026-06-02"


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_no_administrativo_retorna_422(
    client: AsyncClient,
    db,
):
    empleado = await make_empleado(db, rol="empleado", email="sol027_ho3@leoni.test")
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-02",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "Administrativo" in response.text


@pytest.mark.asyncio
async def test_crear_solicitud_rh_home_office_no_administrativo_retorna_422(
    client: AsyncClient,
    db,
):
    rh = await make_empleado(db, rol="rh", email="sol027_ho_rh@leoni.test")
    colaborador = await make_empleado(db, rol="empleado", email="sol027_ho_sub@leoni.test")
    headers = await auth_headers(client, rh)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-02",
            "empleado_id": colaborador.id,
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "Administrativo" in response.text


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_fin_de_semana_retorna_422(client: AsyncClient, db):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho_weekend@leoni.test")
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-06",
            "fecha_fin": "2026-06-06",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "entre semana" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_empleado_rango_retorna_422(client: AsyncClient, db):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho2@leoni.test")
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-06",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "un día" in response.text.lower()


@pytest.mark.asyncio
async def test_crear_solicitud_rh_home_office_rango_retorna_422(client: AsyncClient, db):
    from tests.conftest import make_clasificacion_administrativo

    cl_admin = await make_clasificacion_administrativo(db)
    rh = await make_empleado(db, rol="rh", email="sol027_ho_rh_rango@leoni.test")
    colaborador = await make_empleado(
        db,
        rol="empleado",
        email="sol027_ho_sub_rango@leoni.test",
        clasificacion_id=cl_admin.clasificacion_id,
    )
    headers = await auth_headers(client, rh)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-06",
            "empleado_id": colaborador.id,
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "un día" in response.text.lower()


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_segundo_en_mismo_bloque_retorna_422(
    client: AsyncClient, db,
):
    from tests.conftest import make_empleado_home_office

    # Regla «1 cada 2 semanas»: 3 y 10 de junio de 2026 (semanas ISO 23 y 24) caen
    # en el mismo bloque.
    empleado = await make_empleado_home_office(
        db, email="sol027_ho_mes@leoni.test", periodo_semanas=2
    )
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="home_office",
        estado="approved",
        fecha_inicio=date(2026, 6, 3),
        fecha_fin=date(2026, 6, 3),
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-10",
            "fecha_fin": "2026-06-10",
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "periodo" in response.text.lower()


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_bloques_distintos_ok(client: AsyncClient, db):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho_mes_ok@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="home_office",
        estado="approved",
        fecha_inicio=date(2026, 5, 6),
        fecha_fin=date(2026, 5, 6),
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={
            "tipo": "home_office",
            "fecha_inicio": "2026-06-02",
            "fecha_fin": "2026-06-02",
        },
        headers=headers,
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_patch_revision_home_office_mismo_mes_excluye_solicitud_actual(
    client: AsyncClient, db,
):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho_rev@leoni.test")
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="home_office",
        estado="changes_requested",
        fecha_inicio=date(2026, 6, 2),
        fecha_fin=date(2026, 6, 2),
    )
    headers = await auth_headers(client, empleado)
    response = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={
            "fecha_inicio": "2026-06-09",
            "fecha_fin": "2026-06-09",
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["fecha_inicio"] == "2026-06-09"


@pytest.mark.asyncio
async def test_get_home_office_disponibilidad_empleado(client: AsyncClient, db):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(db, email="sol027_ho_disp@leoni.test")
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="home_office",
        estado="pending",
        fecha_inicio=date(2026, 6, 4),
        fecha_fin=date(2026, 6, 4),
    )
    headers = await auth_headers(client, empleado)
    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/home-office/disponibilidad",
        params={"fecha": "2026-06-05"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["elegible"] is True
    assert body["dias_usados"] == 1
    assert body["puede_solicitar"] is False

    # Semana siguiente: el bloque de «1 por semana» ya está libre.
    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/home-office/disponibilidad",
        params={"fecha": "2026-06-08"},
        headers=headers,
    )
    assert response.json()["puede_solicitar"] is True


@pytest.mark.asyncio
async def test_get_home_office_disponibilidad_no_elegible_sin_regla_de_area(
    client: AsyncClient, db,
):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(
        db, email="sol027_ho_noregla@leoni.test", con_regla=False
    )
    headers = await auth_headers(client, empleado)
    response = await client.get(
        f"/api/v1/empleados/{empleado.id}/home-office/disponibilidad",
        params={"fecha": "2026-06-05"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["elegible"] is False
    assert body["puede_solicitar"] is False


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_regla_de_area_apagada_retorna_422(
    client: AsyncClient, db,
):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(
        db, email="sol027_ho_apagada@leoni.test", regla_activa=False
    )
    headers = await auth_headers(client, empleado)
    response = await client.post(
        "/api/v1/solicitudes",
        json={"tipo": "home_office", "fecha_inicio": "2026-06-02", "fecha_fin": "2026-06-02"},
        headers=headers,
    )
    assert response.status_code == 422
    assert "regla" in response.text.lower()


@pytest.mark.asyncio
async def test_crear_solicitud_home_office_dos_dias_por_semana_permite_segundo(
    client: AsyncClient, db,
):
    from tests.conftest import make_empleado_home_office

    empleado = await make_empleado_home_office(
        db, email="sol027_ho_2xsem@leoni.test", dias_permitidos=2, periodo_semanas=1
    )
    await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="home_office",
        estado="approved",
        fecha_inicio=date(2026, 6, 2),
        fecha_fin=date(2026, 6, 2),
    )
    headers = await auth_headers(client, empleado)
    ok = await client.post(
        "/api/v1/solicitudes",
        json={"tipo": "home_office", "fecha_inicio": "2026-06-04", "fecha_fin": "2026-06-04"},
        headers=headers,
    )
    assert ok.status_code == 201
    tercero = await client.post(
        "/api/v1/solicitudes",
        json={"tipo": "home_office", "fecha_inicio": "2026-06-05", "fecha_fin": "2026-06-05"},
        headers=headers,
    )
    assert tercero.status_code == 422


@pytest.mark.asyncio
async def test_crear_solicitud_goce_redirige_a_faltas_retardos(client: AsyncClient, db):
    """Alta de goce ya no va por Solicitudes: debe usarse Incidencias (módulo faltas-retardos)."""
    rh = await make_empleado(db, rol="rh", email="sol027b_rh@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="sol027b_emp@leoni.test")
    headers = await auth_headers(client, rh)
    for tipo, fin in (
        ("matrimonio", "2026-05-05"),
        ("paternidad", "2026-05-12"),
        ("defuncion", "2026-05-08"),
        ("incapacidad_interna", "2026-05-10"),
    ):
        response = await client.post(
            "/api/v1/solicitudes",
            json={
                "tipo": tipo,
                "empleado_id": empleado.id,
                "fecha_inicio": "2026-05-04",
                "fecha_fin": fin,
            },
            headers=headers,
        )
        assert response.status_code == 422, tipo
        detail = response.json().get("detail", "").lower()
        assert "incidencias" in detail


# ---------------------------------------------------------------------------
# TC-SOL-028: Gerente — listado incluye solicitudes de todo el subarbol
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_solicitudes_gerente_incluye_subarbol(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="sol028g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol028s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol028e@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers = await auth_headers(client, gerente)
    response = await client.get("/api/v1/solicitudes", headers=headers)
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert solicitud.id in ids


# ---------------------------------------------------------------------------
# TC-SOL-029: Gerente — no puede ver solicitud fuera de su linea (GET 403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_solicitud_gerente_fuera_de_linea_retorna_403(client: AsyncClient, db):
    gerente_a = await make_empleado(db, rol="gerente", email="sol029ga@leoni.test")
    gerente_b = await make_empleado(db, rol="gerente", email="sol029gb@leoni.test")
    sup_a = await make_empleado(db, rol="supervisor", email="sol029sa@leoni.test", lider_id=gerente_a.empleado_id)
    emp_a = await make_empleado(db, rol="empleado", email="sol029ea@leoni.test", lider_id=sup_a.empleado_id)
    solicitud = await make_solicitud(db, empleado_id=emp_a.id)

    headers_b = await auth_headers(client, gerente_b)
    response = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_b)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-SOL-030: Gerente — puede aprobar como gerente de línea (un solo paso)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_solicitud_gerente_linea_un_solo_paso_ok(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="sol030g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol030s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol030e@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers_g = await auth_headers(client, gerente)
    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_g,
    )
    assert response.status_code == 200
    assert response.json()["estado"] == "approved"


# ---------------------------------------------------------------------------
# TC-SOL-030b: Gerente raíz aprueba solicitud de subárbol aunque no sea gerente de línea
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aprobar_solicitud_gerente_raiz_subarbol_sin_ser_linea(client: AsyncClient, db):
    gerente_raiz = await make_empleado(db, rol="gerente", email="sol030br@leoni.test")
    gerente_intermedio = await make_empleado(
        db, rol="gerente", email="sol030bi@leoni.test", lider_id=gerente_raiz.empleado_id
    )
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol030bs@leoni.test", lider_id=gerente_intermedio.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol030be@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers_raiz = await auth_headers(client, gerente_raiz)
    det = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_raiz)
    assert det.status_code == 200
    assert det.json()["gerente_linea_id"] == gerente_intermedio.id

    response = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_raiz,
    )
    assert response.status_code == 200
    assert response.json()["estado"] == "approved"


# ---------------------------------------------------------------------------
# TC-SOL-031: Un solo paso — supervisor aprueba y queda cerrada; segundo intento 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flujo_aprobacion_supervisor_un_paso_segundo_409(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="sol031g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol031s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol031e@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers_g = await auth_headers(client, gerente)
    det = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_g)
    assert det.status_code == 200
    body0 = det.json()
    assert body0["pendiente_aprobacion_supervisor"] is False
    assert body0["pendiente_aprobacion_gerente"] is False
    assert body0["gerente_linea_id"] == gerente.id
    assert body0["gerente_linea_nombre"] == gerente.nombre

    headers_s = await auth_headers(client, supervisor)
    r1 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_s,
    )
    assert r1.status_code == 200
    assert r1.json()["estado"] == "approved"
    assert r1.json()["nivel_actual"] == 1

    det2 = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers_g)
    assert det2.json()["supervisor_aprobo"] is True
    assert det2.json()["pendiente_aprobacion_gerente"] is False

    r2 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_g,
    )
    assert r2.status_code == 409


# ---------------------------------------------------------------------------
# TC-SOL-031b: Gerente puede aprobar primero (un solo paso)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_flujo_aprobacion_gerente_primero_ok(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="sol031bgg@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol031bss@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol031bee@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers_g = await auth_headers(client, gerente)
    r1 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_g,
    )
    assert r1.status_code == 200
    assert r1.json()["estado"] == "approved"

    headers_s = await auth_headers(client, supervisor)
    r2 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_s,
    )
    assert r2.status_code == 409


# ---------------------------------------------------------------------------
# TC-SOL-032: Otro gerente no puede aprobar; tras primera aprobación el segundo intento es 409
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aprobar_otro_gerente_sin_permiso_o_ya_aprobada(client: AsyncClient, db):
    gerente_a = await make_empleado(db, rol="gerente", email="sol032ga@leoni.test")
    gerente_b = await make_empleado(db, rol="gerente", email="sol032gb@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="sol032s@leoni.test", lider_id=gerente_a.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="sol032e@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(db, empleado_id=empleado.id)

    headers_s = await auth_headers(client, supervisor)
    r1 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_s,
    )
    assert r1.status_code == 200

    headers_b = await auth_headers(client, gerente_b)
    r2 = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers_b,
    )
    assert r2.status_code == 409


# ---------------------------------------------------------------------------
# Alcance del equipo (gerente): profundidad configurable del listado
# ---------------------------------------------------------------------------

async def _armar_cadena_gerente(db, prefijo: str):
    """gerente → supervisor → empleado (3 niveles); una solicitud por nivel inferior."""
    gerente = await make_empleado(db, rol="gerente", email=f"{prefijo}g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email=f"{prefijo}s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email=f"{prefijo}e@leoni.test", lider_id=supervisor.empleado_id
    )
    sol_sup = await make_solicitud(db, empleado_id=supervisor.id)
    sol_emp = await make_solicitud(db, empleado_id=empleado.id)
    return gerente, supervisor, empleado, sol_sup, sol_emp


@pytest.mark.asyncio
async def test_alcance_equipo_get_gerente_default_todo(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="alc001g@leoni.test")
    headers = await auth_headers(client, gerente)
    response = await client.get("/api/v1/solicitudes/me/alcance-equipo", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"aplica": True, "profundidad_equipo": None}


@pytest.mark.asyncio
async def test_alcance_equipo_get_supervisor_no_aplica(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="alc002s@leoni.test")
    headers = await auth_headers(client, supervisor)
    response = await client.get("/api/v1/solicitudes/me/alcance-equipo", headers=headers)
    assert response.status_code == 200
    assert response.json()["aplica"] is False


@pytest.mark.asyncio
async def test_alcance_equipo_put_supervisor_403(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="alc003s@leoni.test")
    headers = await auth_headers(client, supervisor)
    response = await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": 1},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_alcance_equipo_put_fuera_de_rango_422(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="alc004g@leoni.test")
    headers = await auth_headers(client, gerente)
    for valor in (0, 4):
        response = await client.put(
            "/api/v1/solicitudes/me/alcance-equipo",
            json={"profundidad_equipo": valor},
            headers=headers,
        )
        assert response.status_code == 422, valor


@pytest.mark.asyncio
async def test_alcance_equipo_profundidad_1_solo_directos_en_listado(client: AsyncClient, db):
    gerente, supervisor, empleado, sol_sup, sol_emp = await _armar_cadena_gerente(db, "alc005")
    headers = await auth_headers(client, gerente)

    put = await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": 1},
        headers=headers,
    )
    assert put.status_code == 200
    assert put.json() == {"aplica": True, "profundidad_equipo": 1}

    get = await client.get("/api/v1/solicitudes/me/alcance-equipo", headers=headers)
    assert get.json()["profundidad_equipo"] == 1

    listado = await client.get("/api/v1/solicitudes", headers=headers)
    assert listado.status_code == 200
    ids = {item["id"] for item in listado.json()["items"]}
    assert sol_sup.id in ids
    assert sol_emp.id not in ids
    assert listado.json()["total"] == 1


@pytest.mark.asyncio
async def test_alcance_equipo_profundidad_2_incluye_nivel_2(client: AsyncClient, db):
    gerente, supervisor, empleado, sol_sup, sol_emp = await _armar_cadena_gerente(db, "alc006")
    headers = await auth_headers(client, gerente)
    await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": 2},
        headers=headers,
    )
    listado = await client.get("/api/v1/solicitudes", headers=headers)
    ids = {item["id"] for item in listado.json()["items"]}
    assert {sol_sup.id, sol_emp.id} <= ids


@pytest.mark.asyncio
async def test_alcance_equipo_volver_a_null_restaura_todo(client: AsyncClient, db):
    gerente, supervisor, empleado, sol_sup, sol_emp = await _armar_cadena_gerente(db, "alc007")
    headers = await auth_headers(client, gerente)
    await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": 1},
        headers=headers,
    )
    await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": None},
        headers=headers,
    )
    listado = await client.get("/api/v1/solicitudes", headers=headers)
    ids = {item["id"] for item in listado.json()["items"]}
    assert {sol_sup.id, sol_emp.id} <= ids


@pytest.mark.asyncio
async def test_alcance_equipo_no_acota_detalle_ni_aprobacion(client: AsyncClient, db):
    """Solo visualización: con profundidad 1 el gerente sigue viendo y aprobando nivel 2."""
    gerente, supervisor, empleado, sol_sup, sol_emp = await _armar_cadena_gerente(db, "alc008")
    headers = await auth_headers(client, gerente)
    await client.put(
        "/api/v1/solicitudes/me/alcance-equipo",
        json={"profundidad_equipo": 1},
        headers=headers,
    )
    detalle = await client.get(f"/api/v1/solicitudes/{sol_emp.id}", headers=headers)
    assert detalle.status_code == 200
    aprobar = await client.put(
        f"/api/v1/solicitudes/{sol_emp.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=headers,
    )
    assert aprobar.status_code == 200, aprobar.text


@pytest.mark.asyncio
async def test_listado_gerente_atraviesa_lider_intermedio_inactivo(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="alc009g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="alc009s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="alc009e@leoni.test", lider_id=supervisor.empleado_id
    )
    await db.execute(update(Empleado).where(Empleado.id == supervisor.id).values(estado_id=99))
    await db.commit()
    sol_emp = await make_solicitud(db, empleado_id=empleado.id)

    headers = await auth_headers(client, gerente)
    listado = await client.get("/api/v1/solicitudes", headers=headers)
    ids = {item["id"] for item in listado.json()["items"]}
    assert sol_emp.id in ids
