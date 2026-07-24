"""Tests HTTP del router de Operaciones (cobertura y polivalencia)."""
from unittest.mock import AsyncMock, patch

import pytest

from app.services.operaciones.types import CoberturaCompetencia
from app.services.operaciones_service import AreaResumen, CoberturaArea, PuestoCobertura
from tests.conftest import auth_headers, make_empleado

BASE = "/api/v1/operaciones"


@pytest.mark.asyncio
async def test_get_areas_ok(client, db):
    rh = await make_empleado(
        db, rol="rh", email="oper_rh1@leoni.test",
        modulos_rh={"operaciones": True}, inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    resumen = AreaResumen(5, "Ensamble", 75.0, 50.0, 1, 3)
    with patch(
        "app.api.v1.operaciones.router.OperacionesService.listar_areas",
        AsyncMock(return_value=[resumen]),
    ):
        resp = await client.get(f"{BASE}/areas", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body[0]["area_id"] == 5 and body[0]["n_criticas"] == 1


@pytest.mark.asyncio
async def test_get_cobertura_shape(client, db):
    rh = await make_empleado(
        db, rol="rh", email="oper_rh2@leoni.test",
        modulos_rh={"operaciones": True}, inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    cob = CoberturaArea(
        resumen=AreaResumen(5, "Ensamble", 75.0, 50.0, 1, 3),
        competencias=[
            CoberturaCompetencia(10, "Crimpado", "Op", 3, 1, 1, 33.3, "rojo", "punto_unico")
        ],
        puestos=[PuestoCobertura(1, "Crimpado", [])],
        criticas=[],
    )
    with patch(
        "app.api.v1.operaciones.router.OperacionesService.cobertura_area",
        AsyncMock(return_value=cob),
    ):
        resp = await client.get(f"{BASE}/areas/5/cobertura", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["resumen"]["pol_area_pct"] == 75.0
    assert body["competencias"][0]["semaforo"] == "rojo"


@pytest.mark.asyncio
async def test_operaciones_sin_permiso_403(client, db):
    emp = await make_empleado(db, rol="empleado", email="oper_emp1@leoni.test")
    headers = await auth_headers(client, emp)
    resp = await client.get(f"{BASE}/areas", headers=headers)
    assert resp.status_code == 403
