"""Tabla `levelup_homeoffice_tomados`: caché en Bono de los días de home office de TRESS."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.homeoffice_tomados import HomeOfficeTomados
from tests.conftest import make_homeoffice_tomados


@pytest.mark.asyncio
async def test_guarda_dias_por_empleado_y_anio(db):
    fila = await make_homeoffice_tomados(
        db, no_empleado=4001, anio=2026, dias_tomados=3
    )
    assert fila.no_empleado == 4001
    assert fila.anio == 2026
    assert Decimal(str(fila.dias_tomados)) == Decimal("3")
    assert fila.actualizado_en is not None


@pytest.mark.asyncio
async def test_un_empleado_puede_tener_una_fila_por_anio(db):
    await make_homeoffice_tomados(db, no_empleado=4002, anio=2025, dias_tomados=12)
    await make_homeoffice_tomados(db, no_empleado=4002, anio=2026, dias_tomados=4)

    result = await db.execute(
        select(HomeOfficeTomados).where(HomeOfficeTomados.no_empleado == 4002)
    )
    anios = sorted(fila.anio for fila in result.scalars().all())
    assert anios == [2025, 2026]


@pytest.mark.asyncio
async def test_no_admite_dos_filas_del_mismo_empleado_y_anio(db):
    """La unique es lo que hace seguro el upsert del sync ante corridas repetidas."""
    await make_homeoffice_tomados(db, no_empleado=4003, anio=2026, dias_tomados=2)

    db.add(HomeOfficeTomados(no_empleado=4003, anio=2026, dias_tomados=9))
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()
