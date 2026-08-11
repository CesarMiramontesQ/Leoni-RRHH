"""RH: registros de reporte por rango de fechas (inclusive)."""

from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, reset_comedor_transaccional

URL = "/api/v1/comedor/accesos/rh/registros-reporte"


@pytest_asyncio.fixture(autouse=True)
async def _reset_comedor_global(db):
    """Aísla los conteos globales de comedor de la contaminación entre tests."""
    await reset_comedor_transaccional(db)


@pytest.mark.asyncio
async def test_rh_registros_reporte_incluye_pasado_y_respeta_rango(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 6, 10)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C-Reporte", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="rep_rh_emp@test.leoni", password="SecretP!")
    rh = await make_empleado(db, rol="rh", email="rep_rh@test.leoni", password="RhRep!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    pasado = hoy - timedelta(days=3)
    futuro = hoy + timedelta(days=5)
    for fecha in (pasado, hoy, futuro):
        db.add(
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=fecha,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            )
        )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhRep!!")
    r = await client.get(
        URL,
        params={
            "desde": pasado.isoformat(),
            "hasta": hoy.isoformat(),
            "page": 1,
            "page_size": 50,
            "filtro_estado": "todos",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 2
    fechas = {row["fecha_servicio"] for row in data["items"]}
    assert pasado.isoformat() in fechas or str(pasado) in fechas
    assert hoy.isoformat() in fechas or str(hoy) in fechas


@pytest.mark.asyncio
async def test_rh_registros_reporte_incluye_repetido_en_todos(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorAcceso, ComedorAccesoEstado, ComedorRegistro, ComedorTipoComida
    from app.services import comedor_service as cs

    hoy = date(2030, 7, 8)
    monkeypatch.setattr(cs, "business_today", lambda: hoy)

    comedor = Comedor(nombre="C-RepRepet", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="rep_repet_emp@test.leoni", password="SecretP!")
    rh = await make_empleado(db, rol="rh", email="rep_repet_rh@test.leoni", password="RhRep!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=hoy - timedelta(days=hoy.weekday()),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    db.add(
        ComedorAcceso(
            empleado_id=emp.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg.id,
            fecha_servicio=hoy,
            tipo_comida=ComedorTipoComida.casera,
            estado_acceso=ComedorAccesoEstado.REPETIDO,
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhRep!!")
    r = await client.get(
        URL,
        params={
            "desde": hoy.isoformat(),
            "hasta": hoy.isoformat(),
            "page": 1,
            "page_size": 50,
            "filtro_estado": "todos",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["estado_acceso"] == "REPETIDO"


@pytest.mark.asyncio
async def test_rh_registros_reporte_page_size_5_sin_datos(client: AsyncClient, db):
    """Vista 360 usa page_size=5; debe responder 200 con lista vacía, no error de validación."""
    rh = await make_empleado(db, rol="rh", email="rep_p5@test.leoni", password="RhP5!!")
    hdrs = await auth_headers(client, rh, password="RhP5!!")
    r = await client.get(
        URL,
        params={
            "desde": "2030-01-01",
            "hasta": "2030-01-31",
            "page": 1,
            "page_size": 5,
            "buscar": "99999999",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["page_size"] == 5


@pytest.mark.asyncio
async def test_rh_registros_reporte_rango_invalido(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rep_inv@test.leoni", password="RhInv!!")
    hdrs = await auth_headers(client, rh, password="RhInv!!")
    r = await client.get(
        URL,
        params={
            "desde": "2030-06-15",
            "hasta": "2030-06-01",
            "page": 1,
            "page_size": 10,
        },
        headers=hdrs,
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_empleado_no_puede_registros_reporte(client: AsyncClient, db):
    emp = await make_empleado(db, email="rep_no@test.leoni", password="SecretN!")
    hdrs = await auth_headers(client, emp, password="SecretN!")
    r = await client.get(
        URL,
        params={
            "desde": "2030-06-01",
            "hasta": "2030-06-30",
            "page": 1,
            "page_size": 10,
        },
        headers=hdrs,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_rh_registros_reporte_acepta_lotes_grandes(client: AsyncClient, db):
    """El tablero se descarga el rango completo; con el tope de 50 eran 258 peticiones.

    Un mes de operación con 812 empleados ronda las 13 000 filas. Permitir lotes de 1000
    lo deja en ~13 peticiones, que el cliente además lanza en paralelo.
    """
    rh = await make_empleado(db, rol="rh", email="rep_big@test.leoni", password="RhBig!!")
    hdrs = await auth_headers(client, rh, password="RhBig!!")

    for size in (500, 1000):
        r = await client.get(
            URL,
            params={
                "desde": "2030-01-01",
                "hasta": "2030-01-31",
                "page": 1,
                "page_size": size,
            },
            headers=hdrs,
        )
        assert r.status_code == 200, r.text
        assert r.json()["page_size"] == size


@pytest.mark.asyncio
async def test_rh_registros_reporte_rechaza_un_lote_arbitrario(client: AsyncClient, db):
    """Los tamaños siguen siendo una lista cerrada: nada de paginar de 7 en 7."""
    rh = await make_empleado(db, rol="rh", email="rep_raro@test.leoni", password="RhRaro!")
    hdrs = await auth_headers(client, rh, password="RhRaro!")
    r = await client.get(
        URL,
        params={"desde": "2030-01-01", "hasta": "2030-01-31", "page": 1, "page_size": 7},
        headers=hdrs,
    )
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_rh_registros_reporte_no_permite_pasar_del_tope(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rep_tope@test.leoni", password="RhTope!")
    hdrs = await auth_headers(client, rh, password="RhTope!")
    r = await client.get(
        URL,
        params={"desde": "2030-01-01", "hasta": "2030-01-31", "page": 1, "page_size": 5000},
        headers=hdrs,
    )
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_rh_registros_reporte_resuelve_el_horario_de_comida(client: AsyncClient, db):
    """Planeación necesita a qué hora se sirve cada platillo, y eso no está en el acceso.

    La ventana se calcula recorriendo el ciclo del turno de la persona, así que el
    servidor la resuelve y la manda en la fila: el cliente no puede deducirla.
    """
    from datetime import datetime, time

    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from tests.conftest import (
        make_horario,
        make_turno,
        make_turno_empleado,
        make_ventana_comida,
        reset_turnos_horario,
    )

    await reset_turnos_horario(db)
    # Patrón real de ROT321: días 1-5 en la jornada 003 (nocturna).
    await make_horario(db, "003", "Nocturno 22:00 - 06:00", intime="2200", outtime="0600")
    await make_ventana_comida(db, "003", time(2, 0), time(2, 30))
    await make_turno(
        db,
        "ROT321",
        "3a2a1a",
        rit_pat="5:003,2:002,5:002,0,1:006,1:002,6:001,1:001",
        rit_ini=datetime(2020, 3, 9),
    )

    comedor = Comedor(nombre="C-Horario", activo=True)
    db.add(comedor)
    await db.flush()
    emp = await make_empleado(db, email="rep_hor_emp@test.leoni", no_empleado=8080)
    rh = await make_empleado(db, rol="rh", email="rep_hor_rh@test.leoni", password="RhHor!!")
    await make_turno_empleado(db, "8080", "Beto", tu_codigo="ROT321")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2020, 3, 9),
        tipo_platillo="normal",
        acceso_concedido=True,
    )
    db.add(reg)
    await db.flush()
    db.add(
        ComedorAcceso(
            empleado_id=emp.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg.id,
            fecha_servicio=date(2020, 3, 9),  # día 1 del ciclo
            tipo_comida=ComedorTipoComida.casera,
            estado_acceso=ComedorAccesoEstado.PENDIENTE,
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhHor!!")
    r = await client.get(
        URL,
        params={
            "desde": "2020-03-09",
            "hasta": "2020-03-09",
            "page": 1,
            "page_size": 50,
        },
        headers=hdrs,
    )

    assert r.status_code == 200, r.text
    fila = r.json()["items"][0]
    assert fila["tu_codigo"] == "ROT321"
    assert fila["ho_codigo"] == "003"
    assert fila["hora_inicio_comida"] == "02:00:00"
    assert fila["hora_fin_comida"] == "02:30:00"


@pytest.mark.asyncio
async def test_rh_registros_reporte_sin_horario_no_inventa_uno(client: AsyncClient, db):
    """Un acceso de alguien sin turno asignado viaja con la ventana vacía, no con horas falsas."""
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from tests.conftest import reset_turnos_horario

    await reset_turnos_horario(db)
    comedor = Comedor(nombre="C-SinHorario", activo=True)
    db.add(comedor)
    await db.flush()
    emp = await make_empleado(db, email="rep_sinh_emp@test.leoni", no_empleado=9091)
    rh = await make_empleado(db, rol="rh", email="rep_sinh_rh@test.leoni", password="RhSin!!")

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2030, 6, 10),
        tipo_platillo="normal",
        acceso_concedido=True,
    )
    db.add(reg)
    await db.flush()
    db.add(
        ComedorAcceso(
            empleado_id=emp.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg.id,
            fecha_servicio=date(2030, 6, 10),
            tipo_comida=ComedorTipoComida.casera,
            estado_acceso=ComedorAccesoEstado.PENDIENTE,
        )
    )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhSin!!")
    r = await client.get(
        URL,
        params={"desde": "2030-06-10", "hasta": "2030-06-10", "page": 1, "page_size": 50},
        headers=hdrs,
    )

    fila = r.json()["items"][0]
    assert fila["ho_codigo"] is None
    assert fila["hora_inicio_comida"] is None
