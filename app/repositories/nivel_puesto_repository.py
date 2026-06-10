# app/repositories/nivel_puesto_repository.py
"""Repositorio de NivelPuesto — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import NivelPuesto, PuestoPerfil
from app.repositories.base import BaseRepository


class NivelPuestoRepository(BaseRepository[NivelPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(NivelPuesto, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[NivelPuesto], int]:
        query = select(NivelPuesto)
        if solo_activos:
            query = query.where(NivelPuesto.activo.is_(True))
        if busqueda:
            query = query.where(NivelPuesto.nombre.ilike(f"%{busqueda}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(NivelPuesto.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(NivelPuesto).where(
            NivelPuesto.nombre.ilike(nombre),
            NivelPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(NivelPuesto.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def count_puestos_usando(self, nivel_id: int) -> int:
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.nivel_id == nivel_id,
            PuestoPerfil.activo.is_(True),
        )
        count = await self.db.scalar(query)
        return count or 0

    async def get_activo(self, id: int) -> NivelPuesto | None:
        result = await self.db.execute(
            select(NivelPuesto).where(
                NivelPuesto.id == id,
                NivelPuesto.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()
