"""Acceso a `levelup_turnos_uso`, la caché de personal activo por turno."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.turnos_uso import TurnoUso
from app.repositories.base import BaseRepository


class TurnosUsoRepository(BaseRepository[TurnoUso]):
    def __init__(self, db: AsyncSession):
        super().__init__(TurnoUso, db)

    async def map_existentes(self) -> dict[str, TurnoUso]:
        """Todas las filas indexadas por código, para el upsert del sync."""
        result = await self.db.execute(select(TurnoUso))
        return {fila.tu_codigo.strip(): fila for fila in result.scalars().all()}

    async def map_conteos(self) -> dict[str, int]:
        """``{tu_codigo: empleados activos}`` para filtrar y contar en la pantalla."""
        result = await self.db.execute(
            select(TurnoUso.tu_codigo, TurnoUso.empleados_activos)
        )
        return {codigo.strip(): int(total) for codigo, total in result.all()}
