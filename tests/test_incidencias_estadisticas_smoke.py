"""Smoke: GET /api/v1/incidencias/estadisticas (SQLite en tests)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_incidencia


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
