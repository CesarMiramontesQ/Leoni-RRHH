"""Los 11 jobs conservan id y cron, y todos pasan por el registro de corridas."""

from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.main import registrar_jobs_programados

# id -> (day_of_week, hour, minute). `*` = todos los días.
CRONS_ESPERADOS = {
    "eval360_recordatorios": ("*", "8", "0"),
    "encuestas_rh_recordatorios": ("*", "8", "0"),
    "metas_recordatorios": ("*", "8", "0"),
    "sync_vacaciones_disponibles": ("*", "6", "0"),
    "sync_homeoffice_tomados": ("*", "6", "0"),
    "sync_turnos_catalogo": ("*", "3", "40"),
    "sync_turnos_uso": ("*", "4", "0"),
    "sync_empleados_tress": ("*", "4", "10"),
    "sync_turnos_empleados": ("*", "4", "20"),
    "sync_ausencias_fi_re": ("wed", "8", "30"),
    "sync_incidencias_tress": ("wed", "10", "0"),
}


@pytest.fixture
def sched() -> AsyncIOScheduler:
    s = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    registrar_jobs_programados(s)
    return s


def test_estan_los_once_jobs_con_su_cron(sched):
    jobs = {j.id: j for j in sched.get_jobs()}
    assert set(jobs) == set(CRONS_ESPERADOS)

    for job_id, (dow, hora, minuto) in CRONS_ESPERADOS.items():
        campos = {f.name: str(f) for f in jobs[job_id].trigger.fields}
        assert campos["day_of_week"] == dow, job_id
        assert campos["hour"] == hora, job_id
        assert campos["minute"] == minuto, job_id


def test_todos_los_jobs_pasan_por_el_registro_de_corridas(sched):
    for job in sched.get_jobs():
        assert getattr(job.func, "job_id", None) == job.id, job.id


def test_el_scheduler_usa_la_zona_de_la_app(sched):
    assert settings.APP_TIMEZONE == "America/Mexico_City"
    for job in sched.get_jobs():
        assert str(job.trigger.timezone) == "America/Mexico_City", job.id
