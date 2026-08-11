"""Sync de turno por colaborador: DATOS_ANALISIS (TRESS) → `levelup_turnos_empleados`.

TRESS se simula (`_mock_tress`); la escritura en Bono es real contra el fixture `db`, así
que lo que se prueba de verdad es el upsert.

El caso que más importa de este archivo es que el sync **no toque la columna `comedor`**:
es dato propio de la app y un upsert descuidado borraría en silencio la asignación de
comedor de toda la planta, sin producir un solo error.
"""

from unittest.mock import AsyncMock

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import OperationalError

from app.models.turnos_empleados import TurnoEmpleado
from app.services.sync_turnos_empleados_service import sincronizar_turnos_empleados
from tests.conftest import make_empleado, make_turno_empleado


def _mock_tress(monkeypatch, *, por_empleado=None, side_effect=None):
    """Motor y repositorio de datos-analisis simulados."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_turnos_empleados_service.DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    if side_effect is not None:
        repo.get_turno_por_empleado = AsyncMock(side_effect=side_effect)
    else:
        repo.get_turno_por_empleado = AsyncMock(return_value=por_empleado or {})
    monkeypatch.setattr(
        "app.services.sync_turnos_empleados_service.DatosAnalisisCatalogosReadRepository",
        lambda _engine: repo,
    )
    return repo, engine


async def _filas(db) -> dict[str, TurnoEmpleado]:
    result = await db.execute(select(TurnoEmpleado))
    return {f.no_empleado: f for f in result.scalars().all()}


@pytest.fixture(autouse=True)
async def _limpiar(db):
    await db.execute(delete(TurnoEmpleado))
    await db.flush()
    yield


@pytest.mark.asyncio
async def test_el_sync_no_toca_la_asignacion_de_comedor(db, monkeypatch):
    """La columna `comedor` la escribe RH desde la app; TRESS no la conoce."""
    await make_turno_empleado(db, "406", "Carla", tu_codigo="G1", comedor=7)
    _mock_tress(monkeypatch, por_empleado={"406": "G9"})

    await sincronizar_turnos_empleados(db, origen="test")

    fila = (await _filas(db))["406"]
    assert fila.tu_codigo == "G9"  # el turno sí se corrige
    assert fila.comedor == 7  # el comedor se conserva intacto


@pytest.mark.asyncio
async def test_inserta_solo_a_quien_existe_en_bono(db, monkeypatch):
    """Sembrar filas huérfanas dejaría la pantalla contando gente que Bono no conoce."""
    await make_empleado(db, rol="empleado", email="sync_emp_ok@test.leoni", no_empleado=406)
    _mock_tress(monkeypatch, por_empleado={"406": "G9", "999999": "G5"})

    stats = await sincronizar_turnos_empleados(db, origen="test")

    assert stats.insertados == 1
    assert stats.sin_empleado_en_bono == 1
    assert set(await _filas(db)) == {"406"}


@pytest.mark.asyncio
async def test_el_numero_con_sufijo_punto_cero_no_duplica_la_fila(db, monkeypatch):
    """El seed viejo de Excel dejó filas "553.0"; indexar solo por "553" chocaría con el UNIQUE."""
    await make_turno_empleado(db, "553.0", "Dora", tu_codigo=None, comedor=3)
    _mock_tress(monkeypatch, por_empleado={"553": "ROT321"})

    stats = await sincronizar_turnos_empleados(db, origen="test")

    filas = await _filas(db)
    assert set(filas) == {"553.0"}
    assert filas["553.0"].tu_codigo == "ROT321"
    assert filas["553.0"].comedor == 3
    assert stats.insertados == 0


@pytest.mark.asyncio
async def test_una_baja_se_marca_inactiva_pero_no_se_borra(db, monkeypatch):
    await make_turno_empleado(db, "406", "Carla", tu_codigo="G9", comedor=7)
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    _mock_tress(monkeypatch, por_empleado={"80": "ROT321"})

    stats = await sincronizar_turnos_empleados(db, origen="test")

    filas = await _filas(db)
    assert stats.bajas_marcadas == 1
    # La fila sobrevive con su comedor, por si la persona reingresa.
    assert filas["406"].activo is False
    assert filas["406"].comedor == 7
    assert filas["80"].activo is True


@pytest.mark.asyncio
async def test_un_reingreso_vuelve_a_marcar_activo(db, monkeypatch):
    await make_turno_empleado(db, "406", "Carla", tu_codigo="G9", activo=False)
    _mock_tress(monkeypatch, por_empleado={"406": "G9"})

    stats = await sincronizar_turnos_empleados(db, origen="test")

    assert (await _filas(db))["406"].activo is True
    assert stats.actualizados == 1


@pytest.mark.asyncio
async def test_cero_colaboradores_aborta_sin_escribir(db, monkeypatch):
    """Una planta en marcha siempre tiene gente: cero filas es una consulta rota.

    Sin este freno, toda la plantilla quedaría marcada como baja y sin ventana de comida.
    """
    await make_turno_empleado(db, "406", "Carla", tu_codigo="G9", comedor=7)
    _mock_tress(monkeypatch, por_empleado={})

    with pytest.raises(ValueError):
        await sincronizar_turnos_empleados(db, origen="test")

    fila = (await _filas(db))["406"]
    assert fila.activo is True
    assert fila.comedor == 7


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    await make_empleado(db, rol="empleado", email="sync_emp_dry@test.leoni", no_empleado=406)
    _mock_tress(monkeypatch, por_empleado={"406": "G9"})

    stats = await sincronizar_turnos_empleados(db, origen="test", execute=False)

    assert stats.insertados == 1
    assert await _filas(db) == {}


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_falla_claro(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.sync_turnos_empleados_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_turnos_empleados(db, origen="test")


@pytest.mark.asyncio
async def test_un_error_de_lectura_conserva_el_detalle_del_driver(db, monkeypatch):
    """Sin el detalle, un timeout de login y un error de permisos se ven idénticos."""
    _mock_tress(
        monkeypatch,
        side_effect=OperationalError("SELECT 1", {}, Exception("Login timeout expired")),
    )

    with pytest.raises(ConnectionError) as exc:
        await sincronizar_turnos_empleados(db, origen="test")

    assert "Login timeout expired" in str(exc.value)


@pytest.mark.asyncio
async def test_el_filtro_por_empleado_no_marca_bajas(db, monkeypatch):
    """Depurar una sola persona no debe dar de baja al resto de la planta."""
    await make_turno_empleado(db, "406", "Carla", tu_codigo="G9")
    await make_turno_empleado(db, "80", "Beto", tu_codigo="ROT321")
    _mock_tress(monkeypatch, por_empleado={"406": "G5", "80": "ROT321"})

    stats = await sincronizar_turnos_empleados(db, origen="test", solo_no_empleado=406)

    filas = await _filas(db)
    assert filas["406"].tu_codigo == "G5"
    assert filas["80"].activo is True
    assert stats.bajas_marcadas == 0
