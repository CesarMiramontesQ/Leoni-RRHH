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
