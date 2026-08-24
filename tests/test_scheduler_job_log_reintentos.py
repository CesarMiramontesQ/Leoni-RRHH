"""Reintentos automáticos de los jobs del scheduler tras una corrida con `error`."""

import asyncio
import logging
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select

import app.integrations.scheduler_job_log as scheduler_job_log
from app.integrations.scheduler_job_log import con_registro
from app.models.scheduler_job_log import SchedulerJobLog


@pytest.fixture(autouse=True)
def _con_captura_de_logs_instalada():
    """Mismo arranque simulado que en tests/test_scheduler_job_log.py."""
    scheduler_job_log.instalar_captura_logs()
    try:
        yield
    finally:
        handler = scheduler_job_log._handler_instalado
        if handler is not None:
            logging.getLogger().removeHandler(handler)
        scheduler_job_log._handler_instalado = None


@pytest.fixture
def _backoff_inmediato(monkeypatch):
    """Reintentos sin espera: el espaciado real (15/30/60 min) haría eterno el test."""
    monkeypatch.setattr(
        scheduler_job_log, "BACKOFF_REINTENTOS_SEGUNDOS", (0, 0, 0)
    )


def _usar_sesion_de_test(monkeypatch, db):
    """La misma sesión del fixture para leer lo escrito (ver test_scheduler_job_log.py)."""
    lock = asyncio.Lock()

    @asynccontextmanager
    async def _sesion():
        async with lock:
            yield db

    monkeypatch.setattr(
        "app.integrations.scheduler_job_log.AsyncSessionLocal", _sesion
    )


async def _esperar_reintentos():
    """Espera a que se agote la cadena de reintentos pendientes (cada uno programa
    el siguiente, así que se re-consulta el conjunto hasta que quede vacío)."""
    while scheduler_job_log._REINTENTOS_PENDIENTES:
        await asyncio.gather(
            *list(scheduler_job_log._REINTENTOS_PENDIENTES), return_exceptions=True
        )


async def _filas(db):
    filas = (
        (await db.execute(select(SchedulerJobLog).order_by(SchedulerJobLog.id)))
        .scalars()
        .all()
    )
    return [(f.intento, f.resultado) for f in filas]


def test_backoff_es_15_30_60_minutos_y_cuatro_intentos():
    assert scheduler_job_log.BACKOFF_REINTENTOS_SEGUNDOS == (900, 1800, 3600)
    assert scheduler_job_log.MAX_INTENTOS == 4


@pytest.mark.asyncio
async def test_error_reintenta_y_deja_una_fila_por_intento(db, monkeypatch, _backoff_inmediato):
    _usar_sesion_de_test(monkeypatch, db)
    intentos = {"n": 0}

    async def job():
        intentos["n"] += 1
        if intentos["n"] == 1:
            logging.getLogger("app.main").error("Error en sync: TRESS caído")
        else:
            logging.getLogger("app.main").info("Sync ok | insertados=3")

    await con_registro(job, "job_reintento", reintentos=True)()
    await _esperar_reintentos()

    assert intentos["n"] == 2
    assert await _filas(db) == [(1, "error"), (2, "ok")]


@pytest.mark.asyncio
async def test_se_detiene_al_agotar_los_cuatro_intentos(db, monkeypatch, _backoff_inmediato):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").error("Error en sync: sigue caído")

    await con_registro(job, "job_agotado", reintentos=True)()
    await _esperar_reintentos()

    assert await _filas(db) == [
        (1, "error"),
        (2, "error"),
        (3, "error"),
        (4, "error"),
    ]


@pytest.mark.asyncio
async def test_advertencia_no_reintenta(db, monkeypatch, _backoff_inmediato):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").warning("omitido: lock tomado")

    await con_registro(job, "job_advertencia", reintentos=True)()
    await _esperar_reintentos()

    assert await _filas(db) == [(1, "advertencia")]


@pytest.mark.asyncio
async def test_error_sin_opt_in_no_reintenta(db, monkeypatch, _backoff_inmediato):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").error("Error en recordatorios")

    await con_registro(job, "job_sin_opt_in")()
    await _esperar_reintentos()

    assert await _filas(db) == [(1, "error")]


@pytest.mark.asyncio
async def test_excepcion_propagada_tambien_reintenta(db, monkeypatch, _backoff_inmediato):
    """Un job que explota (en vez de loguear ERROR) también entra al backoff; la
    excepción del primer intento se sigue propagando, como siempre hizo el wrapper."""
    _usar_sesion_de_test(monkeypatch, db)
    intentos = {"n": 0}

    async def job():
        intentos["n"] += 1
        if intentos["n"] == 1:
            raise RuntimeError("boom")
        logging.getLogger("app.main").info("recuperado")

    with pytest.raises(RuntimeError):
        await con_registro(job, "job_explota", reintentos=True)()
    await _esperar_reintentos()

    assert await _filas(db) == [(1, "error"), (2, "ok")]
