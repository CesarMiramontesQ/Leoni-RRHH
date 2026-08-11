"""Acceso a la caché de datos generales del colaborador en Bono (`levelup_empleados_tress`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados_tress import EmpleadoTress
from app.repositories.base import BaseRepository


class EmpleadosTressRepository(BaseRepository[EmpleadoTress]):
    def __init__(self, db: AsyncSession):
        super().__init__(EmpleadoTress, db)

    async def get_fecha_ingreso(self, no_empleado: int) -> date | None:
        """`CB_FEC_ING` cacheada. `None` si no hay fila o si TRESS no la tenía."""
        result = await self.db.execute(
            select(EmpleadoTress.fecha_ingreso).where(
                EmpleadoTress.no_empleado == int(no_empleado)
            )
        )
        return result.scalar_one_or_none()

    async def map_existentes(self) -> dict[int, EmpleadoTress]:
        """Todas las filas por `no_empleado`, para que el sync decida insert/update en memoria."""
        result = await self.db.execute(select(EmpleadoTress))
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}
