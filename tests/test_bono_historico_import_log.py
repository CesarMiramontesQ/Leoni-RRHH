"""Tests de historial de importaciones bono histórico."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.integrations.bono_historico_import_log import (
    ejecutar_import_con_historial,
    registrar_corrida_importacion,
)
from app.integrations.bono_empleados_import import _empleados_stats_to_log_like
from app.models.bono_historico_import_log import BonoHistoricoImportLog
from app.scripts.import_calidad_historico import ImportStats
from app.scripts.import_empleados_bono import ImportStats as EmpleadosImportStats


@pytest.mark.asyncio
async def test_registrar_corrida_importacion_ok(db):
    started = datetime.now(timezone.utc)
    stats = ImportStats(leidos=10, insertados=3, omitidos=5, errores=2)
    await registrar_corrida_importacion(
        "calidad_historico",
        status="ok",
        started_at=started,
        finished_at=started,
        stats=stats,
        corrida_id="test-corrida-uuid",
        db=db,
    )

    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(
                BonoHistoricoImportLog.fuente == "calidad_historico"
            )
        )
    ).scalar_one()
    assert row.status == "ok"
    assert row.leidos == 10
    assert row.insertados == 3
    assert row.corrida_id == "test-corrida-uuid"


@pytest.mark.asyncio
async def test_ejecutar_import_con_historial_skipped(db):
    async def _falla_conexion():
        raise ConnectionError("bono no configurado")

    result = await ejecutar_import_con_historial(
        "seguridad_historico",
        _falla_conexion,
        corrida_id="corrida-skip",
        db=db,
    )
    assert result is None

    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(
                BonoHistoricoImportLog.fuente == "seguridad_historico"
            )
        )
    ).scalar_one()
    assert row.status == "skipped"
    assert row.error_msg == "bono no configurado"


@pytest.mark.asyncio
async def test_registrar_corrida_ausencias_fi(db):
    from app.integrations.sync_ausencias_fi_job import ausencias_stats_to_log_like
    from app.services.sync_ausencias_fi_service import SyncAusenciasStats

    started = datetime.now(timezone.utc)
    stats = ausencias_stats_to_log_like(
        SyncAusenciasStats(
            leidos=10,
            insertados=4,
            omitidos_duplicado=3,
            omitidos_sin_empleado=2,
            omitidos_sin_semana=1,
            omitidos_incompletos=0,
            errores=0,
            mensajes_error=[],
            tipo_inc="FI",
        )
    )
    await registrar_corrida_importacion(
        "ausencias_fi",
        status="ok",
        started_at=started,
        finished_at=started,
        stats=stats,
        origen_ejecucion="scheduler",
        corrida_id="corrida-ausencias-fi",
        db=db,
    )

    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(
                BonoHistoricoImportLog.fuente == "ausencias_fi"
            )
        )
    ).scalar_one()
    assert row.status == "ok"
    assert row.fuente == "ausencias_fi"
    assert row.leidos == 10
    assert row.insertados == 4
    assert row.omitidos == 6  # 3+2+1
    assert row.mensajes_error is not None
    assert any("dup=3" in m for m in row.mensajes_error)


@pytest.mark.asyncio
async def test_registrar_corrida_ausencias_re(db):
    from app.integrations.sync_ausencias_fi_job import ausencias_stats_to_log_like
    from app.services.sync_ausencias_fi_service import SyncAusenciasStats

    started = datetime.now(timezone.utc)
    stats = ausencias_stats_to_log_like(
        SyncAusenciasStats(
            leidos=5,
            insertados=5,
            omitidos_duplicado=0,
            omitidos_sin_empleado=0,
            omitidos_sin_semana=0,
            omitidos_incompletos=0,
            errores=0,
            tipo_inc="RE",
        )
    )
    await registrar_corrida_importacion(
        "ausencias_re",
        status="ok",
        started_at=started,
        finished_at=started,
        stats=stats,
        origen_ejecucion="manual",
        db=db,
    )
    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(
                BonoHistoricoImportLog.fuente == "ausencias_re"
            )
        )
    ).scalar_one()
    assert row.fuente == "ausencias_re"
    assert row.origen_ejecucion == "manual"
    assert row.insertados == 5


def test_empleados_stats_to_log_like_mapea_creados_y_actualizados():
    stats = EmpleadosImportStats(
        leidos=100,
        creados=5,
        actualizados=12,
        omitidos=2,
        errores=1,
        mensajes_error=["detalle error"],
    )
    log_like = _empleados_stats_to_log_like(stats)
    assert log_like.leidos == 100
    assert log_like.insertados == 5
    assert log_like.omitidos == 2
    assert log_like.errores == 1
    assert log_like.mensajes_error is not None
    assert "actualizados=12" in log_like.mensajes_error
    assert "creados=5" in log_like.mensajes_error
    assert "detalle error" in log_like.mensajes_error


@pytest.mark.asyncio
async def test_registrar_corrida_empleados(db):
    started = datetime.now(timezone.utc)
    stats = _empleados_stats_to_log_like(
        EmpleadosImportStats(leidos=50, creados=3, actualizados=7, omitidos=1, errores=0)
    )
    await registrar_corrida_importacion(
        "empleados",
        status="ok",
        started_at=started,
        finished_at=started,
        stats=stats,
        origen_ejecucion="scheduler",
        db=db,
    )

    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(BonoHistoricoImportLog.fuente == "empleados")
        )
    ).scalar_one()
    assert row.status == "ok"
    assert row.fuente == "empleados"
    assert row.leidos == 50
    assert row.insertados == 3
    assert row.origen_ejecucion == "scheduler"
