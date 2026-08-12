"""Historial de corridas de los jobs del scheduler: modelo, envoltorio y API."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.scheduler_job_log import SchedulerJobLog


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
