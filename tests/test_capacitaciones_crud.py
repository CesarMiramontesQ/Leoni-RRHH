# tests/test_capacitaciones_crud.py
"""
Tests para CRUD de Capacitaciones — Modulo Talento Fase 3.
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
    duracion_horas: int = 8,
    modalidad: str = "presencial",
    cupo_maximo: int = 20,
    area_id: int | None = None,
    estado: str = "activa",
):
    from app.models.talento import Capacitacion

    cap = Capacitacion(
        nombre=nombre,
        duracion_horas=duracion_horas,
        modalidad=modalidad,
        cupo_maximo=cupo_maximo,
        area_id=area_id,
        estado=estado,
        activo=True,
    )
    db.add(cap)
    await db.flush()
    await db.refresh(cap)
    return cap


# ── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listar_capacitaciones_auth_required(client: AsyncClient, db: AsyncSession):
    """GET sin auth → 401."""
    resp = await client.get("/api/v1/capacitaciones")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_listar_capacitaciones_vacio(client: AsyncClient, db: AsyncSession):
    """GET con auth, sin datos → 200, items=[]."""
    emp = await make_empleado(db, rol="empleado", email="cap_emp1@leoni.test")
    headers = await auth_headers(client, emp)

    resp = await client.get("/api/v1/capacitaciones", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_crear_capacitacion_rh(client: AsyncClient, db: AsyncSession):
    """RH crea capacitacion → 201, verificar campos de respuesta."""
    rh = await make_empleado(db, rol="rh", email="cap_rh1@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Seguridad Industrial",
        "descripcion": "Curso basico",
        "duracion_horas": 16,
        "modalidad": "presencial",
        "instructor": "Juan Perez",
        "cupo_maximo": 30,
        "area_id": None,
    }
    resp = await client.post("/api/v1/capacitaciones", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["nombre"] == "Seguridad Industrial"
    assert data["descripcion"] == "Curso basico"
    assert data["duracion_horas"] == 16
    assert data["modalidad"] == "presencial"
    assert data["instructor"] == "Juan Perez"
    assert data["cupo_maximo"] == 30
    assert data["estado"] == "activa"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_crear_capacitacion_empleado_forbidden(client: AsyncClient, db: AsyncSession):
    """Empleado POST → 403."""
    emp = await make_empleado(db, rol="empleado", email="cap_emp2@leoni.test")
    headers = await auth_headers(client, emp)

    payload = {
        "nombre": "Curso Prohibido",
        "descripcion": "No deberia crearse",
        "duracion_horas": 4,
        "modalidad": "online",
        "cupo_maximo": 10,
    }
    resp = await client.post("/api/v1/capacitaciones", json=payload, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_obtener_capacitacion_detalle(client: AsyncClient, db: AsyncSession):
    """GET /{id} → 200, datos correctos."""
    rh = await make_empleado(db, rol="rh", email="cap_rh2@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear via endpoint
    payload = {
        "nombre": "Lean Manufacturing",
        "descripcion": "Metodologia lean",
        "duracion_horas": 24,
        "modalidad": "mixta",
        "instructor": "Maria Garcia",
        "cupo_maximo": 15,
    }
    resp_create = await client.post("/api/v1/capacitaciones", json=payload, headers=headers)
    assert resp_create.status_code == 201
    cap_id = resp_create.json()["id"]

    # Obtener detalle
    resp = await client.get(f"/api/v1/capacitaciones/{cap_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == cap_id
    assert data["nombre"] == "Lean Manufacturing"
    assert data["duracion_horas"] == 24
    assert data["modalidad"] == "mixta"
    assert data["instructor"] == "Maria Garcia"


@pytest.mark.asyncio
async def test_obtener_capacitacion_not_found(client: AsyncClient, db: AsyncSession):
    """GET /99999 → 404."""
    emp = await make_empleado(db, rol="empleado", email="cap_emp3@leoni.test")
    headers = await auth_headers(client, emp)

    resp = await client.get("/api/v1/capacitaciones/99999", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_actualizar_capacitacion_rh(client: AsyncClient, db: AsyncSession):
    """PUT /{id} → 200, datos actualizados."""
    rh = await make_empleado(db, rol="rh", email="cap_rh3@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear
    payload = {
        "nombre": "Excel Basico",
        "duracion_horas": 8,
        "modalidad": "online",
        "cupo_maximo": 25,
    }
    resp_create = await client.post("/api/v1/capacitaciones", json=payload, headers=headers)
    assert resp_create.status_code == 201
    cap_id = resp_create.json()["id"]

    # Actualizar
    update_payload = {
        "nombre": "Excel Avanzado",
        "duracion_horas": 16,
        "cupo_maximo": 20,
    }
    resp = await client.put(f"/api/v1/capacitaciones/{cap_id}", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["nombre"] == "Excel Avanzado"
    assert data["duracion_horas"] == 16
    assert data["cupo_maximo"] == 20
    # Modalidad no cambia
    assert data["modalidad"] == "online"


@pytest.mark.asyncio
async def test_eliminar_capacitacion_rh(client: AsyncClient, db: AsyncSession):
    """DELETE /{id} → 204, luego GET → 404."""
    rh = await make_empleado(db, rol="rh", email="cap_rh4@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear
    payload = {
        "nombre": "Curso Temporal",
        "duracion_horas": 4,
        "modalidad": "presencial",
        "cupo_maximo": 10,
    }
    resp_create = await client.post("/api/v1/capacitaciones", json=payload, headers=headers)
    assert resp_create.status_code == 201
    cap_id = resp_create.json()["id"]

    # Eliminar
    resp_del = await client.delete(f"/api/v1/capacitaciones/{cap_id}", headers=headers)
    assert resp_del.status_code == 204

    # Verificar que ya no existe
    resp_get = await client.get(f"/api/v1/capacitaciones/{cap_id}", headers=headers)
    assert resp_get.status_code == 404


@pytest.mark.asyncio
async def test_filtrar_por_modalidad(client: AsyncClient, db: AsyncSession):
    """Crear 2 capacitaciones (presencial y online), filtrar → solo la que coincide."""
    rh = await make_empleado(db, rol="rh", email="cap_rh5@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear presencial
    await client.post(
        "/api/v1/capacitaciones",
        json={
            "nombre": "Capacitacion Presencial",
            "duracion_horas": 8,
            "modalidad": "presencial",
            "cupo_maximo": 20,
        },
        headers=headers,
    )

    # Crear online
    await client.post(
        "/api/v1/capacitaciones",
        json={
            "nombre": "Capacitacion Online",
            "duracion_horas": 4,
            "modalidad": "online",
            "cupo_maximo": 50,
        },
        headers=headers,
    )

    # Filtrar por modalidad=online
    resp = await client.get(
        "/api/v1/capacitaciones?modalidad=online",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["modalidad"] == "online"


@pytest.mark.asyncio
async def test_filtrar_por_busqueda(client: AsyncClient, db: AsyncSession):
    """Filtrar por busqueda (nombre) → solo capacitaciones que coinciden."""
    rh = await make_empleado(db, rol="rh", email="cap_rh6@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear dos capacitaciones con nombres distintos
    await client.post(
        "/api/v1/capacitaciones",
        json={
            "nombre": "Soldadura MIG Avanzada",
            "duracion_horas": 40,
            "modalidad": "presencial",
            "cupo_maximo": 12,
        },
        headers=headers,
    )
    await client.post(
        "/api/v1/capacitaciones",
        json={
            "nombre": "Normativa ISO 9001",
            "duracion_horas": 16,
            "modalidad": "online",
            "cupo_maximo": 30,
        },
        headers=headers,
    )

    # Buscar por "Soldadura"
    resp = await client.get(
        "/api/v1/capacitaciones?busqueda=Soldadura",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "Soldadura" in item["nombre"]
