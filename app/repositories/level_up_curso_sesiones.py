from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_up import CursoEmpleado, CursoPuesto, CursoSesion
from app.repositories.base import BaseRepository


class CursoSesionRepository(BaseRepository[CursoSesion]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoSesion, db)

    async def list_by_curso(
        self,
        curso_id: int,
        offset: int,
        limit: int,
        estado: str | None = None,
    ) -> tuple[list[CursoSesion], int]:
        query = select(CursoSesion).where(CursoSesion.curso_id == curso_id)

        if estado:
            query = query.where(CursoSesion.estado == estado)

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        query = query.order_by(CursoSesion.fecha_inicio.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def count_inscritos(self, sesion_id: int) -> int:
        puestos_count = await self.db.scalar(
            select(func.count()).select_from(CursoPuesto).where(
                CursoPuesto.sesion_id == sesion_id
            )
        )
        empleados_count = await self.db.scalar(
            select(func.count()).select_from(CursoEmpleado).where(
                CursoEmpleado.sesion_id == sesion_id
            )
        )
        return (puestos_count or 0) + (empleados_count or 0)
