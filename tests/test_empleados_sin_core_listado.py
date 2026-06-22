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
