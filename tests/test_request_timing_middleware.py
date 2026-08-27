"""Tiempo por request: cabecera y log, con umbral de «lento».

Nació de investigar un dashboard de gerente de 10 s sin ninguna forma de saber qué
endpoint se los llevaba. El middleware deja método, ruta, usuario (claim `sub` del JWT,
sin validarlo) y milisegundos en el log; por encima de `SLOW_REQUEST_MS` sube a WARNING.
"""

import logging

import pytest

from app.core.config import settings

pytestmark = pytest.mark.asyncio


async def test_toda_respuesta_lleva_la_cabecera_de_tiempo(client):
    res = await client.get("/api/v1/incidencias/")

    assert res.status_code == 200
    ms = float(res.headers["x-process-time-ms"])
    assert ms >= 0


async def test_request_normal_se_registra_en_info(client, caplog):
    caplog.set_level(logging.INFO, logger="app.request_timing")

    await client.get("/api/v1/incidencias/")

    linea = next(r for r in caplog.records if r.name == "app.request_timing")
    assert linea.levelno == logging.INFO
    assert "GET /api/v1/incidencias/" in linea.getMessage()
    assert "200" in linea.getMessage()
    assert "ms" in linea.getMessage()


async def test_request_lenta_se_registra_en_warning(client, caplog, monkeypatch):
    monkeypatch.setattr(settings, "SLOW_REQUEST_MS", 0)
    caplog.set_level(logging.INFO, logger="app.request_timing")

    await client.get("/api/v1/incidencias/")

    linea = next(r for r in caplog.records if r.name == "app.request_timing")
    assert linea.levelno == logging.WARNING
    assert "lenta" in linea.getMessage()


async def test_el_log_incluye_el_sub_del_token(client, caplog, db):
    from tests.conftest import auth_headers, make_empleado

    caplog.set_level(logging.INFO, logger="app.request_timing")
    emp = await make_empleado(db, rol="gerente", email="timing_g@leoni.test")

    headers = await auth_headers(client, emp)
    caplog.clear()

    await client.get("/api/v1/incidencias/", headers=headers)

    linea = next(r for r in caplog.records if r.name == "app.request_timing")
    assert f"sub={emp.id}" in linea.getMessage()
