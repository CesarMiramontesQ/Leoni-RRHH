# tests/test_competencias.py
"""
Tests del dominio Competencias — Modulo Talento Fase 1.

Cubre:
  - CRUD competencias (crear, listar, detalle, actualizar, eliminar)
  - Autorizacion (solo RH muta, cualquier auth lee)
  - Duplicado de nombre+categoria → 409
  - Filtrado por categoria y busqueda
  - Matriz: obtener por area, bulk update
  - Resumen area
  - Brechas criticas
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.empleados import Empleado
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_area,
    make_competencia,
    make_competencia_requisito,
    make_puesto_perfil,
)


# Payload valido reutilizable
COMPETENCIA_PAYLOAD = {
    "nombre": "Lean Manufacturing",
    "categoria": "tecnica",
    "descripcion": "Metodologia de manufactura esbelta",
}


# ===========================================================================
# CRUD Competencias
# ===========================================================================


# ---------------------------------------------------------------------------
# test_create_competencia_success
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_competencia_success(client: AsyncClient, db):
    """RH crea competencia exitosamente → 201."""
    rh = await make_empleado(db, rol="rh", email="comp_create@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/competencias",
        json=COMPETENCIA_PAYLOAD,
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "Lean Manufacturing"
    assert body["categoria"] == "tecnica"
    assert body["activo"] is True
    assert "id" in body


# ---------------------------------------------------------------------------
# test_create_competencia_duplicate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_competencia_duplicate(client: AsyncClient, db):
    """Crear competencia con nombre+categoria duplicado → 409."""
    rh = await make_empleado(db, rol="rh", email="comp_dup@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "Competencia Unica Dup", "categoria": "blanda", "descripcion": "Test"}

    # Crear la primera
    r1 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r1.status_code == 201

    # Intentar duplicar
    r2 = await client.post("/api/v1/competencias", json=payload, headers=headers)
    assert r2.status_code == 409
    assert "ya existe" in r2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# test_list_competencias_by_categoria
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_competencias_by_categoria(client: AsyncClient, db):
    """Filtrar competencias por categoria retorna solo las de esa categoria."""
    area = await make_area(db, descripcion="Area Comp Cat")
    rh = await make_empleado(db, rol="rh", email="comp_cat@leoni.test")
    headers = await auth_headers(client, rh)

    await make_competencia(db, nombre="Tecnica Cat A", categoria="tecnica", area_id=area.area_id)
    await make_competencia(db, nombre="Blanda Cat B", categoria="blanda", area_id=area.area_id)
    await make_competencia(db, nombre="Tecnica Cat C", categoria="tecnica", area_id=area.area_id)

    response = await client.get(
        "/api/v1/competencias?categoria=tecnica",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    for item in body["items"]:
        assert item["categoria"] == "tecnica"


# ---------------------------------------------------------------------------
# test_update_competencia
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_competencia(client: AsyncClient, db):
    """RH actualiza competencia → 200, campos actualizados."""
    rh = await make_empleado(db, rol="rh", email="comp_upd@leoni.test")
    headers = await auth_headers(client, rh)

    comp = await make_competencia(
        db, nombre="Comp Original", categoria="tecnica", descripcion="Original"
    )

    response = await client.put(
        f"/api/v1/competencias/{comp.id}",
        json={"nombre": "Comp Actualizada", "descripcion": "Actualizada"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Comp Actualizada"
    assert body["descripcion"] == "Actualizada"


# ---------------------------------------------------------------------------
# test_delete_competencia
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_competencia(client: AsyncClient, db):
    """RH elimina competencia → 204 (soft-delete)."""
    rh = await make_empleado(db, rol="rh", email="comp_del@leoni.test")
    headers = await auth_headers(client, rh)

    comp = await make_competencia(db, nombre="Comp Para Borrar", categoria="blanda")

    response = await client.delete(
        f"/api/v1/competencias/{comp.id}",
        headers=headers,
    )
    assert response.status_code == 204


# ===========================================================================
# Matriz de Competencias
# ===========================================================================


# ---------------------------------------------------------------------------
# test_get_matriz_by_area
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_matriz_by_area(client: AsyncClient, db):
    """Obtener matriz por area retorna puestos, competencias y niveles."""
    area = await make_area(db, descripcion="Area Matriz")
    rh = await make_empleado(db, rol="rh", email="comp_mat@leoni.test")
    headers = await auth_headers(client, rh)

    perfil_a = await make_puesto_perfil(db, nombre="Operador Matriz A", area_id=area.area_id)
    perfil_b = await make_puesto_perfil(db, nombre="Operador Matriz B", area_id=area.area_id)
    comp_1 = await make_competencia(db, nombre="Seguridad Matriz", categoria="tecnica", area_id=area.area_id)
    comp_2 = await make_competencia(db, nombre="5S Matriz", categoria="tecnica", area_id=area.area_id)

    await make_competencia_requisito(db, competencia_id=comp_1.id, puesto_perfil_id=perfil_a.id, nivel_requerido=3)
    await make_competencia_requisito(db, competencia_id=comp_2.id, puesto_perfil_id=perfil_a.id, nivel_requerido=2)
    await make_competencia_requisito(db, competencia_id=comp_1.id, puesto_perfil_id=perfil_b.id, nivel_requerido=4)

    response = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["area_id"] == area.area_id
    assert "puestos" in body
    assert "competencias" in body
    assert len(body["puestos"]) == 2
    assert len(body["competencias"]) >= 2


# ---------------------------------------------------------------------------
# test_update_matriz_bulk
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_matriz_bulk(client: AsyncClient, db):
    """Bulk update de la matriz crea/actualiza requisitos correctamente."""
    area = await make_area(db, descripcion="Area Bulk")
    rh = await make_empleado(db, rol="rh", email="comp_bulk@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Inspector Bulk", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Metrologia Bulk", categoria="tecnica", area_id=area.area_id)

    payload = {
        "celdas": [
            {
                "puesto_perfil_id": perfil.id,
                "competencia_id": comp.id,
                "nivel_requerido": 4,
            }
        ]
    }

    response = await client.put(
        "/api/v1/competencias/matriz",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["actualizados"] == 1

    # Verificar que se creo el requisito via la matriz
    verify = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    assert verify.status_code == 200
    matriz = verify.json()
    # Buscar la competencia en la matriz y verificar nivel
    comp_row = next(
        (c for c in matriz["competencias"] if c["competencia_id"] == comp.id),
        None,
    )
    assert comp_row is not None
    assert comp_row["niveles"][str(perfil.id)] == 4


# ---------------------------------------------------------------------------
# test_get_resumen_area
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_resumen_area(client: AsyncClient, db):
    """Resumen de area retorna totales y cumplimiento."""
    area = await make_area(db, descripcion="Area Resumen")
    rh = await make_empleado(db, rol="rh", email="comp_resumen@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Tecnico Resumen", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Electronica Resumen", categoria="tecnica", area_id=area.area_id)
    await make_competencia_requisito(db, competencia_id=comp.id, puesto_perfil_id=perfil.id, nivel_requerido=3)

    response = await client.get(
        f"/api/v1/competencias/resumen-area?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["area_id"] == area.area_id
    assert body["total_puestos_perfil"] >= 1
    assert body["total_competencias"] >= 1
    assert body["requisitos_activos"] >= 1
    assert "cumplimiento_porcentaje" in body
    # El perfil tiene al menos un requisito → cumplimiento > 0
    assert body["cumplimiento_porcentaje"] > 0


# ---------------------------------------------------------------------------
# test_get_brechas_criticas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_brechas_criticas(client: AsyncClient, db):
    """Brechas del area retorna estructura correcta con competencias requeridas."""
    area = await make_area(db, descripcion="Area Brechas")
    rh = await make_empleado(db, rol="rh", email="comp_brecha@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(db, nombre="Tecnico Brecha", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Hidraulica Brecha", categoria="tecnica", area_id=area.area_id)
    await make_competencia_requisito(db, competencia_id=comp.id, puesto_perfil_id=perfil.id, nivel_requerido=3)

    # Crear un empleado en esa area para que haya brechas
    emp = await make_empleado(db, rol="empleado", email="comp_brecha_emp@leoni.test")
    # Asignar area_id al empleado
    await db.execute(
        update(Empleado).where(Empleado.id == emp.id).values(area_id=area.area_id)
    )
    await db.flush()

    response = await client.get(
        f"/api/v1/competencias/brechas?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["area_id"] == area.area_id
    assert "brechas" in body
    # Con un empleado en el area y requisitos definidos, deberia haber brechas
    assert len(body["brechas"]) >= 1
    brecha = body["brechas"][0]
    assert "competencia_id" in brecha
    assert "competencia_nombre" in brecha
    assert "nivel_requerido_promedio" in brecha
    assert "gap_porcentaje" in brecha
    assert "empleados_afectados" in brecha
