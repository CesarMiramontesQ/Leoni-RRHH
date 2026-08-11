"""Sync de catálogos: DATOS_ANALISIS (TRESS) → `levelup_turnos` y `levelup_horarios`.

TRESS se simula; la escritura en Bono es real contra el fixture `db`, así que lo que se
prueba de verdad es el upsert.

Antes existía solo la carga manual del catálogo de turnos. Eso bastaba cuando la réplica
servía para listar nombres; deja de bastar ahora que de `tu_rit_pat` y `tu_rit_ini`
depende a qué hora come la gente.
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.horarios import Horario
from app.models.turnos import Turno
from app.services.sync_turnos_catalogo_service import (
    sincronizar_catalogos_tress,
    sincronizar_horarios_catalogo,
    sincronizar_turnos_catalogo,
)
from tests.conftest import make_turno, reset_turnos_horario


def _turno_origen(tu_codigo: str, **overrides) -> dict:
    """Fila de `dbo.TURNO` tal como la devuelve el SELECT del sync (40 columnas)."""
    fila = {
        "tu_codigo": tu_codigo.ljust(6),
        "tu_descrip": "Turno de prueba",
        "tu_dias": 5,
        "tu_dobles": Decimal("9.00"),
        "tu_domingo": Decimal("0.00"),
        "tu_festivo": "N",
        "tu_horario": 0,
        "tu_jornada": Decimal("48.00"),
        "tu_nomina": 0,
        "tu_rit_ini": datetime(1899, 12, 30),
        "tu_rit_pat": "",
        "tu_tip_jor": 1,
        "tu_ingles": "",
        "tu_texto": "",
        "tu_numero": Decimal("0.00"),
        "tu_hor_fes": "      ",
        "tu_vaca_ha": Decimal("1.00"),
        "tu_vaca_sa": Decimal("0.00"),
        "tu_vaca_de": Decimal("0.00"),
        "tu_sub_cta": "",
        "tu_dias_ba": Decimal("0.00000"),
        "tu_activo": "S",
        "tu_tip_jt": 0,
        "llave": 1,
        "tu_nivel0": "",
        "tu_sat_jor": "      ",
    }
    for i in range(1, 8):
        fila[f"tu_hor_{i}"] = "      "
        fila[f"tu_tip_{i}"] = 0
    fila.update(overrides)
    return fila


def _horario_origen(ho_codigo: str, **overrides) -> dict:
    fila = {
        "ho_codigo": ho_codigo,
        "ho_descrip": "Jornada de prueba",
        "ho_intime": "0600",
        "ho_outtime": "1400",
        "ho_jornada": Decimal("8.00"),
        "ho_activo": "S",
    }
    fila.update(overrides)
    return fila


def _mock_tress(monkeypatch, *, turnos=None, horarios=None):
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_turnos_catalogo_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    repo.get_turnos_catalogo = AsyncMock(return_value=turnos if turnos is not None else [])
    repo.get_horarios_catalogo = AsyncMock(
        return_value=horarios if horarios is not None else []
    )
    monkeypatch.setattr(
        "app.services.sync_turnos_catalogo_service.DatosAnalisisCatalogosReadRepository",
        lambda _engine: repo,
    )
    return repo


@pytest.fixture(autouse=True)
async def _limpiar(db):
    await reset_turnos_horario(db)
    yield


@pytest.mark.asyncio
async def test_inserta_los_turnos_y_las_jornadas_que_reporta_tress(db, monkeypatch):
    _mock_tress(
        monkeypatch,
        turnos=[_turno_origen("01"), _turno_origen("G9", tu_rit_pat="2:001,0,2:003")],
        horarios=[_horario_origen("001"), _horario_origen("003", ho_intime="2200")],
    )

    resultado = await sincronizar_catalogos_tress(db, origen="test")

    assert [s.insertados for s in resultado] == [2, 2]
    turnos = {t.tu_codigo.strip() for t in (await db.execute(select(Turno))).scalars()}
    jornadas = {h.ho_codigo for h in (await db.execute(select(Horario))).scalars()}
    assert turnos == {"01", "G9"}
    assert jornadas == {"001", "003"}


@pytest.mark.asyncio
async def test_actualiza_un_turno_existente_sin_duplicarlo(db, monkeypatch):
    await make_turno(db, "01", "Nombre viejo")
    _mock_tress(monkeypatch, turnos=[_turno_origen("01", tu_descrip="Nombre nuevo")])

    stats = await sincronizar_turnos_catalogo(db, origen="test")

    filas = (await db.execute(select(Turno))).scalars().all()
    assert len(filas) == 1
    assert filas[0].tu_descrip == "Nombre nuevo"
    assert (stats.insertados, stats.actualizados) == (0, 1)


@pytest.mark.asyncio
async def test_un_turno_sin_cambios_no_cuenta_como_actualizado(db, monkeypatch):
    _mock_tress(monkeypatch, turnos=[_turno_origen("01")])
    await sincronizar_turnos_catalogo(db, origen="test")

    stats = await sincronizar_turnos_catalogo(db, origen="test")

    assert (stats.insertados, stats.actualizados, stats.omitidos) == (0, 0, 1)


@pytest.mark.asyncio
async def test_un_cambio_de_ritmo_se_reporta_aparte(db, monkeypatch):
    """Editar el patrón o el ancla mueve el ciclo de todo el personal del turno.

    Es el único cambio capaz de correr la hora de comida de cientos de personas de un día
    para otro sin que nadie lo pida, así que no puede pasar como una actualización más.
    """
    _mock_tress(monkeypatch, turnos=[_turno_origen("G9", tu_rit_pat="2:001,0,2:003")])
    await sincronizar_turnos_catalogo(db, origen="test")

    _mock_tress(
        monkeypatch,
        turnos=[
            _turno_origen(
                "G9", tu_rit_pat="2:003,0,2:001", tu_rit_ini=datetime(2026, 1, 1)
            )
        ],
    )
    stats = await sincronizar_turnos_catalogo(db, origen="test")

    assert stats.ritmo_cambiado == ["G9"]


@pytest.mark.asyncio
async def test_un_cambio_de_descripcion_no_se_reporta_como_ritmo(db, monkeypatch):
    _mock_tress(monkeypatch, turnos=[_turno_origen("01")])
    await sincronizar_turnos_catalogo(db, origen="test")

    _mock_tress(monkeypatch, turnos=[_turno_origen("01", tu_descrip="Otro nombre")])
    stats = await sincronizar_turnos_catalogo(db, origen="test")

    assert stats.actualizados == 1
    assert stats.ritmo_cambiado == []


@pytest.mark.asyncio
async def test_un_turno_retirado_de_tress_no_se_borra(db, monkeypatch):
    """Conserva referencias históricas y la configuración que cuelga de él."""
    await make_turno(db, "ZZ", "Turno viejo")
    _mock_tress(monkeypatch, turnos=[_turno_origen("01")])

    await sincronizar_turnos_catalogo(db, origen="test")

    codigos = {t.tu_codigo.strip() for t in (await db.execute(select(Turno))).scalars()}
    assert codigos == {"01", "ZZ"}


@pytest.mark.asyncio
async def test_cero_filas_aborta_sin_escribir(db, monkeypatch):
    """TRESS siempre tiene catálogo: cero filas es una consulta rota, no un vaciado."""
    await make_turno(db, "01", "Matutino")
    _mock_tress(monkeypatch, turnos=[])

    with pytest.raises(ValueError):
        await sincronizar_turnos_catalogo(db, origen="test")

    filas = (await db.execute(select(Turno))).scalars().all()
    assert len(filas) == 1


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    _mock_tress(monkeypatch, horarios=[_horario_origen("001")])

    stats = await sincronizar_horarios_catalogo(db, origen="test", execute=False)

    assert stats.insertados == 1
    assert (await db.execute(select(Horario))).scalars().all() == []


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_falla_claro(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.sync_turnos_catalogo_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_turnos_catalogo(db, origen="test")
