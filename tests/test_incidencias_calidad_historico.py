"""Tests de listado de incidencias desde calidad_historico (mock de bono)."""

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.incidencias import IncidenciaResponse, IncidenciasListPageResponse
from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)
from app.services.incidencia_fuentes.mapper import synthetic_incidencia_id
from tests.conftest import auth_headers


def _sample_page() -> IncidenciasListPageResponse:
    calidad_id = synthetic_incidencia_id(ORIGEN_CALIDAD_HISTORICO, 7)
    return IncidenciasListPageResponse(
        items=[
            IncidenciaResponse(
                id=calidad_id,
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
async def test_list_incidencias_unificadas_calidad_y_seguridad(client: AsyncClient, empleado_rh):
    """GET /incidencias expone filas de calidad_historico y seguridad_historico."""
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
    assert item["origen"] == ORIGEN_CALIDAD_HISTORICO
    assert item["origen_id"] == 7
    assert item["id"] == synthetic_incidencia_id(ORIGEN_CALIDAD_HISTORICO, 7)


@pytest.mark.asyncio
async def test_list_incidencias_respuesta_seguridad(client: AsyncClient, empleado_rh):
    seg_id = synthetic_incidencia_id("seguridad_historico", 3)
    page = IncidenciasListPageResponse(
        items=[
            IncidenciaResponse(
                id=seg_id,
                empleado_id=1002,
                tipo=TIPO_INCIDENCIA_SEGURIDAD,
                tipo_incidencia=TIPO_INCIDENCIA_SEGURIDAD,
                subtipo="EPP",
                no_empleado="E-1002",
                nombre="LOPEZ, ANA",
                fecha=date(2026, 2, 1),
                categoria="EPP",
                detalle="Sin casco",
                area="Planta",
                subarea="Línea 2",
                origen="seguridad_historico",
                origen_id=3,
                created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
                updated_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
            )
        ],
        total=1,
        page=1,
        page_size=10,
        resumen={"abiertas": 1, "en_investigacion": 0, "resueltas": 0, "criticas": 0},
    )
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.list_incidencias_paginated",
        new_callable=AsyncMock,
        return_value=page,
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias", headers=headers)
    assert r.status_code == 200, r.text
    item = r.json()["items"][0]
    assert item["tipo_incidencia"] == TIPO_INCIDENCIA_SEGURIDAD
    assert item["origen"] == "seguridad_historico"


@pytest.mark.asyncio
async def test_tipos_registrados_calidad_y_seguridad(client: AsyncClient, empleado_rh):
    with patch(
        "app.services.incidencia_service.IncidenciaFuentesService.list_tipos_registrados",
        new_callable=AsyncMock,
        return_value=["Calidad", "Seguridad"],
    ):
        headers = await auth_headers(client, empleado_rh)
        r = await client.get("/api/v1/incidencias/tipos", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["items"] == ["Calidad", "Seguridad"]
