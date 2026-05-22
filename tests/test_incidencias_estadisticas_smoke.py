"""Smoke: GET /api/v1/incidencias/estadisticas (SQLite en tests)."""

from datetime import date

import pytest
from httpx import AsyncClient

from app.models.incidencias import Incidencia
from tests.conftest import auth_headers, make_incidencia


@pytest.mark.asyncio
async def test_list_incidencias_desde_tabla_interna(client: AsyncClient, db, empleado_rh):
    """GET /incidencias debe leer solo filas de la tabla local `incidencias`."""
    inc = Incidencia(
        tipo="tardanza_interna",
        empleado_id=empleado_rh.id,
        area="RH Test",
    )
    db.add(inc)
    await db.flush()
    headers = await auth_headers(client, empleado_rh)
    r = await client.get("/api/v1/incidencias", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    ids = {item["id"] for item in data["items"]}
    assert inc.id in ids
    assert all(item["tipo"] == "tardanza_interna" for item in data["items"] if item["id"] == inc.id)


@pytest.mark.asyncio
async def test_estadisticas_incidencias_ok(client: AsyncClient, db, empleado_rh):
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="tardanza")
    headers = await auth_headers(client, empleado_rh)
    r = await client.get("/api/v1/incidencias/estadisticas", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total_incidencias" in data
    assert "incidencias_seguridad" in data
    assert "areas_con_mas_incidencias" in data
    assert "incidencias_por_mes" in data
    assert isinstance(data["incidencias_por_mes"], list)
    assert "incidencias_por_mes_y_tipo" in data
    assert isinstance(data["incidencias_por_mes_y_tipo"], list)
    assert "incidencias_por_periodo_y_tipo" in data


@pytest.mark.asyncio
async def test_estadisticas_filtra_areas_y_subareas_por_rango_fecha(
    client: AsyncClient, db, empleado_rh
):
    """Top áreas/subáreas deben respetar fecha_inicio y fecha_fin."""
    db.add_all(
        [
            Incidencia(
                tipo="tardanza",
                empleado_id=empleado_rh.id,
                fecha=date(2026, 1, 10),
                area="Produccion A",
                subarea="Linea 1",
            ),
            Incidencia(
                tipo="tardanza",
                empleado_id=empleado_rh.id,
                fecha=date(2026, 1, 15),
                area="Produccion A",
                subarea="Linea 1",
            ),
            Incidencia(
                tipo="tardanza",
                empleado_id=empleado_rh.id,
                fecha=date(2026, 3, 1),
                area="Calidad",
                subarea="Inspeccion",
            ),
        ]
    )
    await db.flush()
    headers = await auth_headers(client, empleado_rh)

    r_enero = await client.get(
        "/api/v1/incidencias/estadisticas",
        params={"fecha_inicio": "2026-01-01", "fecha_fin": "2026-01-31"},
        headers=headers,
    )
    assert r_enero.status_code == 200, r_enero.text
    enero = r_enero.json()
    assert enero["total_incidencias"] == 2
    areas_enero = {x["area"]: x["total"] for x in enero["areas_con_mas_incidencias"]}
    assert areas_enero.get("Produccion A") == 2
    assert "Calidad" not in areas_enero
    subs_enero = {x["subarea"]: x["total"] for x in enero["subareas_con_mas_incidencias"]}
    assert subs_enero.get("Linea 1") == 2
    assert "Inspeccion" not in subs_enero

    r_marzo = await client.get(
        "/api/v1/incidencias/estadisticas",
        params={"fecha_inicio": "2026-03-01", "fecha_fin": "2026-03-31"},
        headers=headers,
    )
    assert r_marzo.status_code == 200, r_marzo.text
    marzo = r_marzo.json()
    assert marzo["total_incidencias"] == 1
    assert marzo["areas_con_mas_incidencias"][0]["area"] == "Calidad"
    assert marzo["subareas_con_mas_incidencias"][0]["subarea"] == "Inspeccion"

    r_dia = await client.get(
        "/api/v1/incidencias/estadisticas",
        params={
            "fecha_inicio": "2026-01-10",
            "fecha_fin": "2026-01-15",
            "tendencia_agrupacion": "dia",
        },
        headers=headers,
    )
    assert r_dia.status_code == 200, r_dia.text
    dia = r_dia.json()
    assert dia["tendencia_agrupacion"] == "dia"
    assert len(dia["incidencias_por_periodo_y_tipo"]) >= 1


@pytest.mark.asyncio
async def test_catalogo_areas_y_subareas(client: AsyncClient, db, empleado_rh):
    db.add_all(
        [
            Incidencia(
                tipo="tardanza",
                empleado_id=empleado_rh.id,
                fecha=date(2026, 2, 1),
                area="Produccion A",
                subarea="Linea 1",
            ),
            Incidencia(
                tipo="tardanza",
                empleado_id=empleado_rh.id,
                fecha=date(2026, 2, 2),
                area="Calidad",
                subarea="Inspeccion",
            ),
        ]
    )
    await db.flush()
    headers = await auth_headers(client, empleado_rh)

    r_areas = await client.get("/api/v1/incidencias/areas", headers=headers)
    assert r_areas.status_code == 200, r_areas.text
    areas = r_areas.json()["items"]
    assert "Produccion A" in areas
    assert "Calidad" in areas

    r_sub_all = await client.get("/api/v1/incidencias/subareas", headers=headers)
    assert r_sub_all.status_code == 200, r_sub_all.text
    subs_all = set(r_sub_all.json()["items"])
    assert "Linea 1" in subs_all
    assert "Inspeccion" in subs_all

    r_sub_area = await client.get(
        "/api/v1/incidencias/subareas",
        params={"area": "Produccion A"},
        headers=headers,
    )
    assert r_sub_area.status_code == 200, r_sub_area.text
    subs_area = r_sub_area.json()["items"]
    assert subs_area == ["Linea 1"]
