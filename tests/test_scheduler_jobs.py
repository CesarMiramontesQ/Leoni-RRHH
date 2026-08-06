"""Registro de los jobs periódicos de APScheduler (`registrar_jobs_programados`).

Comprueba la hora y la zona con las que quedan programados; el lifespan de la app llama a
esta misma función, así que lo que se verifica aquí es lo que corre en producción. Cubre
tanto el sync de saldos de vacaciones como el de home office tomado.
"""

from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.main import registrar_jobs_programados


def _jobs():
    sched = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    registrar_jobs_programados(sched)
    return {job.id: job for job in sched.get_jobs()}


def _campo(job, nombre: str) -> str:
    return str(next(c for c in job.trigger.fields if c.name == nombre))


def test_sync_de_vacaciones_corre_diario_a_las_seis():
    job = _jobs()["sync_vacaciones_disponibles"]
    assert _campo(job, "hour") == "6"
    assert _campo(job, "minute") == "0"
    assert _campo(job, "day") == "*"
    assert job.trigger.timezone.key == settings.APP_TIMEZONE


def test_los_recordatorios_diarios_siguen_registrados():
    """El sync se añadió sin desplazar los jobs que ya existían."""
    jobs = _jobs()
    for job_id in ("eval360_recordatorios", "encuestas_rh_recordatorios", "metas_recordatorios"):
        assert _campo(jobs[job_id], "hour") == "8"


def test_sync_de_home_office_corre_diario_a_las_seis():
    job = _jobs()["sync_homeoffice_tomados"]
    assert _campo(job, "hour") == "6"
    assert _campo(job, "minute") == "0"
    assert _campo(job, "day") == "*"
    assert job.trigger.timezone.key == settings.APP_TIMEZONE


def test_home_office_y_vacaciones_son_jobs_independientes():
    """Comparten hora pero no proceso: un fallo de uno no debe impedir el otro."""
    jobs = _jobs()
    assert "sync_vacaciones_disponibles" in jobs
    assert "sync_homeoffice_tomados" in jobs
