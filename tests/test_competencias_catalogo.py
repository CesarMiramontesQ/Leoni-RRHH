# tests/test_competencias_catalogo.py
"""
Tests CRUD del catalogo de Competencias — subcategoria UX.

Cubre:
  - Crear competencia (con y sin subcategoria)
  - Duplicado nombre+categoria → 409
  - Listar con paginacion
  - Filtro por busqueda
  - Actualizar competencia
  - Eliminar (soft-delete, activo=false)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_competencia


# ── Tests CRUD ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_competencia(client: AsyncClient, db: AsyncSession):
    """POST /competencias con datos validos → 201, respuesta con shape correcto."""
    rh = await make_empleado(db, rol="rh", email="cat_crear@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Soldadura MIG",
        "categoria": "tecnica",
        "descripcion": "Proceso de soldadura con gas inerte",
    }
    resp = await client.post("/api/v1/competencias", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["nombre"] == "Soldadura MIG"
    assert body["categoria"] == "tecnica"
    assert body["descripcion"] == "Proceso de soldadura con gas inerte"
    assert body["activo"] is True
    assert body["subcategoria"] is None
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_crear_competencia_duplicada(client: AsyncClient, db: AsyncSession):
    """POST con nombre+categoria duplicado → 409."""
    rh = await make_empleado(db, rol="rh", email="cat_dup@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Competencia Duplicada Cat",
        "categoria": "blanda",
        "descripcion": "Prueba de duplicado",
    }

    # Primera creacion exitosa
    r1 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r1.status_code == 201

    # Segunda creacion con mismos datos → conflicto
    r2 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r2.status_code == 409
    assert "ya existe" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_listar_competencias(client: AsyncClient, db: AsyncSession):
    """GET /competencias con paginacion retorna items."""
    rh = await make_empleado(db, rol="rh", email="cat_list@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear varias competencias
    await make_competencia(db, nombre="Comp Listar A", categoria="tecnica")
    await make_competencia(db, nombre="Comp Listar B", categoria="blanda")
    await make_competencia(db, nombre="Comp Listar C", categoria="tecnica")

    resp = await client.get(
        "/api/v1/competencias?page=1&page_size=10",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert "page" in body
    assert "page_size" in body
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert body["total"] >= 3
    assert len(body["items"]) >= 3


@pytest.mark.asyncio
async def test_listar_competencias_filtro_busqueda(client: AsyncClient, db: AsyncSession):
    """GET /competencias?busqueda=X filtra por nombre."""
    rh = await make_empleado(db, rol="rh", email="cat_busq@leoni.test")
    headers = await auth_headers(client, rh)

    await make_competencia(db, nombre="Metrologia Avanzada", categoria="tecnica")
    await make_competencia(db, nombre="Comunicacion Asertiva", categoria="blanda")

    resp = await client.get(
        "/api/v1/competencias?busqueda=Metrologia",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert "metrologia" in item["nombre"].lower()


@pytest.mark.asyncio
async def test_actualizar_competencia(client: AsyncClient, db: AsyncSession):
    """PUT /competencias/{id} actualiza nombre → 200."""
    rh = await make_empleado(db, rol="rh", email="cat_upd@leoni.test")
    headers = await auth_headers(client, rh)

    comp = await make_competencia(
        db, nombre="Nombre Original Cat", categoria="tecnica", descripcion="Desc original"
    )

    resp = await client.put(
        f"/api/v1/competencias/{comp.id}",
        json={"nombre": "Nombre Actualizado Cat", "descripcion": "Desc actualizada"},
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["nombre"] == "Nombre Actualizado Cat"
    assert body["descripcion"] == "Desc actualizada"
    # Categoria no cambio
    assert body["categoria"] == "tecnica"


@pytest.mark.asyncio
async def test_eliminar_competencia(client: AsyncClient, db: AsyncSession):
    """DELETE /competencias/{id} → 204 (soft-delete), GET confirma activo=false."""
    rh = await make_empleado(db, rol="rh", email="cat_del@leoni.test")
    headers = await auth_headers(client, rh)

    comp = await make_competencia(db, nombre="Comp Para Eliminar Cat", categoria="blanda")

    # Eliminar
    resp_del = await client.delete(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    assert resp_del.status_code == 204

    # Verificar que GET ya no la encuentra (soft-delete excluye inactivas del listado)
    resp_detail = await client.get(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    # El endpoint puede retornar 404 o el objeto con activo=false
    if resp_detail.status_code == 200:
        assert resp_detail.json()["activo"] is False
    else:
        assert resp_detail.status_code == 404


@pytest.mark.asyncio
async def test_crear_competencia_con_subcategoria(client: AsyncClient, db: AsyncSession):
    """POST /competencias con subcategoria → 201, subcategoria presente en respuesta."""
    rh = await make_empleado(db, rol="rh", email="cat_subcat@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Python Avanzado",
        "categoria": "tecnica",
        "descripcion": "Programacion avanzada en Python",
        "subcategoria": "informatica",
    }
    resp = await client.post("/api/v1/competencias", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["nombre"] == "Python Avanzado"
    assert body["categoria"] == "tecnica"
    assert body["subcategoria"] == "informatica"
    assert body["activo"] is True
    assert "id" in body
