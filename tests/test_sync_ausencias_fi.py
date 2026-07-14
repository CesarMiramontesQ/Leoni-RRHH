"""Tests del sync diario FI/RE: dbo.AUSENCIA → importadas_historico."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.sync_ausencias_fi_service import SyncAusenciasFiService, SyncAusenciasService
from tests.conftest import make_empleado


def _fila(
    *,
    no_empleado: int = 100,
    fecha: date = date(2026, 7, 14),
    llave: str = "LLAVE-1",
    tipo_inc: str = "FI",
    inc_id: int | None = None,
) -> dict:
    return {
        "no_empleado": no_empleado,
        "tipo_inc": tipo_inc,
        "inc_id": inc_id,
        "fecha_incidencia": fecha,
        "ausencia_llave": llave,
    }


def _patch_engines(da_repo, bono_repo):
    da_engine = MagicMock()
    da_engine.dispose = AsyncMock()
    bono_engine = MagicMock()
    bono_engine.dispose = AsyncMock()
    return (
        patch(
            "app.services.sync_ausencias_fi_service.DatosAnalisisReadClient.create_read_engine",
            return_value=da_engine,
        ),
        patch(
            "app.services.sync_ausencias_fi_service.BonoProductividadReadClient.create_read_engine",
            return_value=bono_engine,
        ),
        patch(
            "app.services.sync_ausencias_fi_service.DatosAnalisisAusenciasRepository",
            return_value=da_repo,
        ),
        patch(
            "app.services.sync_ausencias_fi_service.BonoImportadasHistoricoRepository",
            return_value=bono_repo,
        ),
    )


@pytest.mark.asyncio
async def test_sync_inserta_fi(db):
    emp = await make_empleado(db, rol="empleado", nombre="Emp FI", no_empleado=100)

    insert_mock = AsyncMock(return_value=501)
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=False),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(
        list_ausencias=AsyncMock(return_value=[_fila(no_empleado=100)]),
    )

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="FI",
            execute=True,
        )

    assert stats.leidos == 1
    assert stats.insertados == 1
    assert stats.errores == 0
    insert_mock.assert_awaited_once()
    kwargs = insert_mock.await_args.kwargs
    assert kwargs["tipo_inc"] == "FI"
    assert kwargs["inc_id"] == 6
    assert kwargs["id_semana"] == 77
    assert kwargs["no_empleado"] == 100
    assert kwargs["area_empleado"] == emp.area_id
    assert kwargs["subarea_empleado"] == emp.subarea_id
    da_repo.list_ausencias.assert_awaited_once()
    assert da_repo.list_ausencias.await_args.kwargs["tipo_inc"] == "FI"


@pytest.mark.asyncio
async def test_sync_inserta_re_con_inc_id_8(db):
    emp = await make_empleado(db, rol="empleado", nombre="Emp RE", no_empleado=100)

    insert_mock = AsyncMock(return_value=601)
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=False),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
    )
    # Fuente trae inc_id NULL; el servicio debe forzar 8.
    da_repo = AsyncMock(
        list_ausencias=AsyncMock(
            return_value=[_fila(no_empleado=100, tipo_inc="RE", inc_id=None)]
        ),
    )

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="RE",
            execute=True,
        )

    assert stats.leidos == 1
    assert stats.insertados == 1
    kwargs = insert_mock.await_args.kwargs
    assert kwargs["tipo_inc"] == "RE"
    assert kwargs["inc_id"] == 8
    assert kwargs["area_empleado"] == emp.area_id
    assert da_repo.list_ausencias.await_args.kwargs["tipo_inc"] == "RE"


@pytest.mark.asyncio
async def test_sync_omite_duplicado_re(db):
    await make_empleado(db, rol="empleado", nombre="Emp Dup RE", no_empleado=100)

    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=True),
        resolve_semana_id=AsyncMock(),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(
        list_ausencias=AsyncMock(return_value=[_fila(tipo_inc="RE")]),
    )

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="RE",
            execute=True,
        )

    assert stats.omitidos_duplicado == 1
    assert stats.insertados == 0
    insert_mock.assert_not_awaited()
    bono_repo.exists_evento.assert_awaited()
    assert bono_repo.exists_evento.await_args.kwargs["tipo_inc"] == "RE"


@pytest.mark.asyncio
async def test_sync_omite_duplicado(db):
    await make_empleado(db, rol="empleado", nombre="Emp Dup", no_empleado=100)

    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=True),
        resolve_semana_id=AsyncMock(),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[_fila()]))

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="FI",
            execute=True,
        )

    assert stats.omitidos_duplicado == 1
    assert stats.insertados == 0
    insert_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_omite_sin_empleado(db):
    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=False),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(
        list_ausencias=AsyncMock(return_value=[_fila(no_empleado=99999, tipo_inc="RE")]),
    )

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="RE",
            execute=True,
        )

    assert stats.omitidos_sin_empleado == 1
    assert stats.insertados == 0
    insert_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_omite_sin_semana(db):
    await make_empleado(db, rol="empleado", nombre="Emp Semana", no_empleado=100)

    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=False),
        resolve_semana_id=AsyncMock(return_value=None),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[_fila(tipo_inc="RE")]))

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="RE",
            execute=True,
        )

    assert stats.omitidos_sin_semana == 1
    assert stats.insertados == 0
    insert_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_dry_run_no_inserta(db):
    await make_empleado(db, rol="empleado", nombre="Emp Dry", no_empleado=100)

    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        exists_evento=AsyncMock(return_value=False),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[_fila()]))

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasFiService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            execute=False,
        )

    assert stats.insertados == 1
    insert_mock.assert_not_awaited()


def test_load_ausencias_sql_contiene_binds():
    from app.repositories.datos_analisis_ausencias_repository import (
        load_ausencias_fi_sql,
        load_ausencias_por_tipo_sql,
    )

    sql = load_ausencias_por_tipo_sql()
    assert "dbo.AUSENCIA" in sql
    assert ":fecha_inicio" in sql
    assert ":fecha_fin" in sql
    assert ":tipo_inc" in sql
    assert load_ausencias_fi_sql() == sql
