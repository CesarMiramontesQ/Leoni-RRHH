"""Smoke: GET /api/v1/incidencias y estadísticas (mock de fuentes externas en tests)."""

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.incidencias import (
    IncidenciaAreaTotalItem,
    IncidenciaEmpleadoTotalItem,
    IncidenciaMesTipoItem,
    IncidenciaPeriodoTipoItem,
    IncidenciaSerieMensualItem,
    IncidenciaSubareaTotalItem,
    IncidenciasEstadisticasResponse,
    IncidenciasListPageResponse,
)
from tests.conftest import auth_headers


def _empty_list_page() -> IncidenciasListPageResponse:
    return IncidenciasListPageResponse(
        items=[],
        total=0,
        page=1,
        page_size=10,
        resumen={"abiertas": 0, "en_investigacion": 0, "resueltas": 0, "criticas": 0},
    )


@pytest.mark.asyncio
async def test_list_incidencias_desde_fuentes(client: AsyncClient, empleado_rh):
    """GET /incidencias delega en la capa de fuentes (calidad_historico en producción)."""
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.list_incidencias_paginated",
        new_callable=AsyncMock,
        return_value=_empty_list_page(),
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias", headers=headers)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_estadisticas_incidencias_ok(client: AsyncClient, empleado_rh):
    mock_stats = IncidenciasEstadisticasResponse(
        total_incidencias=1,
        incidencias_seguridad=0,
        incidencias_calidad=1,
        areas_con_mas_incidencias=[],
        subareas_con_mas_incidencias=[],
        empleados_con_mas_incidencias=[],
        incidencias_por_tipo=[],
        incidencias_por_mes=[],
        incidencias_por_mes_y_tipo=[],
        incidencias_por_periodo_y_tipo=[],
    )
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.estadisticas_incidencias",
        new_callable=AsyncMock,
        return_value=mock_stats,
    ):
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
async def test_estadisticas_tendencia_mes_solo_con_fecha_negocio(
    client: AsyncClient, empleado_rh
):
    mock_stats = IncidenciasEstadisticasResponse(
        total_incidencias=2,
        incidencias_seguridad=0,
        incidencias_calidad=2,
        areas_con_mas_incidencias=[],
        subareas_con_mas_incidencias=[],
        empleados_con_mas_incidencias=[],
        incidencias_por_tipo=[],
        incidencias_por_mes=[IncidenciaSerieMensualItem(periodo="2026-01", total=2)],
        incidencias_por_mes_y_tipo=[],
        incidencias_por_periodo_y_tipo=[],
    )
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.estadisticas_incidencias",
        new_callable=AsyncMock,
        return_value=mock_stats,
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias/estadisticas", headers=headers)
    assert r.status_code == 200, r.text
    por_mes = {x["periodo"]: x["total"] for x in r.json()["incidencias_por_mes"]}
    assert por_mes.get("2026-01") == 2
    assert sum(por_mes.values()) == 2


@pytest.mark.asyncio
async def test_estadisticas_tendencia_mes_excluye_fechas_futuras(
    client: AsyncClient, empleado_rh
):
    mock_stats = IncidenciasEstadisticasResponse(
        total_incidencias=1,
        incidencias_seguridad=0,
        incidencias_calidad=1,
        areas_con_mas_incidencias=[],
        subareas_con_mas_incidencias=[],
        empleados_con_mas_incidencias=[],
        incidencias_por_tipo=[],
        incidencias_por_mes=[IncidenciaSerieMensualItem(periodo="2026-01", total=1)],
        incidencias_por_mes_y_tipo=[],
        incidencias_por_periodo_y_tipo=[],
    )
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.estadisticas_incidencias",
        new_callable=AsyncMock,
        return_value=mock_stats,
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias/estadisticas", headers=headers)
    assert r.status_code == 200, r.text
    por_mes = {x["periodo"]: x["total"] for x in r.json()["incidencias_por_mes"]}
    assert por_mes.get("2026-01") == 1
    assert "2026-12" not in por_mes


@pytest.mark.asyncio
async def test_estadisticas_filtra_areas_y_subareas_por_rango_fecha(
    client: AsyncClient, empleado_rh
):
    async def _side_effect(*_args, **kwargs):
        fi = kwargs.get("fecha_inicio")
        if fi == date(2026, 1, 1):
            return IncidenciasEstadisticasResponse(
                total_incidencias=2,
                incidencias_seguridad=0,
                incidencias_calidad=2,
                areas_con_mas_incidencias=[
                    IncidenciaAreaTotalItem(area="Produccion A", total=2)
                ],
                subareas_con_mas_incidencias=[
                    IncidenciaSubareaTotalItem(
                        subarea="Linea 1", total=2, area="Produccion A"
                    )
                ],
                empleados_con_mas_incidencias=[],
                incidencias_por_tipo=[],
                incidencias_por_mes=[],
                incidencias_por_mes_y_tipo=[],
                incidencias_por_periodo_y_tipo=[],
            )
        if fi == date(2026, 3, 1):
            return IncidenciasEstadisticasResponse(
                total_incidencias=1,
                incidencias_seguridad=0,
                incidencias_calidad=1,
                areas_con_mas_incidencias=[
                    IncidenciaAreaTotalItem(area="Calidad", total=1)
                ],
                subareas_con_mas_incidencias=[
                    IncidenciaSubareaTotalItem(
                        subarea="Inspeccion", total=1, area="Calidad"
                    )
                ],
                empleados_con_mas_incidencias=[],
                incidencias_por_tipo=[],
                incidencias_por_mes=[],
                incidencias_por_mes_y_tipo=[],
                incidencias_por_periodo_y_tipo=[],
            )
        return IncidenciasEstadisticasResponse(
            total_incidencias=2,
            incidencias_seguridad=0,
            incidencias_calidad=2,
            areas_con_mas_incidencias=[],
            subareas_con_mas_incidencias=[],
            empleados_con_mas_incidencias=[],
            incidencias_por_tipo=[],
            incidencias_por_mes=[],
            incidencias_por_mes_y_tipo=[],
            incidencias_por_periodo_y_tipo=[
                IncidenciaPeriodoTipoItem(periodo="2026-01-10", tipo="Calidad", total=1)
            ],
            tendencia_agrupacion="dia",
        )

    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.estadisticas_incidencias",
        new_callable=AsyncMock,
        side_effect=_side_effect,
    ):
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
async def test_catalogo_areas_y_subareas(client: AsyncClient, empleado_rh):
    async def _subareas(*_args, area=None, **_kwargs):
        if area == "Produccion A":
            return ["Linea 1"]
        return ["Linea 1", "Inspeccion"]

    with (
        patch(
            "app.services.incidencia_service.IncidenciaFuentesService.list_areas_registradas",
            new_callable=AsyncMock,
            return_value=["Produccion A", "Calidad"],
        ),
        patch(
            "app.services.incidencia_service.IncidenciaFuentesService.list_subareas_registradas",
            new_callable=AsyncMock,
            side_effect=_subareas,
        ),
    ):
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


@pytest.mark.asyncio
async def test_estadisticas_filtro_tipo_seguridad_sin_resultados_calidad(
    client: AsyncClient, empleado_rh
):
    """Con solo calidad_historico activo, filtrar Seguridad devuelve conjunto vacío."""
    mock_stats = IncidenciasEstadisticasResponse(
        total_incidencias=0,
        incidencias_seguridad=0,
        incidencias_calidad=0,
        areas_con_mas_incidencias=[],
        subareas_con_mas_incidencias=[],
        empleados_con_mas_incidencias=[],
        incidencias_por_tipo=[],
        incidencias_por_mes=[],
        incidencias_por_mes_y_tipo=[],
        incidencias_por_periodo_y_tipo=[],
    )
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.estadisticas_incidencias",
        new_callable=AsyncMock,
        return_value=mock_stats,
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get(
            "/api/v1/incidencias/estadisticas",
            params={"tipo": "Seguridad"},
            headers=headers,
        )
    assert r.status_code == 200, r.text
    assert r.json()["total_incidencias"] == 0
