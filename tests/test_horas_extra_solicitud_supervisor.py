"""Solicitudes de horas extra — acceso y reglas de supervisor."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.catalogos import Area, Subarea
from app.models.horas_extra import (
    CentroCosto,
    HorasExtraMotivo,
    HorasExtraSolicitud,
)
from tests.conftest import auth_headers, make_clasificacion_administrativo, make_empleado


async def _seed_catalogo_horas_extra(db):
    uid = uuid.uuid4().hex[:6].upper()
    area_id = int(uid, 16) % 900000 + 100000
    subarea_id = area_id + 1
    cc_id = area_id + 2
    area = Area(area_id=area_id, descripcion="Extrusión", estatus_id=1)
    sub = Subarea(
        subarea_id=subarea_id, descripcion="Línea 1", area_id=area_id, estatus_id=1
    )
    cc = CentroCosto(
        centrocosto_id=cc_id,
        codigo=f"CC-{uid}",
        descripcion="Centro prueba",
        activo=True,
    )
    motivo = HorasExtraMotivo(
        codigo=f"MOT-{uid}", descripcion="Urgencia producción", activo=True
    )
    db.add_all([area, sub, cc, motivo])
    await db.flush()
    return area, sub, cc, motivo


def _payload_base(empleado_id: int) -> dict:
    return {
        "semana": 24,
        "tipo": "planeado",
        "motivo": "Cobertura turno",
        "empleados": [
            {
                "empleado_id": empleado_id,
                "lunes": 2,
                "martes": 0,
                "miercoles": 0,
                "jueves": 0,
                "viernes": 0,
                "sabado": 0,
                "domingo": 0,
            }
        ],
    }


@pytest.mark.asyncio
async def test_horas_extra_solicitud_rechaza_no_supervisor(
    client: AsyncClient, db, empleado_base
):
    headers = await auth_headers(client, empleado_base)
    response = await client.get("/api/v1/horas-extra/solicitudes", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_horas_extra_solicitud_supervisor_crea_y_lista_solo_propias(
    client: AsyncClient, db, empleado_supervisor
):
    area, sub, cc, motivo = await _seed_catalogo_horas_extra(db)

    operativo = await make_empleado(
        db,
        rol="empleado",
        email="he_op@leoni.test",
        empleado_id=88101,
        no_empleado="HE-OP-01",
        nombre="Operativo Uno",
        lider_id=empleado_supervisor.empleado_id,
    )
    operativo.area_id = area.area_id
    operativo.subarea_id = sub.subarea_id
    operativo.centrocosto_id = cc.centrocosto_id
    await db.flush()

    admin_cl = await make_clasificacion_administrativo(db)
    admin = await make_empleado(
        db,
        rol="empleado",
        email="he_admin@leoni.test",
        empleado_id=88102,
        no_empleado="HE-ADM-01",
        nombre="Admin Uno",
        lider_id=empleado_supervisor.empleado_id,
        clasificacion_id=admin_cl.clasificacion_id,
    )
    admin.area_id = area.area_id
    admin.subarea_id = sub.subarea_id
    admin.centrocosto_id = cc.centrocosto_id
    await db.flush()

    otro_supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="he_sup2@leoni.test",
        empleado_id=88103,
        no_empleado="HE-SUP-02",
        nombre="Supervisor Dos",
    )

    db.add(
        HorasExtraSolicitud(
            fecha_solicitud=date(2026, 6, 1),
            semana_inicio=date(2026, 6, 1),
            tipo="planeado",
            area_id=area.area_id,
            subarea_id=sub.subarea_id,
            centrocosto_id=cc.centrocosto_id,
            motivo_id=motivo.id,
            estado="pendiente",
            registrado_por_id=otro_supervisor.id,
        )
    )
    await db.flush()

    headers = await auth_headers(client, empleado_supervisor)

    opciones = await client.get("/api/v1/horas-extra/solicitudes/opciones", headers=headers)
    assert opciones.status_code == 200
    opciones_body = opciones.json()
    empleados = {e["no_empleado"] for e in opciones_body["empleados"]}
    assert "HE-OP-01" in empleados
    assert "HE-ADM-01" not in empleados
    assert 1 <= opciones_body["semana_actual"] <= 53

    payload = _payload_base(operativo.id)
    crear = await client.post("/api/v1/horas-extra/solicitudes", headers=headers, json=payload)
    assert crear.status_code == 201
    data = crear.json()
    assert data["semana"] == 24
    assert data["total_horas_general"] == 2
    assert data["total_empleados"] == 1
    assert data["estado"] == "pendiente"
    assert data["motivo_descripcion"] == "Cobertura turno"
    assert data["centrocosto_id"] == cc.centrocosto_id
    assert data["area_id"] == area.area_id
    assert len(data["detalle"]) == 1
    assert data["detalle"][0]["total_horas"] == 2

    payload_admin = _payload_base(admin.id)
    rechazo_admin = await client.post(
        "/api/v1/horas-extra/solicitudes", headers=headers, json=payload_admin
    )
    assert rechazo_admin.status_code == 422

    lista = await client.get("/api/v1/horas-extra/solicitudes", headers=headers)
    assert lista.status_code == 200
    body = lista.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["semana"] == 24
    assert body["items"][0]["total_horas_general"] == 2


@pytest.mark.asyncio
async def test_horas_extra_solicitud_crea_centro_costo_si_falta_en_catalogo(
    client: AsyncClient, db, empleado_supervisor
):
    uid = uuid.uuid4().hex[:6].upper()
    area_id = int(uid, 16) % 900000 + 100000
    subarea_id = area_id + 1
    cc_id = area_id + 2
    area = Area(area_id=area_id, descripcion="Ensamble", estatus_id=1)
    sub = Subarea(
        subarea_id=subarea_id, descripcion="Línea 2", area_id=area_id, estatus_id=1
    )
    db.add_all([area, sub])
    await db.flush()

    operativo = await make_empleado(
        db,
        rol="empleado",
        email="he_op_cc@leoni.test",
        empleado_id=88105,
        no_empleado="HE-OP-CC-01",
        nombre="Operativo Centro Costo",
        lider_id=empleado_supervisor.empleado_id,
    )
    operativo.area_id = area.area_id
    operativo.subarea_id = sub.subarea_id
    operativo.centrocosto_id = cc_id
    await db.flush()

    headers = await auth_headers(client, empleado_supervisor)
    crear = await client.post(
        "/api/v1/horas-extra/solicitudes",
        headers=headers,
        json=_payload_base(operativo.id),
    )
    assert crear.status_code == 201
    data = crear.json()
    assert data["centrocosto_id"] == cc_id
    assert data["centrocosto_descripcion"] == f"Centro de costo {cc_id}"


@pytest.mark.asyncio
async def test_horas_extra_solicitud_no_expone_otro_supervisor(
    client: AsyncClient, db, empleado_supervisor
):
    area, sub, cc, motivo = await _seed_catalogo_horas_extra(db)
    otro = await make_empleado(
        db,
        rol="supervisor",
        email="he_sup3@leoni.test",
        empleado_id=88104,
        no_empleado="HE-SUP-03",
        nombre="Supervisor Tres",
    )
    solicitud = HorasExtraSolicitud(
        fecha_solicitud=date(2026, 6, 3),
        semana_inicio=date(2026, 6, 1),
        tipo="espontaneo",
        area_id=area.area_id,
        subarea_id=sub.subarea_id,
        centrocosto_id=cc.centrocosto_id,
        motivo_id=motivo.id,
        estado="pendiente",
        registrado_por_id=otro.id,
    )
    db.add(solicitud)
    await db.flush()

    headers = await auth_headers(client, empleado_supervisor)
    detalle = await client.get(
        f"/api/v1/horas-extra/solicitudes/{solicitud.id}", headers=headers
    )
    assert detalle.status_code == 404
