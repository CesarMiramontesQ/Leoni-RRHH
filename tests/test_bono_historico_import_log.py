"""Tests de historial de importaciones bono histórico."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.integrations.bono_historico_import_log import (
    ejecutar_import_con_historial,
    registrar_corrida_importacion,
)
from app.models.bono_historico_import_log import BonoHistoricoImportLog
from app.scripts.import_calidad_historico import ImportStats
from tests.conftest import auth_headers, make_empleado


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
async def test_listar_logs_import_historico_api(client, db):
    rh = await make_empleado(db, rol="rh", usuario="rh_bono_log")
    headers = await auth_headers(client, rh)

    started = datetime.now(timezone.utc)
    await registrar_corrida_importacion(
        "importadas_historico",
        status="ok",
        started_at=started,
        finished_at=started,
        stats=ImportStats(leidos=1, insertados=1),
        db=db,
    )

    resp = await client.get(
        "/api/v1/bono-productividad/import-historico/logs",
        headers=headers,
        params={"fuente": "importadas_historico"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(i["fuente"] == "importadas_historico" for i in data["items"])
