"""El listado y las estadísticas de incidencias ya no dependen de datos-analisis.

Antes, un fallo de TRESS (SQL Server) al leer el listado/estadísticas se traducía en un
503 cuyo `detail` no podía filtrar trazas de pyodbc (ver historial de este archivo). Con
la caché en Bono (`levelup_incidencias_tress`, tarea de "cache de incidencias TRESS")
esos dos endpoints ya no abren datos-analisis, así que un fallo ahí es indiferente para
ellos: siguen respondiendo 200. Este archivo ahora es el regression-guard de eso.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import OperationalError

from tests.conftest import auth_headers, make_empleado

# Reproduce lo que devuelve el driver cuando TRESS no responde.
_ERROR_ODBC = OperationalError(
    "SELECT 1",
    {},
    Exception(
        "('HYT00', '[HYT00] [Microsoft][ODBC Driver 18 for SQL Server]"
        "Login timeout expired (0) (SQLDriverConnect)')"
    ),
)


def _sabotear_datos_analisis(monkeypatch):
    """Si algo intentara abrir datos-analisis, debe explotar con el error de ODBC.

    Parcheado sobre la clase en su módulo de origen: el servicio ya no la importa, y el
    parche al atributo de clase sigue alcanzando a cualquier módulo que la use.
    """

    def _boom():
        raise _ERROR_ODBC

    monkeypatch.setattr(
        "app.integrations.datos_analisis_db.DatosAnalisisReadClient.create_read_engine",
        _boom,
    )


@pytest.mark.asyncio
async def test_listado_no_se_ve_afectado_por_datos_analisis_caido(
    client: AsyncClient, db, monkeypatch
):
    rh = await make_empleado(db, rol="rh", nombre="RH Err", no_empleado=80001)
    headers = await auth_headers(client, rh)
    _sabotear_datos_analisis(monkeypatch)

    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 0


@pytest.mark.asyncio
async def test_estadisticas_no_se_ven_afectadas_por_datos_analisis_caido(
    client: AsyncClient, db, monkeypatch
):
    """Este es el que se veía en el dashboard de RH, dos veces seguidas."""
    rh = await make_empleado(db, rol="rh", nombre="RH Err2", no_empleado=80002)
    headers = await auth_headers(client, rh)
    _sabotear_datos_analisis(monkeypatch)

    res = await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)
    assert res.status_code == 200
    assert res.json()["total_eventos"] == 0
