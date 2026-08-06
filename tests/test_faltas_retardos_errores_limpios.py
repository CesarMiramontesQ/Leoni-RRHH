"""Los 503 de incidencias no deben filtrar la excepción interna al usuario.

Misma regla que `test_descansos_empleado.py::…_devuelve_503_sin_secretos`: el
detail llega tal cual a la UI, así que no puede llevar trazas de pyodbc, cadenas
de conexión ni URLs de SQLAlchemy. El detalle técnico va al log.
"""

from unittest.mock import AsyncMock, MagicMock, patch

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

_FUGAS = ["pyodbc", "ODBC Driver", "SQLDriverConnect", "sqlalche.me", "HYT00", "OperationalError"]


def _mock_tress_caido(monkeypatch):
    engine = MagicMock()
    engine.dispose = AsyncMock()
    repo = MagicMock()
    repo.count = AsyncMock(side_effect=_ERROR_ODBC)
    repo.aggregate_por_tipo = AsyncMock(side_effect=_ERROR_ODBC)
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisFaltasRetardosRepository",
        lambda _engine: repo,
    )


@pytest.mark.asyncio
async def test_listado_no_filtra_la_excepcion(client: AsyncClient, db, monkeypatch):
    rh = await make_empleado(db, rol="rh", nombre="RH Err", no_empleado=80001)
    headers = await auth_headers(client, rh)
    _mock_tress_caido(monkeypatch)

    res = await client.get("/api/v1/faltas-retardos", headers=headers)
    assert res.status_code == 503
    for fuga in _FUGAS:
        assert fuga not in res.text, f"el detail filtra {fuga!r}: {res.text}"


@pytest.mark.asyncio
async def test_estadisticas_no_filtra_la_excepcion(client: AsyncClient, db, monkeypatch):
    """Este es el que se veía en el dashboard de RH, dos veces seguidas."""
    rh = await make_empleado(db, rol="rh", nombre="RH Err2", no_empleado=80002)
    headers = await auth_headers(client, rh)
    _mock_tress_caido(monkeypatch)

    res = await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)
    assert res.status_code == 503
    for fuga in _FUGAS:
        assert fuga not in res.text, f"el detail filtra {fuga!r}: {res.text}"


@pytest.mark.asyncio
async def test_el_mensaje_dice_que_hacer(client: AsyncClient, db, monkeypatch):
    """Sin detalle técnico, el texto tiene que seguir siendo accionable."""
    rh = await make_empleado(db, rol="rh", nombre="RH Err3", no_empleado=80003)
    headers = await auth_headers(client, rh)
    _mock_tress_caido(monkeypatch)

    detail = (await client.get("/api/v1/faltas-retardos/estadisticas", headers=headers)).json()[
        "detail"
    ]
    assert "nómina" in detail.lower()
    assert len(detail) < 160, "un detail largo no cabe en el aviso del dashboard"
