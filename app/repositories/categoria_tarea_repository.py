# app/repositories/categoria_tarea_repository.py
"""Repositorio de CategoriaTarea — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clasificacion_puesto import CategoriaTarea
from app.models.talento import PerfilTarea, TareaCatalogo
from app.repositories.base import BaseRepository


class CategoriaTareaRepository(BaseRepository[CategoriaTarea]):
    def __init__(self, db: AsyncSession):
        super().__init__(CategoriaTarea, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CategoriaTarea], int]:
        query = select(CategoriaTarea)
        if solo_activos:
            query = query.where(CategoriaTarea.activo.is_(True))
        if busqueda:
            query = query.where(CategoriaTarea.nombre.ilike(f"%{busqueda}%"))

        total = await self.db.scalar(select(func.count()).select_from(query.subquery()))

        query = query.order_by(CategoriaTarea.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(CategoriaTarea).where(
            CategoriaTarea.nombre.ilike(nombre),
            CategoriaTarea.activo.is_(True),
        )
        if exclude_id:
            query = query.where(CategoriaTarea.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def count_tareas_usando(self, categoria_id: int) -> int:
        """Usos en el catalogo de tareas y en las tareas ya asignadas a un perfil."""
        catalogo = await self.db.scalar(
            select(func.count()).select_from(TareaCatalogo).where(
                TareaCatalogo.categoria_tarea_id == categoria_id,
                TareaCatalogo.activo.is_(True),
            )
        )
        perfiles = await self.db.scalar(
            select(func.count()).select_from(PerfilTarea).where(
                PerfilTarea.categoria_tarea_id == categoria_id
            )
        )
        return (catalogo or 0) + (perfiles or 0)

    async def get_activo(self, id: int) -> CategoriaTarea | None:
        result = await self.db.execute(
            select(CategoriaTarea).where(
                CategoriaTarea.id == id, CategoriaTarea.activo.is_(True)
            )
        )
        return result.scalar_one_or_none()
