# app/utils/clasificacion_bootstrap.py
"""
Helpers de arranque de la clasificacion de puestos (WTW).

Los usan los seeds y los scripts de demo: un Career Level no puede existir sin
career path, asi que necesitan poder obtener el de por defecto sin duplicar la
logica de get-or-create.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clasificacion_puesto import CareerPath
from app.utils.seed_clasificacion_puesto import (
    CAREER_PATH_DEFAULT_CODIGO,
    CAREER_PATHS_SEED,
)


async def get_or_create_career_path(
    session: AsyncSession, codigo: str = CAREER_PATH_DEFAULT_CODIGO
) -> CareerPath:
    """Devuelve el career path con ese codigo, creandolo desde la semilla si falta."""
    result = await session.execute(
        select(CareerPath).where(CareerPath.codigo == codigo)
    )
    career_path = result.scalar_one_or_none()
    if career_path:
        return career_path

    semilla = next(
        (cp for cp in CAREER_PATHS_SEED if cp["codigo"] == codigo),
        {"codigo": codigo, "nombre": codigo},
    )
    career_path = CareerPath(
        codigo=semilla["codigo"], nombre=semilla["nombre"], activo=True
    )
    session.add(career_path)
    await session.flush()
    return career_path
