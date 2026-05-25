import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_listar_sin_auth_401(client: AsyncClient):
    """GET sin auth retorna 401."""
    resp = await client.get("/api/v1/level-up/habilidades")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_crear_habilidad_rh_201(client: AsyncClient, db: AsyncSession):
    """RH crea habilidad exitosamente."""
    rh = await make_empleado(db, rol="rh", email="rh_hab1@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "nombre": "Liderazgo Situacional",
        "descripcion": "Capacidad de adaptar el estilo de liderazgo",
        "tipo": "blanda",
    }
    resp = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["nombre"] == "Liderazgo Situacional"
    assert data["tipo"] == "blanda"
    assert data["activo"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_crear_habilidad_empleado_403(client: AsyncClient, db: AsyncSession):
    """Empleado no puede crear habilidades."""
    emp = await make_empleado(db, rol="empleado", email="emp_hab1@leoni.test")
    headers = await auth_headers(client, emp)

    payload = {"nombre": "Comunicacion Efectiva", "tipo": "operativa"}
    resp = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_crear_habilidad_duplicada_409(client: AsyncClient, db: AsyncSession):
    """Nombre duplicado retorna 409."""
    rh = await make_empleado(db, rol="rh", email="rh_hab2@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "Trabajo en Equipo", "tipo": "blanda"}
    resp1 = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_crear_habilidad_tipo_invalido_422(client: AsyncClient, db: AsyncSession):
    """Tipo invalido retorna 422."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_tipo@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "Test", "tipo": "invalido"}
    resp = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_crear_habilidad_nombre_corto_422(client: AsyncClient, db: AsyncSession):
    """Nombre con menos de 2 caracteres retorna 422."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_short@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {"nombre": "X", "tipo": "blanda"}
    resp = await client.post(
        "/api/v1/level-up/habilidades", json=payload, headers=headers
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_listar_habilidades_200(client: AsyncClient, db: AsyncSession):
    """Lista habilidades con paginacion."""
    rh = await make_empleado(db, rol="rh", email="rh_hab3@leoni.test")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Resolucion de Problemas", "tipo": "blanda"},
        headers=headers,
    )

    resp = await client.get("/api/v1/level-up/habilidades", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert data["page"] == 1
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_filtrar_por_tipo(client: AsyncClient, db: AsyncSession):
    """Filtro por tipo retorna solo items del tipo solicitado."""
    rh = await make_empleado(db, rol="rh", email="rh_hab4@leoni.test")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Negociacion Avanzada", "tipo": "operativa"},
        headers=headers,
    )
    await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Empatia", "tipo": "blanda"},
        headers=headers,
    )

    resp = await client.get(
        "/api/v1/level-up/habilidades?tipo=operativa", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["tipo"] == "operativa"


@pytest.mark.asyncio
async def test_filtrar_por_busqueda(client: AsyncClient, db: AsyncSession):
    """Filtro por busqueda retorna coincidencias parciales."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_busq@leoni.test")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Comunicacion Asertiva", "tipo": "operativa"},
        headers=headers,
    )

    resp = await client.get(
        "/api/v1/level-up/habilidades?busqueda=asertiva", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert "Asertiva" in data["items"][0]["nombre"]


@pytest.mark.asyncio
async def test_paginacion(client: AsyncClient, db: AsyncSession):
    """Paginacion retorna subconjuntos correctos."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_pag@leoni.test")
    headers = await auth_headers(client, rh)

    for i in range(3):
        await client.post(
            "/api/v1/level-up/habilidades",
            json={"nombre": f"Paginacion Hab {i}", "tipo": "blanda"},
            headers=headers,
        )

    resp = await client.get(
        "/api/v1/level-up/habilidades?page_size=2&page=1", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_obtener_por_id_200(client: AsyncClient, db: AsyncSession):
    """GET por ID retorna la habilidad correcta."""
    rh = await make_empleado(db, rol="rh", email="rh_hab5@leoni.test")
    headers = await auth_headers(client, rh)

    resp_create = await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Pensamiento Critico", "tipo": "tecnica"},
        headers=headers,
    )
    hab_id = resp_create.json()["id"]

    resp = await client.get(
        f"/api/v1/level-up/habilidades/{hab_id}", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Pensamiento Critico"


@pytest.mark.asyncio
async def test_obtener_inexistente_404(client: AsyncClient, db: AsyncSession):
    """GET por ID inexistente retorna 404."""
    rh = await make_empleado(db, rol="rh", email="rh_hab6@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.get("/api/v1/level-up/habilidades/99999", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_actualizar_habilidad_200(client: AsyncClient, db: AsyncSession):
    """PUT actualiza campos correctamente."""
    rh = await make_empleado(db, rol="rh", email="rh_hab7@leoni.test")
    headers = await auth_headers(client, rh)

    resp_create = await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Adaptabilidad", "tipo": "blanda"},
        headers=headers,
    )
    hab_id = resp_create.json()["id"]

    resp = await client.put(
        f"/api/v1/level-up/habilidades/{hab_id}",
        json={"nombre": "Adaptabilidad al Cambio", "tipo": "blanda"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Adaptabilidad al Cambio"
    assert resp.json()["tipo"] == "blanda"


@pytest.mark.asyncio
async def test_actualizar_nombre_duplicado_409(client: AsyncClient, db: AsyncSession):
    """PUT con nombre que ya existe retorna 409."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_dup@leoni.test")
    headers = await auth_headers(client, rh)

    await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Existente Unica", "tipo": "blanda"},
        headers=headers,
    )
    resp2 = await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Otra Habilidad", "tipo": "blanda"},
        headers=headers,
    )
    hab_id = resp2.json()["id"]

    resp = await client.put(
        f"/api/v1/level-up/habilidades/{hab_id}",
        json={"nombre": "Existente Unica"},
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_soft_delete_204(client: AsyncClient, db: AsyncSession):
    """DELETE hace soft-delete y marca activo=False en DB."""
    rh = await make_empleado(db, rol="rh", email="rh_hab8@leoni.test")
    headers = await auth_headers(client, rh)

    resp_create = await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Creatividad", "tipo": "blanda"},
        headers=headers,
    )
    hab_id = resp_create.json()["id"]

    resp = await client.delete(
        f"/api/v1/level-up/habilidades/{hab_id}", headers=headers
    )
    assert resp.status_code == 204

    # Verificar estado en DB directamente
    from app.models.level_up import Habilidad
    from sqlalchemy import select

    result = await db.execute(select(Habilidad).where(Habilidad.id == hab_id))
    hab_db = result.scalar_one_or_none()
    assert hab_db is not None
    assert hab_db.activo is False


@pytest.mark.asyncio
async def test_eliminar_inexistente_404(client: AsyncClient, db: AsyncSession):
    """DELETE de ID inexistente retorna 404."""
    rh = await make_empleado(db, rol="rh", email="rh_hab_del404@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.delete("/api/v1/level-up/habilidades/99999", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_eliminada_no_aparece_en_listado(client: AsyncClient, db: AsyncSession):
    """Habilidad soft-deleted no aparece en GET list ni GET by id."""
    rh = await make_empleado(db, rol="rh", email="rh_hab9@leoni.test")
    headers = await auth_headers(client, rh)

    resp_create = await client.post(
        "/api/v1/level-up/habilidades",
        json={"nombre": "Habilidad Para Borrar", "tipo": "blanda"},
        headers=headers,
    )
    hab_id = resp_create.json()["id"]

    await client.delete(f"/api/v1/level-up/habilidades/{hab_id}", headers=headers)

    resp = await client.get(f"/api/v1/level-up/habilidades/{hab_id}", headers=headers)
    assert resp.status_code == 404

    resp_list = await client.get("/api/v1/level-up/habilidades", headers=headers)
    ids = [item["id"] for item in resp_list.json()["items"]]
    assert hab_id not in ids


