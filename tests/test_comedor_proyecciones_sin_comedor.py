"""Proyecciones comedor: conteo de empleados activos sin comedor en turnos."""

import pytest
from httpx import AsyncClient

from app.models.turnos_empleados import TurnoEmpleado
from tests.conftest import auth_headers, link_turno_comedor_empleado, make_empleado

PROYECCIONES_URL = "/api/v1/comedor/proyecciones"
LISTADO_URL = "/api/v1/comedor/rh/empleados-sin-comedor-asignado"


@pytest.mark.asyncio
async def test_proyecciones_empleados_sin_comedor_asignado(client: AsyncClient, db):
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="C proy", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="rh_proy_sin@test.leoni", password="RhProy!!")
    con_turno = await make_empleado(db, email="con_turno_proy@test.leoni", password="SecretA1!")
    await make_empleado(db, email="sin_turno_proy@test.leoni", password="SecretB2!")
    turno_nulo = await make_empleado(db, email="turno_nulo_proy@test.leoni", password="SecretC3!")

    await link_turno_comedor_empleado(db, rh, comedor.id)
    await link_turno_comedor_empleado(db, con_turno, comedor.id)
    db.add(
        TurnoEmpleado(
            no_empleado=str(turno_nulo.no_empleado),
            nombre=turno_nulo.nombre,
            clasificacion="A",
            comedor=None,
            turno="G1",
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhProy!!")
    r_list = await client.get(LISTADO_URL, headers=hdrs)
    assert r_list.status_code == 200, r_list.text
    total_listado = r_list.json()["total"]
    assert total_listado >= 2

    r = await client.get(PROYECCIONES_URL, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json()["empleados_sin_comedor_asignado"] == total_listado
