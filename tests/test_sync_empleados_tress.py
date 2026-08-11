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
