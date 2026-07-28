# app/repositories/grupo_competencia_repository.py
"""Repositorio de GrupoCompetencia — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import GrupoCompetencia, TipoCompetencia
from app.repositories.base import BaseRepository


class GrupoCompetenciaRepository(BaseRepository[GrupoCompetencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(GrupoCompetencia, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[GrupoCompetencia], int]:
        query = select(GrupoCompetencia)
        if solo_activos:
            query = query.where(GrupoCompetencia.activo.is_(True))
        if busqueda:
            query = query.where(GrupoCompetencia.nombre.ilike(f"%{busqueda}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(GrupoCompetencia.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(GrupoCompetencia).where(
            GrupoCompetencia.nombre.ilike(nombre),
            GrupoCompetencia.activo.is_(True),
        )
        if exclude_id:
            query = query.where(GrupoCompetencia.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def exists_by_codigo(self, codigo: str) -> bool:
        """Incluye inactivos: `codigo` es unico en toda la tabla, no solo entre activos."""
        query = select(func.count()).select_from(GrupoCompetencia).where(
            GrupoCompetencia.codigo == codigo
        )
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def count_tipos_usando(self, grupo_id: int) -> int:
        query = select(func.count()).select_from(TipoCompetencia).where(
            TipoCompetencia.grupo_competencia_id == grupo_id,
            TipoCompetencia.activo.is_(True),
        )
        count = await self.db.scalar(query)
        return count or 0

    async def get_activo(self, id: int) -> GrupoCompetencia | None:
        result = await self.db.execute(
            select(GrupoCompetencia).where(
                GrupoCompetencia.id == id,
                GrupoCompetencia.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()
