"""Consulta agregada de home office en datos-analisis (dbo.PERMISO).

datos-analisis no existe en el entorno de tests: se comprueba el SQL en sí (binds y
filtros, que es donde se cometen los errores caros) y el mapeo del resultado.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import text

from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
    load_home_office_dias_por_empleado_sql,
)


def test_sql_expone_solo_los_binds_de_fecha():
    """Sin bind de empleado: la consulta trae todos y el filtrado se hace en memoria."""
    parsed = text(load_home_office_dias_por_empleado_sql())
    assert set(parsed._bindparams.keys()) == {"desde", "hasta"}


def test_sql_filtra_el_tipo_ho_y_agrupa_por_empleado():
    sql = load_home_office_dias_por_empleado_sql()
    # PM_TIPO es char(3) con padding ('HO '), por eso el RTRIM.
    assert "RTRIM(PM_TIPO) = 'HO'" in sql
    # Se acota por fecha de inicio: PM_FEC_FIN es exclusiva en TRESS.
    assert "PM_FEC_INI >= :desde" in sql
    assert "PM_FEC_INI < :hasta" in sql
    assert "GROUP BY CB_CODIGO" in sql
    assert "SUM(PM_DIAS)" in sql


def _engine_con_filas(filas):
    """Motor simulado cuyo `connect()` devuelve `filas` como mappings."""
    result = MagicMock()
    result.mappings.return_value.all.return_value = filas
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=result)
    engine = MagicMock()
    engine.connect.return_value.__aenter__ = AsyncMock(return_value=conn)
    engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)
    return engine, conn


@pytest.mark.asyncio
async def test_devuelve_un_mapa_numero_de_empleado_a_dias():
    engine, conn = _engine_con_filas([
        {"no_empleado": 101, "dias_home_office": 3},
        {"no_empleado": 202, "dias_home_office": Decimal("1.50")},
    ])

    dias = await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_por_empleado(
        desde=date(2026, 1, 1), hasta=date(2027, 1, 1)
    )

    assert dias == {101: Decimal("3"), 202: Decimal("1.50")}
    assert conn.execute.await_args.args[1] == {
        "desde": date(2026, 1, 1),
        "hasta": date(2027, 1, 1),
    }


@pytest.mark.asyncio
async def test_sin_filas_devuelve_un_mapa_vacio():
    engine, _ = _engine_con_filas([])

    dias = await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_por_empleado(
        desde=date(2026, 1, 1), hasta=date(2027, 1, 1)
    )

    assert dias == {}
