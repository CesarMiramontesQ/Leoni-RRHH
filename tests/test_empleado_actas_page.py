"""GET /api/v1/empleados/{id}/actas — listado Vista 360."""

from app.models.catalogos import Puesto
from tests.conftest import auth_headers, make_empleado


async def test_empleado_actas_page_con_puesto_asignado_sin_actas(client, db):
    """Empleado con puesto_id no debe provocar 500 por lazy load."""
    rh = await make_empleado(db, rol="rh", email="rh_v360_puesto@leoni.test")
    puesto = Puesto(puesto_id=88001, descripcion="Operador prueba", estatus_id=1)
    db.add(puesto)
    await db.flush()
    emp = await make_empleado(db, rol="empleado", email="emp_v360_puesto@leoni.test")
    emp.puesto_id = puesto.puesto_id
    await db.flush()
    headers = await auth_headers(client, rh)

    r = await client.get(
        f"/api/v1/empleados/{emp.id}/actas",
        params={"page": 1, "page_size": 5},
        headers=headers,
    )

    assert r.status_code == 200, r.text
    assert r.json()["total"] == 0


async def test_empleado_actas_page_sin_registros(client, db):
    """Sin actas debe responder 200 (no 500 por lazy load de puesto)."""
    rh = await make_empleado(db, rol="rh", email="rh_v360_actas@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="emp_v360_actas@leoni.test")
    headers = await auth_headers(client, rh)

    r = await client.get(
        f"/api/v1/empleados/{emp.id}/actas",
        params={"page": 1, "page_size": 5},
        headers=headers,
    )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 0
    assert body["items"] == []
    assert body["page"] == 1
    assert body["page_size"] == 5
