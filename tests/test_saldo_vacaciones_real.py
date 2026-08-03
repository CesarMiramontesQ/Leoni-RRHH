"""Tests del saldo real de vacaciones (SQL Server datos-analisis, función GET_SALDOS_VACACION).

La BD externa no existe en el entorno de tests: se mockea `obtener_saldo_gozo_tress` (el
helper que consulta datos-analisis) para probar el wiring del endpoint sin tocar SQL Server.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_vacaciones_repository import load_saldo_vacaciones_sql
from tests.conftest import auth_headers, make_empleado


def test_sql_saldo_tiene_un_solo_bind_cb_codigo():
    """Regresión: un token ``:x`` dentro de un comentario del .sql también lo toma
    SQLAlchemy como bind param, provocando 'contains 1 parameter markers, but 2 supplied'.
    El SQL debe exponer exactamente el bind ``cb_codigo``."""
    parsed = text(load_saldo_vacaciones_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo"}


@pytest.fixture
def mock_saldo_tress(monkeypatch):
    """Fija el saldo TRESS que devuelve `obtener_saldo_gozo_tress`."""

    def _apply(valor):
        async def _fake(no_empleado):  # noqa: ANN001
            return valor

        monkeypatch.setattr(
            "app.services.vacaciones_service.obtener_saldo_gozo_tress", _fake
        )

    return _apply


@pytest.mark.asyncio
async def test_saldo_real_happy_path(client: AsyncClient, db, mock_saldo_tress):
    mock_saldo_tress(15.5)
    rh = await make_empleado(db, rol="rh", email="saldo-rh@test")
    emp = await make_empleado(db, rol="empleado", email="saldo-emp@test")
    headers = await auth_headers(client, rh)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["empleado_id"] == emp.id
    assert body["no_empleado"] == emp.no_empleado
    assert body["saldo_gozo_total"] == 15.5


@pytest.mark.asyncio
async def test_saldo_real_sin_periodos_devuelve_cero(client: AsyncClient, db, mock_saldo_tress):
    # ISNULL(SUM,0) en el SQL => un empleado sin periodos da 0 (no None).
    mock_saldo_tress(0.0)
    rh = await make_empleado(db, rol="rh", email="saldo-cero-rh@test")
    emp = await make_empleado(db, rol="empleado", email="saldo-cero-emp@test")
    headers = await auth_headers(client, rh)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["saldo_gozo_total"] == 0.0


@pytest.mark.asyncio
async def test_saldo_real_empleado_inexistente_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="saldo-404-rh@test")
    headers = await auth_headers(client, rh)

    res = await client.get(
        "/api/v1/empleados/99999999/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_saldo_real_sin_permiso_403(client: AsyncClient, db):
    emp_a = await make_empleado(db, rol="empleado", email="saldo-a@test")
    emp_b = await make_empleado(db, rol="empleado", email="saldo-b@test")
    headers = await auth_headers(client, emp_a)

    res = await client.get(
        f"/api/v1/empleados/{emp_b.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 403
