"""Jobs periódicos registrados en el scheduler (`registrar_jobs_programados`)."""

from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.main import registrar_jobs_programados


@pytest.fixture
async def scheduler():
    """Scheduler arrancado en pausa: sin `start()`, los jobs quedan pendientes y
    `get_job` no los ve."""
    sched = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    sched.start(paused=True)
    registrar_jobs_programados(sched)
    yield sched
    sched.shutdown(wait=False)


@pytest.mark.asyncio
async def test_el_sync_de_home_office_corre_a_las_seis(scheduler):
    job = scheduler.get_job("sync_homeoffice_tomados")
    assert job is not None
    trigger = str(job.trigger)
    assert "hour='6'" in trigger
    assert "minute='0'" in trigger
    # La zona horaria la fija el scheduler, no el job. `str(trigger)` no la incluye en esta
    # version de APScheduler (3.10.4); solo `repr()` la expone, o el atributo directo.
    assert job.trigger.timezone.key == settings.APP_TIMEZONE


@pytest.mark.asyncio
async def test_home_office_y_vacaciones_son_jobs_independientes(scheduler):
    """Comparten hora pero no proceso: un fallo de uno no debe impedir el otro."""
    assert scheduler.get_job("sync_vacaciones_disponibles") is not None
    assert scheduler.get_job("sync_homeoffice_tomados") is not None
