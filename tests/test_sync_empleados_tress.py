"""Caché en Bono de los datos generales del colaborador en TRESS."""

from datetime import date

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
