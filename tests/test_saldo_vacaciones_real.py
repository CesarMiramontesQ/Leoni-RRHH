"""Tests del saldo de vacaciones que expone `/empleados/{id}/saldo-vacaciones-real`.

La fuente es `levelup_vacaciones_disponibles` (Bono), la caché que el sync alimenta desde
datos-analisis: los tests siembran la fila real y el endpoint la lee sin mocks, así que
también verifican que no queda ninguna llamada a la BD externa en la ruta de lectura.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_vacaciones_repository import load_saldo_vacaciones_sql
from tests.conftest import auth_headers, make_empleado, make_vacaciones_disponibles


def test_sql_saldo_tiene_un_solo_bind_cb_codigo():
    """Regresión: un token ``:x`` dentro de un comentario del .sql también lo toma
    SQLAlchemy como bind param, provocando 'contains 1 parameter markers, but 2 supplied'.
    El SQL debe exponer exactamente el bind ``cb_codigo``."""
    parsed = text(load_saldo_vacaciones_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo"}


@pytest.mark.asyncio
async def test_saldo_real_happy_path(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="saldo-rh@test")
    emp = await make_empleado(db, rol="empleado", email="saldo-emp@test")
    await make_vacaciones_disponibles(db, no_empleado=emp.no_empleado, dias_disponibles=15.5)
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
async def test_saldo_real_no_consulta_datos_analisis(client: AsyncClient, db, monkeypatch):
    """La lectura sale de Bono: crear un motor a datos-analisis sería un fallo."""

    def _boom():
        raise AssertionError("el saldo no debe consultar datos-analisis")

    monkeypatch.setattr(
        "app.integrations.datos_analisis_db.DatosAnalisisReadClient.create_read_engine",
        staticmethod(_boom),
    )
    emp = await make_empleado(db, rol="empleado", email="saldo-sin-tress@test")
    await make_vacaciones_disponibles(db, no_empleado=emp.no_empleado, dias_disponibles=7.0)
    headers = await auth_headers(client, emp)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["saldo_gozo_total"] == 7.0


@pytest.mark.asyncio
async def test_saldo_real_sin_periodos_devuelve_cero(client: AsyncClient, db):
    # ISNULL(SUM,0) en el SQL => un empleado sin periodos se sincroniza como 0 (no None).
    rh = await make_empleado(db, rol="rh", email="saldo-cero-rh@test")
    emp = await make_empleado(db, rol="empleado", email="saldo-cero-emp@test")
    await make_vacaciones_disponibles(db, no_empleado=emp.no_empleado, dias_disponibles=0.0)
    headers = await auth_headers(client, rh)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["saldo_gozo_total"] == 0.0


@pytest.mark.asyncio
async def test_saldo_real_empleado_sin_sincronizar_503(client: AsyncClient, db):
    """Sin fila en la caché no se inventa un 0: la UI debe pintar «—», no «0 días»."""
    rh = await make_empleado(db, rol="rh", email="saldo-nosync-rh@test")
    emp = await make_empleado(
        db, rol="empleado", email="saldo-nosync-emp@test", saldo_vacaciones=None
    )
    headers = await auth_headers(client, rh)

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/saldo-vacaciones-real",
        headers=headers,
    )
    assert res.status_code == 503


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
