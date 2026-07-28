# app/repositories/grado_puesto_repository.py
"""
Repositorio de GradoPuesto (Career Level) — acceso a datos async.

La unicidad de `codigo` y `nombre` es POR career path, no global: P1 y M1 conviven.
Toda comprobacion de duplicados recibe el career path.

El nivel no tiene orden propio: se ordena por el `orden` del Global Grade al que
equivale. Los niveles sin equivalencia van al final (`NULLS LAST`) y, dentro del
mismo grado, se desempata por codigo para que el listado sea estable.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clasificacion_puesto import (
    CareerLevelGradeMapping,
    CareerPath,
    GlobalGrade,
)
from app.models.talento import CompetenciaRequisito, GradoPuesto, PerfilFunciones
from app.repositories.base import BaseRepository


class GradoPuestoRepository(BaseRepository[GradoPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(GradoPuesto, db)

    @staticmethod
    def _carga_completa() -> tuple:
        """Career path y equivalencia: sin ellos el nivel no sabe su posicion."""
        return (
            selectinload(GradoPuesto.career_path),
            selectinload(GradoPuesto.equivalencia).selectinload(
                CareerLevelGradeMapping.global_grade
            ),
        )

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[GradoPuesto], int]:
        query = select(GradoPuesto)
        if solo_activos:
            query = query.where(GradoPuesto.activo.is_(True))
        if career_path_id:
            query = query.where(GradoPuesto.career_path_id == career_path_id)
        if busqueda:
            query = query.where(
                GradoPuesto.nombre.ilike(f"%{busqueda}%")
                | GradoPuesto.codigo.ilike(f"%{busqueda}%")
            )

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # El career path y la equivalencia se precargan: el response los
        # denormaliza y leerlos en lazy dentro de una sesion async revienta con
        # MissingGreenlet.
        query = (
            query.options(
                selectinload(GradoPuesto.career_path),
                selectinload(GradoPuesto.equivalencia).selectinload(
                    CareerLevelGradeMapping.global_grade
                ),
            )
            .join(CareerPath, CareerPath.id == GradoPuesto.career_path_id)
            .outerjoin(
                CareerLevelGradeMapping,
                (CareerLevelGradeMapping.career_level_id == GradoPuesto.id)
                & CareerLevelGradeMapping.activo.is_(True),
            )
            .outerjoin(
                GlobalGrade, GlobalGrade.id == CareerLevelGradeMapping.global_grade_id
            )
            .order_by(
                CareerPath.codigo,
                GlobalGrade.orden.nulls_last(),
                GradoPuesto.codigo,
            )
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().unique().all()), total or 0

    async def exists_by_nombre(
        self, career_path_id: int, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(GradoPuesto).where(
            GradoPuesto.career_path_id == career_path_id,
            GradoPuesto.nombre.ilike(nombre),
            GradoPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(GradoPuesto.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def exists_by_codigo(
        self, career_path_id: int, codigo: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(GradoPuesto).where(
            GradoPuesto.career_path_id == career_path_id,
            GradoPuesto.codigo.ilike(codigo),
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
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(
                GradoPuesto.id.in_(ids),
                GradoPuesto.activo.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_activo(self, id: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(
                GradoPuesto.id == id,
                GradoPuesto.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_with_career_path(self, id: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(GradoPuesto.id == id)
        )
        return result.scalar_one_or_none()

