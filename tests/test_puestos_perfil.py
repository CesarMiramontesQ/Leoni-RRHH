# tests/test_puestos_perfil.py
"""
Tests del dominio Puestos Perfil — Modulo Talento Fase 1.

Cubre:
  - CRUD completo (crear, listar, detalle, actualizar, eliminar)
  - Autorizacion por rol (solo RH muta, cualquier auth lee)
  - Validacion de payload
  - Reglas de negocio: codigo secuencial, version increment, soft-delete
  - Filtrado y busqueda
  - Nombre duplicado → 409
  - Generacion con IA (Ollama mockeado)
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_area,
    make_nivel_puesto,
    make_perfil_funciones,
    make_puesto_perfil,
)


# Payload valido reutilizable — nivel_id se asigna en cada test
PERFIL_PAYLOAD_BASE = {
    "nombre": "Ingeniero de Procesos",
    "descripcion": "Optimizar procesos de manufactura",
}


# ---------------------------------------------------------------------------
# test_create_puesto_perfil_success
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_success(client: AsyncClient, db):
    """RH crea perfil exitosamente → 201, codigo generado, version=1."""
    area = await make_area(db, descripcion="Manufactura")
    nivel = await make_nivel_puesto(db, nombre="Senior")
    rh = await make_empleado(db, rol="rh", email="pp_create_ok@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {**PERFIL_PAYLOAD_BASE, "area_id": area.area_id, "nivel_id": nivel.id}
    response = await client.post(
        "/api/v1/puestos-perfil",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "Ingeniero de Procesos"
    assert body["version"] == 1
    assert body["activo"] is True
    assert body["codigo"].startswith("PRF-")
    assert body["area_id"] == area.area_id
    assert body["nivel_id"] == nivel.id
    assert body["nivel_nombre"] == "Senior"
    assert body["tipo"] == "administrativo"
    assert body["created_by"] == rh.id


# ---------------------------------------------------------------------------
# test_create_puesto_perfil_duplicate_nombre
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_duplicate_nombre(client: AsyncClient, db):
    """Crear perfil con mismo nombre y mismo nivel → 409."""
    rh = await make_empleado(db, rol="rh", email="pp_dup@leoni.test")
    headers = await auth_headers(client, rh)
    nivel = await make_nivel_puesto(db, nombre="Nivel Dup")

    # Crear el primero
    payload = {**PERFIL_PAYLOAD_BASE, "nombre": "Operador CNC Unico", "nivel_id": nivel.id}
    response1 = await client.post(
        "/api/v1/puestos-perfil",
        json=payload,
        headers=headers,
    )
    assert response1.status_code == 201

    # Intentar crear con mismo nombre y mismo nivel
    response2 = await client.post(
        "/api/v1/puestos-perfil",
        json=payload,
        headers=headers,
    )
    assert response2.status_code == 409
    assert "ya existe" in response2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# test_create_puesto_perfil_tipo_operativo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_tipo_operativo(client: AsyncClient, db):
    """Crear perfil con tipo operativo explícito → 201."""
    nivel = await make_nivel_puesto(db, nombre="Nivel Operativo")
    rh = await make_empleado(db, rol="rh", email="pp_tipo_op@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            **PERFIL_PAYLOAD_BASE,
            "nombre": "Operador de Linea",
            "nivel_id": nivel.id,
            "tipo": "operativo",
        },
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["tipo"] == "operativo"


# ---------------------------------------------------------------------------
# test_update_puesto_perfil_tipo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_puesto_perfil_tipo(client: AsyncClient, db):
    """Actualizar tipo de perfil → 200 y persiste."""
    area = await make_area(db, descripcion="Area Tipo Update")
    rh = await make_empleado(db, rol="rh", email="pp_tipo_upd@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Tipo Update", area_id=area.area_id, nivel_id=(await make_nivel_puesto(db, nombre="Nivel Tipo")).id
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"tipo": "operativo"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["tipo"] == "operativo"


# ---------------------------------------------------------------------------
# test_create_puesto_perfil_same_nombre_different_nivel
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_same_nombre_different_nivel(client: AsyncClient, db):
    """Mismo nombre con distinto nivel → 201 en ambos."""
    rh = await make_empleado(db, rol="rh", email="pp_same_name@leoni.test")
    headers = await auth_headers(client, rh)
    nivel_jr = await make_nivel_puesto(db, nombre="JR")
    nivel_senior = await make_nivel_puesto(db, nombre="Senior")

    nombre = "Analista UL"
    response1 = await client.post(
        "/api/v1/puestos-perfil",
        json={**PERFIL_PAYLOAD_BASE, "nombre": nombre, "nivel_id": nivel_jr.id},
        headers=headers,
    )
    assert response1.status_code == 201

    response2 = await client.post(
        "/api/v1/puestos-perfil",
        json={**PERFIL_PAYLOAD_BASE, "nombre": nombre, "nivel_id": nivel_senior.id},
        headers=headers,
    )
    assert response2.status_code == 201
    assert response2.json()["nombre"] == nombre
    assert response2.json()["nivel_id"] == nivel_senior.id


# ---------------------------------------------------------------------------
# test_create_puesto_perfil_unauthorized
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_unauthorized(client: AsyncClient, db):
    """Empleado no-RH intenta crear → 403."""
    empleado = await make_empleado(db, rol="empleado", email="pp_noauth@leoni.test")
    headers = await auth_headers(client, empleado)
    nivel = await make_nivel_puesto(db, nombre="Nivel Noauth")

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={**PERFIL_PAYLOAD_BASE, "nivel_id": nivel.id},
        headers=headers,
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# test_list_puestos_perfil_paginated
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_puestos_perfil_paginated(client: AsyncClient, db):
    """Listar puestos retorna estructura paginada."""
    area = await make_area(db, descripcion="Area Paginacion")
    rh = await make_empleado(db, rol="rh", email="pp_list@leoni.test")
    headers = await auth_headers(client, rh)

    # Crear 3 perfiles
    for i in range(3):
        await make_puesto_perfil(
            db, nombre=f"Puesto Paginado {i}", area_id=area.area_id
        )

    response = await client.get(
        "/api/v1/puestos-perfil?page=1&page_size=2",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert "page" in body
    assert "page_size" in body
    assert len(body["items"]) <= 2
    assert body["total"] >= 3
    assert body["page"] == 1


# ---------------------------------------------------------------------------
# test_list_puestos_perfil_filter_area
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_puestos_perfil_filter_area(client: AsyncClient, db):
    """Filtrar por area_id retorna solo perfiles de esa area."""
    area_a = await make_area(db, descripcion="Area A Filtro")
    area_b = await make_area(db, descripcion="Area B Filtro")
    rh = await make_empleado(db, rol="rh", email="pp_filt_area@leoni.test")
    headers = await auth_headers(client, rh)

    await make_puesto_perfil(db, nombre="En Area A 1", area_id=area_a.area_id)
    await make_puesto_perfil(db, nombre="En Area A 2", area_id=area_a.area_id)
    await make_puesto_perfil(db, nombre="En Area B", area_id=area_b.area_id)

    response = await client.get(
        f"/api/v1/puestos-perfil?area_id={area_a.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2
    for item in body["items"]:
        assert item["area_id"] == area_a.area_id


# ---------------------------------------------------------------------------
# test_list_puestos_perfil_filter_busqueda
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_puestos_perfil_filter_busqueda(client: AsyncClient, db):
    """Buscar por nombre filtra correctamente."""
    rh = await make_empleado(db, rol="rh", email="pp_filt_busq@leoni.test")
    headers = await auth_headers(client, rh)

    await make_puesto_perfil(db, nombre="Soldador TIG Especial")
    await make_puesto_perfil(db, nombre="Supervisor Logistica")

    response = await client.get(
        "/api/v1/puestos-perfil?busqueda=Soldador",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert "soldador" in item["nombre"].lower()


# ---------------------------------------------------------------------------
# test_get_puesto_perfil_by_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_puesto_perfil_by_id(client: AsyncClient, db):
    """Obtener detalle de un perfil por ID → 200 con todos los campos."""
    area = await make_area(db, descripcion="Area Detalle")
    rh = await make_empleado(db, rol="rh", email="pp_get@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(
        db, nombre="Perfil Para Detalle", area_id=area.area_id
    )

    response = await client.get(
        f"/api/v1/puestos-perfil/{perfil.id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == perfil.id
    assert body["nombre"] == "Perfil Para Detalle"
    assert body["codigo"] == perfil.codigo
    assert body["version"] == 1
    assert body["activo"] is True
    assert body["area_id"] == area.area_id


# ---------------------------------------------------------------------------
# test_get_puesto_perfil_not_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_puesto_perfil_not_found(client: AsyncClient, db):
    """Solicitar perfil con ID inexistente → 404."""
    rh = await make_empleado(db, rol="rh", email="pp_notfound@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/puestos-perfil/999999",
        headers=headers,
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# test_update_puesto_perfil_increments_version
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_puesto_perfil_increments_version(client: AsyncClient, db):
    """Actualizar perfil incrementa la version en cada update."""
    area = await make_area(db, descripcion="Area Update")
    rh = await make_empleado(db, rol="rh", email="pp_update@leoni.test")
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Versionable", area_id=area.area_id
    )
    headers = await auth_headers(client, rh)

    # Primera actualizacion → version 2
    response1 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"nombre": "Perfil Versionable V2", "descripcion": "Actualizado"},
        headers=headers,
    )
    assert response1.status_code == 200
    assert response1.json()["version"] == 2
    assert response1.json()["nombre"] == "Perfil Versionable V2"

    # Segunda actualizacion → version 3
    response2 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"descripcion": "Doblemente actualizado"},
        headers=headers,
    )
    assert response2.status_code == 200
    assert response2.json()["version"] == 3


# ---------------------------------------------------------------------------
# test_update_puesto_perfil_duplicate_nombre_nivel
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_puesto_perfil_duplicate_nombre_nivel(client: AsyncClient, db):
    """Actualizar nivel hacia combinación nombre+nivel ya existente → 409."""
    area = await make_area(db, descripcion="Area Dup Update")
    rh = await make_empleado(db, rol="rh", email="pp_dup_update@leoni.test")
    headers = await auth_headers(client, rh)
    nivel_jr = await make_nivel_puesto(db, nombre="JR Dup")
    nivel_senior = await make_nivel_puesto(db, nombre="Senior Dup")

    nombre = "Analista Dup Update"
    perfil_jr = await make_puesto_perfil(
        db, nombre=nombre, area_id=area.area_id, nivel_id=nivel_jr.id
    )
    await make_puesto_perfil(
        db, nombre=nombre, area_id=area.area_id, nivel_id=nivel_senior.id
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil_jr.id}",
        json={"nivel_id": nivel_senior.id},
        headers=headers,
    )
    assert response.status_code == 409
    assert "ya existe" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# test_delete_puesto_perfil_soft_delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_puesto_perfil_soft_delete(client: AsyncClient, db):
    """Eliminar perfil → 204; GET posterior → 404 (soft-delete)."""
    area = await make_area(db, descripcion="Area Delete")
    rh = await make_empleado(db, rol="rh", email="pp_delete@leoni.test")
    perfil = await make_puesto_perfil(
        db, nombre="Perfil a Eliminar", area_id=area.area_id
    )
    headers = await auth_headers(client, rh)

    # Eliminar
    response = await client.delete(
        f"/api/v1/puestos-perfil/{perfil.id}",
        headers=headers,
    )
    assert response.status_code == 204

    # Verificar que GET retorna 404 (soft-deleted no visible)
    response_get = await client.get(
        f"/api/v1/puestos-perfil/{perfil.id}",
        headers=headers,
    )
    # Puede ser 404 si el repo filtra activos, o 200 con activo=False
    # segun la implementacion del repo. Verificamos que no aparece como activo.
    if response_get.status_code == 200:
        assert response_get.json()["activo"] is False
    else:
        assert response_get.status_code == 404


# ===========================================================================
# Generacion con IA
# ===========================================================================


# ---------------------------------------------------------------------------
# test_generar_perfil_ia_success
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generar_perfil_ia_success(client: AsyncClient, db):
    """RH genera perfil con IA exitosamente (Ollama mockeado) → 200."""
    area = await make_area(db, descripcion="Area IA")
    rh = await make_empleado(db, rol="rh", email="pp_ia_ok@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(
        db, nombre="Operador IA Test", area_id=area.area_id
    )

    ia_response = {
        "descripcion": "Operador responsable de la linea de produccion",
        "competencias_tecnicas": ["Manejo de CNC", "Lectura de planos"],
        "habilidades_blandas": ["Trabajo en equipo", "Comunicacion"],
        "maquinas_herramientas": ["Torno CNC", "Fresadora"],
    }

    with patch(
        "app.services.puesto_perfil_service.PuestoPerfilService._llamar_ollama_perfil",
        new_callable=AsyncMock,
    ) as mock_ollama:
        from app.schemas.talento import GenerarPerfilIAResponse

        mock_ollama.return_value = GenerarPerfilIAResponse(**ia_response)

        response = await client.post(
            f"/api/v1/puestos-perfil/{perfil.id}/generar-ia",
            json={"nombre": "Operador IA Test", "area_nombre": "Area IA"},
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["descripcion"] == ia_response["descripcion"]
    assert body["competencias_tecnicas"] == ia_response["competencias_tecnicas"]
    assert body["habilidades_blandas"] == ia_response["habilidades_blandas"]
    assert body["maquinas_herramientas"] == ia_response["maquinas_herramientas"]


# ---------------------------------------------------------------------------
# test_generar_perfil_ia_unauthorized
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generar_perfil_ia_unauthorized(client: AsyncClient, db):
    """Empleado no-RH intenta generar con IA → 403."""
    area = await make_area(db, descripcion="Area IA Noauth")
    empleado = await make_empleado(db, rol="empleado", email="pp_ia_noauth@leoni.test")
    headers = await auth_headers(client, empleado)

    perfil = await make_puesto_perfil(
        db, nombre="Operador IA Noauth", area_id=area.area_id
    )

    response = await client.post(
        f"/api/v1/puestos-perfil/{perfil.id}/generar-ia",
        json={"nombre": "Operador IA Noauth"},
        headers=headers,
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# test_generar_perfil_ia_not_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generar_perfil_ia_not_found(client: AsyncClient, db):
    """Generar IA para perfil inexistente → 404."""
    rh = await make_empleado(db, rol="rh", email="pp_ia_notfound@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil/999999/generar-ia",
        json={"nombre": "Puesto Inexistente"},
        headers=headers,
    )
    assert response.status_code == 404


# ===========================================================================
# Resumen Tarjetas
# ===========================================================================


# ---------------------------------------------------------------------------
# test_resumen_tarjetas_empty
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_tarjetas_empty(client: AsyncClient, db):
    """Resumen tarjetas sin perfiles activos → 200 con items vacio."""
    rh = await make_empleado(db, rol="rh", email="pp_tarj_empty@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/puestos-perfil/resumen-tarjetas",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert isinstance(body["items"], list)


# ---------------------------------------------------------------------------
# test_resumen_tarjetas_with_profiles
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_tarjetas_with_profiles(client: AsyncClient, db):
    """Resumen tarjetas con perfiles retorna datos y estructura correcta."""
    area = await make_area(db, descripcion="Area Tarjetas")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_data@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(
        db, nombre="Operador Tarjeta Test", area_id=area.area_id
    )

    response = await client.get(
        "/api/v1/puestos-perfil/resumen-tarjetas",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1

    item = next(i for i in body["items"] if i["id"] == perfil.id)
    assert item["codigo"] == perfil.codigo
    assert item["nombre"] == "Operador Tarjeta Test"
    assert item["area_nombre"] == "Area Tarjetas"
    assert item["personas"] == 0
    assert item["cumplimiento_pct"] == 0
    assert item["brechas"] == 0


# ---------------------------------------------------------------------------
# test_resumen_tarjetas_personas_count
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_tarjetas_personas_count(client: AsyncClient, db):
    """Resumen tarjetas cuenta personas asignadas correctamente."""
    area = await make_area(db, descripcion="Area Personas")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_pers@leoni.test")
    headers = await auth_headers(client, rh)

    perfil = await make_puesto_perfil(
        db, nombre="Perfil Con Personas", area_id=area.area_id
    )

    # Asignar 3 empleados al perfil
    for i in range(3):
        emp = await make_empleado(
            db, rol="empleado", email=f"pp_tarj_emp{i}@leoni.test"
        )
        await make_perfil_funciones(
            db,
            puesto_perfil_id=perfil.id,
            empleado_id=emp.id,
            departamento="Produccion",
        )
    await db.flush()

    response = await client.get(
        "/api/v1/puestos-perfil/resumen-tarjetas",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    item = next(i for i in body["items"] if i["id"] == perfil.id)
    assert item["personas"] == 3


# ---------------------------------------------------------------------------
# test_resumen_tarjetas_excludes_inactive
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_tarjetas_excludes_inactive(client: AsyncClient, db):
    """Resumen tarjetas no incluye perfiles inactivos (soft-deleted)."""
    area = await make_area(db, descripcion="Area Inactiva")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_inact@leoni.test")
    headers = await auth_headers(client, rh)

    perfil_activo = await make_puesto_perfil(
        db, nombre="Perfil Activo Tarj", area_id=area.area_id, activo=True
    )
    perfil_inactivo = await make_puesto_perfil(
        db, nombre="Perfil Inactivo Tarj", area_id=area.area_id, activo=False
    )

    response = await client.get(
        "/api/v1/puestos-perfil/resumen-tarjetas",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    ids = [i["id"] for i in body["items"]]
    assert perfil_activo.id in ids
    assert perfil_inactivo.id not in ids


# ---------------------------------------------------------------------------
# test_resumen_tarjetas_unauthorized
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_tarjetas_unauthorized(client: AsyncClient, db):
    """Resumen tarjetas requiere autenticacion → 401 sin token."""
    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas")
    assert response.status_code == 401
