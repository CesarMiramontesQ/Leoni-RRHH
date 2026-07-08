"""Tests de la fecha de ingreso real en Vista 360 (SQL Server datos-analisis, CB_FEC_ING).

La BD externa no existe en el entorno de tests: se mockea el helper
`_obtener_fecha_ingreso_datos_analisis` para probar el wiring sin tocar SQL Server. Sin mock,
`create_read_engine()` devuelve None (env vacío) y `fecha_ingreso` viaja como null.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_colaborador_repository import load_fecha_ingreso_sql
from tests.conftest import auth_headers, make_empleado


def test_sql_fecha_ingreso_tiene_un_solo_bind_cb_codigo():
    """Regresión: un token ``:x`` en un comentario del .sql también lo toma SQLAlchemy como
    bind. El SQL debe exponer exactamente el bind ``cb_codigo``."""
    parsed = text(load_fecha_ingreso_sql())
    assert set(parsed._bindparams.keys()) == {"cb_codigo"}


@pytest.fixture
def mock_fecha_ingreso(monkeypatch):
    """Fija la fecha que devuelve `_obtener_fecha_ingreso_datos_analisis`."""

    def _apply(valor):
        async def _fake(no_empleado):  # noqa: ANN001
            return valor

        monkeypatch.setattr(
            "app.services.usuario_service._obtener_fecha_ingreso_datos_analisis", _fake
        )

    return _apply


@pytest.mark.asyncio
async def test_vista360_incluye_fecha_ingreso(client: AsyncClient, db, mock_fecha_ingreso):
    mock_fecha_ingreso(date(2019, 3, 15))
    rh = await make_empleado(db, rol="rh", email="fi-rh@test", dias_vacaciones=None)
    emp = await make_empleado(db, rol="empleado", email="fi-emp@test", dias_vacaciones=0)
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)
    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] == "2019-03-15"


@pytest.mark.asyncio
async def test_vista360_fecha_ingreso_null_sin_bd_externa(client: AsyncClient, db):
    # Sin datos-analisis configurada, el helper devuelve None y el endpoint sigue 200.
    rh = await make_empleado(db, rol="rh", email="fi-null-rh@test", dias_vacaciones=None)
    emp = await make_empleado(db, rol="empleado", email="fi-null-emp@test", dias_vacaciones=0)
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)
    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] is None
