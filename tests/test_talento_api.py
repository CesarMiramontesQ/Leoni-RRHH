"""Tests HTTP del router del Dashboard de Talento."""
from unittest.mock import AsyncMock, patch

import pytest

from app.services.talento_service import (
    AreaPolivalencia,
    BloqueDesempeno,
    BloquePolivalencia,
    OrgPolivalencia,
)
from tests.conftest import auth_headers, make_empleado

BASE = "/api/v1/talento"


async def _rh(db, email: str):
    return await make_empleado(
        db, rol="rh", email=email,
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )


@pytest.mark.asyncio
async def test_polivalencia_ok(client, db):
    rh = await _rh(db, "tal_api_pol@leoni.test")
    headers = await auth_headers(client, rh)
    bloque = BloquePolivalencia(
        disponible=True,
        org=OrgPolivalencia(70.0, 60.0, 4, 100, "ambar"),
        areas=[AreaPolivalencia(1, "Arneses A", 40, 70.0, 60.0, 2, "ambar")],
    )
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_polivalencia",
        AsyncMock(return_value=bloque),
    ):
        resp = await client.get(f"{BASE}/polivalencia", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["org"]["pol_pct"] == 70.0
    assert body["areas"][0]["area_nombre"] == "Arneses A"


@pytest.mark.asyncio
async def test_desempeno_sin_ciclo_devuelve_200_no_disponible(client, db):
    rh = await _rh(db, "tal_api_sinciclo@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_desempeno",
        AsyncMock(return_value=BloqueDesempeno(disponible=False, motivo="sin_ciclo")),
    ):
        resp = await client.get(f"{BASE}/desempeno", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["disponible"] is False and body["motivo"] == "sin_ciclo"


@pytest.mark.asyncio
async def test_objetivo_caido_no_afecta_a_los_demas_bloques(client, db):
    """El bloque externo vive en su propia ruta: si DATOS_ANALISIS falla, solo
    esa llamada se cae y las otras cuatro siguen sirviendo."""
    rh = await _rh(db, "tal_api_obj@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_objetivo",
        AsyncMock(side_effect=RuntimeError("DATOS_ANALISIS caido")),
    ), patch(
        "app.api.v1.talento.router.TalentoService.bloque_polivalencia",
        AsyncMock(return_value=BloquePolivalencia(disponible=True, org=None, areas=[])),
    ):
        try:
            objetivo = await client.get(f"{BASE}/objetivo", headers=headers)
            # Segun la config del transporte de test, la excepcion puede
            # propagarse o convertirse en 500. Ambas son "el bloque se cayo".
            assert objetivo.status_code >= 500
        except RuntimeError:
            pass

        resp = await client.get(f"{BASE}/polivalencia", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sin_modulo_403(client, db):
    emp = await make_empleado(db, rol="empleado", email="tal_api_emp@leoni.test")
    headers = await auth_headers(client, emp)
    for ruta in ("polivalencia", "desempeno", "capacitacion", "pdi", "objetivo"):
        resp = await client.get(f"{BASE}/{ruta}", headers=headers)
        assert resp.status_code == 403, f"{ruta}: {resp.text}"


@pytest.mark.asyncio
async def test_detalle_area_fuera_de_scope_403(client, db):
    from app.core.exceptions import ForbiddenError

    rh = await _rh(db, "tal_api_det@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.detalle_area",
        AsyncMock(side_effect=ForbiddenError(detail="Area fuera de tu alcance")),
    ):
        resp = await client.get(f"{BASE}/areas/9/detalle", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_coherencia_con_operaciones(client, db):
    """El pol_area_pct del dashboard es el MISMO numero que reporta Operaciones:
    ambos salen de `listar_areas_con_scope`. Si esto se rompe, alguien duplico
    el calculo."""
    from app.services.operaciones_service import AreaResumen

    rh = await make_empleado(
        db, rol="rh", email="tal_api_coh@leoni.test",
        modulos_rh={"dashboard-talento": True, "operaciones": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    areas = [AreaResumen(1, "Arneses A", 73.5, 61.0, 2, 40)]
    with patch(
        "app.services.operaciones_service.OperacionesService.listar_areas_con_scope",
        AsyncMock(return_value=areas),
    ):
        dash = await client.get(f"{BASE}/polivalencia", headers=headers)
        oper = await client.get("/api/v1/operaciones/areas", headers=headers)

    assert dash.status_code == 200 and oper.status_code == 200
    assert dash.json()["areas"][0]["pol_pct"] == oper.json()[0]["pol_area_pct"] == 73.5
