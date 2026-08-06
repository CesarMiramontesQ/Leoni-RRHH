"""Sincronización de home office: datos-analisis → `levelup_homeoffice_tomados`.

datos-analisis no existe en el entorno de tests: se mockea el motor y la consulta agregada
(`get_dias_por_empleado`), pero la escritura en Bono es real, así que estos tests cubren el
upsert, los contadores y la idempotencia contra la BD.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.models.homeoffice_tomados import HomeOfficeTomados
from app.services.sync_homeoffice_tomados_service import (
    rango_anio,
    sincronizar_homeoffice_empleado_background,
    sincronizar_homeoffice_tomados,
)
from tests.conftest import make_empleado, make_homeoffice_tomados

ANIO = 2026


def _mock_tress(monkeypatch, *, dias=None, side_effect=None):
    """Motor y repositorio de datos-analisis simulados."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )

    repo = AsyncMock()
    if side_effect is not None:
        repo.get_dias_por_empleado = AsyncMock(side_effect=side_effect)
    else:
        repo.get_dias_por_empleado = AsyncMock(return_value=dias or {})
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisHomeOfficeReadRepository",
        lambda _engine: repo,
    )
    return repo, engine


async def _fila(db, no_empleado: int, anio: int = ANIO):
    result = await db.execute(
        select(HomeOfficeTomados).where(
            HomeOfficeTomados.no_empleado == no_empleado,
            HomeOfficeTomados.anio == anio,
        )
    )
    return result.scalar_one_or_none()


def test_rango_anio_es_semiabierto():
    assert rango_anio(2026) == (date(2026, 1, 1), date(2027, 1, 1))


@pytest.mark.asyncio
async def test_inserta_empleado_sin_registro_previo(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-nuevo@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("3")})

    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert fila is not None
    assert Decimal(str(fila.dias_tomados)) == Decimal("3.00")
    assert (stats.consultados, stats.insertados, stats.actualizados, stats.omitidos) == (
        1, 1, 0, 0,
    )


@pytest.mark.asyncio
async def test_actualiza_empleado_con_registro_existente(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-upd@test")
    await make_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, dias_tomados=1
    )
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("5")})

    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert Decimal(str(fila.dias_tomados)) == Decimal("5.00")
    assert (stats.insertados, stats.actualizados, stats.omitidos) == (0, 1, 0)


@pytest.mark.asyncio
async def test_empleado_sin_home_office_se_guarda_como_cero(db, monkeypatch):
    """Sin filas en dbo.PERMISO el empleado tomó 0 días: es un dato, no una ausencia."""
    emp = await make_empleado(db, email="ho-sync-cero@test")
    _mock_tress(monkeypatch, dias={})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert fila is not None
    assert Decimal(str(fila.dias_tomados)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_es_idempotente_y_no_duplica(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-idem@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("2")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )
    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    result = await db.execute(
        select(HomeOfficeTomados).where(
            HomeOfficeTomados.no_empleado == emp.no_empleado,
            HomeOfficeTomados.anio == ANIO,
        )
    )
    assert len(result.scalars().all()) == 1
    # Sin cambios: se cuenta como omitido, no como actualizado.
    assert (stats.insertados, stats.actualizados, stats.omitidos) == (0, 0, 1)


@pytest.mark.asyncio
async def test_la_corrida_masiva_cubre_a_los_activos(db, monkeypatch):
    uno = await make_empleado(db, email="ho-sync-masivo-1@test")
    dos = await make_empleado(db, email="ho-sync-masivo-2@test")
    _mock_tress(monkeypatch, dias={uno.no_empleado: Decimal("4")})

    stats = await sincronizar_homeoffice_tomados(db, anio=ANIO, origen="scheduler")

    assert stats.consultados >= 2
    assert Decimal(str((await _fila(db, uno.no_empleado)).dias_tomados)) == Decimal("4.00")
    # El que no aparece en TRESS también queda escrito, con cero.
    assert Decimal(str((await _fila(db, dos.no_empleado)).dias_tomados)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_solo_toca_el_anio_pedido(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-anio@test")
    await make_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=2025, dias_tomados=12
    )
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("1")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    assert Decimal(str((await _fila(db, emp.no_empleado, 2025)).dias_tomados)) == Decimal("12.00")
    assert Decimal(str((await _fila(db, emp.no_empleado, ANIO)).dias_tomados)) == Decimal("1.00")


@pytest.mark.asyncio
async def test_pide_a_tress_el_rango_del_anio(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-rango@test")
    repo, _ = _mock_tress(monkeypatch, dias={})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    kwargs = repo.get_dias_por_empleado.await_args.kwargs
    assert kwargs["desde"] == date(ANIO, 1, 1)
    assert kwargs["hasta"] == date(ANIO + 1, 1, 1)


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-dry@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("7")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual", execute=False
    )

    assert await _fila(db, emp.no_empleado) is None


@pytest.mark.asyncio
async def test_sin_datos_analisis_configurada_levanta_connection_error(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-sinconf@test")
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_homeoffice_tomados(
            db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
        )

    assert await _fila(db, emp.no_empleado) is None


@pytest.mark.asyncio
async def test_error_de_consulta_no_escribe_nada(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-boom@test")
    _, engine = _mock_tress(
        monkeypatch, side_effect=OperationalError("stmt", {}, Exception("boom"))
    )

    with pytest.raises(ConnectionError):
        await sincronizar_homeoffice_tomados(
            db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
        )

    assert await _fila(db, emp.no_empleado) is None
    # El motor se libera aunque la consulta falle.
    engine.dispose.assert_awaited()


@pytest.mark.asyncio
async def test_el_sync_de_fondo_nunca_propaga(db, monkeypatch):
    """La aprobación ya está confirmada: un fallo aquí se registra, no revienta."""
    import contextlib

    @contextlib.asynccontextmanager
    async def _sesion_de_test():
        yield db

    # `sincronizar_homeoffice_empleado_background` abre su propia sesión (en tests
    # apuntaría a la BD real de Bono); se sustituye por la sesión del fixture para que el
    # fallo que se prueba sea el del sync, no el de la conexión.
    monkeypatch.setattr(
        "app.core.database.AsyncSessionLocal", lambda: _sesion_de_test()
    )
    fallo = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service.sincronizar_homeoffice_tomados",
        fallo,
    )

    await sincronizar_homeoffice_empleado_background(12345, solicitud_id=7)

    fallo.assert_awaited_once()
