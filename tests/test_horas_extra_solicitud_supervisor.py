"""Solicitudes de horas extra — acceso y reglas de supervisor."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.catalogos import Area, Subarea
from app.models.horas_extra import (
    CentroCosto,
    Departamento,
    HorasExtraMotivo,
    HorasExtraSolicitud,
)
from tests.conftest import auth_headers, make_clasificacion_administrativo, make_empleado


async def _seed_catalogo_horas_extra(db):
    uid = uuid.uuid4().hex[:6].upper()
    dep = Departamento(codigo=f"DEP-{uid}", nombre="Producción", activo=True)
    db.add(dep)
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
    return dep, area, sub, cc, motivo


def _payload_base(dep, area, sub, cc, motivo, empleado_id: int) -> dict:
    return {
        "fecha_solicitud": "2026-06-10",
        "semana_inicio": "2026-06-08",
        "tipo": "planeado",
        "departamento_id": dep.departamento_id,
        "area_id": area.area_id,
        "subarea_id": sub.subarea_id,
        "centrocosto_id": cc.centrocosto_id,
        "motivo_id": motivo.id,
        "comentarios": "Cobertura turno",
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
    dep, area, sub, cc, motivo = await _seed_catalogo_horas_extra(db)

    operativo = await make_empleado(
        db,
        rol="empleado",
        email="he_op@leoni.test",
        empleado_id=88101,
        no_empleado="HE-OP-01",
        nombre="Operativo Uno",
        lider_id=empleado_supervisor.empleado_id,
    )

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
            departamento_id=dep.departamento_id,
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
    empleados = {e["no_empleado"] for e in opciones.json()["empleados"]}
    assert "HE-OP-01" in empleados
    assert "HE-ADM-01" not in empleados

    payload = _payload_base(dep, area, sub, cc, motivo, operativo.id)
    crear = await client.post("/api/v1/horas-extra/solicitudes", headers=headers, json=payload)
    assert crear.status_code == 201
    data = crear.json()
    assert data["total_horas_general"] == 2
    assert data["total_empleados"] == 1
    assert data["estado"] == "pendiente"
    assert len(data["detalle"]) == 1
    assert data["detalle"][0]["total_horas"] == 2

    payload_admin = _payload_base(dep, area, sub, cc, motivo, admin.id)
    rechazo_admin = await client.post(
        "/api/v1/horas-extra/solicitudes", headers=headers, json=payload_admin
    )
    assert rechazo_admin.status_code == 422

    lista = await client.get("/api/v1/horas-extra/solicitudes", headers=headers)
    assert lista.status_code == 200
    body = lista.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["total_horas_general"] == 2


@pytest.mark.asyncio
async def test_horas_extra_solicitud_no_expone_otro_supervisor(
    client: AsyncClient, db, empleado_supervisor
):
    dep, area, sub, cc, motivo = await _seed_catalogo_horas_extra(db)
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
        departamento_id=dep.departamento_id,
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
