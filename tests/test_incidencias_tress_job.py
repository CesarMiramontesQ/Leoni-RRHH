"""El sync de incidencias corre los miércoles a las 10:00 (America/Mexico_City)."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.main import registrar_jobs_programados


def _job_incidencias():
    sched = AsyncIOScheduler()
    registrar_jobs_programados(sched)
    return sched.get_job("sync_incidencias_tress")


def test_el_job_esta_registrado():
    assert _job_incidencias() is not None


def test_corre_los_miercoles_a_las_diez():
    campos = {f.name: str(f) for f in _job_incidencias().trigger.fields}
    assert campos["day_of_week"] == "wed"
    assert campos["hour"] == "10"
    assert campos["minute"] == "0"


def test_no_pisa_los_jobs_existentes():
    sched = AsyncIOScheduler()
    registrar_jobs_programados(sched)
    ids = {job.id for job in sched.get_jobs()}
    assert {
        "eval360_recordatorios",
        "encuestas_rh_recordatorios",
        "metas_recordatorios",
        "sync_vacaciones_disponibles",
        "sync_homeoffice_tomados",
        "sync_incidencias_tress",
    } <= ids
