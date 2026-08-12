"""Historial de corridas de los jobs del scheduler: modelo, envoltorio y API."""

import asyncio
import logging
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

import app.integrations.scheduler_job_log as scheduler_job_log
from app.integrations.scheduler_job_log import con_registro
from app.models.scheduler_job_log import SchedulerJobLog


@pytest.fixture(autouse=True)
def _con_captura_de_logs_instalada():
    """`con_registro` depende de que `CapturaCorridaHandler` esté enganchado al logger
    raíz — en producción lo hace `instalar_captura_logs()` una sola vez al arrancar
    (Task 4). Aquí simulamos ese arranque para este módulo y lo deshacemos al terminar
    cada test, para no dejar el handler instalado y romper el conteo "antes/después"
    de `test_instalar_captura_logs_es_idempotente` (tests/test_scheduler_job_log_captura.py).
    """
    scheduler_job_log.instalar_captura_logs()
    try:
        yield
    finally:
        handler = scheduler_job_log._handler_instalado
        if handler is not None:
            logging.getLogger().removeHandler(handler)
        scheduler_job_log._handler_instalado = None


def _usar_sesion_de_test(monkeypatch, db):
    """`AsyncSessionLocal` del modulo apunta a la sesion del fixture.

    El envoltorio abre su propia sesion en produccion; en tests reusamos la del fixture
    para poder leer lo que escribio sin lidiar con dos conexiones. Como es LA MISMA
    sesion para cualquier llamada (a diferencia de produccion, donde cada llamada abre
    la suya), dos jobs solapados (`test_dos_jobs_solapados_no_mezclan_sus_lineas`) la
    usarian a la vez y `AsyncSession` no tolera eso. El lock serializa el acceso aqui,
    en el helper de test donde vive la sesion compartida — no en produccion, donde no
    hace falta porque no hay sesion que compartir.
    """
    from contextlib import asynccontextmanager

    lock = asyncio.Lock()

    @asynccontextmanager
    async def _sesion():
        async with lock:
            yield db

    monkeypatch.setattr(
        "app.integrations.scheduler_job_log.AsyncSessionLocal", _sesion
    )


def _falla(mensaje: str):
    async def _boom(*args, **kwargs):
        raise RuntimeError(mensaje)

    return _boom


@pytest.mark.asyncio
async def test_modelo_persiste_una_corrida_con_defaults(db):
    fila = SchedulerJobLog(
        job_id="sync_turnos_uso",
        inicio_at=datetime(2026, 8, 12, 10, 0, tzinfo=timezone.utc),
    )
    db.add(fila)
    await db.commit()

    guardada = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert guardada.job_id == "sync_turnos_uso"
    assert guardada.resultado == "en_curso"
    assert guardada.lineas == []
    assert guardada.lineas_descartadas == 0
    assert guardada.fin_at is None
    assert guardada.duracion_ms is None


@pytest.mark.asyncio
async def test_corrida_sin_incidentes_queda_ok_con_duracion(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").info("Sync X job | insertados=3")

    await con_registro(job, "job_ok")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.job_id == "job_ok"
    assert fila.resultado == "ok"
    assert fila.resumen == "Sync X job | insertados=3"
    assert fila.fin_at is not None
    assert fila.duracion_ms is not None and fila.duracion_ms >= 0
    assert fila.error is None
    assert [linea["mensaje"] for linea in fila.lineas] == ["Sync X job | insertados=3"]


@pytest.mark.asyncio
async def test_job_que_loguea_error_sin_propagar_queda_como_error(db, monkeypatch):
    """El caso real: los 11 wrappers atrapan su excepcion y solo loguean ERROR."""
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").error("Error en sync de turnos: TRESS caido")

    await con_registro(job, "job_con_error")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "error"
    assert fila.error == "Error en sync de turnos: TRESS caido"


@pytest.mark.asyncio
async def test_job_que_loguea_warning_queda_como_advertencia(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").warning("omitido: ya hay una sincronizacion")

    await con_registro(job, "job_advertencia")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "advertencia"


@pytest.mark.asyncio
async def test_excepcion_queda_registrada_y_se_relanza(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await con_registro(job, "job_explota")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "error"
    assert fila.error == "RuntimeError: boom"
    assert fila.fin_at is not None


@pytest.mark.asyncio
async def test_la_fila_existe_como_en_curso_mientras_el_job_corre(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)
    vistas = {}

    async def job():
        fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
        vistas["resultado"] = fila.resultado
        vistas["fin_at"] = fila.fin_at

    await con_registro(job, "job_en_curso")()

    assert vistas == {"resultado": "en_curso", "fin_at": None}


@pytest.mark.asyncio
async def test_dos_jobs_solapados_no_mezclan_sus_lineas(db, monkeypatch):
    import asyncio

    _usar_sesion_de_test(monkeypatch, db)
    log = logging.getLogger("app.main")

    async def job_a():
        log.info("soy A")
        await asyncio.sleep(0.01)
        log.info("A termina")

    async def job_b():
        await asyncio.sleep(0.005)
        log.info("soy B")

    await asyncio.gather(con_registro(job_a, "job_a")(), con_registro(job_b, "job_b")())

    filas = (await db.execute(select(SchedulerJobLog))).scalars().all()
    por_job = {f.job_id: [linea["mensaje"] for linea in f.lineas] for f in filas}
    assert por_job["job_a"] == ["soy A", "A termina"]
    assert por_job["job_b"] == ["soy B"]


@pytest.mark.asyncio
async def test_si_el_registro_falla_el_job_corre_igual(db, monkeypatch):
    """La pagina es diagnostico: no puede volverse un punto de falla para nomina."""
    _usar_sesion_de_test(monkeypatch, db)
    monkeypatch.setattr(
        "app.integrations.scheduler_job_log._insertar_en_curso",
        _falla("insert caido"),
    )
    corrio = {"si": False}

    async def job():
        corrio["si"] = True

    await con_registro(job, "job_sin_registro")()

    assert corrio["si"] is True
