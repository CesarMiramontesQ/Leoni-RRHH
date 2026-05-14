# tests/test_capacitaciones_inscripciones.py
"""
Tests para Inscripciones de Capacitaciones — Modulo Talento Fase 3.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado


# ── Helpers ──────────────────────────────────────────────────────────────────


async def make_capacitacion(
    db: AsyncSession,
    *,
    nombre: str = "Cap Test",
    cupo_maximo: int = 5,
    estado: str = "activa",
):
    from app.models.talento import Capacitacion

    cap = Capacitacion(
        nombre=nombre,
        duracion_horas=8,
        modalidad="presencial",
        cupo_maximo=cupo_maximo,
        estado=estado,
        activo=True,
    )
    db.add(cap)
    await db.flush()
    await db.refresh(cap)
    return cap


# ── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_inscribir_self(client: AsyncClient, db: AsyncSession):
    """Empleado se inscribe a si mismo → 201."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp1@leoni.test")
    cap = await make_capacitacion(db)
    headers = await auth_headers(client, emp)

    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["capacitacion_id"] == cap.id
    assert data["empleado_id"] == emp.id
    assert data["estado"] == "inscrito"


@pytest.mark.asyncio
async def test_inscribir_rh_otro_empleado(client: AsyncClient, db: AsyncSession):
    """RH inscribe a otro empleado → 201."""
    rh = await make_empleado(db, rol="rh", email="insc_rh1@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="insc_emp2@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap RH Test")
    headers = await auth_headers(client, rh)

    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["empleado_id"] == emp.id
    assert data["estado"] == "inscrito"


@pytest.mark.asyncio
async def test_inscribir_empleado_otro_empleado_forbidden(client: AsyncClient, db: AsyncSession):
    """Empleado intenta inscribir a otro empleado → 403."""
    emp1 = await make_empleado(db, rol="empleado", email="insc_emp3@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="insc_emp4@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Forbidden Test")
    headers = await auth_headers(client, emp1)

    payload = {"capacitacion_id": cap.id, "empleado_id": emp2.id}
    resp = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_inscribir_duplicado(client: AsyncClient, db: AsyncSession):
    """Mismo empleado inscrito dos veces → 409 conflict."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp5@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Dup Test")
    headers = await auth_headers(client, emp)

    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp1 = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_inscribir_capacitacion_llena(client: AsyncClient, db: AsyncSession):
    """Cupo maximo alcanzado → 400."""
    rh = await make_empleado(db, rol="rh", email="insc_rh2@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Llena", cupo_maximo=1)
    headers = await auth_headers(client, rh)

    # Llenar el unico cupo
    emp1 = await make_empleado(db, rol="empleado", email="insc_emp6@leoni.test")
    payload = {"capacitacion_id": cap.id, "empleado_id": emp1.id}
    resp1 = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp1.status_code == 201

    # Intentar inscribir otro
    emp2 = await make_empleado(db, rol="empleado", email="insc_emp7@leoni.test")
    payload2 = {"capacitacion_id": cap.id, "empleado_id": emp2.id}
    resp2 = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload2,
        headers=headers,
    )
    assert resp2.status_code == 400


@pytest.mark.asyncio
async def test_inscribir_capacitacion_cancelada(client: AsyncClient, db: AsyncSession):
    """Capacitacion con estado != activa → 400."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp8@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Cancelada", estado="cancelada")
    headers = await auth_headers(client, emp)

    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_mis_inscripciones(client: AsyncClient, db: AsyncSession):
    """Empleado ve sus propias inscripciones via GET /mis-inscripciones."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp9@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Mis Insc")
    headers = await auth_headers(client, emp)

    # Inscribirse primero
    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )

    # Consultar mis inscripciones
    resp = await client.get(
        "/api/v1/capacitaciones/mis-inscripciones",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(i["empleado_id"] == emp.id for i in data["items"])


@pytest.mark.asyncio
async def test_listar_inscripciones_capacitacion_rh(client: AsyncClient, db: AsyncSession):
    """RH lista inscripciones de una capacitacion → 200."""
    rh = await make_empleado(db, rol="rh", email="insc_rh3@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="insc_emp10@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Listar RH")
    headers = await auth_headers(client, rh)

    # Inscribir al empleado
    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )

    # Listar inscripciones de la capacitacion
    resp = await client.get(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["items"][0]["capacitacion_id"] == cap.id


@pytest.mark.asyncio
async def test_listar_inscripciones_capacitacion_empleado_forbidden(
    client: AsyncClient, db: AsyncSession
):
    """Empleado no puede listar inscripciones de una capacitacion → 403."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp11@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Listar Forbidden")
    headers = await auth_headers(client, emp)

    resp = await client.get(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cancelar_inscripcion_self(client: AsyncClient, db: AsyncSession):
    """Empleado cancela su propia inscripcion → 204."""
    emp = await make_empleado(db, rol="empleado", email="insc_emp12@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Cancelar Self")
    headers = await auth_headers(client, emp)

    # Inscribirse
    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp_insc = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp_insc.status_code == 201
    inscripcion_id = resp_insc.json()["id"]

    # Cancelar
    resp = await client.delete(
        f"/api/v1/capacitaciones/inscripciones/{inscripcion_id}",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_cancelar_inscripcion_ajena_forbidden(client: AsyncClient, db: AsyncSession):
    """Empleado no puede cancelar inscripcion de otro → 403."""
    rh = await make_empleado(db, rol="rh", email="insc_rh4@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="insc_emp13@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="insc_emp14@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Cancelar Ajena")

    # RH inscribe a emp1
    rh_headers = await auth_headers(client, rh)
    payload = {"capacitacion_id": cap.id, "empleado_id": emp1.id}
    resp_insc = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=rh_headers,
    )
    assert resp_insc.status_code == 201
    inscripcion_id = resp_insc.json()["id"]

    # emp2 intenta cancelar la inscripcion de emp1
    emp2_headers = await auth_headers(client, emp2)
    resp = await client.delete(
        f"/api/v1/capacitaciones/inscripciones/{inscripcion_id}",
        headers=emp2_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_actualizar_inscripcion_rh(client: AsyncClient, db: AsyncSession):
    """RH actualiza estado de inscripcion a completado → 200."""
    rh = await make_empleado(db, rol="rh", email="insc_rh5@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="insc_emp15@leoni.test")
    cap = await make_capacitacion(db, nombre="Cap Actualizar RH")
    headers = await auth_headers(client, rh)

    # Inscribir
    payload = {"capacitacion_id": cap.id, "empleado_id": emp.id}
    resp_insc = await client.post(
        f"/api/v1/capacitaciones/{cap.id}/inscripciones",
        json=payload,
        headers=headers,
    )
    assert resp_insc.status_code == 201
    inscripcion_id = resp_insc.json()["id"]

    # Actualizar estado a completado
    resp = await client.put(
        f"/api/v1/capacitaciones/inscripciones/{inscripcion_id}",
        json={"estado": "completado"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado"] == "completado"
    assert data["fecha_completado"] is not None
