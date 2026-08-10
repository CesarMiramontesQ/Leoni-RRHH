"""Sync de personal activo por turno: DATOS_ANALISIS (TRESS) → `levelup_turnos_uso`.

TRESS se simula (`_mock_tress`); la escritura en Bono es real contra el fixture `db`, así
que lo que se prueba de verdad es el upsert.
"""

from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.models.turnos_uso import TurnoUso
from app.services.sync_turnos_uso_service import sincronizar_turnos_uso


def _mock_tress(monkeypatch, *, por_turno=None, side_effect=None):
    """Motor y repositorio de datos-analisis simulados."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_turnos_uso_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    if side_effect is not None:
        repo.get_empleados_por_turno = AsyncMock(side_effect=side_effect)
    else:
        repo.get_empleados_por_turno = AsyncMock(return_value=por_turno or {})
    monkeypatch.setattr(
        "app.services.sync_turnos_uso_service.DatosAnalisisTurnosUsoReadRepository",
        lambda _engine: repo,
    )
    return repo, engine


async def _filas(db) -> dict[str, int]:
    result = await db.execute(select(TurnoUso))
    return {f.tu_codigo.strip(): f.empleados_activos for f in result.scalars().all()}


@pytest.fixture(autouse=True)
async def _limpiar(db):
    from sqlalchemy import delete

    await db.execute(delete(TurnoUso))
    await db.flush()
    yield


@pytest.mark.asyncio
async def test_inserta_los_turnos_que_reporta_tress(db, monkeypatch):
    _mock_tress(monkeypatch, por_turno={"05A": 181, "G9": 83})

    stats = await sincronizar_turnos_uso(db, origen="test")

    assert stats.turnos_origen == 2
    assert stats.insertados == 2
    assert await _filas(db) == {"05A": 181, "G9": 83}


@pytest.mark.asyncio
async def test_actualiza_el_conteo_de_un_turno_existente(db, monkeypatch):
    _mock_tress(monkeypatch, por_turno={"05A": 181})
    await sincronizar_turnos_uso(db, origen="test")

    _mock_tress(monkeypatch, por_turno={"05A": 200})
    stats = await sincronizar_turnos_uso(db, origen="test")

    assert stats.actualizados == 1
    assert stats.insertados == 0
    assert await _filas(db) == {"05A": 200}


@pytest.mark.asyncio
async def test_corrida_repetida_no_duplica_y_cuenta_omitido(db, monkeypatch):
    _mock_tress(monkeypatch, por_turno={"05A": 181})
    await sincronizar_turnos_uso(db, origen="test")

    _mock_tress(monkeypatch, por_turno={"05A": 181})
    stats = await sincronizar_turnos_uso(db, origen="test")

    assert stats.omitidos == 1
    assert stats.insertados == 0
    assert await _filas(db) == {"05A": 181}


@pytest.mark.asyncio
async def test_un_turno_que_se_queda_sin_gente_baja_a_cero_pero_no_se_borra(
    db, monkeypatch
):
    """Distinguir «turno sin personal» de «turno nunca sincronizado» exige conservar la fila."""
    _mock_tress(monkeypatch, por_turno={"05A": 181, "G9": 83})
    await sincronizar_turnos_uso(db, origen="test")

    _mock_tress(monkeypatch, por_turno={"05A": 181})
    stats = await sincronizar_turnos_uso(db, origen="test")

    assert stats.puestos_a_cero == 1
    assert await _filas(db) == {"05A": 181, "G9": 0}


@pytest.mark.asyncio
async def test_cero_turnos_en_origen_aborta_sin_escribir(db, monkeypatch):
    """Freno de seguridad: una planta en marcha siempre tiene turnos con personal."""
    _mock_tress(monkeypatch, por_turno={"05A": 181})
    await sincronizar_turnos_uso(db, origen="test")

    _mock_tress(monkeypatch, por_turno={})
    with pytest.raises(ValueError, match="0 turnos"):
        await sincronizar_turnos_uso(db, origen="test")

    # La caché anterior queda intacta: no se puso todo a cero.
    assert await _filas(db) == {"05A": 181}


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    _mock_tress(monkeypatch, por_turno={"05A": 181})

    stats = await sincronizar_turnos_uso(db, origen="test", execute=False)

    assert stats.insertados == 1
    assert await _filas(db) == {}


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_levanta_connection_error(
    db, monkeypatch
):
    monkeypatch.setattr(
        "app.services.sync_turnos_uso_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )
    with pytest.raises(ConnectionError, match="no está configurada"):
        await sincronizar_turnos_uso(db, origen="test")

    assert await _filas(db) == {}


@pytest.mark.asyncio
async def test_error_de_lectura_conserva_el_detalle_del_driver(db, monkeypatch):
    """Sin el detalle, un timeout y un error de permisos se ven idénticos en el CLI."""
    _, engine = _mock_tress(
        monkeypatch, side_effect=OperationalError("SELECT", {}, Exception("boom"))
    )
    with pytest.raises(ConnectionError, match="boom"):
        await sincronizar_turnos_uso(db, origen="test")

    engine.dispose.assert_awaited()
    assert await _filas(db) == {}
