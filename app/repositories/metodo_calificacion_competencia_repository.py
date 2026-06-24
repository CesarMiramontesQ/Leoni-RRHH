# app/repositories/metodo_calificacion_competencia_repository.py
"""Repositorio de MetodoCalificacionCompetencia — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talento import CompetenciaRequisito, MetodoCalificacionCompetencia
from app.repositories.base import BaseRepository


class MetodoCalificacionCompetenciaRepository(BaseRepository[MetodoCalificacionCompetencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(MetodoCalificacionCompetencia, db)

    async def list_activos(self) -> list[MetodoCalificacionCompetencia]:
        result = await self.db.execute(
            select(MetodoCalificacionCompetencia)
            .where(MetodoCalificacionCompetencia.activo.is_(True))
            .order_by(MetodoCalificacionCompetencia.orden)
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[MetodoCalificacionCompetencia]:
        result = await self.db.execute(
            select(MetodoCalificacionCompetencia).order_by(
                MetodoCalificacionCompetencia.orden
            )
        )
        return list(result.scalars().all())

    async def count_activos(self) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(MetodoCalificacionCompetencia)
            .where(MetodoCalificacionCompetencia.activo.is_(True))
        )
        return count or 0

    async def next_valor(self) -> int:
        max_valor = await self.db.scalar(
            select(func.max(MetodoCalificacionCompetencia.valor))
        )
        return (max_valor or 0) + 1

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(MetodoCalificacionCompetencia).where(
            MetodoCalificacionCompetencia.nombre.ilike(nombre),
            MetodoCalificacionCompetencia.activo.is_(True),
        )
        if exclude_id:
            query = query.where(MetodoCalificacionCompetencia.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def exists_by_orden(
        self, orden: int, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(MetodoCalificacionCompetencia).where(
            MetodoCalificacionCompetencia.orden == orden,
            MetodoCalificacionCompetencia.activo.is_(True),
        )
        if exclude_id:
            query = query.where(MetodoCalificacionCompetencia.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def get_activo(self, id: int) -> MetodoCalificacionCompetencia | None:
        result = await self.db.execute(
            select(MetodoCalificacionCompetencia).where(
                MetodoCalificacionCompetencia.id == id,
                MetodoCalificacionCompetencia.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_valor(self, valor: int) -> MetodoCalificacionCompetencia | None:
        result = await self.db.execute(
            select(MetodoCalificacionCompetencia).where(
                MetodoCalificacionCompetencia.valor == valor,
                MetodoCalificacionCompetencia.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def count_requisitos_usando_valor(self, valor: int) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(CompetenciaRequisito)
            .where(CompetenciaRequisito.nivel_requerido == valor)
        )
        return count or 0

    async def valores_activos(self) -> set[int]:
        result = await self.db.execute(
            select(MetodoCalificacionCompetencia.valor).where(
                MetodoCalificacionCompetencia.activo.is_(True)
            )
        )
        return {row[0] for row in result.all()}
