"""Consultas del historial de corridas."""

from datetime import datetime, timezone

import pytest

from app.models.scheduler_job_log import SchedulerJobLog
from app.repositories.scheduler_job_log_repository import SchedulerJobLogRepository


async def _sembrar(db):
    filas = [
        SchedulerJobLog(
            job_id="sync_turnos_uso",
            inicio_at=datetime(2026, 8, 10, 10, 0, tzinfo=timezone.utc),
            resultado="ok",
            resumen="insertados=3",
        ),
        SchedulerJobLog(
            job_id="sync_turnos_uso",
            inicio_at=datetime(2026, 8, 11, 10, 0, tzinfo=timezone.utc),
            resultado="error",
            resumen="TRESS caido",
            error="TRESS caido",
        ),
        SchedulerJobLog(
            job_id="sync_ausencias_fi_re",
            inicio_at=datetime(2026, 8, 12, 14, 30, tzinfo=timezone.utc),
            resultado="ok",
            resumen="insertados=1",
        ),
    ]
    for fila in filas:
        db.add(fila)
    await db.commit()


@pytest.mark.asyncio
async def test_listar_devuelve_lo_mas_reciente_primero(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(page=1, page_size=10)

    assert total == 3
    assert [i.job_id for i in items] == [
        "sync_ausencias_fi_re",
        "sync_turnos_uso",
        "sync_turnos_uso",
    ]


@pytest.mark.asyncio
async def test_listar_filtra_por_job_y_por_resultado(db):
    await _sembrar(db)
    repo = SchedulerJobLogRepository(db)

    items, total = await repo.listar(job_id="sync_turnos_uso", page=1, page_size=10)
    assert total == 2

    items, total = await repo.listar(resultado="error", page=1, page_size=10)
    assert total == 1
    assert items[0].error == "TRESS caido"


@pytest.mark.asyncio
async def test_listar_filtra_por_rango_de_fechas(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(
        desde=datetime(2026, 8, 11, 0, 0, tzinfo=timezone.utc),
        hasta=datetime(2026, 8, 11, 23, 59, tzinfo=timezone.utc),
        page=1,
        page_size=10,
    )

    assert total == 1
    assert items[0].resultado == "error"


@pytest.mark.asyncio
async def test_listar_pagina(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(page=2, page_size=2)

    assert total == 3
    assert len(items) == 1


@pytest.mark.asyncio
async def test_obtener_devuelve_none_si_no_existe(db):
    await _sembrar(db)
    repo = SchedulerJobLogRepository(db)

    assert await repo.obtener(99999) is None
    assert (await repo.obtener(1)).job_id == "sync_turnos_uso"
