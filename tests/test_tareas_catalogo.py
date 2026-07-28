# tests/test_tareas_catalogo.py
"""
Tests para el catalogo centralizado de tareas.

Cubre:
  - CRUD de tareas en catalogo (solo RH)
  - Verificacion de duplicados
  - Soft delete
  - Asignacion de tarea del catalogo a un perfil
  - Backwards compatibility (tarea con texto libre sigue funcionando)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import TareaCatalogo
from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_area, make_categoria_tarea, make_puesto_perfil


# ---------------------------------------------------------------------------
# Factories locales
# ---------------------------------------------------------------------------


async def make_tarea_catalogo(
    db: AsyncSession,
    *,
    nombre: str = "Tarea de prueba",
    descripcion: str | None = None,
    categoria: str | None = None,
    es_complemento: bool = False,
) -> TareaCatalogo:
    tarea = TareaCatalogo(
        nombre=nombre,
        descripcion=descripcion,
        categoria=categoria,
        es_complemento=es_complemento,
        activo=True,
    )
    db.add(tarea)
    await db.flush()
    await db.refresh(tarea)
    return tarea


# ===========================================================================
# CRUD CATALOGO
# ===========================================================================


@pytest.mark.asyncio
async def test_crear_tarea_catalogo_success(client: AsyncClient, db):
    """POST /tareas-catalogo crea tarea exitosamente con rol RH."""
    rh = await make_empleado(db, rol="rh", email="tc_crear_rh@leoni.test")
    headers = await auth_headers(client, rh)

    categoria = await make_categoria_tarea(db, nombre="Logistica")
    payload = {
        "nombre": "Supervisar entregas de material",
        "categoria_tarea_id": categoria.id,
    }
    response = await client.post("/api/v1/tareas-catalogo", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Supervisar entregas de material"
    assert data["categoria_tarea_id"] == categoria.id
    assert data["categoria_tarea_nombre"] == "Logistica"
    assert data["es_complemento"] is False
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_tarea_catalogo_duplicada(client: AsyncClient, db):
    """POST /tareas-catalogo con nombre existente retorna 409."""
    rh = await make_empleado(db, rol="rh", email="tc_dup_rh@leoni.test")
    await make_tarea_catalogo(db, nombre="Tarea duplicada test")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "Tarea duplicada test"}
    response = await client.post("/api/v1/tareas-catalogo", json=payload, headers=headers)

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_crear_tarea_catalogo_no_autorizado(client: AsyncClient, db):
    """POST /tareas-catalogo con rol empleado retorna 403."""
    emp = await make_empleado(db, rol="empleado", email="tc_noauth@leoni.test")
    headers = await auth_headers(client, emp)

    payload = {"nombre": "No deberia crearse"}
    response = await client.post("/api/v1/tareas-catalogo", json=payload, headers=headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_listar_tareas_catalogo(client: AsyncClient, db):
    """GET /tareas-catalogo retorna lista paginada."""
    rh = await make_empleado(db, rol="rh", email="tc_list_rh@leoni.test")
    await make_tarea_catalogo(db, nombre="Tarea lista 1", categoria="calidad")
    await make_tarea_catalogo(db, nombre="Tarea lista 2", categoria="seguridad")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/tareas-catalogo", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


@pytest.mark.asyncio
async def test_listar_tareas_catalogo_con_busqueda(client: AsyncClient, db):
    """GET /tareas-catalogo?busqueda= filtra por nombre."""
    rh = await make_empleado(db, rol="rh", email="tc_busq_rh@leoni.test")
    await make_tarea_catalogo(db, nombre="Verificar calibracion equipos")
    await make_tarea_catalogo(db, nombre="Limpiar area de trabajo")
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/tareas-catalogo?busqueda=calibracion", headers=headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert "calibracion" in data["items"][0]["nombre"].lower()


@pytest.mark.asyncio
async def test_actualizar_tarea_catalogo(client: AsyncClient, db):
    """PATCH /tareas-catalogo/{id} actualiza nombre y categoria del catalogo."""
    rh = await make_empleado(db, rol="rh", email="tc_upd_rh@leoni.test")
    tarea = await make_tarea_catalogo(db, nombre="Nombre original", categoria="vieja")
    nueva = await make_categoria_tarea(db, nombre="Categoria Nueva")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "Nombre actualizado", "categoria_tarea_id": nueva.id}
    response = await client.patch(
        f"/api/v1/tareas-catalogo/{tarea.id}", json=payload, headers=headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nombre"] == "Nombre actualizado"
    assert data["categoria_tarea_nombre"] == "Categoria Nueva"


@pytest.mark.asyncio
async def test_actualizar_tarea_catalogo_propaga_a_perfiles(client: AsyncClient, db):
    """Al editar el catálogo, los perfiles vinculados reflejan el nuevo nombre y tipo."""
    from app.models.talento import PerfilTarea

    area = await make_area(db, descripcion="TC Propaga Area")
    rh = await make_empleado(db, rol="rh", email="tc_propaga_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(
        db, nombre="Nombre viejo en perfil", es_complemento=False
    )

    tarea = PerfilTarea(
        puesto_perfil_id=perfil.id,
        orden=1,
        descripcion="Nombre viejo en perfil",
        es_complemento=False,
        tarea_catalogo_id=tarea_cat.id,
    )
    db.add(tarea)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/tareas-catalogo/{tarea_cat.id}",
        json={"nombre": "Nombre nuevo en catálogo", "es_complemento": True},
        headers=headers,
    )
    assert response.status_code == 200

    list_response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas", headers=headers
    )
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) == 1
    assert data[0]["descripcion"] == "Nombre nuevo en catálogo"
    assert data[0]["tarea_catalogo_nombre"] == "Nombre nuevo en catálogo"
    assert data[0]["es_complemento"] is True


@pytest.mark.asyncio
async def test_eliminar_tarea_catalogo_soft_delete(client: AsyncClient, db):
    """DELETE /tareas-catalogo/{id} hace soft delete (activo=False)."""
    rh = await make_empleado(db, rol="rh", email="tc_del_rh@leoni.test")
    tarea = await make_tarea_catalogo(db, nombre="Tarea a eliminar")
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/tareas-catalogo/{tarea.id}", headers=headers
    )
    assert response.status_code == 204

    # No aparece en listado
    list_response = await client.get("/api/v1/tareas-catalogo", headers=headers)
    items = list_response.json()["items"]
    assert all(i["id"] != tarea.id for i in items)


# ===========================================================================
# ASIGNACION A PERFIL (tarea_catalogo_id)
# ===========================================================================


@pytest.mark.asyncio
async def test_crear_tarea_perfil_from_catalogo(client: AsyncClient, db):
    """POST /perfiles/{id}/tareas con tarea_catalogo_id resuelve nombre del catalogo."""
    area = await make_area(db, descripcion="TC Assign Test")
    rh = await make_empleado(db, rol="rh", email="tc_assign_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(db, nombre="Auditar procesos de calidad")
    headers = await auth_headers(client, rh)

    payload = {"orden": 1, "tarea_catalogo_id": tarea_cat.id}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas", json=payload, headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["tarea_catalogo_id"] == tarea_cat.id
    assert data["descripcion"] == "Auditar procesos de calidad"
    assert data["tarea_catalogo_nombre"] == "Auditar procesos de calidad"


@pytest.mark.asyncio
async def test_crear_tarea_perfil_from_catalogo_inexistente(client: AsyncClient, db):
    """POST /perfiles/{id}/tareas con tarea_catalogo_id invalido retorna 404."""
    area = await make_area(db, descripcion="TC NotFound Test")
    rh = await make_empleado(db, rol="rh", email="tc_nf_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {"orden": 1, "tarea_catalogo_id": 99999}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas", json=payload, headers=headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_crear_tarea_perfil_texto_libre_sigue_funcionando(client: AsyncClient, db):
    """POST /perfiles/{id}/tareas con descripcion (sin catalogo) sigue creando tarea."""
    area = await make_area(db, descripcion="TC Legacy Test")
    rh = await make_empleado(db, rol="rh", email="tc_legacy_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {"orden": 1, "descripcion": "Tarea texto libre legacy", "es_complemento": False}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas", json=payload, headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["descripcion"] == "Tarea texto libre legacy"
    assert data["tarea_catalogo_id"] is None


@pytest.mark.asyncio
async def test_listar_tareas_perfil_incluye_catalogo_nombre(client: AsyncClient, db):
    """GET /perfiles/{id}/tareas incluye tarea_catalogo_nombre cuando existe."""
    from app.models.talento import PerfilTarea

    area = await make_area(db, descripcion="TC List Name Test")
    rh = await make_empleado(db, rol="rh", email="tc_listname_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(db, nombre="Tarea catalogada")

    tarea = PerfilTarea(
        puesto_perfil_id=perfil.id,
        orden=1,
        descripcion="Tarea catalogada",
        es_complemento=False,
        tarea_catalogo_id=tarea_cat.id,
    )
    db.add(tarea)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas", headers=headers
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["tarea_catalogo_nombre"] == "Tarea catalogada"
    assert data[0]["tarea_catalogo_id"] == tarea_cat.id


@pytest.mark.asyncio
async def test_actualizar_tarea_catalogo_no_propaga_tarea_legacy_sin_fk(
    client: AsyncClient, db
):
    """Tareas de perfil sin tarea_catalogo_id no reciben cambios del catálogo."""
    from app.models.talento import PerfilTarea

    rh = await make_empleado(db, rol="rh", email="tc_legacy_rh@leoni.test")
    perfil = await make_puesto_perfil(db, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(db, nombre="Texto compartido legacy")

    tarea = PerfilTarea(
        puesto_perfil_id=perfil.id,
        orden=1,
        descripcion="Texto compartido legacy",
        es_complemento=False,
        tarea_catalogo_id=None,
    )
    db.add(tarea)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/tareas-catalogo/{tarea_cat.id}",
        json={"nombre": "Nombre nuevo que no aplica a legacy"},
        headers=headers,
    )
    assert response.status_code == 200

    list_response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas", headers=headers
    )
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) == 1
    assert data[0]["descripcion"] == "Texto compartido legacy"
    assert data[0]["tarea_catalogo_id"] is None


@pytest.mark.asyncio
async def test_crear_tarea_catalogo_con_descripcion(client: AsyncClient, db):
    """POST /tareas-catalogo persiste nombre y descripcion."""
    rh = await make_empleado(db, rol="rh", email="tc_desc_rh@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Supervisión entregas",
        "descripcion": "Supervisar y validar entregas de material del almacén.",
        "categoria_tarea_id": None,
    }
    response = await client.post("/api/v1/tareas-catalogo", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Supervisión entregas"
    assert data["descripcion"] == "Supervisar y validar entregas de material del almacén."


@pytest.mark.asyncio
async def test_busqueda_tareas_catalogo_por_descripcion(client: AsyncClient, db):
    """GET /tareas-catalogo?busqueda= encuentra por descripcion."""
    rh = await make_empleado(db, rol="rh", email="tc_busq_desc_rh@leoni.test")
    await make_tarea_catalogo(
        db,
        nombre="Tarea corta",
        descripcion="Fragmento unico de busqueda xyz123",
    )
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/tareas-catalogo",
        params={"busqueda": "xyz123"},
        headers=headers,
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert any(i["nombre"] == "Tarea corta" for i in items)


@pytest.mark.asyncio
async def test_propaga_descripcion_a_perfiles(client: AsyncClient, db):
    """Al actualizar descripcion del catalogo, los perfiles vinculados la reflejan."""
    from app.models.talento import PerfilTarea

    rh = await make_empleado(db, rol="rh", email="tc_prop_desc_rh@leoni.test")
    perfil = await make_puesto_perfil(db, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(
        db,
        nombre="Nombre corto",
        descripcion="Texto detallado original",
    )

    tarea = PerfilTarea(
        puesto_perfil_id=perfil.id,
        orden=1,
        descripcion="Texto detallado original",
        es_complemento=False,
        tarea_catalogo_id=tarea_cat.id,
    )
    db.add(tarea)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/tareas-catalogo/{tarea_cat.id}",
        json={"descripcion": "Texto detallado actualizado"},
        headers=headers,
    )
    assert response.status_code == 200

    list_response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas", headers=headers
    )
    data = list_response.json()
    assert data[0]["descripcion"] == "Texto detallado actualizado"
    assert data[0]["tarea_catalogo_nombre"] == "Nombre corto"


@pytest.mark.asyncio
async def test_cambio_nombre_no_altera_descripcion_perfil_si_catalogo_tiene_descripcion(
    client: AsyncClient, db
):
    """Cambiar solo nombre no modifica el texto mostrado cuando hay descripcion en catalogo."""
    from app.models.talento import PerfilTarea

    rh = await make_empleado(db, rol="rh", email="tc_nombre_only_rh@leoni.test")
    perfil = await make_puesto_perfil(db, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(
        db,
        nombre="Nombre viejo",
        descripcion="Descripcion estable en perfil",
    )

    tarea = PerfilTarea(
        puesto_perfil_id=perfil.id,
        orden=1,
        descripcion="Descripcion estable en perfil",
        es_complemento=False,
        tarea_catalogo_id=tarea_cat.id,
    )
    db.add(tarea)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.patch(
        f"/api/v1/tareas-catalogo/{tarea_cat.id}",
        json={"nombre": "Nombre nuevo"},
        headers=headers,
    )
    assert response.status_code == 200

    list_response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas", headers=headers
    )
    data = list_response.json()
    assert data[0]["descripcion"] == "Descripcion estable en perfil"
    assert data[0]["tarea_catalogo_nombre"] == "Nombre nuevo"


@pytest.mark.asyncio
async def test_crear_tarea_perfil_from_catalogo_usa_descripcion(client: AsyncClient, db):
    """POST con tarea_catalogo_id resuelve descripcion detallada del catalogo."""
    rh = await make_empleado(db, rol="rh", email="tc_assign_desc_rh@leoni.test")
    perfil = await make_puesto_perfil(db, created_by=rh.id)
    tarea_cat = await make_tarea_catalogo(
        db,
        nombre="Auditar calidad",
        descripcion="Auditar procesos de calidad en línea de producción.",
    )
    headers = await auth_headers(client, rh)

    payload = {"orden": 1, "tarea_catalogo_id": tarea_cat.id}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["descripcion"] == "Auditar procesos de calidad en línea de producción."
    assert data["tarea_catalogo_nombre"] == "Auditar calidad"
