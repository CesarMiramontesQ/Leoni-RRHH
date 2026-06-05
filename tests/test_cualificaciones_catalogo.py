"""Tests para el catálogo configurable de cualificaciones."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import seed_cualificaciones_catalogo


@pytest.mark.asyncio
async def test_listar_tipos_cualificacion(client: AsyncClient, db: AsyncSession):
    await seed_cualificaciones_catalogo(db)
    rh = await make_empleado(db, rol="rh", email="cat_tipos_rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/cualificaciones-catalogo/tipos", headers=headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 7


@pytest.mark.asyncio
async def test_crear_tipo_cualificacion(client: AsyncClient, db: AsyncSession):
    await seed_cualificaciones_catalogo(db)
    rh = await make_empleado(db, rol="rh", email="cat_crear_tipo@leoni.test")
    headers = await auth_headers(client, rh)

    metodos = await client.get("/api/v1/cualificaciones-catalogo/metodos", headers=headers)
    metodo_id = metodos.json()["items"][0]["id"]

    response = await client.post(
        "/api/v1/cualificaciones-catalogo/tipos",
        json={
            "nombre": "Certificaciones externas",
            "descripcion": "Certs de terceros",
            "metodo_calificacion_id": metodo_id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Certificaciones externas"
    assert data["metodo_calificacion_id"] == metodo_id
    assert data["cualificacion_catalogo_id"] is not None


@pytest.mark.asyncio
async def test_crear_opcion_metodo_ordinal(client: AsyncClient, db: AsyncSession):
    await seed_cualificaciones_catalogo(db)
    rh = await make_empleado(db, rol="rh", email="cat_opcion_rh@leoni.test")
    headers = await auth_headers(client, rh)

    metodos = await client.get("/api/v1/cualificaciones-catalogo/metodos", headers=headers)
    metodo_id = metodos.json()["items"][0]["id"]

    response = await client.post(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones",
        json={"etiqueta": "Opción test", "valor": "opc_test", "orden": 99, "peso": 10},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["valor"] == "opc_test"
