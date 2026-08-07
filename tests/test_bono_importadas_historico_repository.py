"""Tests del SQL que emite BonoImportadasHistoricoRepository.

Los tests del sync mockean ``insert_evento`` entero, así que no ven el SQL. Aquí se
captura el statement real contra una conexión falsa para verificar las columnas que
viajan al INSERT.
"""

from datetime import date

import pytest

from app.repositories.bono_importadas_historico_repository import (
    BonoImportadasHistoricoRepository,
)


class _FakeResult:
    def __init__(self, value: int) -> None:
        self._value = value

    def scalar(self) -> int:
        return self._value


class _FakeConn:
    """Captura (sql, params) del execute sin tocar una BD."""

    def __init__(self, new_id: int = 99) -> None:
        self.new_id = new_id
        self.sql: str | None = None
        self.params: dict | None = None

    async def execute(self, sql, params=None):
        self.sql = str(sql)
        self.params = params
        return _FakeResult(self.new_id)


async def _insert(conn: _FakeConn, **extra):
    repo = BonoImportadasHistoricoRepository(engine=None)
    return await repo.insert_evento(
        no_empleado=4295,
        tipo_inc="FI",
        inc_id=1,
        id_semana=10,
        area_empleado=3,
        subarea_empleado=7,
        fecha_incidencia=date(2026, 8, 3),
        conn=conn,
        **extra,
    )


@pytest.mark.asyncio
async def test_insert_evento_escribe_estado_recibido():
    conn = _FakeConn()
    await _insert(conn, estado=1)

    assert conn.params is not None
    assert conn.params["estado"] == 1
    assert "estado" in (conn.sql or "")


@pytest.mark.asyncio
async def test_insert_evento_sin_estado_manda_null():
    """El registro manual de RH no pasa estado: la columna queda en NULL."""
    conn = _FakeConn()
    await _insert(conn)

    assert conn.params is not None
    assert conn.params["estado"] is None


@pytest.mark.asyncio
async def test_insert_evento_escribe_semana_incidencia():
    """La semana a la que corresponde el evento, aparte de id_semana."""
    conn = _FakeConn()
    await _insert(conn, semana_incidencia=78)

    assert conn.params is not None
    assert conn.params["semana_incidencia"] == 78
    assert "semana_incidencia" in (conn.sql or "")


@pytest.mark.asyncio
async def test_insert_evento_sin_semana_incidencia_manda_null():
    conn = _FakeConn()
    await _insert(conn)

    assert conn.params is not None
    assert conn.params["semana_incidencia"] is None


@pytest.mark.asyncio
async def test_insert_evento_devuelve_id():
    conn = _FakeConn(new_id=1234)
    assert await _insert(conn, estado=1) == 1234
