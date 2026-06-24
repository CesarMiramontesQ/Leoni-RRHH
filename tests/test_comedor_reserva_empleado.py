"""Reservas comedor: semana siguiente, rol empleado, un acceso activo por empleado y fecha."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient

from app.core.exceptions import DomainValidationError
from app.services.comedor_service import ComedorService
from tests.conftest import auth_headers, link_turno_comedor_empleado, make_empleado

RESERVAR_URL = "/api/v1/comedor/accesos/reservar"
MIS_RESERVAS_URL = "/api/v1/comedor/accesos/mis-reservas"
PRIMERA_FECHA_URL = "/api/v1/comedor/accesos/primera-fecha-permitida"
MIS_FECHAS_OCUPADAS_URL = "/api/v1/comedor/accesos/mis-fechas-ocupadas"
MIS_PROXIMAS_URL = "/api/v1/comedor/accesos/mis-proximas-reservas"
EDITAR_ACCESO_URL = "/api/v1/comedor/accesos/{acceso_id}"


@pytest.fixture(autouse=True)
def _fijar_business_now(monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(
        cs,
        "business_now",
        lambda: datetime(2026, 4, 23, 12, 0, 0, tzinfo=timezone.utc),
    )


def test_valida_deadline_permite_jueves_235959():
    service = object.__new__(ComedorService)
    service._validar_ventana_modificacion_reserva(
        fecha_servicio=date(2026, 4, 27),
        fecha_transaccion=datetime(2026, 4, 23, 23, 59, 59, tzinfo=ZoneInfo("UTC")),
    )


def test_valida_deadline_bloquea_viernes_000000():
    service = object.__new__(ComedorService)
    with pytest.raises(DomainValidationError):
        service._validar_ventana_modificacion_reserva(
            fecha_servicio=date(2026, 4, 27),
            fecha_transaccion=datetime(2026, 4, 24, 0, 0, 0, tzinfo=ZoneInfo("UTC")),
        )


def test_valida_deadline_cruce_anio_ok():
    service = object.__new__(ComedorService)
    service._validar_ventana_modificacion_reserva(
        fecha_servicio=date(2027, 1, 4),
        fecha_transaccion=datetime(2026, 12, 31, 23, 59, 59, tzinfo=ZoneInfo("UTC")),
    )
    with pytest.raises(DomainValidationError):
        service._validar_ventana_modificacion_reserva(
            fecha_servicio=date(2027, 1, 4),
            fecha_transaccion=datetime(2027, 1, 1, 0, 0, 0, tzinfo=ZoneInfo("UTC")),
        )


@pytest.mark.asyncio
async def test_primera_fecha_permitida_ok_empleado(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))
    emp = await make_empleado(db, email="prim_f@test.leoni", password="SecretPF!")
    hdrs = await auth_headers(client, emp, password="SecretPF!")
    r = await client.get(PRIMERA_FECHA_URL, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json().get("fecha_iso") == "2026-04-27"


@pytest.mark.asyncio
async def test_primera_fecha_permitida_despues_de_deadline_salta_una_semana(client: AsyncClient, db, monkeypatch):
    from app.services import comedor_service as cs

    monkeypatch.setattr(
        cs,
        "business_now",
        lambda: datetime(2026, 4, 24, 0, 0, 0, tzinfo=timezone.utc),
    )
    emp = await make_empleado(db, email="prim_deadline@test.leoni", password="SecretPF2!")
    hdrs = await auth_headers(client, emp, password="SecretPF2!")
    r = await client.get(PRIMERA_FECHA_URL, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json().get("fecha_iso") == "2026-05-04"


@pytest.mark.asyncio
async def test_supervisor_puede_reservar_pero_no_listar_mis_reservas(client: AsyncClient, db):
    from app.models.comedor import Comedor

    comedor = Comedor(nombre="CX", activo=True)
    db.add(comedor)
    await db.flush()

    sup = await make_empleado(db, rol="supervisor", email="sup_res@test.leoni", password="S3cret!!")
    await link_turno_comedor_empleado(db, sup, comedor.id)
    hdrs = await auth_headers(client, sup, password="S3cret!!")

    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2030-07-07",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 200

    r2 = await client.get(f"{MIS_RESERVAS_URL}?anio=2030&mes=7", headers=hdrs)
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_empleado_puede_reservar_sin_relacion_rol_cargada(client: AsyncClient, db, monkeypatch):
    """Simula sesión donde rol_id es válido pero la relación ORM `empleado.rol` no está cargada."""
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C sin rol rel", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_sin_rol_rel@test.leoni", password="Secret1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    # `rol`/`core` se cargan vía selectin en get_current_user; el endpoint recarga
    # su propio usuario, así que la reserva funciona aunque el objeto de prueba no
    # tenga la relación precargada.
    hdrs = await auth_headers(client, emp, password="Secret1!")
    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-28",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_reservar_rechaza_semana_actual_permite_siguiente(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C semana", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_sem@test.leoni", password="Secret1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret1!")

    r_bloque = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-25",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r_bloque.status_code == 422
    assert "fecha límite" in (r_bloque.json().get("detail") or "").lower()

    r_ok = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-27",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r_ok.status_code == 200, r_ok.text
    body = r_ok.json()
    assert body["tipo_comida"] == "casera"


@pytest.mark.asyncio
async def test_no_duplicar_mismo_tipo_misma_fecha(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C dup", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_dup@test.leoni", password="Secret2!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret2!")
    payload = {
        "comedor_id": comedor.id,
        "fecha_servicio": "2026-04-28",
        "tipo_comida": "casera",
    }
    r1 = await client.post(RESERVAR_URL, json=payload, headers=hdrs)
    assert r1.status_code == 200
    r2 = await client.post(RESERVAR_URL, json=payload, headers=hdrs)
    assert r2.status_code == 409
    assert "registro" in (r2.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_mismo_dia_distinto_tipo_rechaza_conflicto(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C multi", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_multi@test.leoni", password="Secret3!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret3!")
    r1 = await client.post(
        RESERVAR_URL,
        json={"comedor_id": comedor.id, "fecha_servicio": "2026-04-29", "tipo_comida": "casera"},
        headers=hdrs,
    )
    assert r1.status_code == 200
    r2 = await client.post(
        RESERVAR_URL,
        json={"comedor_id": comedor.id, "fecha_servicio": "2026-04-29", "tipo_comida": "saludable"},
        headers=hdrs,
    )
    assert r2.status_code == 409
    assert "registro" in (r2.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_reserva_batch_crea_un_registro_por_fecha(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C batch", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_batch@test.leoni", password="SecretBatch1!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretBatch1!")
    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fechas_servicio": ["2026-04-28", "2026-04-29", "2026-04-30"],
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 3
    assert [item["fecha_servicio"] for item in body] == [
        "2026-04-28",
        "2026-04-29",
        "2026-04-30",
    ]


@pytest.mark.asyncio
async def test_reserva_batch_falla_si_alguna_fecha_ya_esta_ocupada(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C batch dup", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_batch_dup@test.leoni", password="SecretBatch2!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretBatch2!")
    pre = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fecha_servicio": "2026-04-29",
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert pre.status_code == 200, pre.text

    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fechas_servicio": ["2026-04-28", "2026-04-29", "2026-04-30"],
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 409
    assert "registro" in (r.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_reserva_batch_permite_fin_de_semana(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C weekend", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_weekend@test.leoni", password="SecretWeekend!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretWeekend!")
    r = await client.post(
        RESERVAR_URL,
        json={
            "comedor_id": comedor.id,
            "fechas_servicio": ["2026-05-02", "2026-05-03"],
            "tipo_comida": "casera",
        },
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert [item["fecha_servicio"] for item in body] == ["2026-05-02", "2026-05-03"]


@pytest.mark.asyncio
async def test_mis_reservas_mes(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C list", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_list@test.leoni", password="Secret4!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret4!")
    await client.post(
        RESERVAR_URL,
        json={"comedor_id": comedor.id, "fecha_servicio": "2026-04-30", "tipo_comida": "casera"},
        headers=hdrs,
    )

    r = await client.get(f"{MIS_RESERVAS_URL}?anio=2026&mes=4", headers=hdrs)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(row["fecha_servicio"] == "2026-04-30" and row["tipo_comida"] == "casera" for row in data)


@pytest.mark.asyncio
async def test_mis_reservas_mes_excluye_expiradas(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C exp", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_exp@test.leoni", password="SecretExp!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    db.add_all(
        [
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=date(2026, 4, 28),
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            ),
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=date(2026, 4, 29),
                tipo_comida=ComedorTipoComida.saludable,
                estado_acceso=ComedorAccesoEstado.EXPIRADO,
            ),
        ]
    )
    await db.flush()

    hdrs = await auth_headers(client, emp, password="SecretExp!")
    r = await client.get(f"{MIS_RESERVAS_URL}?anio=2026&mes=4", headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert [row["fecha_servicio"] for row in data] == ["2026-04-28"]
    assert all(row["estado_acceso"] != "EXPIRADO" for row in data)


@pytest.mark.asyncio
async def test_mis_fechas_ocupadas_incluye_reserva_activa(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import Comedor, ComedorRegistro
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C fechas", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_fechas@test.leoni", password="Secret5!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret5!")
    await client.post(
        RESERVAR_URL,
        json={"comedor_id": comedor.id, "fecha_servicio": "2026-04-28", "tipo_comida": "casera"},
        headers=hdrs,
    )

    r = await client.get(
        f"{MIS_FECHAS_OCUPADAS_URL}?desde=2026-04-27&hasta=2026-04-30",
        headers=hdrs,
    )
    assert r.status_code == 200, r.text
    fechas = r.json().get("fechas") or []
    assert "2026-04-28" in fechas


@pytest.mark.asyncio
async def test_mis_fechas_ocupadas_rango_invalido_422(client: AsyncClient, db):
    emp = await make_empleado(db, email="res_bad_range@test.leoni", password="Secret6!")
    hdrs = await auth_headers(client, emp, password="Secret6!")
    r = await client.get(
        f"{MIS_FECHAS_OCUPADAS_URL}?desde=2026-05-10&hasta=2026-05-01",
        headers=hdrs,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_mis_proximas_reservas_top5_ordenadas_y_privadas(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C top5", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_top5@test.leoni", password="Secret7!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)

    otro = await make_empleado(db, email="res_top5_otro@test.leoni", password="Secret8!")
    reg_otro = ComedorRegistro(
        empleado_id=otro.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 20),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg_otro)
    await db.flush()

    fechas_emp = [
        date(2026, 4, 22),  # pasado, no debe aparecer
        date(2026, 4, 23),
        date(2026, 4, 24),
        date(2026, 4, 25),
        date(2026, 4, 26),
        date(2026, 4, 27),
        date(2026, 4, 28),  # 6 futuras+actual, debe cortar a 5
    ]
    for f in fechas_emp:
        db.add(
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=f,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            )
        )

    db.add(
        ComedorAcceso(
            empleado_id=otro.id,
            comedor_id=comedor.id,
            comedor_registro_id=reg_otro.id,
            fecha_servicio=date(2026, 4, 23),
            tipo_comida=ComedorTipoComida.saludable,
            estado_acceso=ComedorAccesoEstado.PENDIENTE,
        )
    )
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret7!")
    r = await client.get(f"{MIS_PROXIMAS_URL}?limite=5", headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 5
    assert [row["fecha_servicio"] for row in data] == [
        "2026-04-23",
        "2026-04-24",
        "2026-04-25",
        "2026-04-26",
        "2026-04-27",
    ]
    assert all(int(row["id"]) > 0 for row in data)


@pytest.mark.asyncio
async def test_editar_y_cancelar_reserva_futura_ok(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C edit", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_edit@test.leoni", password="Secret9!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    acceso = ComedorAcceso(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg.id,
        fecha_servicio=date(2026, 4, 29),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add(acceso)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret9!")
    r_edit = await client.put(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        json={"tipo_comida": "saludable"},
        headers=hdrs,
    )
    assert r_edit.status_code == 200, r_edit.text
    assert r_edit.json()["tipo_comida"] == "saludable"

    r_del = await client.delete(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        headers=hdrs,
    )
    assert r_del.status_code == 204, r_del.text


@pytest.mark.asyncio
async def test_no_editar_ni_cancelar_semana_actual(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C bloqueada", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="res_lock@test.leoni", password="Secret10!")
    await link_turno_comedor_empleado(db, emp, comedor.id)
    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 21),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    acceso = ComedorAcceso(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg.id,
        fecha_servicio=date(2026, 4, 24),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add(acceso)
    await db.flush()

    hdrs = await auth_headers(client, emp, password="Secret10!")
    r_edit = await client.put(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        json={"tipo_comida": "saludable"},
        headers=hdrs,
    )
    assert r_edit.status_code == 409
    r_del = await client.delete(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        headers=hdrs,
    )
    assert r_del.status_code == 422
    assert "fecha límite" in (r_del.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_no_puede_editar_ni_cancelar_reserva_de_otro_empleado(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C privacidad", activo=True)
    db.add(comedor)
    await db.flush()

    dueno = await make_empleado(db, email="res_dueno@test.leoni", password="Secret11!")
    actor = await make_empleado(db, email="res_actor@test.leoni", password="Secret12!")
    reg = ComedorRegistro(
        empleado_id=dueno.id,
        comedor_id=comedor.id,
        semana=date(2026, 4, 27),
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    acceso = ComedorAcceso(
        empleado_id=dueno.id,
        comedor_id=comedor.id,
        comedor_registro_id=reg.id,
        fecha_servicio=date(2026, 4, 28),
        tipo_comida=ComedorTipoComida.casera,
        estado_acceso=ComedorAccesoEstado.PENDIENTE,
    )
    db.add(acceso)
    await db.flush()

    hdrs_actor = await auth_headers(client, actor, password="Secret12!")
    r_edit = await client.put(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        json={"tipo_comida": "saludable"},
        headers=hdrs_actor,
    )
    assert r_edit.status_code == 404
    r_del = await client.delete(
        EDITAR_ACCESO_URL.format(acceso_id=acceso.id),
        headers=hdrs_actor,
    )
    assert r_del.status_code == 404
