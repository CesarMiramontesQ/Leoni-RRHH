from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import Habilidad
from app.repositories.base import BaseRepository


class HabilidadRepository(BaseRepository[Habilidad]):
    def __init__(self, db: AsyncSession):
        super().__init__(Habilidad, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        tipo: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Habilidad], int]:
        query = select(Habilidad).where(Habilidad.activo.is_(True))

        if tipo:
            query = query.where(Habilidad.tipo == tipo)
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(Habilidad.nombre.ilike(f"%{escaped}%", escape="\\"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(Habilidad.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(Habilidad).where(
            Habilidad.nombre.ilike(nombre),
            Habilidad.activo.is_(True),
        )
        if exclude_id is not None:
            query = query.where(Habilidad.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0
