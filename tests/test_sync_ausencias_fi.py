"""Tests del mirror sync FI/RE: dbo.AUSENCIA → importadas_historico."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import DomainValidationError, ServiceUnavailableError
from app.repositories.bono_importadas_historico_repository import SemanaAnteriorRango
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


def _bono_row(
    *,
    evento_id: int = 1,
    no_empleado: int = 100,
    fecha: date = date(2026, 7, 14),
    tipo_inc: str = "FI",
    inc_id: int = 6,
    id_semana: int = 77,
    area_empleado: int | None = 1,
    subarea_empleado: int | None = 2,
) -> dict:
    return {
        "id": evento_id,
        "no_empleado": no_empleado,
        "tipo_inc": tipo_inc,
        "inc_id": inc_id,
        "id_semana": id_semana,
        "area_empleado": area_empleado,
        "subarea_empleado": subarea_empleado,
        "fecha_incidencia": fecha,
    }


def _patch_engines(da_repo, bono_repo, *, bono_engine: MagicMock | None = None):
    da_engine = MagicMock()
    da_engine.dispose = AsyncMock()
    if bono_engine is None:
        bono_engine = MagicMock()
        bono_engine.dispose = AsyncMock()
        begin_cm = MagicMock()
        begin_cm.__aenter__ = AsyncMock(return_value=MagicMock())
        begin_cm.__aexit__ = AsyncMock(return_value=None)
        bono_engine.begin = MagicMock(return_value=begin_cm)
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
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
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
    assert kwargs["estado"] == 1
    # Las dos columnas de semana llevan el mismo valor: el de la fecha del evento.
    assert kwargs["semana_incidencia"] == 77
    assert kwargs["id_semana"] == kwargs["semana_incidencia"]
    da_repo.list_ausencias.assert_awaited_once()
    assert da_repo.list_ausencias.await_args.kwargs["tipo_inc"] == "FI"


@pytest.mark.asyncio
async def test_sync_inserta_re_con_inc_id_8(db):
    emp = await make_empleado(db, rol="empleado", nombre="Emp RE", no_empleado=100)

    insert_mock = AsyncMock(return_value=601)
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
    )
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
async def test_sync_omite_sin_cambio_cuando_igual(db):
    emp = await make_empleado(db, rol="empleado", nombre="Emp Dup", no_empleado=100)

    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(
            return_value=[
                _bono_row(
                    area_empleado=emp.area_id,
                    subarea_empleado=emp.subarea_id,
                )
            ]
        ),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
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

    assert stats.omitidos_sin_cambio == 1
    assert stats.omitidos_duplicado == 1
    assert stats.insertados == 0
    insert_mock.assert_not_awaited()
    bono_repo.update_evento.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_actualiza_cuando_cambia(db):
    emp = await make_empleado(db, rol="empleado", nombre="Emp Upd", no_empleado=100)

    update_mock = AsyncMock()
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(
            return_value=[
                _bono_row(
                    area_empleado=999,
                    subarea_empleado=888,
                    id_semana=70,
                )
            ]
        ),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=AsyncMock(),
        update_evento=update_mock,
        delete_evento_by_id=AsyncMock(),
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

    assert stats.actualizados == 1
    assert stats.insertados == 0
    update_mock.assert_awaited_once()
    kwargs = update_mock.await_args.kwargs
    assert kwargs["area_empleado"] == emp.area_id
    assert kwargs["subarea_empleado"] == emp.subarea_id
    assert kwargs["id_semana"] == 77


@pytest.mark.asyncio
async def test_sync_elimina_huerfanos(db):
    await make_empleado(db, rol="empleado", nombre="Emp Del", no_empleado=100)

    delete_mock = AsyncMock()
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(
            return_value=[_bono_row(evento_id=42, no_empleado=100)]
        ),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=AsyncMock(),
        update_evento=AsyncMock(),
        delete_evento_by_id=delete_mock,
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[]))

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        stats = await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="FI",
            execute=True,
        )

    assert stats.eliminados == 1
    delete_mock.assert_awaited_once()
    assert delete_mock.await_args.kwargs["evento_id"] == 42


@pytest.mark.asyncio
async def test_sync_no_toca_otros_tipos_en_listado(db):
    """list_eventos_en_rango se llama solo con el tipo del sync (FI)."""
    await make_empleado(db, rol="empleado", nombre="Emp Tipo", no_empleado=100)

    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=AsyncMock(return_value=1),
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[_fila()]))

    patches = _patch_engines(da_repo, bono_repo)
    with patches[0], patches[1], patches[2], patches[3]:
        await SyncAusenciasService(db).sincronizar(
            fecha_inicio=date(2026, 7, 14),
            fecha_fin=date(2026, 7, 14),
            tipo_inc="FI",
            execute=True,
        )

    assert bono_repo.list_eventos_en_rango.await_args.kwargs["tipos"] == ("FI",)


@pytest.mark.asyncio
async def test_sync_omite_sin_empleado(db):
    insert_mock = AsyncMock()
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
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
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=None),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
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
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
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


@pytest.mark.asyncio
async def test_sync_semana_anterior_resuelve_rango(db):
    await make_empleado(db, rol="empleado", nombre="Emp Sem", no_empleado=100)
    rango = SemanaAnteriorRango(
        id_semana=20,
        fecha_inicio=date(2026, 5, 11),
        fecha_fin=date(2026, 5, 17),
    )

    bono_engine = MagicMock()
    bono_engine.dispose = AsyncMock()
    begin_cm = MagicMock()
    begin_cm.__aenter__ = AsyncMock(return_value=MagicMock())
    begin_cm.__aexit__ = AsyncMock(return_value=None)
    bono_engine.begin = MagicMock(return_value=begin_cm)

    insert_mock = AsyncMock(return_value=1)
    bono_repo = AsyncMock(
        resolve_rango_semana_anterior=AsyncMock(return_value=rango),
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=20),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
    )

    async def list_ausencias(**kw):
        return [_fila(fecha=date(2026, 5, 12), tipo_inc=kw["tipo_inc"])]

    da_repo = AsyncMock(list_ausencias=AsyncMock(side_effect=list_ausencias))
    da_engine = MagicMock()
    da_engine.dispose = AsyncMock()

    with (
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
    ):
        stats = await SyncAusenciasService(db).sincronizar_semana_anterior(
            execute=True,
            hoy=date(2026, 5, 20),
        )

    assert stats.fecha_inicio == date(2026, 5, 11)
    assert stats.fecha_fin == date(2026, 5, 17)
    assert stats.id_semana == 20
    assert stats.insertados == 2  # FI + RE
    bono_repo.resolve_rango_semana_anterior.assert_awaited_once_with(date(2026, 5, 20))
    assert insert_mock.await_count == 2


@pytest.mark.asyncio
async def test_sync_semana_anterior_sin_catalogo(db):
    bono_engine = MagicMock()
    bono_engine.dispose = AsyncMock()
    bono_repo = AsyncMock(
        resolve_rango_semana_anterior=AsyncMock(return_value=None),
    )
    with patch(
        "app.services.sync_ausencias_fi_service.BonoProductividadReadClient.create_read_engine",
        return_value=bono_engine,
    ), patch(
        "app.services.sync_ausencias_fi_service.BonoImportadasHistoricoRepository",
        return_value=bono_repo,
    ):
        with pytest.raises(DomainValidationError):
            await SyncAusenciasService(db).sincronizar_semana_anterior(
                execute=True,
                hoy=date(2026, 5, 20),
            )


@pytest.mark.asyncio
async def test_sync_rollback_si_falla_insert(db):
    await make_empleado(db, rol="empleado", nombre="Emp Fail", no_empleado=100)

    begin_cm = MagicMock()
    conn = MagicMock()
    begin_cm.__aenter__ = AsyncMock(return_value=conn)
    begin_cm.__aexit__ = AsyncMock(return_value=None)

    bono_engine = MagicMock()
    bono_engine.dispose = AsyncMock()
    bono_engine.begin = MagicMock(return_value=begin_cm)

    insert_mock = AsyncMock(side_effect=RuntimeError("boom"))
    bono_repo = AsyncMock(
        list_eventos_en_rango=AsyncMock(return_value=[]),
        resolve_semana_id=AsyncMock(return_value=77),
        insert_evento=insert_mock,
        update_evento=AsyncMock(),
        delete_evento_by_id=AsyncMock(),
    )
    da_repo = AsyncMock(list_ausencias=AsyncMock(return_value=[_fila()]))

    patches = _patch_engines(da_repo, bono_repo, bono_engine=bono_engine)
    with patches[0], patches[1], patches[2], patches[3]:
        with pytest.raises(ServiceUnavailableError):
            await SyncAusenciasService(db).sincronizar(
                fecha_inicio=date(2026, 7, 14),
                fecha_fin=date(2026, 7, 14),
                tipo_inc="FI",
                execute=True,
            )

    begin_cm.__aexit__.assert_awaited()


@pytest.mark.asyncio
async def test_api_sincronizar_ausencias_ok(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", nombre="RH Sync", no_empleado=5001)
    headers = await auth_headers(client, rh)

    stats = MagicMock(
        fecha_inicio=date(2026, 5, 11),
        fecha_fin=date(2026, 5, 17),
        id_semana=20,
        leidos=3,
        insertados=1,
        actualizados=1,
        eliminados=1,
        omitidos_sin_empleado=0,
        omitidos_sin_semana=0,
        omitidos_incompletos=0,
        omitidos_sin_cambio=0,
    )

    with patch(
        "app.api.v1.faltas_retardos.router.SyncAusenciasService"
    ) as svc_cls:
        svc_cls.return_value.sincronizar_semana_anterior = AsyncMock(return_value=stats)
        res = await client.post(
            "/api/v1/faltas-retardos/sincronizar-ausencias",
            headers=headers,
        )

    assert res.status_code == 200
    body = res.json()
    assert body["insertados"] == 1
    assert body["actualizados"] == 1
    assert body["eliminados"] == 1
    assert body["id_semana"] == 20


@pytest.mark.asyncio
async def test_api_sincronizar_ausencias_concurrente_409(client, db):
    import asyncio

    import app.api.v1.faltas_retardos.router as fr_router
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", nombre="RH Sync2", no_empleado=5002)
    headers = await auth_headers(client, rh)

    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_sync(*, execute=True, hoy=None):
        started.set()
        await release.wait()
        return MagicMock(
            fecha_inicio=date(2026, 5, 11),
            fecha_fin=date(2026, 5, 17),
            id_semana=20,
            leidos=0,
            insertados=0,
            actualizados=0,
            eliminados=0,
            omitidos_sin_empleado=0,
            omitidos_sin_semana=0,
            omitidos_incompletos=0,
            omitidos_sin_cambio=0,
        )

    with patch(
        "app.api.v1.faltas_retardos.router.SyncAusenciasService"
    ) as svc_cls:
        svc_cls.return_value.sincronizar_semana_anterior = AsyncMock(
            side_effect=slow_sync
        )
        # Ensure lock is free before test
        if fr_router._sync_ausencias_lock.locked():
            fr_router._sync_ausencias_lock.release()

        task1 = asyncio.create_task(
            client.post(
                "/api/v1/faltas-retardos/sincronizar-ausencias",
                headers=headers,
            )
        )
        await started.wait()
        res2 = await client.post(
            "/api/v1/faltas-retardos/sincronizar-ausencias",
            headers=headers,
        )
        release.set()
        res1 = await task1

    assert res1.status_code == 200
    assert res2.status_code == 409


def test_scheduler_ya_no_registra_sync_ausencias_fi():
    import inspect

    import app.main as main_mod

    src = inspect.getsource(main_mod.lifespan)
    assert "sync_ausencias_fi" not in src
    assert "_sync_ausencias_fi_job" not in src
    assert not hasattr(main_mod, "_sync_ausencias_fi_job")


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
