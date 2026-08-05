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
            no_empleado=str(turno_nulo.no_empleado),
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
    # El endpoint lista TODOS los empleados activos sin comedor (estado global);
    # otros tests crean empleados que también aparecen, así que se verifica la
    # clasificación de los empleados propios en lugar de un total exacto.
    assert data["total"] == len(data["items"])
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


# ─────────────── búsqueda de empleados para el modal de registro ───────────────

BUSCAR_URL = "/api/v1/comedor/rh/empleados-buscar"


@pytest.mark.asyncio
async def test_buscar_empleados_por_nombre_y_por_numero(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_buscar@test.leoni", password="RhBusc!1")
    objetivo = await make_empleado(
        db, email="obj_buscar@test.leoni", password="SecretX9!", nombre="MARTINEZ LOPEZ, ANA"
    )
    await make_empleado(db, email="otro_buscar@test.leoni", password="SecretY9!", nombre="PEREZ SOSA, LUIS")
    await db.commit()
    hdrs = await auth_headers(client, rh, password="RhBusc!1")

    r = await client.get(BUSCAR_URL, params={"q": "martinez"}, headers=hdrs)
    assert r.status_code == 200, r.text
    nombres = [item["nombre"] for item in r.json()["items"]]
    assert "MARTINEZ LOPEZ, ANA" in nombres
    assert "PEREZ SOSA, LUIS" not in nombres

    r = await client.get(BUSCAR_URL, params={"q": str(objetivo.no_empleado)}, headers=hdrs)
    assert r.status_code == 200, r.text
    assert [item["empleado_id"] for item in r.json()["items"]] == [objetivo.id]


@pytest.mark.asyncio
async def test_buscar_empleados_con_modulo_comedor_pero_sin_modulo_empleados(
    client: AsyncClient, db
):
    """El caso que rompía el buscador.

    El modal llamaba a `/api/v1/empleados`, cuyo path exige el módulo `empleados`; un perfil
    de comedor no lo tiene y recibía un 403. Bajo `/comedor/rh` basta `comedor-registro`.
    """
    usuario = await make_empleado(
        db,
        rol="empleado",
        email="solo_comedor@test.leoni",
        password="SoloCom1!",
        nombre="GOMEZ RIOS, MARIA",
        inscrito_modulos_rh=True,
        modulos_rh={"comedor-registro": True},
    )
    await db.commit()

    from app.core.rh_module_registry import user_has_module

    assert user_has_module(usuario, "comedor-registro") is True
    assert user_has_module(usuario, "empleados") is False, "el fallo dependía de esto"

    r = await client.get(
        BUSCAR_URL,
        params={"q": "gomez"},
        headers=await auth_headers(client, usuario, password="SoloCom1!"),
    )
    assert r.status_code == 200, r.text
    assert any(item["nombre"] == "GOMEZ RIOS, MARIA" for item in r.json()["items"])


@pytest.mark.asyncio
async def test_buscar_empleados_sin_modulo_de_comedor(client: AsyncClient, db):
    usuario = await make_empleado(
        db,
        rol="empleado",
        email="sin_comedor_mod@test.leoni",
        password="SinCom1!",
        inscrito_modulos_rh=True,
        modulos_rh={"solicitudes": True},
    )
    await db.commit()

    r = await client.get(
        BUSCAR_URL,
        params={"q": "gomez"},
        headers=await auth_headers(client, usuario, password="SinCom1!"),
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_buscar_empleados_valida_q_y_respeta_limit(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_buscar2@test.leoni", password="RhBusc!2")
    for i in range(4):
        await make_empleado(
            db, email=f"lote{i}@test.leoni", password="SecretZ9!", nombre=f"LOTE PRUEBA {i}"
        )
    await db.commit()
    hdrs = await auth_headers(client, rh, password="RhBusc!2")

    # `q` de un solo carácter lo rechaza el propio endpoint.
    assert (await client.get(BUSCAR_URL, params={"q": "a"}, headers=hdrs)).status_code == 422

    r = await client.get(BUSCAR_URL, params={"q": "lote", "limit": 2}, headers=hdrs)
    assert r.status_code == 200, r.text
    assert len(r.json()["items"]) == 2
    assert r.json()["total"] == 2


@pytest.mark.asyncio
async def test_buscar_empleados_devuelve_el_comedor_actual(client: AsyncClient, db):
    """El modal de asignar necesita saber qué comedor tiene ya cada quien, para poder
    corregirlo y no solo llenar los vacíos."""
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="C busqueda", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(db, rol="rh", email="rh_bus_com@test.leoni", password="RhBusC!1")
    con = await make_empleado(
        db, email="con_comedor@test.leoni", password="SecretQ1!", nombre="RAMIREZ SOTO, ANA"
    )
    sin = await make_empleado(
        db, email="sin_comedor@test.leoni", password="SecretQ2!", nombre="RAMIREZ LUNA, JOSE"
    )
    await link_turno_comedor_empleado(db, con, comedor.id)
    await db.commit()

    r = await client.get(
        BUSCAR_URL,
        params={"q": "ramirez"},
        headers=await auth_headers(client, rh, password="RhBusC!1"),
    )
    assert r.status_code == 200, r.text
    por_id = {item["empleado_id"]: item["comedor_id"] for item in r.json()["items"]}
    assert por_id[con.id] == comedor.id
    assert por_id[sin.id] is None


@pytest.mark.asyncio
async def test_buscar_empleados_sirve_a_las_dos_pantallas_de_comedor(client: AsyncClient, db):
    """Lo usan el modal de registro y el de asignar, así que basta cualquiera de los dos
    permisos de la sección."""
    for modulo in ("comedor-registro", "comedor-gestion"):
        usuario = await make_empleado(
            db,
            rol="empleado",
            email=f"perfil_{modulo}@test.leoni",
            password="Perfil1!",
            nombre="TORRES DIAZ, LUZ",
            inscrito_modulos_rh=True,
            modulos_rh={modulo: True},
        )
        await db.commit()
        r = await client.get(
            BUSCAR_URL,
            params={"q": "torres"},
            headers=await auth_headers(client, usuario, password="Perfil1!"),
        )
        assert r.status_code == 200, f"{modulo}: {r.text}"

