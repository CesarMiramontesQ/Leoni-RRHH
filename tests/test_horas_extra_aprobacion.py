"""Ciclo de aprobación de horas extra: gerente regional + director (en paralelo)."""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.catalogos import Area, Subarea
from app.models.horas_extra import (
    CentroCosto,
    HorasExtraAprobacion,
    HorasExtraAprobador,
    HorasExtraMotivo,
    HorasExtraSolicitud,
    HorasExtraSolicitudDetalle,
)
from tests.conftest import auth_headers, make_empleado

NOMINAS = "/api/v1/nominas"


async def _reset_horas_extra(db):
    """Limpia el estado del módulo: las llamadas API hacen commit y filtran
    entre tests por compartir la conexión SQLite en memoria."""
    from sqlalchemy import delete

    for model in (
        HorasExtraAprobacion,
        HorasExtraSolicitudDetalle,
        HorasExtraSolicitud,
        HorasExtraAprobador,
    ):
        await db.execute(delete(model))
    await db.flush()


async def _seed_catalogo(db):
    uid = uuid.uuid4().hex[:6].upper()
    area_id = int(uid, 16) % 900000 + 100000
    area = Area(area_id=area_id, descripcion="Extrusión", estatus_id=1)
    sub = Subarea(
        subarea_id=area_id + 1, descripcion="Línea 1", area_id=area_id, estatus_id=1
    )
    cc = CentroCosto(
        centrocosto_id=area_id + 2, codigo=f"CC-{uid}", descripcion="Centro", activo=True
    )
    motivo = HorasExtraMotivo(codigo=f"MOT-{uid}", descripcion="Urgencia", activo=True)
    db.add_all([area, sub, cc, motivo])
    await db.flush()
    return area, sub, cc, motivo


async def _registrar_aprobador(db, empleado, tipo: str):
    db.add(HorasExtraAprobador(empleado_id=empleado.id, tipo=tipo, activo=True))
    await db.flush()


async def _crear_solicitud_via_api(client, db, registrante, area, sub, cc):
    operativo = await make_empleado(
        db,
        rol="empleado",
        email=f"op_{uuid.uuid4().hex[:6]}@leoni.test",
        no_empleado=f"OP-{uuid.uuid4().hex[:5]}",
        nombre="Operativo",
        lider_id=registrante.empleado_id,
    )
    operativo.area_id = area.area_id
    operativo.subarea_id = sub.subarea_id
    operativo.centrocosto_id = cc.centrocosto_id
    await db.flush()

    headers = await auth_headers(client, registrante)
    payload = {
        "semana": 24,
        "tipo": "planeado",
        "motivo": "Cobertura",
        "empleados": [
            {
                "empleado_id": operativo.id,
                "lunes": 3,
                "martes": 0,
                "miercoles": 0,
                "jueves": 0,
                "viernes": 0,
                "sabado": 0,
                "domingo": 0,
            }
        ],
    }
    resp = await client.post(
        "/api/v1/horas-extra/solicitudes", headers=headers, json=payload
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest_asyncio.fixture
async def ciclo(db, client):
    """Configura aprobadores y crea una solicitud con sus firmas pendientes."""
    await _reset_horas_extra(db)
    area, sub, cc, motivo = await _seed_catalogo(db)
    registrante = await make_empleado(
        db, rol="supervisor", nombre="Reg", puede_registrar_horas_extra=True
    )
    gerente = await make_empleado(db, rol="gerente", nombre="Gerente Regional")
    director = await make_empleado(db, rol="director", nombre="Director Planta")
    await _registrar_aprobador(db, gerente, "gerente_regional")
    await _registrar_aprobador(db, director, "director")

    solicitud_id = await _crear_solicitud_via_api(client, db, registrante, area, sub, cc)
    return {
        "solicitud_id": solicitud_id,
        "gerente": gerente,
        "director": director,
        "registrante": registrante,
    }


async def _firmas(db, solicitud_id):
    from sqlalchemy import select

    result = await db.execute(
        select(HorasExtraAprobacion).where(
            HorasExtraAprobacion.solicitud_id == solicitud_id
        )
    )
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_crear_genera_firmas_pendientes(ciclo, db):
    firmas = await _firmas(db, ciclo["solicitud_id"])
    tipos = {f.tipo_firma: f.estado for f in firmas}
    assert tipos == {"gerente_regional": "pendiente", "director_planta": "pendiente"}


@pytest.mark.asyncio
async def test_flujo_completo_aprobado(ciclo, client):
    sid = ciclo["solicitud_id"]

    gh = await auth_headers(client, ciclo["gerente"])
    r1 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh, json={})
    assert r1.status_code == 200, r1.text
    assert r1.json()["estado"] == "aprobado_parcial"
    assert r1.json()["listo_para_nomina"] is False

    dh = await auth_headers(client, ciclo["director"])
    r2 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=dh, json={})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["estado"] == "aprobado"
    assert body["listo_para_nomina"] is True
    assert body["faltantes"] == []


@pytest.mark.asyncio
async def test_solo_gerente_no_es_aprobado(ciclo, client):
    sid = ciclo["solicitud_id"]
    gh = await auth_headers(client, ciclo["gerente"])
    r = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh, json={})
    assert r.status_code == 200
    assert r.json()["estado"] == "aprobado_parcial"
    assert "Director" in r.json()["faltantes"]


@pytest.mark.asyncio
async def test_solo_director_no_es_aprobado(ciclo, client):
    sid = ciclo["solicitud_id"]
    dh = await auth_headers(client, ciclo["director"])
    r = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=dh, json={})
    assert r.status_code == 200
    assert r.json()["estado"] == "aprobado_parcial"
    assert "Gerente regional" in r.json()["faltantes"]


@pytest.mark.asyncio
async def test_rechazo_gerente_cancela(ciclo, client):
    sid = ciclo["solicitud_id"]
    gh = await auth_headers(client, ciclo["gerente"])
    r = await client.post(
        f"{NOMINAS}/horas-extra/{sid}/rechazar",
        headers=gh,
        json={"comentario": "Datos incorrectos"},
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "rechazado"
    assert r.json()["comentario_rechazo"] == "Datos incorrectos"

    # Tras rechazo (terminal), el director ya no puede aprobar.
    dh = await auth_headers(client, ciclo["director"])
    r2 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=dh, json={})
    assert r2.status_code == 422


@pytest.mark.asyncio
async def test_rechazo_requiere_comentario(ciclo, client):
    sid = ciclo["solicitud_id"]
    gh = await auth_headers(client, ciclo["gerente"])
    r = await client.post(
        f"{NOMINAS}/horas-extra/{sid}/rechazar", headers=gh, json={"comentario": ""}
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_usuario_no_asignado_no_puede_aprobar(ciclo, client, db):
    sid = ciclo["solicitud_id"]
    ajeno = await make_empleado(db, rol="gerente", nombre="Gerente Ajeno")
    h = await auth_headers(client, ajeno)
    r = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=h, json={})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_no_doble_aprobacion_mismo_tipo(ciclo, client, db):
    sid = ciclo["solicitud_id"]
    gh = await auth_headers(client, ciclo["gerente"])
    r1 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh, json={})
    assert r1.status_code == 200

    # Otro gerente regional intenta firmar la misma ranura ya resuelta.
    gerente2 = await make_empleado(db, rol="gerente", nombre="Gerente Regional 2")
    await _registrar_aprobador(db, gerente2, "gerente_regional")
    gh2 = await auth_headers(client, gerente2)
    r2 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh2, json={})
    assert r2.status_code == 422


@pytest.mark.asyncio
async def test_basta_un_gerente_regional(ciclo, client, db):
    """Con varios gerentes regionales, uno aprueba y el director cierra el ciclo."""
    sid = ciclo["solicitud_id"]
    gerente2 = await make_empleado(db, rol="gerente", nombre="Gerente Regional 2")
    await _registrar_aprobador(db, gerente2, "gerente_regional")

    gh2 = await auth_headers(client, gerente2)
    r1 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh2, json={})
    assert r1.status_code == 200
    assert r1.json()["estado"] == "aprobado_parcial"

    dh = await auth_headers(client, ciclo["director"])
    r2 = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=dh, json={})
    assert r2.json()["estado"] == "aprobado"


@pytest.mark.asyncio
async def test_pendientes_visibles_solo_para_aprobador(ciclo, client, db):
    sid = ciclo["solicitud_id"]

    gh = await auth_headers(client, ciclo["gerente"])
    pend = await client.get(
        f"{NOMINAS}/horas-extra/aprobaciones/pendientes", headers=gh
    )
    assert pend.status_code == 200
    body = pend.json()
    assert body["total"] == 1
    assert body["items"][0]["solicitud_id"] == sid
    assert body["items"][0]["mi_tipo_firma"] == "gerente_regional"

    # Un usuario sin designación no ve pendientes.
    ajeno = await make_empleado(db, rol="gerente", nombre="Ajeno")
    h = await auth_headers(client, ajeno)
    pend2 = await client.get(
        f"{NOMINAS}/horas-extra/aprobaciones/pendientes", headers=h
    )
    assert pend2.status_code == 200
    assert pend2.json()["total"] == 0


@pytest.mark.asyncio
async def test_estado_e_historial_para_rh(ciclo, client, db):
    sid = ciclo["solicitud_id"]
    rh = await make_empleado(db, rol="rh", nombre="RH")
    rhh = await auth_headers(client, rh)

    estado = await client.get(f"{NOMINAS}/horas-extra/{sid}/estado", headers=rhh)
    assert estado.status_code == 200
    body = estado.json()
    assert body["estado"] == "pendiente"
    assert len(body["firmas"]) == 2
    assert set(body["faltantes"]) == {"Gerente regional", "Director"}

    # Gerente aprueba; historial refleja la firma.
    gh = await auth_headers(client, ciclo["gerente"])
    await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=gh, json={})

    hist = await client.get(f"{NOMINAS}/horas-extra/{sid}/historial", headers=rhh)
    assert hist.status_code == 200
    firmas = {f["tipo_firma"]: f["estado"] for f in hist.json()["firmas"]}
    assert firmas["gerente_regional"] == "aprobado"
    assert firmas["director_planta"] == "pendiente"


@pytest.mark.asyncio
async def test_aprobar_solicitud_inexistente(ciclo, client):
    gh = await auth_headers(client, ciclo["gerente"])
    r = await client.post(f"{NOMINAS}/horas-extra/999999/aprobar", headers=gh, json={})
    assert r.status_code == 404


def _decode_jwt_payload(token: str) -> dict:
    import base64
    import json

    seg = token.split(".")[1]
    seg += "=" * (-len(seg) % 4)
    return json.loads(base64.urlsafe_b64decode(seg))


@pytest.mark.asyncio
async def test_aprobador_es_por_designacion_no_por_rol(ciclo, client, db):
    """Un empleado (rol base) designado por RH como aprobador puede aprobar."""
    sid = ciclo["solicitud_id"]
    # Empleado con rol base, designado como gerente regional por RH.
    aprobador_emp = await make_empleado(db, rol="empleado", nombre="Aprobador Empleado")
    await _registrar_aprobador(db, aprobador_emp, "gerente_regional")

    # El JWT debe portar el claim he_aprobador para que el frontend muestre la vista.
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": aprobador_emp.email, "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    assert _decode_jwt_payload(login.json()["access_token"]).get("he_aprobador") is True

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    pend = await client.get(
        f"{NOMINAS}/horas-extra/aprobaciones/pendientes", headers=headers
    )
    assert pend.json()["total"] == 1

    r = await client.post(f"{NOMINAS}/horas-extra/{sid}/aprobar", headers=headers, json={})
    assert r.status_code == 200
    assert r.json()["estado"] == "aprobado_parcial"


@pytest.mark.asyncio
async def test_no_aprobador_sin_claim(client, db):
    """Un empleado sin designación no recibe el claim he_aprobador."""
    emp = await make_empleado(db, rol="gerente", nombre="Gerente Normal")
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": emp.email, "password": "Passw0rd!Seguro"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    assert "he_aprobador" not in _decode_jwt_payload(login.json()["access_token"])
