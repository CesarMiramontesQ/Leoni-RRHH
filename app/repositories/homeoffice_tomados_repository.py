"""Acceso a la caché de home office tomado en Bono (`levelup_homeoffice_tomados`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
"""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.homeoffice_tomados import HomeOfficeTomados
from app.repositories.base import BaseRepository


class HomeOfficeTomadosRepository(BaseRepository[HomeOfficeTomados]):
    def __init__(self, db: AsyncSession):
        super().__init__(HomeOfficeTomados, db)

    async def get_by_no_empleado_anio(
        self, no_empleado: int, anio: int
    ) -> HomeOfficeTomados | None:
        result = await self.db.execute(
            select(HomeOfficeTomados).where(
                HomeOfficeTomados.no_empleado == int(no_empleado),
                HomeOfficeTomados.anio == int(anio),
            )
        )
        return result.scalar_one_or_none()

    async def map_existentes(
        self, anio: int, no_empleados: Sequence[int] | None = None
    ) -> dict[int, HomeOfficeTomados]:
        """Mapa `no_empleado` -> fila de ese año. Sin lista, todas las filas del año.

        El sync lo carga de una sola vez para decidir insert/update en memoria en lugar de
        hacer un SELECT por empleado.
        """
        query = select(HomeOfficeTomados).where(HomeOfficeTomados.anio == int(anio))
        if no_empleados is not None:
            ids = {int(n) for n in no_empleados}
            if not ids:
                return {}
            query = query.where(HomeOfficeTomados.no_empleado.in_(ids))
        result = await self.db.execute(query)
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}
