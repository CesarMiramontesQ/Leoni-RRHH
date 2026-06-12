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


@pytest.mark.asyncio
async def test_eliminar_opcion_metodo_excluye_de_listado(client: AsyncClient, db: AsyncSession):
    """Al eliminar una opción (soft delete), no debe aparecer en GET /opciones."""
    await seed_cualificaciones_catalogo(db)
    rh = await make_empleado(db, rol="rh", email="cat_del_opcion_rh@leoni.test")
    headers = await auth_headers(client, rh)

    metodos = await client.get("/api/v1/cualificaciones-catalogo/metodos", headers=headers)
    assert metodos.status_code == 200
    metodo_id = metodos.json()["items"][0]["id"]

    create_resp = await client.post(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones",
        json={"etiqueta": "Opción eliminable", "valor": "opc_eliminar_test", "orden": 100, "peso": 5},
        headers=headers,
    )
    assert create_resp.status_code == 201
    opcion_id = create_resp.json()["id"]

    list_before = await client.get(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones",
        headers=headers,
    )
    assert list_before.status_code == 200
    assert any(o["id"] == opcion_id for o in list_before.json())

    delete_resp = await client.delete(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones/{opcion_id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    list_after = await client.get(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones",
        headers=headers,
    )
    assert list_after.status_code == 200
    assert not any(o["id"] == opcion_id for o in list_after.json())

    # Re-crear con el mismo valor debe ser posible tras el soft delete
    recreate_resp = await client.post(
        f"/api/v1/cualificaciones-catalogo/metodos/{metodo_id}/opciones",
        json={"etiqueta": "Opción reemplazo", "valor": "opc_eliminar_test", "orden": 101, "peso": 6},
        headers=headers,
    )
    assert recreate_resp.status_code == 201
    assert recreate_resp.json()["valor"] == "opc_eliminar_test"
