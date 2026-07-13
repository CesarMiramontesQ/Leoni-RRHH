# app/repositories/grado_puesto_repository.py
"""Repositorio de GradoPuesto — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import CompetenciaRequisito, GradoPuesto, PerfilFunciones
from app.repositories.base import BaseRepository


class GradoPuestoRepository(BaseRepository[GradoPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(GradoPuesto, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[GradoPuesto], int]:
        query = select(GradoPuesto)
        if solo_activos:
            query = query.where(GradoPuesto.activo.is_(True))
        if busqueda:
            query = query.where(GradoPuesto.nombre.ilike(f"%{busqueda}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(GradoPuesto.orden).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(GradoPuesto).where(
            GradoPuesto.nombre.ilike(nombre),
            GradoPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(GradoPuesto.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def exists_by_orden(
        self, orden: int, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(GradoPuesto).where(
            GradoPuesto.orden == orden,
            GradoPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(GradoPuesto.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def count_requisitos_usando(self, grado_id: int) -> int:
        query = select(func.count()).select_from(CompetenciaRequisito).where(
            CompetenciaRequisito.grado_id == grado_id,
        )
        count = await self.db.scalar(query)
        return count or 0

    async def count_asignaciones_usando(self, grado_id: int) -> int:
        query = select(func.count()).select_from(PerfilFunciones).where(
            PerfilFunciones.grado_id == grado_id,
            PerfilFunciones.activo.is_(True),
        )
        count = await self.db.scalar(query)
        return count or 0

    async def get_activos_by_ids(self, ids: list[int]) -> list[GradoPuesto]:
        """Devuelve los grados activos cuyos ids esten en la lista."""
        if not ids:
            return []
        result = await self.db.execute(
            select(GradoPuesto).where(
                GradoPuesto.id.in_(ids),
                GradoPuesto.activo.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_activo(self, id: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto).where(
                GradoPuesto.id == id,
                GradoPuesto.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_orden(self, orden: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto).where(
                GradoPuesto.orden == orden,
                GradoPuesto.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()
