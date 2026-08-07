"""Acceso a `levelup_incidencias_tress`, la caché en Bono de las incidencias de TRESS.

Los métodos de escritura los usa el sync; los de lectura y agregado, la página
Incidencias. Ninguno toca datos-analisis.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incidencias_tress import IncidenciaTress


class IncidenciasTressCacheRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sync ─────────────────────────────────────────────────────────────────

    async def map_existentes(
        self, desde: date | None, hasta: date | None
    ) -> dict[tuple[str, int], IncidenciaTress]:
        """Filas del rango indexadas por su llave de idempotencia."""
        stmt = select(IncidenciaTress)
        if desde is not None:
            stmt = stmt.where(IncidenciaTress.fecha_evento >= desde)
        if hasta is not None:
            stmt = stmt.where(IncidenciaTress.fecha_evento <= hasta)
        result = await self.db.execute(stmt)
        return {
            (fila.origen, fila.origen_id): fila for fila in result.scalars().all()
        }

    async def delete_llaves(self, llaves: set[tuple[str, int]]) -> int:
        """Borra por (origen, origen_id). Devuelve cuántas filas se fueron."""
        if not llaves:
            return 0
        borradas = 0
        for origen, origen_id in llaves:
            result = await self.db.execute(
                delete(IncidenciaTress).where(
                    IncidenciaTress.origen == origen,
                    IncidenciaTress.origen_id == origen_id,
                )
            )
            borradas += int(result.rowcount or 0)
        return borradas
