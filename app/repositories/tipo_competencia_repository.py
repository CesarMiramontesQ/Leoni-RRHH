# app/repositories/tipo_competencia_repository.py
"""Repositorio de TipoCompetencia — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import Competencia, TipoCompetencia
from app.repositories.base import BaseRepository


class TipoCompetenciaRepository(BaseRepository[TipoCompetencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(TipoCompetencia, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[TipoCompetencia], int]:
        query = (
            select(TipoCompetencia)
            .options(selectinload(TipoCompetencia.grupo_competencia))
        )
        if solo_activos:
            query = query.where(TipoCompetencia.activo.is_(True))
        if busqueda:
            query = query.where(TipoCompetencia.nombre.ilike(f"%{busqueda}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(TipoCompetencia.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(TipoCompetencia).where(
            TipoCompetencia.nombre.ilike(nombre),
            TipoCompetencia.activo.is_(True),
        )
        if exclude_id:
            query = query.where(TipoCompetencia.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def count_competencias_usando(self, tipo_id: int) -> int:
        query = select(func.count()).select_from(Competencia).where(
            Competencia.tipo_competencia_id == tipo_id,
            Competencia.activo.is_(True),
        )
        count = await self.db.scalar(query)
        return count or 0

    async def get_with_grupo(self, id: int) -> TipoCompetencia | None:
        result = await self.db.execute(
            select(TipoCompetencia)
            .options(selectinload(TipoCompetencia.grupo_competencia))
            .where(TipoCompetencia.id == id)
        )
        return result.scalar_one_or_none()

    async def get_activo(self, id: int) -> TipoCompetencia | None:
        result = await self.db.execute(
            select(TipoCompetencia).where(
                TipoCompetencia.id == id,
                TipoCompetencia.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_activo_with_grupo(self, id: int) -> TipoCompetencia | None:
        result = await self.db.execute(
            select(TipoCompetencia)
            .options(selectinload(TipoCompetencia.grupo_competencia))
            .where(
                TipoCompetencia.id == id,
                TipoCompetencia.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()
