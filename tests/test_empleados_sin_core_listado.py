"""Regresión: listar/buscar empleados de Bono sin fila `levelup_empleados_core`.

La tabla `empleados` (Bono) es la plantilla completa; solo las cuentas del
proyecto tienen fila en `levelup_empleados_core`. Al listar el directorio, un
empleado sin esa fila resuelve `rol_id`/`created_at` a None y `registro` es
texto libre (no fecha). El serializador no debe romper por ello.
"""

import pytest
from httpx import AsyncClient

from app.models.empleados import Empleado
from tests.conftest import auth_headers, make_empleado


@pytest.mark.asyncio
async def test_list_empleados_incluye_empleado_sin_core(client: AsyncClient, db):
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_sin_core@leoni.test",
        empleado_id=93001,
        no_empleado=7100001,
        estado_id=1,
    )

    # Empleado de Bono sin levelup_empleados_core (sin cuenta del proyecto) y con
    # `registro` de texto no-ISO (la columna real es String(50) en Bono).
    sin_core = Empleado(
        empleado_id=93002,
        no_empleado=7100002,
        nombre="Empleado Sin Cuenta",
        estado_id=1,
        registro="ALTA-2020",
    )
    db.add(sin_core)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"page_size": 100},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    items = {item["empleado_id"]: item for item in response.json()["items"]}
    assert 93002 in items, "el empleado sin core debe aparecer en el listado"
    item = items[93002]
    assert item["rol_id"] is None
    assert item["created_at"] is None
    assert item["registro"] == "ALTA-2020"


@pytest.mark.asyncio
async def test_buscar_empleado_sin_core_por_nombre(client: AsyncClient, db):
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_busqueda@leoni.test",
        empleado_id=93010,
        no_empleado=7100010,
        estado_id=1,
    )
    sin_core = Empleado(
        empleado_id=93011,
        no_empleado=7100011,
        nombre="Zoraida Buscable",
        estado_id=1,
        registro="texto-libre",
    )
    db.add(sin_core)
    await db.flush()

    headers = await auth_headers(client, rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"q": "Zoraida"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    ids = {item["empleado_id"] for item in response.json()["items"]}
    assert 93011 in ids


@pytest.mark.asyncio
async def test_buscar_empleado_por_numero(client: AsyncClient, db):
    """Búsqueda por no_empleado. En Bono `no_empleado` es Integer y debe castearse
    a texto antes de normalizar (coalesce(integer, '') falla en PostgreSQL)."""
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_num@leoni.test",
        empleado_id=93020,
        no_empleado=7100020,
        estado_id=1,
    )
    headers = await auth_headers(client, rh)
    response = await client.get(
        "/api/v1/empleados",
        params={"q": "7100020"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    ids = {item["empleado_id"] for item in response.json()["items"]}
    assert 93020 in ids


@pytest.mark.asyncio
async def test_busqueda_solo_nombre_y_no_empleado(client: AsyncClient, db):
    """La búsqueda es solo por nombre o no_empleado: NO debe matchear por
    email, empleado_id, no_sap ni usuario (decisión de producto)."""
    rh = await make_empleado(
        db,
        rol="rh",
        email="rh_scope@leoni.test",
        empleado_id=93030,
        no_empleado=7100030,
        estado_id=1,
    )
    objetivo = await make_empleado(
        db,
        rol="empleado",
        email="zoraida.unica@leoni.test",
        usuario="zoraida.user",
        empleado_id=93031,
        no_empleado=7100031,
        nombre="Persona Cualquiera",
        estado_id=1,
    )
    headers = await auth_headers(client, rh)

    # Por email -> NO debe encontrarlo.
    r_email = await client.get(
        "/api/v1/empleados", params={"q": "zoraida.unica"}, headers=headers
    )
    assert r_email.status_code == 200, r_email.text
    assert objetivo.empleado_id not in {i["empleado_id"] for i in r_email.json()["items"]}

    # Por empleado_id -> NO debe encontrarlo (93031 no aparece en nombre ni no_empleado).
    r_id = await client.get(
        "/api/v1/empleados", params={"q": "93031"}, headers=headers
    )
    assert r_id.status_code == 200, r_id.text
    assert objetivo.empleado_id not in {i["empleado_id"] for i in r_id.json()["items"]}

    # Por nombre -> SÍ.
    r_nombre = await client.get(
        "/api/v1/empleados", params={"q": "Cualquiera"}, headers=headers
    )
    assert r_nombre.status_code == 200, r_nombre.text
    assert objetivo.empleado_id in {i["empleado_id"] for i in r_nombre.json()["items"]}
