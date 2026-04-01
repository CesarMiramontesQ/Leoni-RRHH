# app/repositories/incidencia_repository.py
"""
Repositorio de Incidencias y Evidencias.
"""

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incidencias import Evidencia, Incidencia
from app.repositories.base import BaseRepository


class IncidenciaRepository(BaseRepository[Incidencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(Incidencia, db)

    async def list_by_estado(
        self,
        estado: str,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Incidencia], int | None]:
        filters = [Incidencia.estado == estado]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Incidencia], int | None]:
        filters = [Incidencia.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def get_with_evidencias(self, id: int) -> Incidencia | None:
        result = await self.db.execute(
            select(Incidencia)
            .options(
                selectinload(Incidencia.empleado),
                selectinload(Incidencia.registrador),
            )
            .where(Incidencia.id == id)
        )
        return result.scalar_one_or_none()

    async def count_evidencias(self, incidencia_id: int) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.count())
            .select_from(Evidencia)
            .where(
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
        )
        return result.scalar_one()


class EvidenciaRepository(BaseRepository[Evidencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(Evidencia, db)

    async def list_by_incidencia(self, incidencia_id: int) -> list[Evidencia]:
        result = await self.db.execute(
            select(Evidencia)
            .where(
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
            .order_by(Evidencia.id)
        )
        return list(result.scalars().all())

    async def get_by_id_and_incidencia(
        self, evidencia_id: int, incidencia_id: int
    ) -> Evidencia | None:
        result = await self.db.execute(
            select(Evidencia)
            .where(
                Evidencia.id == evidencia_id,
                Evidencia.entidad_tipo == "incidencia",
                Evidencia.entidad_id == incidencia_id,
                Evidencia.activo == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()
