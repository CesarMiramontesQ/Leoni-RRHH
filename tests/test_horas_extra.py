"""Listado RH de Horas Extra: solicitudes reales desde BD."""

import uuid
from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient

from app.models.catalogos import Area, Subarea
from app.models.horas_extra import (
    CentroCosto,
    HorasExtraAprobacion,
    HorasExtraMotivo,
    HorasExtraSolicitud,
    HorasExtraSolicitudDetalle,
)
from tests.conftest import auth_headers, make_empleado

LISTADO_URL = "/api/v1/nominas/horas-extra"


async def _seed_catalogo(db):
    uid = uuid.uuid4().hex[:6].upper()
    area_id = int(uid, 16) % 900000 + 100000
    area = Area(area_id=area_id, descripcion="Extrusión", estatus_id=1)
    sub = Subarea(
        subarea_id=area_id + 1, descripcion="Línea 1", area_id=area_id, estatus_id=1
    )
    cc = CentroCosto(
        centrocosto_id=area_id + 2,
        codigo=f"CC-{uid}",
        descripcion="Centro Extrusión",
        activo=True,
    )
    motivo = HorasExtraMotivo(
        codigo=f"MOT-{uid}", descripcion="Cobertura de turno", activo=True
    )
    db.add_all([area, sub, cc, motivo])
    await db.flush()
    return area, sub, cc, motivo


async def _crear_solicitud(
    db,
    *,
    area,
    sub,
    cc,
    motivo,
    registrado_por,
    empleados_horas: list[tuple[int, float]],
    estado: str = "pendiente",
    fecha_solicitud: date = date(2026, 6, 8),
    semana_inicio: date = date(2026, 6, 8),
) -> HorasExtraSolicitud:
    solicitud = HorasExtraSolicitud(
        fecha_solicitud=fecha_solicitud,
        semana_inicio=semana_inicio,
        tipo="planeado",
        area_id=area.area_id,
        subarea_id=sub.subarea_id,
        centrocosto_id=cc.centrocosto_id,
        motivo_id=motivo.id,
        estado=estado,
        registrado_por_id=registrado_por.id,
    )
    db.add(solicitud)
    await db.flush()
    for empleado_id, horas in empleados_horas:
        db.add(
            HorasExtraSolicitudDetalle(
                solicitud_id=solicitud.id,
                empleado_id=empleado_id,
                lunes=horas,
            )
        )
    await db.flush()
    return solicitud


@pytest.mark.asyncio
async def test_horas_extra_lista_solicitudes_reales(
    client: AsyncClient, db, empleado_rh
):
    area, sub, cc, motivo = await _seed_catalogo(db)
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Fernando Aguirre Lozano",
        no_empleado="HE-LIDER",
        puede_registrar_horas_extra=True,
    )
    operativo = await make_empleado(
        db,
        rol="empleado",
        nombre="María López García",
        no_empleado="HE-001",
        lider_id=supervisor.empleado_id,
    )

    aprobador = await make_empleado(
        db, rol="gerente", nombre="Gerente Aprobador", no_empleado="HE-GTE"
    )

    pendiente = await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 4.5)],
        estado="pendiente",
        fecha_solicitud=date(2026, 6, 9),
        semana_inicio=date(2026, 6, 8),
    )
    aprobada = await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 2.0)],
        estado="aprobado",
        fecha_solicitud=date(2026, 6, 2),
        semana_inicio=date(2026, 6, 1),
    )
    db.add(
        HorasExtraAprobacion(
            solicitud_id=aprobada.id,
            tipo_firma="gerente_area",
            aprobador_id=aprobador.id,
            estado="aprobado",
            fecha_aprobacion=datetime(2026, 6, 3, 10, 30, tzinfo=timezone.utc),
        )
    )
    await db.flush()

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(LISTADO_URL, headers=headers)

    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 2
    assert data["tabs"] == {
        "todos": 2,
        "pendientes": 1,
        "aprobados": 1,
        "rechazados": 0,
    }
    assert data["resumen"]["total_horas_extra"] == 6.5
    assert data["resumen"]["colaboradores_con_registro"] == 1
    assert data["resumen"]["solicitudes_total"] == 2
    assert data["resumen"]["solicitudes_pendientes"] == 1
    assert data["resumen"]["solicitudes_aprobadas"] == 1
    assert data["resumen"]["porcentaje_aprobacion"] == 100.0
    assert data["filter_options"]["centros_costo"] == [
        {"id": cc.centrocosto_id, "label": "Centro Extrusión"}
    ]

    # Orden: fecha_solicitud desc → primero la pendiente (9 jun)
    fila_pendiente, fila_aprobada = data["items"]

    assert fila_pendiente["empleado"]["no_empleado"] == "HE-001"
    assert fila_pendiente["empleado"]["nombre"] == "María López García"
    assert fila_pendiente["empleado"]["lider"]["nombre"] == "Fernando Aguirre Lozano"
    sol = fila_pendiente["solicitud"]
    assert sol["solicitud_id"] == pendiente.id
    assert sol["fecha_solicitud"] == "2026-06-09"
    assert sol["semana_inicio"] == "2026-06-08"
    assert sol["semana"] == date(2026, 6, 8).isocalendar()[1]
    assert sol["total_horas"] == 4.5
    assert sol["motivo"] == "Cobertura de turno"
    assert sol["area_descripcion"] == "Extrusión"
    assert sol["centrocosto_descripcion"] == "Centro Extrusión"
    assert sol["estado"] == "pendiente"
    assert sol["registrado_por_nombre"] == "Fernando Aguirre Lozano"
    assert sol["aprobador_nombre"] is None
    assert sol["fecha_aprobacion"] is None

    sol_aprobada = fila_aprobada["solicitud"]
    assert sol_aprobada["solicitud_id"] == aprobada.id
    assert sol_aprobada["estado"] == "aprobado"
    assert sol_aprobada["total_horas"] == 2.0
    assert sol_aprobada["aprobador_nombre"] == "Gerente Aprobador"
    assert sol_aprobada["fecha_aprobacion"] == "2026-06-03"


@pytest.mark.asyncio
async def test_horas_extra_filtra_por_tab_y_centro_costo(
    client: AsyncClient, db, empleado_rh
):
    area, sub, cc, motivo = await _seed_catalogo(db)
    supervisor = await make_empleado(
        db, rol="supervisor", nombre="Sup Filtros", puede_registrar_horas_extra=True
    )
    operativo = await make_empleado(
        db, rol="empleado", nombre="Op Filtros", no_empleado="HE-FIL-01"
    )

    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 3.0)],
        estado="pendiente",
    )
    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 1.0)],
        estado="rechazado",
    )

    headers = await auth_headers(client, empleado_rh)

    pendientes = await client.get(
        LISTADO_URL, headers=headers, params={"tab": "pendientes"}
    )
    assert pendientes.status_code == 200
    body = pendientes.json()
    assert body["total"] == 1
    assert body["items"][0]["solicitud"]["estado"] == "pendiente"
    assert body["tabs"]["todos"] == 2

    otro_cc = await client.get(
        LISTADO_URL, headers=headers, params={"centrocosto_id": cc.centrocosto_id + 999}
    )
    assert otro_cc.status_code == 200
    assert otro_cc.json()["total"] == 0

    por_nombre = await client.get(
        LISTADO_URL, headers=headers, params={"q": "HE-FIL-01"}
    )
    assert por_nombre.status_code == 200
    assert por_nombre.json()["total"] == 2


@pytest.mark.asyncio
async def test_horas_extra_sin_solicitudes_responde_vacio(
    client: AsyncClient, db, empleado_rh
):
    headers = await auth_headers(client, empleado_rh)
    response = await client.get(LISTADO_URL, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["tabs"]["todos"] == 0
    assert data["resumen"]["total_horas_extra"] == 0
    assert data["resumen"]["solicitudes_total"] == 0
    assert data["resumen"]["porcentaje_aprobacion"] == 0.0
    assert data["filter_options"]["centros_costo"] == []
    assert 1 <= data["semana_actual"] <= 53


@pytest.mark.asyncio
async def test_horas_extra_detalle_rh(client: AsyncClient, db, empleado_rh):
    area, sub, cc, motivo = await _seed_catalogo(db)
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Lider Detalle",
        no_empleado="HE-DET-L",
        puede_registrar_horas_extra=True,
    )
    operativo = await make_empleado(
        db,
        rol="empleado",
        nombre="Operativo Detalle",
        no_empleado="HE-DET-001",
        lider_id=supervisor.empleado_id,
    )
    solicitud = await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 3.5)],
        estado="pendiente",
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(f"{LISTADO_URL}/{solicitud.id}", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == solicitud.id
    assert data["estado"] == "pendiente"
    assert data["total_horas_general"] == 3.5
    assert len(data["detalle"]) == 1
    assert data["detalle"][0]["empleado_id"] == operativo.id
    assert data["detalle"][0]["lunes"] == 3.5


@pytest.mark.asyncio
async def test_horas_extra_filtra_por_semana_inicio(client: AsyncClient, db, empleado_rh):
    area, sub, cc, motivo = await _seed_catalogo(db)
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Sup Semana",
        puede_registrar_horas_extra=True,
    )
    operativo = await make_empleado(db, rol="empleado", nombre="Op Semana", lider_id=supervisor.empleado_id)
    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 2.0)],
        semana_inicio=date(2026, 6, 8),
        fecha_solicitud=date(2026, 6, 9),
    )
    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 1.0)],
        semana_inicio=date(2026, 6, 1),
        fecha_solicitud=date(2026, 6, 2),
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(
        LISTADO_URL,
        headers=headers,
        params={"semana_inicio": "2026-06-08"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["solicitud"]["semana_inicio"] == "2026-06-08"


@pytest.mark.asyncio
async def test_horas_extra_filtra_por_fecha_solicitud(client: AsyncClient, db, empleado_rh):
    area, sub, cc, motivo = await _seed_catalogo(db)
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        nombre="Sup Fecha",
        puede_registrar_horas_extra=True,
    )
    operativo = await make_empleado(db, rol="empleado", nombre="Op Fecha", lider_id=supervisor.empleado_id)
    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 2.0)],
        fecha_solicitud=date(2026, 6, 9),
    )
    await _crear_solicitud(
        db,
        area=area,
        sub=sub,
        cc=cc,
        motivo=motivo,
        registrado_por=supervisor,
        empleados_horas=[(operativo.id, 1.0)],
        fecha_solicitud=date(2026, 6, 2),
    )

    headers = await auth_headers(client, empleado_rh)
    response = await client.get(
        LISTADO_URL,
        headers=headers,
        params={"fecha_inicio": "2026-06-08", "fecha_fin": "2026-06-30"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["solicitud"]["fecha_solicitud"] == "2026-06-09"


@pytest.mark.asyncio
async def test_horas_extra_rechaza_empleado(client: AsyncClient, empleado_base):
    headers = await auth_headers(client, empleado_base)
    response = await client.get(LISTADO_URL, headers=headers)
    assert response.status_code == 403
