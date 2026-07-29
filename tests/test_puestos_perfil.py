# tests/test_puestos_perfil.py
"""
Tests del dominio Puestos Perfil — Modulo Talento.

Cubre:
  - CRUD completo (crear, listar, detalle, actualizar, eliminar)
  - Autorizacion por rol (solo RH muta, cualquier auth lee)
  - Validacion de payload (area + grados obligatorios)
  - Reglas de negocio: codigo unico manual, version increment, soft-delete
  - Grados por perfil: consecutivos, libres por area, no quitar grados en uso
  - Nombre duplicado por area → 409
  - Generacion con IA (Ollama mockeado)
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_clasificacion_payload,
    make_equivalencia,
    make_area,
    make_grados_consecutivos,
    make_perfil_funciones,
    make_puesto_perfil,
)


async def _grado_ids(db, *, ordenes):
    grados = await make_grados_consecutivos(db, ordenes=ordenes)
    return [g.id for g in grados]


# ---------------------------------------------------------------------------
# Crear — un career level
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_perfil_con_un_career_level_success(client: AsyncClient, db):
    """
    El perfil lleva UN career level, no un rango.

    El nivel dice el tamano del puesto; el global grade concreto se asigna a cada
    persona dentro del tramo de ese nivel, asi que un puesto no necesita abarcar
    varios niveles para admitir gente de distinto peso.
    """
    area = await make_area(db, descripcion="Manufactura")
    clasificacion = await make_clasificacion_payload(db, ordenes=[7, 8, 9])
    rh = await make_empleado(db, rol="rh", email="pp_create_ok@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "codigo": "TEC-001",
        "nombre": "Ingeniero de Procesos",
        "descripcion": "Optimizar procesos",
        "area_id": area.area_id,
        **clasificacion,
    }
    response = await client.post("/api/v1/puestos-perfil", json=payload, headers=headers)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nombre"] == "Ingeniero de Procesos"
    assert body["version"] == 1
    assert body["activo"] is True
    assert body["codigo"] == "TEC-001"
    assert body["area_id"] == area.area_id
    assert body["tipo"] == "administrativo"
    assert body["created_by"] == rh.id
    # La respuesta sigue siendo una lista —la leen la matriz de competencias y
    # las tareas, que se acotan por nivel— pero con un solo elemento.
    assert [g["id"] for g in body["grados"]] == [clasificacion["grado_id"]]
    assert body["clasificacion_completa"] is True, (
        "sin global grade el perfil no puede nacer marcado como pendiente"
    )


@pytest.mark.asyncio
async def test_create_perfil_con_nivel_sin_equivalencia_422(client: AsyncClient, db):
    """
    Un career level sin equivalencias no tiene posicion en la estructura.

    Sustituye al test de contiguidad del rango: con un solo nivel no hay rango
    que validar, y lo que queda por comprobar es que el nivel se pueda ubicar.
    """
    area = await make_area(db, descripcion="Area Sin Equivalencia")
    clasificacion = await make_clasificacion_payload(
        db, ordenes=[7], con_equivalencia=False
    )
    rh = await make_empleado(db, rol="rh", email="pp_sin_eq@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "NC-01",
            "nombre": "Perfil Sin Equivalencia",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert response.status_code == 422, response.text
    assert "equivalencia" in response.text.lower()
    assert "ajustes" in response.text.lower(), "el mensaje debe decir donde arreglarlo"


@pytest.mark.asyncio
async def test_create_perfil_sin_grados_422(client: AsyncClient, db):
    """Sin career level → 422 (validacion de schema)."""
    area = await make_area(db, descripcion="Area SinGrados")
    rh = await make_empleado(db, rol="rh", email="pp_singrados@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "SG-01",
            "nombre": "Perfil SinGrados",
            "area_id": area.area_id,
        },
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_perfil_sin_area_422(client: AsyncClient, db):
    """area_id ausente → 422 (area obligatoria)."""
    grados = await _grado_ids(db, ordenes=[1, 2])
    rh = await make_empleado(db, rol="rh", email="pp_sinarea@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "SA-01",
            "nombre": "Perfil SinArea",
            "grado_id": grados[0],
        },
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_varios_perfiles_comparten_career_level_en_la_misma_area(
    client: AsyncClient, db
):
    """
    Dos puestos distintos de la misma area pueden estar en el mismo career level.

    Antes habia una regla que lo bloqueaba con 409. Con la metodologia Towers
    Watson es invalida: el nivel mide el tamano del puesto, no lo ocupa en
    exclusiva, y en Ingenieria puede haber varios puestos en P10.
    """
    area = await make_area(db, descripcion="Area Career Level Compartido")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2, 3])
    otros = await make_grados_consecutivos(db, ordenes=[1, 2, 3])
    rh = await make_empleado(db, rol="rh", email="pp_grado_dup@leoni.test")
    headers = await auth_headers(client, rh)

    r0 = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GD-BASE",
            "nombre": "Perfil Base Grado",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert r0.status_code == 201, r0.text

    # Otro perfil de la MISMA area reusando el mismo nivel intermedio.
    r1 = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GD-DUP",
            "nombre": "Perfil Dup Grado",
            "area_id": area.area_id,
            **{**clasificacion, "grado_id": otros[1].id},
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert [g["id"] for g in r1.json()["grados"]] == [otros[1].id]


# ---------------------------------------------------------------------------
# Actualizar — grados
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_perfil_cambia_su_career_level(client: AsyncClient, db):
    """Cambiar el nivel del perfil lo REEMPLAZA; nunca acumula dos."""
    area = await make_area(db, descripcion="Area Update Grados")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2, 3])
    rh = await make_empleado(db, rol="rh", email="pp_upd_grados@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Update Grados", area_id=area.area_id,
        grado_ids=[grados[0].id],
    )

    r_ok = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"grado_id": grados[2].id},
        headers=headers,
    )
    assert r_ok.status_code == 200, r_ok.text
    assert [g["id"] for g in r_ok.json()["grados"]] == [grados[2].id]


@pytest.mark.asyncio
async def test_update_perfil_no_permite_quitar_grado_en_uso_409(client: AsyncClient, db):
    """Quitar un grado con asignacion activa → 409."""
    area = await make_area(db, descripcion="Area Quitar Grado")
    grados = await make_grados_consecutivos(db, ordenes=[7, 8])
    rh = await make_empleado(db, rol="rh", email="pp_quitar_grado@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Quitar Grado", area_id=area.area_id,
        grado_ids=[grados[0].id, grados[1].id],
    )
    emp = await make_empleado(db, rol="empleado", email="pp_quitar_emp@leoni.test")
    await make_perfil_funciones(
        db, puesto_perfil_id=perfil.id, empleado_id=emp.id, grado_id=grados[1].id
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"grado_ids": [grados[0].id]},
        headers=headers,
    )
    assert response.status_code == 409
    assert "uso" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Nombre duplicado por area
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_nombre_duplicado_misma_area_409(client: AsyncClient, db):
    """Mismo nombre en la misma area → 409."""
    area = await make_area(db, descripcion="Area Nombre Dup")
    clasif_a = await make_clasificacion_payload(db, ordenes=[1, 2])
    clasif_b = await make_clasificacion_payload(db, ordenes=[3, 4])
    rh = await make_empleado(db, rol="rh", email="pp_nom_dup@leoni.test")
    headers = await auth_headers(client, rh)

    nombre = "Analista Nombre Dup"
    r1 = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "NOM-1", "nombre": nombre, "area_id": area.area_id,
              **clasif_a},
        headers=headers,
    )
    assert r1.status_code == 201, r1.text

    r2 = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "NOM-2", "nombre": nombre, "area_id": area.area_id,
              **clasif_b},
        headers=headers,
    )
    assert r2.status_code == 409
    assert "ya existe" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_nombre_duplicado_otra_area_ok(client: AsyncClient, db):
    """Mismo nombre en otra area → 201."""
    area_a = await make_area(db, descripcion="Area Nom A")
    area_b = await make_area(db, descripcion="Area Nom B")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    rh = await make_empleado(db, rol="rh", email="pp_nom_otra@leoni.test")
    headers = await auth_headers(client, rh)

    nombre = "Analista Otra Area"
    r1 = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "NOMA-1", "nombre": nombre, "area_id": area_a.area_id,
              **clasificacion},
        headers=headers,
    )
    assert r1.status_code == 201, r1.text

    r2 = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "NOMA-2", "nombre": nombre, "area_id": area_b.area_id,
              **clasificacion},
        headers=headers,
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["nombre"] == nombre


# ---------------------------------------------------------------------------
# Listar / filtros
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_listar_filtra_por_grado_id(client: AsyncClient, db):
    """Filtro grado_id retorna solo perfiles que incluyen ese grado."""
    area_a = await make_area(db, descripcion="Area Filtro G A")
    area_b = await make_area(db, descripcion="Area Filtro G B")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2, 3, 4])
    rh = await make_empleado(db, rol="rh", email="pp_filt_grado@leoni.test")
    headers = await auth_headers(client, rh)

    perfil_a = await make_puesto_perfil(
        db, nombre="Perfil G12", area_id=area_a.area_id,
        grado_ids=[grados[0].id, grados[1].id],
    )
    perfil_b = await make_puesto_perfil(
        db, nombre="Perfil G34", area_id=area_b.area_id,
        grado_ids=[grados[2].id, grados[3].id],
    )

    response = await client.get(
        f"/api/v1/puestos-perfil?grado_id={grados[0].id}", headers=headers
    )
    assert response.status_code == 200
    ids = [i["id"] for i in response.json()["items"]]
    assert perfil_a.id in ids
    assert perfil_b.id not in ids


@pytest.mark.asyncio
async def test_resumen_tarjetas_incluye_grados(client: AsyncClient, db):
    """Resumen tarjetas incluye la lista de grados ordenada por orden."""
    area = await make_area(db, descripcion="Area Tarjetas Grados")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2])
    rh = await make_empleado(db, rol="rh", email="pp_tarj_grados@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Tarjeta Grados", area_id=area.area_id,
        grado_ids=[g.id for g in grados],
    )

    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas", headers=headers)
    assert response.status_code == 200
    item = next(i for i in response.json()["items"] if i["id"] == perfil.id)
    assert [g["orden"] for g in item["grados"]] == [1, 2]


# ---------------------------------------------------------------------------
# CRUD general (adaptado a grados via make_puesto_perfil)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_puesto_perfil_tipo_operativo(client: AsyncClient, db):
    """Crear perfil con tipo operativo explícito → 201."""
    area = await make_area(db, descripcion="Area Tipo Op")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    rh = await make_empleado(db, rol="rh", email="pp_tipo_op@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "OP-LINEA-01",
            "nombre": "Operador de Linea",
            "area_id": area.area_id,
            "tipo": "operativo",
            **clasificacion,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["tipo"] == "operativo"


@pytest.mark.asyncio
async def test_update_puesto_perfil_tipo(client: AsyncClient, db):
    """Actualizar tipo de perfil → 200 y persiste."""
    area = await make_area(db, descripcion="Area Tipo Update")
    rh = await make_empleado(db, rol="rh", email="pp_tipo_upd@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Tipo Update", area_id=area.area_id
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"tipo": "operativo"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["tipo"] == "operativo"


@pytest.mark.asyncio
async def test_create_puesto_perfil_unauthorized(client: AsyncClient, db):
    """Empleado no-RH intenta crear → 403."""
    area = await make_area(db, descripcion="Area Noauth")
    grados = await _grado_ids(db, ordenes=[1, 2])
    empleado = await make_empleado(db, rol="empleado", email="pp_noauth@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "NOAUTH-01", "nombre": "Perfil Noauth",
              "area_id": area.area_id, "grado_ids": grados},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_puestos_perfil_paginated(client: AsyncClient, db):
    """Listar puestos retorna estructura paginada."""
    area = await make_area(db, descripcion="Area Paginacion")
    rh = await make_empleado(db, rol="rh", email="pp_list@leoni.test")
    headers = await auth_headers(client, rh)

    for i in range(3):
        await make_puesto_perfil(db, nombre=f"Puesto Paginado {i}", area_id=area.area_id)

    response = await client.get("/api/v1/puestos-perfil?page=1&page_size=2", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert {"items", "total", "page", "page_size"} <= set(body)
    assert len(body["items"]) <= 2
    assert body["total"] >= 3
    assert body["page"] == 1


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
        f"/api/v1/puestos-perfil?area_id={area_a.area_id}", headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2
    for item in body["items"]:
        assert item["area_id"] == area_a.area_id


@pytest.mark.asyncio
async def test_create_puesto_perfil_duplicate_codigo(client: AsyncClient, db):
    """Crear perfil con codigo duplicado → 409."""
    area = await make_area(db, descripcion="Area Cod Dup")
    clasificacion = await make_clasificacion_payload(db, ordenes=[3, 4])
    rh = await make_empleado(db, rol="rh", email="pp_dup_cod@leoni.test")
    headers = await auth_headers(client, rh)

    await make_puesto_perfil(db, codigo="DUP-COD-01", nombre="Perfil Original", area_id=area.area_id)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={"codigo": "DUP-COD-01", "nombre": "Otro Perfil",
              "area_id": area.area_id, **clasificacion},
        headers=headers,
    )
    assert response.status_code == 409
    assert "codigo" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_puesto_perfil_codigo(client: AsyncClient, db):
    """Actualizar codigo de perfil → 200 y persiste."""
    area = await make_area(db, descripcion="Area Cod Update")
    rh = await make_empleado(db, rol="rh", email="pp_cod_upd@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, codigo="OLD-CODE-01", nombre="Perfil Cod Update", area_id=area.area_id
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"codigo": "NEW-CODE-01"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["codigo"] == "NEW-CODE-01"


@pytest.mark.asyncio
async def test_list_puestos_perfil_filter_busqueda(client: AsyncClient, db):
    """Buscar por nombre filtra correctamente."""
    area = await make_area(db, descripcion="Area Busqueda")
    rh = await make_empleado(db, rol="rh", email="pp_filt_busq@leoni.test")
    headers = await auth_headers(client, rh)

    await make_puesto_perfil(db, codigo="SOL-TIG-01", nombre="Soldador TIG Especial", area_id=area.area_id)
    await make_puesto_perfil(db, codigo="SUP-LOG-01", nombre="Supervisor Logistica", area_id=area.area_id)

    response = await client.get("/api/v1/puestos-perfil?busqueda=Soldador", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    for item in body["items"]:
        assert "soldador" in item["nombre"].lower()


@pytest.mark.asyncio
async def test_get_puesto_perfil_by_id(client: AsyncClient, db):
    """Obtener detalle de un perfil por ID → 200 con grados."""
    area = await make_area(db, descripcion="Area Detalle")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2])
    rh = await make_empleado(db, rol="rh", email="pp_get@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Para Detalle", area_id=area.area_id,
        grado_ids=[g.id for g in grados],
    )

    response = await client.get(f"/api/v1/puestos-perfil/{perfil.id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == perfil.id
    assert body["nombre"] == "Perfil Para Detalle"
    assert body["area_id"] == area.area_id
    assert [g["orden"] for g in body["grados"]] == [1, 2]


@pytest.mark.asyncio
async def test_get_puesto_perfil_not_found(client: AsyncClient, db):
    """Solicitar perfil con ID inexistente → 404."""
    rh = await make_empleado(db, rol="rh", email="pp_notfound@leoni.test")
    headers = await auth_headers(client, rh)
    response = await client.get("/api/v1/puestos-perfil/999999", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_puesto_perfil_increments_version(client: AsyncClient, db):
    """Actualizar perfil incrementa la version en cada update."""
    area = await make_area(db, descripcion="Area Update")
    rh = await make_empleado(db, rol="rh", email="pp_update@leoni.test")
    perfil = await make_puesto_perfil(db, nombre="Perfil Versionable", area_id=area.area_id)
    headers = await auth_headers(client, rh)

    r1 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"nombre": "Perfil Versionable V2", "descripcion": "Actualizado"},
        headers=headers,
    )
    assert r1.status_code == 200
    assert r1.json()["version"] == 2
    assert r1.json()["nombre"] == "Perfil Versionable V2"

    r2 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"descripcion": "Doblemente actualizado"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["version"] == 3


@pytest.mark.asyncio
async def test_delete_puesto_perfil_soft_delete(client: AsyncClient, db):
    """Eliminar perfil → 204; GET posterior → 404 (soft-delete)."""
    area = await make_area(db, descripcion="Area Delete")
    rh = await make_empleado(db, rol="rh", email="pp_delete@leoni.test")
    perfil = await make_puesto_perfil(db, nombre="Perfil a Eliminar", area_id=area.area_id)
    headers = await auth_headers(client, rh)

    response = await client.delete(f"/api/v1/puestos-perfil/{perfil.id}", headers=headers)
    assert response.status_code == 204

    response_get = await client.get(f"/api/v1/puestos-perfil/{perfil.id}", headers=headers)
    if response_get.status_code == 200:
        assert response_get.json()["activo"] is False
    else:
        assert response_get.status_code == 404


# ===========================================================================
# Generacion con IA
# ===========================================================================

@pytest.mark.asyncio
async def test_generar_perfil_ia_success(client: AsyncClient, db):
    """RH genera perfil con IA exitosamente (Ollama mockeado) → 200."""
    area = await make_area(db, descripcion="Area IA")
    rh = await make_empleado(db, rol="rh", email="pp_ia_ok@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(db, nombre="Operador IA Test", area_id=area.area_id)

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


@pytest.mark.asyncio
async def test_generar_perfil_ia_unauthorized(client: AsyncClient, db):
    """Empleado no-RH intenta generar con IA → 403."""
    area = await make_area(db, descripcion="Area IA Noauth")
    empleado = await make_empleado(db, rol="empleado", email="pp_ia_noauth@leoni.test")
    headers = await auth_headers(client, empleado)
    perfil = await make_puesto_perfil(db, nombre="Operador IA Noauth", area_id=area.area_id)

    response = await client.post(
        f"/api/v1/puestos-perfil/{perfil.id}/generar-ia",
        json={"nombre": "Operador IA Noauth"},
        headers=headers,
    )
    assert response.status_code == 403


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

@pytest.mark.asyncio
async def test_resumen_tarjetas_empty(client: AsyncClient, db):
    """Resumen tarjetas sin perfiles activos → 200 con items lista."""
    rh = await make_empleado(db, rol="rh", email="pp_tarj_empty@leoni.test")
    headers = await auth_headers(client, rh)
    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_resumen_tarjetas_with_profiles(client: AsyncClient, db):
    """Resumen tarjetas con perfiles retorna datos y estructura correcta."""
    area = await make_area(db, descripcion="Area Tarjetas")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_data@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(db, nombre="Operador Tarjeta Test", area_id=area.area_id)

    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas", headers=headers)
    assert response.status_code == 200
    item = next(i for i in response.json()["items"] if i["id"] == perfil.id)
    assert item["codigo"] == perfil.codigo
    assert item["nombre"] == "Operador Tarjeta Test"
    assert item["area_nombre"] == "Area Tarjetas"
    assert item["personas"] == 0
    assert item["cumplimiento_pct"] == 0
    assert item["brechas"] == 0


@pytest.mark.asyncio
async def test_resumen_tarjetas_personas_count(client: AsyncClient, db):
    """Resumen tarjetas cuenta personas asignadas correctamente."""
    area = await make_area(db, descripcion="Area Personas")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_pers@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(db, nombre="Perfil Con Personas", area_id=area.area_id)

    for i in range(3):
        emp = await make_empleado(db, rol="empleado", email=f"pp_tarj_emp{i}@leoni.test")
        await make_perfil_funciones(
            db, puesto_perfil_id=perfil.id, empleado_id=emp.id, departamento="Produccion"
        )
    await db.flush()

    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas", headers=headers)
    assert response.status_code == 200
    item = next(i for i in response.json()["items"] if i["id"] == perfil.id)
    assert item["personas"] == 3


@pytest.mark.asyncio
async def test_resumen_tarjetas_excludes_inactive(client: AsyncClient, db):
    """Resumen tarjetas no incluye perfiles inactivos (soft-deleted)."""
    area = await make_area(db, descripcion="Area Inactiva")
    rh = await make_empleado(db, rol="rh", email="pp_tarj_inact@leoni.test")
    headers = await auth_headers(client, rh)

    perfil_activo = await make_puesto_perfil(db, nombre="Perfil Activo Tarj", area_id=area.area_id, activo=True)
    perfil_inactivo = await make_puesto_perfil(db, nombre="Perfil Inactivo Tarj", area_id=area.area_id, activo=False)

    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas", headers=headers)
    assert response.status_code == 200
    ids = [i["id"] for i in response.json()["items"]]
    assert perfil_activo.id in ids
    assert perfil_inactivo.id not in ids


@pytest.mark.asyncio
async def test_resumen_tarjetas_unauthorized(client: AsyncClient, db):
    """Resumen tarjetas requiere autenticacion → 401 sin token."""
    response = await client.get("/api/v1/puestos-perfil/resumen-tarjetas")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cambiar_el_nivel_se_refleja_en_la_respuesta(client: AsyncClient, db):
    """
    Regresion: el cambio se guardaba pero la respuesta mostraba el nivel viejo.

    `set_grados` reemplaza los niveles con un DELETE masivo, que no sincroniza la
    coleccion ya cargada en la sesion. La relectura devolvia lo cacheado, asi que
    la respuesta —y el historial de clasificacion, que se arma de ella— seguian
    diciendo el nivel anterior.
    """
    area = await make_area(db, descripcion="Area Reflejo Nivel")
    grados = await make_grados_consecutivos(db, ordenes=[4, 5])
    rh = await make_empleado(db, rol="rh", email="pp_reflejo@leoni.test")
    headers = await auth_headers(client, rh)
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Reflejo", area_id=area.area_id, grado_ids=[grados[0].id]
    )

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"grado_id": grados[1].id},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert [g["id"] for g in response.json()["grados"]] == [grados[1].id]

    # Y al releerlo, tambien.
    detalle = await client.get(f"/api/v1/puestos-perfil/{perfil.id}", headers=headers)
    assert [g["id"] for g in detalle.json()["grados"]] == [grados[1].id]
