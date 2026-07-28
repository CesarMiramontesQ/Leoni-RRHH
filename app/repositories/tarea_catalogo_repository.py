# app/repositories/tarea_catalogo_repository.py
"""Repositorio de TareaCatalogo — acceso a datos async."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import TareaCatalogo
from app.repositories.base import BaseRepository


class TareaCatalogoRepository(BaseRepository[TareaCatalogo]):
    def __init__(self, db: AsyncSession):
        super().__init__(TareaCatalogo, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        categoria: str | None = None,
        busqueda: str | None = None,
        categoria_tarea_id: int | None = None,
    ) -> tuple[list[TareaCatalogo], int]:
        """Lista paginada con filtros opcionales."""
        query = select(TareaCatalogo).where(TareaCatalogo.activo.is_(True))

        if categoria_tarea_id:
            query = query.where(TareaCatalogo.categoria_tarea_id == categoria_tarea_id)
        # Filtro legacy por el texto libre; sigue vivo mientras queden filas sin
        # migrar al catalogo de categorias.
        if categoria:
            query = query.where(TareaCatalogo.categoria == categoria)
        if busqueda:
            pattern = f"%{busqueda}%"
            query = query.where(
                or_(
                    TareaCatalogo.nombre.ilike(pattern),
                    TareaCatalogo.descripcion.ilike(pattern),
                )
            )

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = (
            query.options(selectinload(TareaCatalogo.categoria_tarea))
            .order_by(TareaCatalogo.nombre)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def get_with_categoria(self, id: int) -> TareaCatalogo | None:
        result = await self.db.execute(
            select(TareaCatalogo)
            .options(selectinload(TareaCatalogo.categoria_tarea))
            .where(TareaCatalogo.id == id)
        )
        return result.scalar_one_or_none()

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        """Verifica duplicado por nombre."""
        query = select(func.count()).select_from(TareaCatalogo).where(
            TareaCatalogo.nombre.ilike(nombre),
            TareaCatalogo.activo.is_(True),
        )
        if exclude_id:
            query = query.where(TareaCatalogo.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0
