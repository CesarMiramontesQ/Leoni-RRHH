# tests/test_perfil_competencias.py
"""
Tests para endpoints de Competencias Requeridas en Perfil de Funciones.

Endpoints:
  GET  /api/v1/perfiles/{perfil_id}/competencias
  POST /api/v1/perfiles/{perfil_id}/competencias
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_competencia, make_puesto_perfil


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _make_competencia_con_subcategoria(
    db: AsyncSession,
    *,
    nombre: str = "Liderazgo",
    categoria: str = "blanda",
    subcategoria: str | None = None,
) -> "Competencia":
    """Crea competencia con subcategoria (campo no expuesto en conftest_talento)."""
    from app.models.talento import Competencia

    comp = Competencia(
        nombre=nombre,
        categoria=categoria,
        subcategoria=subcategoria,
        activo=True,
    )
    db.add(comp)
    await db.flush()
    await db.refresh(comp)
    return comp


# ── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listar_competencias_perfil_vacio(client: AsyncClient, db: AsyncSession):
    """GET en perfil sin competencias asignadas retorna lista vacia."""
    rh = await make_empleado(db, rol="rh", email="pc_rh1@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto Vacio")

    resp = await client.get(f"/api/v1/perfiles/{perfil.id}/competencias", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_agregar_competencia_a_perfil(client: AsyncClient, db: AsyncSession):
    """POST con competencia_id valido crea requisito con nivel_requerido=0."""
    rh = await make_empleado(db, rol="rh", email="pc_rh2@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto Competencia")
    comp = await make_competencia(db, nombre="Excel Avanzado", categoria="tecnica")

    resp = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["competencia_id"] == comp.id
    assert data["competencia_nombre"] == "Excel Avanzado"
    assert data["nivel_requerido"] == 0
    assert data["orden"] == 1
    assert "id" in data


@pytest.mark.asyncio
async def test_agregar_competencia_duplicada(client: AsyncClient, db: AsyncSession):
    """POST misma competencia_id dos veces retorna 409 Conflict."""
    rh = await make_empleado(db, rol="rh", email="pc_rh3@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto Duplicado")
    comp = await make_competencia(db, nombre="SAP", categoria="tecnica")

    # Primera vez: OK
    resp1 = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp1.status_code == 201

    # Segunda vez: Conflict
    resp2 = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_agregar_competencia_inexistente(client: AsyncClient, db: AsyncSession):
    """POST con competencia_id que no existe retorna 404."""
    rh = await make_empleado(db, rol="rh", email="pc_rh4@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto NotFound Comp")

    resp = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": 999999},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_agregar_competencia_perfil_inexistente(client: AsyncClient, db: AsyncSession):
    """POST a perfil_id que no existe retorna 404."""
    rh = await make_empleado(db, rol="rh", email="pc_rh5@leoni.test")
    headers = await auth_headers(client, rh)

    comp = await make_competencia(db, nombre="Comunicacion", categoria="blanda")

    resp = await client.post(
        "/api/v1/perfiles/999999/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_agregar_competencia_sin_permiso(client: AsyncClient, db: AsyncSession):
    """POST como empleado (sin rol rh/supervisor) retorna 403."""
    emp = await make_empleado(db, rol="empleado", email="pc_emp1@leoni.test")
    headers = await auth_headers(client, emp)

    perfil = await make_puesto_perfil(db, nombre="Puesto Forbidden")
    comp = await make_competencia(db, nombre="Python", categoria="tecnica")

    resp = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_listar_competencias_con_subcategoria(client: AsyncClient, db: AsyncSession):
    """Despues de agregar, GET incluye subcategoria en la respuesta."""
    rh = await make_empleado(db, rol="rh", email="pc_rh6@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto SubCat")
    comp = await _make_competencia_con_subcategoria(
        db,
        nombre="Negociacion",
        categoria="blanda",
        subcategoria="social",
    )

    # Agregar competencia al perfil
    resp_post = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id},
        headers=headers,
    )
    assert resp_post.status_code == 201
    assert resp_post.json()["subcategoria"] == "social"

    # Verificar en listado GET
    resp_get = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias", headers=headers
    )
    assert resp_get.status_code == 200
    items = resp_get.json()
    assert len(items) == 1
    assert items[0]["subcategoria"] == "social"
    assert items[0]["competencia_nombre"] == "Negociacion"


@pytest.mark.asyncio
async def test_auto_orden_incrementa(client: AsyncClient, db: AsyncSession):
    """Al agregar 2 competencias, orden se asigna 1 y 2 respectivamente."""
    rh = await make_empleado(db, rol="rh", email="pc_rh7@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Puesto Orden")
    comp1 = await make_competencia(db, nombre="Lean Manufacturing", categoria="tecnica")
    comp2 = await make_competencia(db, nombre="Six Sigma", categoria="tecnica")

    resp1 = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp1.id},
        headers=headers,
    )
    resp2 = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp2.id},
        headers=headers,
    )

    assert resp1.status_code == 201
    assert resp2.status_code == 201
    assert resp1.json()["orden"] == 1
    assert resp2.json()["orden"] == 2
