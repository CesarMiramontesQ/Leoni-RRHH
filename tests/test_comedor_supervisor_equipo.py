from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

PROXIMAS_EQUIPO_URL = "/api/v1/comedor/accesos/equipo/mis-proximas-reservas"
RESERVAS_EQUIPO_MES_URL = "/api/v1/comedor/accesos/equipo/mis-reservas"
BENEFICIARIOS_EQUIPO_URL = "/api/v1/comedor/accesos/equipo/beneficiarios"
METRICAS_EQUIPO_URL = "/api/v1/comedor/accesos/equipo/metricas"
RESUMEN_RH_URL = "/api/v1/comedor/accesos/rh/resumen-diario"
REGISTRO_RH_URL = "/api/v1/comedor/accesos/rh/registro"
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
    r_self = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "saludable",
        },
        headers=headers_sup,
    )
    assert r_self.status_code == 200, r_self.text
    assert r_self.json()["empleado_id"] == supervisor.id

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

    r_dup = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "casera",
            "target_user_id": sub.id,
        },
        headers=headers_sup,
    )
    assert r_dup.status_code == 409
    assert r_dup.json().get("detail") == "El empleado Carlos Lopez ya tiene una comida registrada para este día"

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


@pytest.mark.asyncio
async def test_supervisor_metricas_dashboard(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))  # jueves
    comedor = Comedor(nombre="Comedor metricas", activo=True)
    db.add(comedor)
    await db.flush()

    supervisor = await make_empleado(
        db, rol="supervisor", nombre="SUPERVISOR, ANA", email="sup_metricas@test.leoni", password="SupMetricas1!"
    )
    sub = await make_empleado(
        db, rol="empleado", nombre="LOPEZ, CARLOS", lider_id=supervisor.id, email="sub_metricas@test.leoni", password="SubMetricas1!"
    )
    externo = await make_empleado(
        db, rol="empleado", nombre="FUERA, SCOPE", email="ext_metricas@test.leoni", password="ExtMetricas1!"
    )

    reg_sup = ComedorRegistro(
        empleado_id=supervisor.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
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
    db.add_all([reg_sup, reg_sub, reg_ext])
    await db.flush()

    db.add_all(
        [
            # Semana actual (2026-04-20..2026-04-26) dentro del scope
            ComedorAcceso(
                empleado_id=supervisor.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_sup.id,
                fecha_servicio=date(2026, 4, 23),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
            # Semana próxima (2026-04-27..2026-05-03) dentro del scope
            ComedorAcceso(
                empleado_id=sub.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_sub.id,
                fecha_servicio=date(2026, 4, 28),
                tipo_comida=ComedorTipoComida.saludable,
                estado_acceso=ComedorAccesoEstado.ACCEDIDO,
            ),
            # Expirada (no debe contar)
            ComedorAcceso(
                empleado_id=sub.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_sub.id,
                fecha_servicio=date(2026, 4, 29),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.EXPIRADO,
            ),
            # Fuera del scope (no subordinado)
            ComedorAcceso(
                empleado_id=externo.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg_ext.id,
                fecha_servicio=date(2026, 4, 28),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
        ]
    )
    await db.flush()

    headers = await auth_headers(client, supervisor, password="SupMetricas1!")
    r = await client.get(METRICAS_EQUIPO_URL, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["semana_actual_total"] == 1
    assert data["semana_proxima_total"] == 1
    assert data["total_activas"] == 2
    assert data["porcentaje_caseras"] == 50
    assert data["porcentaje_saludables"] == 50


@pytest.mark.asyncio
async def test_rh_resumen_diario_global_excluye_expirados(client: AsyncClient, db):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )

    comedor = Comedor(nombre="Comedor RH", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(
        db,
        rol="rh",
        nombre="RH, ANA",
        email="rh_resumen@test.leoni",
        password="RhResumen1!",
    )
    empleado = await make_empleado(
        db,
        rol="empleado",
        nombre="LOPEZ, CARLOS",
        email="emp_resumen@test.leoni",
        password="EmpResumen1!",
    )
    empleado_2 = await make_empleado(
        db,
        rol="empleado",
        nombre="PEREZ, MARIA",
        email="emp2_resumen@test.leoni",
        password="Emp2Resumen1!",
    )
    registro = ComedorRegistro(
        empleado_id=empleado.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    registro_2 = ComedorRegistro(
        empleado_id=empleado_2.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add_all([registro, registro_2])
    await db.flush()

    db.add_all(
        [
            ComedorAcceso(
                empleado_id=empleado.id,
                comedor_id=comedor.id,
                comedor_registro_id=registro.id,
                fecha_servicio=date(2026, 4, 28),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
            ComedorAcceso(
                empleado_id=empleado_2.id,
                comedor_id=comedor.id,
                comedor_registro_id=registro_2.id,
                fecha_servicio=date(2026, 4, 28),
                tipo_comida=ComedorTipoComida.saludable,
                estado_acceso=ComedorAccesoEstado.ACCEDIDO,
            ),
            ComedorAcceso(
                empleado_id=empleado.id,
                comedor_id=comedor.id,
                comedor_registro_id=registro.id,
                fecha_servicio=date(2026, 4, 29),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.EXPIRADO,
            ),
        ]
    )
    await db.flush()

    headers_rh = await auth_headers(client, rh, password="RhResumen1!")
    response = await client.get(
        f"{RESUMEN_RH_URL}?desde=2026-04-01&hasta=2026-04-30",
        headers=headers_rh,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 1
    assert data[0]["fecha"] == "2026-04-28"
    assert data[0]["caseras"] == 1
    assert data[0]["saludables"] == 1


@pytest.mark.asyncio
async def test_rh_puede_crear_registro_externo_y_recibir_credenciales(client: AsyncClient, db):
    import re

    from app.models.comedor import Comedor

    comedor = Comedor(nombre="Comedor RH Externo", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(
        db,
        rol="rh",
        nombre="RH, OPERADOR",
        email="rh_externo@test.leoni",
        password="RhExterno1!",
    )
    headers_rh = await auth_headers(client, rh, password="RhExterno1!")
    response = await client.post(
        REGISTRO_RH_URL,
        json={
            "person_type": "externo",
            "comedor_id": comedor.id,
            "fechas_servicio": ["2026-04-28", "2026-04-29", "2026-04-30"],
            "tipo_comida": "casera",
            "external_people_count": 2,
            "observaciones": "Visitas proveedor",
        },
        headers=headers_rh,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["modo"] == "externo"
    assert data["total_registros_creados"] == 2
    assert data["credenciales_temporales"] is not None
    cred = data["credenciales_temporales"]
    assert cred["lote_id"]
    assert cred["valido_desde"] == "2026-04-28"
    assert cred["valido_hasta"] == "2026-04-30"
    pases = cred["pases"]
    assert len(pases) == 2
    assert pases[0]["codigo_acceso"] != pases[1]["codigo_acceso"]
    assert pases[0]["password_temporal"] != pases[1]["password_temporal"]
    for p in pases:
        assert re.match(r"^CEXT\d+$", p["codigo_acceso"])
    n0 = int(re.match(r"^CEXT(\d+)$", pases[0]["codigo_acceso"]).group(1))
    n1 = int(re.match(r"^CEXT(\d+)$", pases[1]["codigo_acceso"]).group(1))
    assert n1 == n0 + 1

    resumen = await client.get(
        f"{RESUMEN_RH_URL}?desde=2026-04-01&hasta=2026-04-30",
        headers=headers_rh,
    )
    assert resumen.status_code == 200, resumen.text
    rows = resumen.json()
    fila = next((row for row in rows if row["fecha"] == "2026-04-28"), None)
    assert fila is not None
    assert fila["caseras"] == 2
    assert fila["saludables"] == 0

    listado = await client.get(
        "/api/v1/comedor/accesos/rh/codigos-externos?desde=2026-04-01&hasta=2026-04-30",
        headers=headers_rh,
    )
    assert listado.status_code == 200, listado.text
    codigos = listado.json()
    lote = cred["lote_id"]
    mismo_lote = [r for r in codigos if r.get("lote_id") == lote]
    assert len(mismo_lote) == 2
    for row in mismo_lote:
        assert row["fecha_inicio"] == "2026-04-28"
        assert row["fecha_fin"] == "2026-04-30"
        assert row["cantidad_personas"] == 1
        assert row["tipo_comida"] == "casera"
        assert re.match(r"^CEXT\d+$", row["codigo_acceso"])
        assert row["password_temporal"]
        assert row.get("empleado_id") is None


@pytest.mark.asyncio
async def test_rh_puede_crear_registro_interno_fin_de_semana(client: AsyncClient, db):
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="Comedor RH interno finde", activo=True)
    db.add(comedor)
    await db.flush()

    rh = await make_empleado(
        db,
        rol="rh",
        nombre="RH, Finde",
        email="rh_finde_interno@test.leoni",
        password="RhFinde1!",
    )
    empleado = await make_empleado(
        db,
        rol="empleado",
        nombre="Colaborador Interno",
        email="colab_finde@test.leoni",
        password="ColabFinde1!",
    )
    headers_rh = await auth_headers(client, rh, password="RhFinde1!")
    response = await client.post(
        REGISTRO_RH_URL,
        json={
            "person_type": "interno",
            "comedor_id": comedor.id,
            "fechas_servicio": ["2026-05-01", "2026-05-02", "2026-05-03"],
            "tipo_comida": "casera",
            "target_user_id": empleado.id,
            "observaciones": "Turno fin de semana",
        },
        headers=headers_rh,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["modo"] == "interno"
    assert data["total_registros_creados"] == 3
    assert data.get("credenciales_temporales") is None
