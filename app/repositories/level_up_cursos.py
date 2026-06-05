from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import Curso
from app.repositories.base import BaseRepository


class CursoRepository(BaseRepository[Curso]):
    def __init__(self, db: AsyncSession):
        super().__init__(Curso, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        tipo: str | None = None,
        clasificacion: str | None = None,
        obligatorio: bool | None = None,
        categoria: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Curso], int]:
        query = select(Curso).where(Curso.activo.is_(True))

        if tipo:
            query = query.where(Curso.tipo == tipo)
        if clasificacion:
            query = query.where(Curso.clasificacion == clasificacion)
        if obligatorio is not None:
            query = query.where(Curso.obligatorio.is_(obligatorio))
        if categoria:
            query = query.where(Curso.categoria == categoria)
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(Curso.nombre.ilike(f"%{escaped}%", escape="\\"))

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(Curso.nombre.asc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def exists_by_nombre(
        self, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(Curso).where(
            Curso.nombre.ilike(nombre),
            Curso.activo.is_(True),
        )
        if exclude_id is not None:
            query = query.where(Curso.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0
