"""Sincronización del saldo de vacaciones: datos-analisis → `levelup_vacaciones_disponibles`.

datos-analisis no existe en el entorno de tests: se mockea el motor y el repositorio de
lectura (`get_kpis_ciclo`), pero la escritura en Bono es real, así que estos tests cubren
el upsert, los contadores y la idempotencia contra la BD.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.models.vacaciones_disponibles import VacacionesDisponibles
from app.services.sync_vacaciones_disponibles_service import (
    sincronizar_vacaciones_disponibles,
)
from tests.conftest import make_empleado, make_vacaciones_disponibles

CICLO = {
    "disponibles": 8.0,
    "aniversario": 12,
    "derecho_ciclo": 24.0,
    "tomados_ciclo": 16.0,
    "vence": date(2026, 2, 16),
}


class _Ciclo:
    """Lo que devuelve `DatosAnalisisVacacionesRepository.get_kpis_ciclo`."""

    def __init__(self, **kwargs):
        for campo, valor in {**CICLO, **kwargs}.items():
            setattr(self, campo, valor)


def _mock_tress(monkeypatch, *, por_empleado=None, ciclo=None, side_effect=None):
    """Motor y repositorio de datos-analisis simulados.

    `por_empleado` permite devolver un ciclo distinto según el `cb_codigo` consultado.
    """
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_vacaciones_disponibles_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )

    repo = AsyncMock()
    if side_effect is not None:
        repo.get_kpis_ciclo = AsyncMock(side_effect=side_effect)
    elif por_empleado is not None:
        async def _por_empleado(*, cb_codigo):
            return por_empleado[cb_codigo]

        repo.get_kpis_ciclo = AsyncMock(side_effect=_por_empleado)
    else:
        repo.get_kpis_ciclo = AsyncMock(return_value=ciclo or _Ciclo())
    monkeypatch.setattr(
        "app.services.sync_vacaciones_disponibles_service.DatosAnalisisVacacionesRepository",
        lambda _engine: repo,
    )
    return repo, engine


async def _fila(db, no_empleado: int) -> VacacionesDisponibles | None:
    result = await db.execute(
        select(VacacionesDisponibles).where(
            VacacionesDisponibles.no_empleado == no_empleado
        )
    )
    return result.scalar_one_or_none()


@pytest.mark.asyncio
async def test_inserta_empleado_sin_registro_previo(db, monkeypatch):
    _mock_tress(monkeypatch)
    emp = await make_empleado(db, email="sync-nuevo@test", saldo_vacaciones=None)

    stats = await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)

    assert (stats.consultados, stats.insertados, stats.actualizados) == (1, 1, 0)
    fila = await _fila(db, emp.no_empleado)
    assert fila is not None
    assert float(fila.dias_disponibles) == 8.0
    assert float(fila.derecho_ciclo) == 24.0
    assert float(fila.tomados_ciclo) == 16.0
    assert fila.aniversario == 12
    assert fila.fecha_vence == date(2026, 2, 16)
    assert fila.actualizado_en is not None


@pytest.mark.asyncio
async def test_actualiza_empleado_con_registro_existente(db, monkeypatch):
    _mock_tress(monkeypatch)
    emp = await make_empleado(db, email="sync-existente@test", saldo_vacaciones=None)
    await make_vacaciones_disponibles(
        db, no_empleado=emp.no_empleado, dias_disponibles=99.0
    )

    stats = await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)

    assert (stats.insertados, stats.actualizados) == (0, 1)
    fila = await _fila(db, emp.no_empleado)
    assert float(fila.dias_disponibles) == 8.0


@pytest.mark.asyncio
async def test_es_idempotente_y_no_duplica(db, monkeypatch):
    """Dos corridas seguidas: la segunda no inserta ni cambia nada, y sigue habiendo 1 fila."""
    _mock_tress(monkeypatch)
    emp = await make_empleado(db, email="sync-idem@test", saldo_vacaciones=None)

    primera = await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)
    segunda = await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)

    assert (primera.insertados, primera.actualizados) == (1, 0)
    assert (segunda.insertados, segunda.actualizados, segunda.omitidos) == (0, 0, 1)

    total = await db.execute(
        select(func.count())
        .select_from(VacacionesDisponibles)
        .where(VacacionesDisponibles.no_empleado == emp.no_empleado)
    )
    assert total.scalar_one() == 1


@pytest.mark.asyncio
async def test_procesa_todos_los_empleados_activos(db, monkeypatch):
    activo_a = await make_empleado(db, email="sync-act-a@test", saldo_vacaciones=None)
    activo_b = await make_empleado(db, email="sync-act-b@test", saldo_vacaciones=None)
    baja = await make_empleado(
        db, email="sync-baja@test", estado_id=2, saldo_vacaciones=None
    )
    _mock_tress(
        monkeypatch,
        por_empleado={
            activo_a.no_empleado: _Ciclo(disponibles=5.0),
            activo_b.no_empleado: _Ciclo(disponibles=7.0),
        },
    )

    stats = await sincronizar_vacaciones_disponibles(db)

    assert stats.consultados == 2
    assert stats.insertados == 2
    assert float((await _fila(db, activo_a.no_empleado)).dias_disponibles) == 5.0
    assert float((await _fila(db, activo_b.no_empleado)).dias_disponibles) == 7.0
    # Las bajas no se consultan: TRESS no tiene periodos vigentes para ellas.
    assert await _fila(db, baja.no_empleado) is None


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_levanta_connection_error(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.sync_vacaciones_disponibles_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )
    emp = await make_empleado(db, email="sync-noconf@test", saldo_vacaciones=None)

    with pytest.raises(ConnectionError):
        await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)

    assert await _fila(db, emp.no_empleado) is None


@pytest.mark.asyncio
async def test_error_de_consulta_se_cuenta_y_no_escribe(db, monkeypatch):
    _, engine = _mock_tress(
        monkeypatch, side_effect=OperationalError("stmt", {}, Exception("boom"))
    )
    emp = await make_empleado(db, email="sync-error@test", saldo_vacaciones=None)

    stats = await sincronizar_vacaciones_disponibles(db, no_empleado=emp.no_empleado)

    assert stats.errores == 1
    assert stats.consultados == 0
    assert str(emp.no_empleado) in stats.mensajes_error[0]
    # Con el detalle del driver: solo el nombre de la clase no permite distinguir un
    # timeout de red de un error de permisos.
    assert "boom" in stats.mensajes_error[0]
    assert await _fila(db, emp.no_empleado) is None
    engine.dispose.assert_awaited()


@pytest.mark.asyncio
async def test_aborta_tras_una_racha_de_fallos(db, monkeypatch):
    """Si la BD externa se cae, no se pagan 800 timeouts: se corta la corrida."""
    _mock_tress(monkeypatch, side_effect=OperationalError("stmt", {}, Exception("boom")))
    for i in range(8):
        await make_empleado(db, email=f"sync-racha-{i}@test", saldo_vacaciones=None)

    stats = await sincronizar_vacaciones_disponibles(db)

    assert stats.errores == 5  # _MAX_FALLOS_CONSECUTIVOS
    assert stats.consultados == 0


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    _mock_tress(monkeypatch)
    emp = await make_empleado(db, email="sync-dryrun@test", saldo_vacaciones=None)

    stats = await sincronizar_vacaciones_disponibles(
        db, no_empleado=emp.no_empleado, execute=False
    )

    assert stats.insertados == 1
    assert await _fila(db, emp.no_empleado) is None
