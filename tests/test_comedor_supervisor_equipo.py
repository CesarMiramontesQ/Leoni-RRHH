from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

PROXIMAS_EQUIPO_URL = "/api/v1/comedor/accesos/equipo/mis-proximas-reservas"
RESERVAS_EQUIPO_MES_URL = "/api/v1/comedor/accesos/equipo/mis-reservas"
BENEFICIARIOS_EQUIPO_URL = "/api/v1/comedor/accesos/equipo/beneficiarios"
RESERVAR_URL = "/api/v1/comedor/accesos/reservar"
EDITAR_ACCESO_URL = "/api/v1/comedor/accesos/{acceso_id}"


@pytest.mark.asyncio
async def test_supervisor_ve_solo_reservas_de_subordinados(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Comedor equipo", activo=True)
    db.add(comedor)
    await db.flush()

    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Juan Supervisor",
        email="sup_equipo@test.leoni",
        password="Sup3rPass!",
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        nombre="Maria Lopez Perez",
        lider_id=supervisor.id,
        email="sub_equipo@test.leoni",
        password="SubPass1!",
    )
    externo = await make_empleado(
        db,
        rol="empleado",
        nombre="Pedro Externo",
        email="ext_equipo@test.leoni",
        password="ExtPass1!",
    )

    reg_sub = ComedorRegistro(
        empleado_id=sub.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    reg_ext = ComedorRegistro(
        empleado_id=externo.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add_all([reg_sub, reg_ext])
    await db.flush()

    db.add_all(
        [
            ComedorAcceso(
                empleado_id=sub.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_sub.id,
                fecha_servicio=date(2026, 4, 25),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
            ComedorAcceso(
                empleado_id=externo.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_ext.id,
                fecha_servicio=date(2026, 4, 25),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
        ]
    )
    await db.flush()

    headers = await auth_headers(client, supervisor, password="Sup3rPass!")
    response = await client.get(PROXIMAS_EQUIPO_URL, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 1
    assert data[0]["empleado_id"] == sub.id
    assert data[0]["empleado_nombre_corto"] == "Maria Lopez"


@pytest.mark.asyncio
async def test_supervisor_reservas_mes_equipo(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Comedor mes", activo=True)
    db.add(comedor)
    await db.flush()

    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Ana Supervisora",
        email="sup_mes@test.leoni",
        password="SupMes1!",
    )
    sub = await make_empleado(
        db,
        rol="empleado",
        nombre="LOYA FROESE, KARIME GISELLE",
        lider_id=supervisor.id,
        email="sub_mes@test.leoni",
        password="SubMes1!",
    )
    reg_sub = ComedorRegistro(
        empleado_id=sub.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg_sub)
    await db.flush()

    db.add(
        ComedorAcceso(
            empleado_id=sub.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg_sub.id,
            fecha_servicio=date(2026, 4, 29),
            tipo_comida=ComedorTipoComida.saludable,
            estado_acceso=ComedorAccesoEstado.ACCEDIDO,
        )
    )
    await db.flush()

    headers = await auth_headers(client, supervisor, password="SupMes1!")
    response = await client.get(f"{RESERVAS_EQUIPO_MES_URL}?anio=2026&mes=4", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 1
    assert data[0]["empleado_nombre"] == "LOYA FROESE, KARIME GISELLE"
    assert data[0]["empleado_nombre_corto"] == "Karime Loya"
    assert data[0]["tipo_comida"] == "saludable"
    assert data[0]["estado_acceso"] == "ACCEDIDO"


@pytest.mark.asyncio
async def test_supervisor_beneficiarios_equipo_directo(client: AsyncClient, db):
    supervisor = await make_empleado(
        db, rol="supervisor", nombre="SUPERVISOR, ANA", email="sup_benef@test.leoni", password="SupBenef1!"
    )
    sub1 = await make_empleado(
        db, rol="empleado", nombre="LOPEZ, CARLOS", lider_id=supervisor.id, email="sub1_benef@test.leoni", password="Sub1!"
    )
    await make_empleado(
        db, rol="empleado", nombre="RAMIREZ, LUZ", lider_id=sub1.id, email="sub2_benef@test.leoni", password="Sub2!"
    )

    headers = await auth_headers(client, supervisor, password="SupBenef1!")
    response = await client.get(BENEFICIARIOS_EQUIPO_URL, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    ids = [row["empleado_id"] for row in data]
    assert supervisor.id in ids
    assert sub1.id in ids
    # No incluye subárbol indirecto en selector
    assert len(data) == 2


@pytest.mark.asyncio
async def test_supervisor_reserva_para_subordinado_refleja_en_empleado(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Comedor reserva sup", activo=True)
    db.add(comedor)
    await db.flush()

    supervisor = await make_empleado(
        db, rol="supervisor", nombre="SUPERVISOR, ANA", email="sup_reserva@test.leoni", password="SupReserva1!"
    )
    sub = await make_empleado(
        db, rol="empleado", nombre="LOPEZ, CARLOS", lider_id=supervisor.id, email="sub_reserva@test.leoni", password="SubReserva1!"
    )

    headers_sup = await auth_headers(client, supervisor, password="SupReserva1!")
    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "casera",
            "target_user_id": sub.id,
        },
        headers=headers_sup,
    )
    assert r.status_code == 200, r.text
    assert r.json()["empleado_id"] == sub.id

    headers_sub = await auth_headers(client, sub, password="SubReserva1!")
    r_sub = await client.get("/api/v1/comedor/accesos/mis-reservas?anio=2026&mes=4", headers=headers_sub)
    assert r_sub.status_code == 200, r_sub.text
    data_sub = r_sub.json()
    assert any(item["fecha_servicio"] == "2026-04-28" for item in data_sub)


@pytest.mark.asyncio
async def test_gerente_no_puede_consultar_beneficiarios_ni_reservar_para_tercero(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))
    comedor = Comedor(nombre="Comedor gerente", activo=True)
    db.add(comedor)
    await db.flush()

    gerente = await make_empleado(
        db, rol="gerente", nombre="GERENTE, ANA", email="gerente_reserva@test.leoni", password="Gerente1!"
    )
    sub = await make_empleado(
        db, rol="empleado", nombre="LOPEZ, CARLOS", lider_id=gerente.id, email="sub_gerente@test.leoni", password="SubGerente1!"
    )

    headers = await auth_headers(client, gerente, password="Gerente1!")
    r_benef = await client.get(BENEFICIARIOS_EQUIPO_URL, headers=headers)
    assert r_benef.status_code == 403

    r_res = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "casera",
            "target_user_id": sub.id,
        },
        headers=headers,
    )
    assert r_res.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_ve_sus_reservas_y_puede_editar_solo_las_propias(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="Comedor permisos supervisor", activo=True)
    db.add(comedor)
    await db.flush()

    supervisor = await make_empleado(
        db, rol="supervisor", nombre="SUPERVISOR, ANA", email="sup_perm@test.leoni", password="SupPerm1!"
    )
    sub = await make_empleado(
        db, rol="empleado", nombre="LOPEZ, CARLOS", lider_id=supervisor.id, email="sub_perm@test.leoni", password="SubPerm1!"
    )
    reg_sup = ComedorRegistro(
        empleado_id=supervisor.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 28),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    reg_sub = ComedorRegistro(
        empleado_id=sub.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 28),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add_all([reg_sup, reg_sub])
    await db.flush()

    acceso_sup = ComedorAcceso(
        empleado_id=supervisor.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg_sup.id,
        fecha_servicio=date(2026, 4, 29),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    acceso_sub = ComedorAcceso(
        empleado_id=sub.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg_sub.id,
        fecha_servicio=date(2026, 4, 29),
        tipo_comida=ComedorTipoComida.saludable,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add_all([acceso_sup, acceso_sub])
    await db.flush()

    headers = await auth_headers(client, supervisor, password="SupPerm1!")
    r_proximas = await client.get(PROXIMAS_EQUIPO_URL, headers=headers)
    assert r_proximas.status_code == 200, r_proximas.text
    proximas = r_proximas.json()
    ids = {item["empleado_id"] for item in proximas}
    assert supervisor.id in ids
    assert sub.id in ids

    r_edit_own = await client.put(
        EDITAR_ACCESO_URL.format(acceso_id=acceso_sup.id),
        json={"tipo_comida": "saludable"},
        headers=headers,
    )
    assert r_edit_own.status_code == 200, r_edit_own.text
    assert r_edit_own.json()["tipo_comida"] == "saludable"

    r_edit_other = await client.put(
        EDITAR_ACCESO_URL.format(acceso_id=acceso_sub.id),
        json={"tipo_comida": "casera"},
        headers=headers,
    )
    assert r_edit_other.status_code == 404
