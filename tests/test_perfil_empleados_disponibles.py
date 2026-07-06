# tests/test_perfil_empleados_disponibles.py
"""
Tests del buscador de empleados para asignar a un perfil de puesto.

Endpoint: GET /api/v1/perfiles/empleados-disponibles

Cubre:
  - Acceso por módulo "puestos" (rol base "empleado" no está en los roles del guard,
    pero el bypass por módulo lo deja pasar). Regresión del bug 403 al buscar empleados.
  - Excluye empleados con asignación de perfil activa.
  - Búsqueda por número de empleado (no revienta; en Postgres usa cast).
  - Denegado si el usuario no tiene el módulo ni rol suficiente.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import get_default_grado, make_area, make_puesto_perfil


async def _make_perfil(db: AsyncSession):
    area = await make_area(db, descripcion="Disponibles Test")
    rh = await make_empleado(db, rol="rh")
    perfil = await make_puesto_perfil(
        db, area_id=area.area_id, created_by=rh.id, nombre="Perfil Disponibles Test"
    )
    grado = await get_default_grado(db)
    return perfil, grado


async def _make_usuario_puestos(db: AsyncSession):
    """Usuario con el módulo 'puestos' pero SIN el módulo 'empleados' (rol base empleado)."""
    return await make_empleado(
        db,
        rol="empleado",
        nombre="Gestor Perfiles",
        modulos_rh={"puestos": True, "empleados": False},
        inscrito_modulos_rh=True,
    )


async def test_usuario_con_modulo_puestos_puede_buscar(client: AsyncClient, db):
    """Regresión: antes daba 403 al buscar empleados desde el modal de asignar."""
    await _make_perfil(db)
    libre = await make_empleado(db, rol="empleado", nombre="ZAVALA LIBRE, ANA", no_empleado=7712345)
    gestor = await _make_usuario_puestos(db)
    await db.commit()

    headers = await auth_headers(client, gestor)
    resp = await client.get("/api/v1/perfiles/empleados-disponibles?q=ZAVALA", headers=headers)

    assert resp.status_code == 200, resp.text
    ids = [item["id"] for item in resp.json()]
    assert libre.id in ids


async def test_excluye_empleados_ya_asignados(client: AsyncClient, db):
    from app.models.talento import PerfilFunciones

    perfil, grado = await _make_perfil(db)
    asignado = await make_empleado(db, rol="empleado", nombre="MONTES ASIGNADO, LUIS")
    libre = await make_empleado(db, rol="empleado", nombre="MONTES LIBRE, MARIA")
    db.add(
        PerfilFunciones(
            puesto_perfil_id=perfil.id,
            empleado_id=asignado.id,
            grado_id=grado.id,
            activo=True,
        )
    )
    gestor = await _make_usuario_puestos(db)
    await db.commit()

    headers = await auth_headers(client, gestor)
    resp = await client.get("/api/v1/perfiles/empleados-disponibles?q=MONTES", headers=headers)

    assert resp.status_code == 200, resp.text
    ids = [item["id"] for item in resp.json()]
    assert libre.id in ids
    assert asignado.id not in ids


async def test_busqueda_por_numero_empleado(client: AsyncClient, db):
    await _make_perfil(db)
    emp = await make_empleado(db, rol="empleado", nombre="POR NUMERO, JOSE", no_empleado=6650099)
    gestor = await _make_usuario_puestos(db)
    await db.commit()

    headers = await auth_headers(client, gestor)
    resp = await client.get("/api/v1/perfiles/empleados-disponibles?q=6650099", headers=headers)

    assert resp.status_code == 200, resp.text
    ids = [item["id"] for item in resp.json()]
    assert emp.id in ids


async def test_query_corta_regresa_vacio(client: AsyncClient, db):
    gestor = await _make_usuario_puestos(db)
    await db.commit()

    headers = await auth_headers(client, gestor)
    resp = await client.get("/api/v1/perfiles/empleados-disponibles?q=a", headers=headers)

    assert resp.status_code == 200
    assert resp.json() == []


async def test_denegado_sin_modulo_ni_rol(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado")
    await db.commit()

    headers = await auth_headers(client, empleado)
    resp = await client.get("/api/v1/perfiles/empleados-disponibles?q=abc", headers=headers)

    assert resp.status_code == 403
