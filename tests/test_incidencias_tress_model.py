"""levelup_incidencias_tress — caché en Bono de las incidencias que viven en TRESS."""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.incidencias_tress import IncidenciaTress


@pytest.mark.asyncio
async def test_guarda_una_fila_de_ausencia(db):
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=1001,
            no_empleado=553,
            empleado_id=10,
            tipo="falta_injustificada",
            fecha_evento=date(2026, 7, 1),
        )
    )
    await db.flush()

    fila = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 1001)
        )
    ).scalar_one()
    assert fila.tipo == "falta_injustificada"
    assert fila.fecha_fin is None
    assert fila.empleado_id == 10


@pytest.mark.asyncio
async def test_empleado_id_puede_ser_nulo(db):
    """Hay CB_CODIGO en TRESS que no existen en Bono; la fila no se descarta."""
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=1002,
            no_empleado=999999,
            empleado_id=None,
            tipo="retardo",
            fecha_evento=date(2026, 7, 2),
        )
    )
    await db.flush()

    fila = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 1002)
        )
    ).scalar_one()
    assert fila.empleado_id is None


@pytest.mark.asyncio
async def test_origen_y_origen_id_son_unicos(db):
    """Es la llave que hace idempotente al sync."""
    for _ in range(2):
        db.add(
            IncidenciaTress(
                origen="permiso",
                origen_id=2001,
                no_empleado=553,
                tipo="matrimonio",
                fecha_evento=date(2026, 7, 3),
                fecha_fin=date(2026, 7, 4),
            )
        )
    with pytest.raises(IntegrityError):
        await db.flush()


@pytest.mark.asyncio
async def test_mismo_origen_id_en_distinto_origen_convive(db):
    """AUSENCIA.LLAVE y PERMISO.LLAVE son secuencias independientes."""
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=3001,
            no_empleado=553,
            tipo="retardo",
            fecha_evento=date(2026, 7, 5),
        )
    )
    db.add(
        IncidenciaTress(
            origen="permiso",
            origen_id=3001,
            no_empleado=553,
            tipo="defuncion",
            fecha_evento=date(2026, 7, 5),
            fecha_fin=date(2026, 7, 7),
        )
    )
    await db.flush()

    filas = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 3001)
        )
    ).scalars().all()
    assert len(filas) == 2
