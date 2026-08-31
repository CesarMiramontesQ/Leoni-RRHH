"""Una solicitud = una semana (lunes–domingo).

TRESS registra un movimiento por semana: ningún rango de solicitud puede cruzar
de domingo a lunes. Aplica a todos los tipos self-service (vacaciones, home
office, permiso sin goce) y a todos los creadores, incluido RH — la restricción
es de nómina, no de política. También bloquea la aprobación de solicitudes en
vuelo capturadas antes de la regla.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_solicitud

# Semana lun 2026-05-04 … dom 2026-05-10; el rango cruza al mar 2026-05-12.
CRUZA_INICIO = "2026-05-06"
CRUZA_FIN = "2026-05-12"
# Cortes sugeridos en el mensaje (dd/mm/YYYY).
CORTE_FIN_SEMANA_1 = "10/05/2026"
CORTE_INICIO_SEMANA_2 = "11/05/2026"


def _payload(tipo: str, fecha_inicio: str, fecha_fin: str, **extra):
    return {"tipo": tipo, "fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin, **extra}


@pytest.mark.asyncio
async def test_empleado_vacaciones_cruza_semana_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sem001@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", CRUZA_INICIO, CRUZA_FIN),
        headers=headers,
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert "por semana" in detail.lower()
    assert CORTE_FIN_SEMANA_1 in detail
    assert CORTE_INICIO_SEMANA_2 in detail


@pytest.mark.asyncio
async def test_empleado_vacaciones_misma_semana_retorna_201(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sem002@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", "2026-05-05", "2026-05-08"),
        headers=headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_vacaciones_terminando_en_domingo_retorna_201(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sem003@leoni.test")
    headers = await auth_headers(client, empleado)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", "2026-05-05", "2026-05-10"),
        headers=headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_supervisor_a_nombre_cruza_semana_retorna_422(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sem004_sup@leoni.test")
    sub = await make_empleado(
        db, rol="empleado", email="sem004_sub@leoni.test", lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, supervisor)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", CRUZA_INICIO, CRUZA_FIN, empleado_id=sub.id),
        headers=headers,
    )
    assert r.status_code == 422
    assert "por semana" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_rh_sin_exencion_cruza_semana_retorna_422(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="sem005_rh@leoni.test")
    colaborador = await make_empleado(db, rol="empleado", email="sem005_col@leoni.test")
    headers = await auth_headers(client, rh)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", CRUZA_INICIO, CRUZA_FIN, empleado_id=colaborador.id),
        headers=headers,
    )
    assert r.status_code == 422
    assert "por semana" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_permiso_sin_goce_cruza_semana_retorna_422(client: AsyncClient, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sem006_sup@leoni.test")
    sub = await make_empleado(
        db, rol="empleado", email="sem006_sub@leoni.test", lider_id=supervisor.empleado_id
    )
    headers = await auth_headers(client, supervisor)
    r = await client.post(
        "/api/v1/solicitudes",
        json=_payload(
            "permiso_sin_goce_sueldo",
            CRUZA_INICIO,
            CRUZA_FIN,
            empleado_id=sub.id,
            motivo="Asunto personal",
        ),
        headers=headers,
    )
    assert r.status_code == 422
    assert "por semana" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_dos_solicitudes_disjuntas_misma_semana_ambas_201(client: AsyncClient, db):
    """Solo se prohíbe el cruce: dos registros dentro de la misma semana son válidos."""
    empleado = await make_empleado(db, rol="empleado", email="sem007@leoni.test")
    headers = await auth_headers(client, empleado)
    r1 = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", "2026-05-05", "2026-05-06"),
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    r2 = await client.post(
        "/api/v1/solicitudes",
        json=_payload("vacaciones", "2026-05-08", "2026-05-08"),
        headers=headers,
    )
    assert r2.status_code == 201, r2.text


@pytest.mark.asyncio
async def test_reenvio_changes_requested_cruza_semana_retorna_422(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="sem008@leoni.test")
    solicitud = await make_solicitud(
        db,
        empleado_id=empleado.id,
        tipo="vacaciones",
        estado="changes_requested",
        fecha_inicio=date(2026, 5, 5),
        fecha_fin=date(2026, 5, 6),
    )
    headers = await auth_headers(client, empleado)
    r = await client.patch(
        f"/api/v1/solicitudes/{solicitud.id}/revision",
        json={"fecha_inicio": CRUZA_INICIO, "fecha_fin": CRUZA_FIN},
        headers=headers,
    )
    assert r.status_code == 422
    assert "por semana" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_aprobar_solicitud_en_vuelo_cruza_semana_retorna_422(
    client: AsyncClient, db, monkeypatch
):
    """Una solicitud multi-semana capturada antes de la regla no debe llegar a TRESS:
    la aprobación se rechaza con instrucción de rechazarla y recapturar por semana."""
    registrar = AsyncMock()
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_vacaciones_en_tress", registrar
    )

    supervisor = await make_empleado(db, rol="supervisor", email="sem009_sup@leoni.test")
    sub = await make_empleado(
        db, rol="empleado", email="sem009_sub@leoni.test", lider_id=supervisor.empleado_id
    )
    solicitud = await make_solicitud(
        db,
        empleado_id=sub.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 5, 6),
        fecha_fin=date(2026, 5, 12),
    )

    headers = await auth_headers(client, supervisor)
    r = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json={"accion": "approve", "nivel": 1, "comentario": "ok"},
        headers=headers,
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert "por semana" in detail.lower()
    assert "rech" in detail.lower()  # instruye a rechazarla y recapturar
    registrar.assert_not_awaited()

    sigue = await client.get(f"/api/v1/solicitudes/{solicitud.id}", headers=headers)
    assert sigue.status_code == 200
    assert sigue.json()["estado"] == "pending"
