"""Tests de listado de incidencias desde calidad_historico (mock de bono)."""

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.incidencias import IncidenciaResponse, IncidenciasListPageResponse
from app.services.incidencia_fuentes.constants import TIPO_INCIDENCIA_CALIDAD
from tests.conftest import auth_headers


def _sample_page() -> IncidenciasListPageResponse:
    return IncidenciasListPageResponse(
        items=[
            IncidenciaResponse(
                id=7,
                empleado_id=1001,
                tipo=TIPO_INCIDENCIA_CALIDAD,
                tipo_incidencia=TIPO_INCIDENCIA_CALIDAD,
                subtipo="Defecto",
                no_empleado="E-1001",
                nombre="PEREZ, JUAN",
                fecha=date(2026, 2, 1),
                categoria="Defecto",
                detalle="Motivo de prueba",
                area="Producción",
                subarea="Línea 1",
                origen="calidad_historico",
                origen_id=7,
                created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
                updated_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
            )
        ],
        total=1,
        page=1,
        page_size=10,
        resumen={"abiertas": 1, "en_investigacion": 0, "resueltas": 0, "criticas": 0},
    )


@pytest.mark.asyncio
async def test_list_incidencias_desde_calidad_historico(client: AsyncClient, empleado_rh):
    """GET /incidencias debe exponer filas mapeadas desde calidad_historico."""
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.list_incidencias_paginated",
        new_callable=AsyncMock,
        return_value=_sample_page(),
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["tipo_incidencia"] == TIPO_INCIDENCIA_CALIDAD
    assert item["tipo"] == TIPO_INCIDENCIA_CALIDAD
    assert item["origen"] == "calidad_historico"
    assert item["origen_id"] == 7


@pytest.mark.asyncio
async def test_tipos_registrados_solo_calidad(client: AsyncClient, empleado_rh):
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.list_tipos_registrados",
        new_callable=AsyncMock,
        return_value=[TIPO_INCIDENCIA_CALIDAD],
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias/tipos", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["items"] == [TIPO_INCIDENCIA_CALIDAD]
