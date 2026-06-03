"""RH: listado y asignación de comedor en turnos_empleados."""

import pytest
from httpx import AsyncClient

from app.models.turnos_empleados import TurnoEmpleado
from tests.conftest import auth_headers, link_turno_comedor_empleado, make_empleado

LISTADO_URL = "/api/v1/comedor/rh/empleados-sin-comedor-asignado"
ASIGNAR_URL = "/api/v1/comedor/rh/asignar-comedor-turnos"


@pytest.mark.asyncio
async def test_listado_empleados_sin_comedor_asignado(client: AsyncClient, db):
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="C list", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="rh_list_sin@test.leoni", password="RhList!!")
    con_turno = await make_empleado(db, email="ok_turno@test.leoni", password="SecretA1!")
    sin_turno = await make_empleado(db, email="sin_turno_list@test.leoni", password="SecretB2!")
    turno_nulo = await make_empleado(db, email="turno_nulo_list@test.leoni", password="SecretC3!")

    await link_turno_comedor_empleado(db, rh, comedor.id)
    await link_turno_comedor_empleado(db, con_turno, comedor.id)
    db.add(
        TurnoEmpleado(
            no_empleado=turno_nulo.no_empleado,
            nombre=turno_nulo.nombre,
            clasificacion="A",
            comedor=None,
            turno="G1",
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhList!!")
    r = await client.get(LISTADO_URL, headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 2
    ids = {row["empleado_id"] for row in data["items"]}
    assert sin_turno.id in ids
    assert turno_nulo.id in ids
    assert con_turno.id not in ids


@pytest.mark.asyncio
async def test_asignar_comedor_turnos_crea_o_actualiza(client: AsyncClient, db):
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="C asig", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="rh_asig@test.leoni", password="RhAsig!!")
    pendiente = await make_empleado(db, email="pend_asig@test.leoni", password="SecretD4!")
    await link_turno_comedor_empleado(db, rh, comedor.id)
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhAsig!!")
    r = await client.post(
        ASIGNAR_URL,
        headers=hdrs,
        json={"asignaciones": [{"empleado_id": pendiente.id, "comedor_id": comedor.id}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["actualizados"] == 1

    r2 = await client.get(LISTADO_URL, headers=hdrs)
    assert r2.status_code == 200
    ids = {row["empleado_id"] for row in r2.json()["items"]}
    assert pendiente.id not in ids
