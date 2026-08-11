"""Caché en Bono de los datos generales del colaborador en TRESS."""

from datetime import date, datetime
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import text

from tests.conftest import make_empleado_tress


@pytest.mark.asyncio
async def test_repo_devuelve_fecha_ingreso_de_la_cache(db):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    await make_empleado_tress(db, no_empleado=553, fecha_ingreso=date(2019, 3, 15))

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(553) == date(2019, 3, 15)


@pytest.mark.asyncio
async def test_repo_sin_fila_devuelve_none(db):
    """Sin sincronizar no se inventa una fecha: la Vista 360 pinta vacío."""
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(999999) is None


@pytest.mark.asyncio
async def test_repo_tolera_fila_con_fecha_nula(db):
    """`CB_FEC_ING` puede venir vacío en TRESS; la fila existe pero sin fecha."""
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    await make_empleado_tress(db, no_empleado=554, fecha_ingreso=None)

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(554) is None


def test_sql_colabora_datos_generales_sin_binds_ni_ddl():
    """Sin parámetros (se lee toda COLABORA) y sin una sola sentencia de esquema.

    Los tokens `:algo` en comentarios también los toma SQLAlchemy como bind, así que el
    set de binds debe quedar vacío.
    """
    from app.repositories.datos_analisis_catalogos_read_repository import (
        load_colabora_datos_generales_sql,
    )

    sql = load_colabora_datos_generales_sql()

    assert set(text(sql)._bindparams) == set()
    assert "FROM dbo.COLABORA" in sql
    assert "CB_FEC_ING" in sql
    # No se filtra por CB_ACTIVO: la Vista 360 se abre también sobre bajas.
    assert "CB_ACTIVO" not in sql.upper()
    for prohibido in ("CREATE ", "ALTER ", "DROP ", "DELETE ", "TRUNCATE ", "INSERT ", "UPDATE "):
        assert prohibido not in sql.upper()


@pytest.mark.asyncio
async def test_parsing_logica_get_datos_generales_por_empleado():
    """Cubre los cinco casos de comportamiento del parseo: coacción de int, normalización
    de datetime a date, descarte de filas inválidas, y distinción entre empleado sin
    fila y empleado con fila pero sin fecha.

    Mockea _filas para devolver filas controladas y verifica que la salida sea exacta,
    incluyendo la AUSENCIA de las claves descartadas.
    """
    from app.repositories.datos_analisis_catalogos_read_repository import (
        DatosAnalisisCatalogosReadRepository,
    )

    # Engine falso; no se usa en el test porque parcharemos _filas.
    fake_engine = None

    repo = DatosAnalisisCatalogosReadRepository(fake_engine)

    # Filas controladas que cubren los cinco casos:
    # 1. Fila normal: no_empleado numérico + fecha_ingreso como datetime
    # 2. fecha_ingreso ya es date
    # 3. no_empleado es None (descartada)
    # 4. no_empleado no coaccionable a int (descartada)
    # 5. fecha_ingreso ausente/None (entra con valor None)
    controlled_rows = [
        {"no_empleado": 553, "fecha_ingreso": datetime(2019, 3, 15, 10, 30)},
        {"no_empleado": 554, "fecha_ingreso": date(2020, 6, 20)},
        {"no_empleado": None, "fecha_ingreso": date(2021, 1, 1)},
        {"no_empleado": "abc", "fecha_ingreso": date(2022, 12, 31)},
        {"no_empleado": 555, "fecha_ingreso": None},
    ]

    # Parchea _filas para devolver las filas controladas.
    repo._filas = AsyncMock(return_value=controlled_rows)

    result = await repo.get_datos_generales_por_empleado()

    # Esperado: solo las tres claves válidas. Las filas con no_empleado inválido se descartan.
    # La distinción entre empleado sin fila (clave ausente) y empleado con fila pero
    # sin fecha (clave con valor None) es crítica aguas abajo.
    expected = {
        553: date(2019, 3, 15),  # datetime normalizado a date
        554: date(2020, 6, 20),  # date ya pasaba tal cual
        555: None,               # clave existe con valor None
    }

    assert result == expected


@pytest.fixture
def fake_datos_generales(monkeypatch):
    """Sustituye la lectura a DATOS_ANALISIS por un dict, sin tocar SQL Server."""

    def _apply(por_empleado):
        class _FakeEngine:
            async def dispose(self):
                return None

        class _FakeRepo:
            def __init__(self, engine):
                self._engine = engine

            async def get_datos_generales_por_empleado(self):
                return dict(por_empleado)

        monkeypatch.setattr(
            "app.services.sync_empleados_tress_service.DatosAnalisisReadClient.create_read_engine",
            lambda: _FakeEngine(),
        )
        monkeypatch.setattr(
            "app.services.sync_empleados_tress_service.DatosAnalisisCatalogosReadRepository",
            _FakeRepo,
        )

    return _apply


@pytest.mark.asyncio
async def test_sync_inserta_y_actualiza_sin_borrar(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress
    from tests.conftest import make_empleado

    nuevo = await make_empleado(db, email="et-nuevo@test")
    existente = await make_empleado(db, email="et-existente@test")
    await make_empleado_tress(db, no_empleado=existente.no_empleado, fecha_ingreso=date(2010, 1, 1))
    # Fila cacheada de alguien que ya no viene de TRESS: NO se borra.
    await make_empleado_tress(db, no_empleado=777001, fecha_ingreso=date(2005, 5, 5))
    await db.commit()

    fake_datos_generales(
        {
            nuevo.no_empleado: date(2019, 3, 15),
            existente.no_empleado: date(2011, 2, 2),
        }
    )

    stats = await sincronizar_empleados_tress(db, origen="test", execute=True)

    repo = EmpleadosTressRepository(db)
    assert stats.insertados == 1
    assert stats.actualizados == 1
    assert await repo.get_fecha_ingreso(nuevo.no_empleado) == date(2019, 3, 15)
    assert await repo.get_fecha_ingreso(existente.no_empleado) == date(2011, 2, 2)
    # El que dejó de venir de TRESS conserva su fila y su fecha.
    assert await repo.get_fecha_ingreso(777001) == date(2005, 5, 5)


@pytest.mark.asyncio
async def test_sync_omite_numeros_que_bono_no_conoce(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    fake_datos_generales({888001: date(2020, 1, 1)})

    stats = await sincronizar_empleados_tress(db, origen="test", execute=True)

    assert stats.sin_empleado_en_bono == 1
    assert stats.insertados == 0
    assert await EmpleadosTressRepository(db).get_fecha_ingreso(888001) is None


@pytest.mark.asyncio
async def test_sync_aborta_si_tress_devuelve_cero_filas(db, fake_datos_generales):
    """Cero colaboradores es consulta rota, no planta vacía: no se escribe nada."""
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    fake_datos_generales({})

    with pytest.raises(ValueError, match="0 colaboradores"):
        await sincronizar_empleados_tress(db, origen="test", execute=True)


@pytest.mark.asyncio
async def test_sync_dry_run_no_persiste(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress
    from tests.conftest import make_empleado

    emp = await make_empleado(db, email="et-dry@test")
    await db.commit()
    # Capturado antes del rollback: `db.rollback()` expira todos los objetos de la
    # sesión (a diferencia de `commit()` con `expire_on_commit=False`), y releer
    # `emp.no_empleado` después dispararía una carga perezosa fuera de contexto async
    # (`MissingGreenlet`). El mismo patrón se evita en el sync hermano de turnos usando
    # un literal en vez del atributo del ORM tras la corrida.
    no_empleado = emp.no_empleado
    fake_datos_generales({no_empleado: date(2018, 6, 1)})

    stats = await sincronizar_empleados_tress(db, origen="test", execute=False)

    assert stats.insertados == 1
    assert await EmpleadosTressRepository(db).get_fecha_ingreso(no_empleado) is None


@pytest.mark.asyncio
async def test_sync_solo_no_empleado_filtra_al_resto_de_la_fuente(db, fake_datos_generales):
    """`--no-empleado` sincroniza solo esa persona; el resto de la fuente no entra.

    No basta comprobar que el objetivo se sincronizó: si el filtro nunca filtrara, ese
    caso también pasaría. La prueba real es la AUSENCIA del otro empleado.
    """
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress
    from tests.conftest import make_empleado

    objetivo = await make_empleado(db, email="et-filtro-obj@test")
    otro = await make_empleado(db, email="et-filtro-otro@test")
    await db.commit()

    fake_datos_generales(
        {
            objetivo.no_empleado: date(2019, 3, 15),
            otro.no_empleado: date(2020, 6, 20),
        }
    )

    stats = await sincronizar_empleados_tress(
        db, origen="test", execute=True, solo_no_empleado=objetivo.no_empleado
    )

    repo = EmpleadosTressRepository(db)
    assert stats.insertados == 1
    assert await repo.get_fecha_ingreso(objetivo.no_empleado) == date(2019, 3, 15)
    # El otro empleado venía en la fuente pero el filtro lo descartó: sin fila.
    assert await repo.get_fecha_ingreso(otro.no_empleado) is None


@pytest.mark.asyncio
async def test_sync_sin_datos_analisis_configurada_levanta_connection_error(db, monkeypatch):
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    monkeypatch.setattr(
        "app.services.sync_empleados_tress_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_empleados_tress(db, origen="test", execute=True)
