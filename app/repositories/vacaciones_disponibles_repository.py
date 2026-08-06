"""Acceso a la caché de saldos de vacaciones en Bono (`levelup_vacaciones_disponibles`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
"""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vacaciones_disponibles import VacacionesDisponibles
from app.repositories.base import BaseRepository


class VacacionesDisponiblesRepository(BaseRepository[VacacionesDisponibles]):
    def __init__(self, db: AsyncSession):
        super().__init__(VacacionesDisponibles, db)

    async def get_by_no_empleado(self, no_empleado: int) -> VacacionesDisponibles | None:
        result = await self.db.execute(
            select(VacacionesDisponibles).where(
                VacacionesDisponibles.no_empleado == int(no_empleado)
            )
        )
        return result.scalar_one_or_none()

    async def map_existentes(
        self, no_empleados: Sequence[int] | None = None
    ) -> dict[int, VacacionesDisponibles]:
        """Mapa `no_empleado` -> fila. Sin argumento, devuelve toda la tabla.

        El sync lo carga de una sola vez para decidir insert/update en memoria en lugar de
        hacer un SELECT por empleado.
        """
        query = select(VacacionesDisponibles)
        if no_empleados is not None:
            ids = {int(n) for n in no_empleados}
            if not ids:
                return {}
            query = query.where(VacacionesDisponibles.no_empleado.in_(ids))
        result = await self.db.execute(query)
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}
