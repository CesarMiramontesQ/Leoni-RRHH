# app/repositories/clasificacion_puesto_repository.py
"""Repositorios de los catalogos de clasificacion de puesto — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clasificacion_puesto import (
    CareerPath,
    DisciplinaPuesto,
    FuncionPuesto,
    GlobalGrade,
    CareerLevelGradeMapping,
)
from app.models.talento import GradoPuesto, PuestoPerfil
from app.repositories.base import BaseRepository


class CareerPathRepository(BaseRepository[CareerPath]):
    def __init__(self, db: AsyncSession):
        super().__init__(CareerPath, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CareerPath], int]:
        query = select(CareerPath)
        if solo_activos:
            query = query.where(CareerPath.activo.is_(True))
        if busqueda:
            query = query.where(CareerPath.nombre.ilike(f"%{busqueda}%"))

        total = await self.db.scalar(select(func.count()).select_from(query.subquery()))

        query = query.order_by(CareerPath.codigo).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(CareerPath).where(
            CareerPath.nombre.ilike(nombre),
            CareerPath.activo.is_(True),
        )
        if exclude_id:
            query = query.where(CareerPath.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def exists_by_codigo(self, codigo: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(CareerPath).where(
            CareerPath.codigo.ilike(codigo),
            CareerPath.activo.is_(True),
        )
        if exclude_id:
            query = query.where(CareerPath.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def count_grados_usando(self, career_path_id: int) -> int:
        query = select(func.count()).select_from(GradoPuesto).where(
            GradoPuesto.career_path_id == career_path_id,
            GradoPuesto.activo.is_(True),
        )
        return await self.db.scalar(query) or 0

    async def count_perfiles_usando(self, career_path_id: int) -> int:
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.career_path_id == career_path_id,
            PuestoPerfil.activo.is_(True),
        )
        return await self.db.scalar(query) or 0

    async def get_activo(self, id: int) -> CareerPath | None:
        result = await self.db.execute(
            select(CareerPath).where(
                CareerPath.id == id, CareerPath.activo.is_(True)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_codigo(self, codigo: str) -> CareerPath | None:
        result = await self.db.execute(
            select(CareerPath).where(CareerPath.codigo == codigo)
        )
        return result.scalar_one_or_none()


class FuncionPuestoRepository(BaseRepository[FuncionPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(FuncionPuesto, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[FuncionPuesto], int]:
        query = select(FuncionPuesto)
        if solo_activos:
            query = query.where(FuncionPuesto.activo.is_(True))
        if busqueda:
            query = query.where(FuncionPuesto.nombre.ilike(f"%{busqueda}%"))

        total = await self.db.scalar(select(func.count()).select_from(query.subquery()))

        query = query.order_by(FuncionPuesto.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(FuncionPuesto).where(
            FuncionPuesto.nombre.ilike(nombre),
            FuncionPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(FuncionPuesto.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def exists_by_codigo(self, codigo: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(FuncionPuesto).where(
            FuncionPuesto.codigo.ilike(codigo),
            FuncionPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(FuncionPuesto.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def count_disciplinas_usando(self, funcion_id: int) -> int:
        query = select(func.count()).select_from(DisciplinaPuesto).where(
            DisciplinaPuesto.funcion_id == funcion_id,
            DisciplinaPuesto.activo.is_(True),
        )
        return await self.db.scalar(query) or 0

    async def count_perfiles_usando(self, funcion_id: int) -> int:
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.funcion_id == funcion_id,
            PuestoPerfil.activo.is_(True),
        )
        return await self.db.scalar(query) or 0

    async def get_activo(self, id: int) -> FuncionPuesto | None:
        result = await self.db.execute(
            select(FuncionPuesto).where(
                FuncionPuesto.id == id, FuncionPuesto.activo.is_(True)
            )
        )
        return result.scalar_one_or_none()


class DisciplinaPuestoRepository(BaseRepository[DisciplinaPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(DisciplinaPuesto, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        funcion_id: int | None = None,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[DisciplinaPuesto], int]:
        query = select(DisciplinaPuesto)
        if solo_activos:
            query = query.where(DisciplinaPuesto.activo.is_(True))
        if funcion_id:
            query = query.where(DisciplinaPuesto.funcion_id == funcion_id)
        if busqueda:
            query = query.where(DisciplinaPuesto.nombre.ilike(f"%{busqueda}%"))

        total = await self.db.scalar(select(func.count()).select_from(query.subquery()))

        # La funcion se precarga: el response la denormaliza y leerla en lazy dentro
        # de una sesion async revienta con MissingGreenlet.
        query = (
            query.options(selectinload(DisciplinaPuesto.funcion))
            .order_by(DisciplinaPuesto.nombre)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def get_with_funcion(self, id: int) -> DisciplinaPuesto | None:
        result = await self.db.execute(
            select(DisciplinaPuesto)
            .options(selectinload(DisciplinaPuesto.funcion))
            .where(DisciplinaPuesto.id == id)
        )
        return result.scalar_one_or_none()

    async def exists_by_nombre(
        self, funcion_id: int, nombre: str, exclude_id: int | None = None
    ) -> bool:
        query = select(func.count()).select_from(DisciplinaPuesto).where(
            DisciplinaPuesto.funcion_id == funcion_id,
            DisciplinaPuesto.nombre.ilike(nombre),
            DisciplinaPuesto.activo.is_(True),
        )
        if exclude_id:
            query = query.where(DisciplinaPuesto.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def count_perfiles_usando(self, disciplina_id: int) -> int:
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.disciplina_id == disciplina_id,
            PuestoPerfil.activo.is_(True),
        )
        return await self.db.scalar(query) or 0

    async def get_activo(self, id: int) -> DisciplinaPuesto | None:
        result = await self.db.execute(
            select(DisciplinaPuesto).where(
                DisciplinaPuesto.id == id, DisciplinaPuesto.activo.is_(True)
            )
        )
        return result.scalar_one_or_none()


class GlobalGradeRepository(BaseRepository[GlobalGrade]):
    def __init__(self, db: AsyncSession):
        super().__init__(GlobalGrade, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[GlobalGrade], int]:
        query = select(GlobalGrade)
        if solo_activos:
            query = query.where(GlobalGrade.activo.is_(True))
        if busqueda:
            query = query.where(
                GlobalGrade.nombre.ilike(f"%{busqueda}%")
                | GlobalGrade.codigo.ilike(f"%{busqueda}%")
            )

        total = await self.db.scalar(select(func.count()).select_from(query.subquery()))

        query = query.order_by(GlobalGrade.orden).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_codigo(self, codigo: str, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(GlobalGrade).where(
            GlobalGrade.codigo.ilike(codigo)
        )
        if exclude_id:
            query = query.where(GlobalGrade.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def exists_by_orden(self, orden: int, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(GlobalGrade).where(
            GlobalGrade.orden == orden
        )
        if exclude_id:
            query = query.where(GlobalGrade.id != exclude_id)
        return (await self.db.scalar(query) or 0) > 0

    async def count_perfiles_usando(self, global_grade_id: int) -> int:
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.global_grade_id == global_grade_id
        )
        return await self.db.scalar(query) or 0

    async def count_equivalencias_usando(self, global_grade_id: int) -> int:
        query = select(func.count()).select_from(CareerLevelGradeMapping).where(
            CareerLevelGradeMapping.global_grade_id == global_grade_id
        )
        return await self.db.scalar(query) or 0

    async def get_activo(self, id: int) -> GlobalGrade | None:
        result = await self.db.execute(
            select(GlobalGrade).where(
                GlobalGrade.id == id, GlobalGrade.activo.is_(True)
            )
        )
        return result.scalar_one_or_none()

    async def max_orden(self) -> int:
        return await self.db.scalar(select(func.max(GlobalGrade.orden))) or 0


class CareerLevelGradeMappingRepository(BaseRepository[CareerLevelGradeMapping]):
    """Equivalencias Career Level → Global Grade. Unicidad por career level."""

    def __init__(self, db: AsyncSession):
        super().__init__(CareerLevelGradeMapping, db)

    def _con_relaciones(self):
        # El response denormaliza nivel, career path y grade; leerlos en lazy dentro
        # de una sesion async revienta con MissingGreenlet.
        return select(CareerLevelGradeMapping).options(
            selectinload(CareerLevelGradeMapping.career_level).selectinload(
                GradoPuesto.career_path
            ),
            selectinload(CareerLevelGradeMapping.global_grade),
        )

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CareerLevelGradeMapping], int]:
        query = self._con_relaciones()
        if solo_activos:
            query = query.where(CareerLevelGradeMapping.activo.is_(True))
        if career_path_id:
            query = query.join(
                GradoPuesto, GradoPuesto.id == CareerLevelGradeMapping.career_level_id
            ).where(GradoPuesto.career_path_id == career_path_id)

        total = await self.db.scalar(
            select(func.count()).select_from(
                query.with_only_columns(CareerLevelGradeMapping.id).subquery()
            )
        )

        # Orden estable: por career path y luego por nivel, como se leen en la UI.
        query = (
            query.join(
                GradoPuesto, GradoPuesto.id == CareerLevelGradeMapping.career_level_id
            )
            .join(CareerPath, CareerPath.id == GradoPuesto.career_path_id)
            .join(GlobalGrade, GlobalGrade.id == CareerLevelGradeMapping.global_grade_id)
            .order_by(CareerPath.codigo, GlobalGrade.orden)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().unique().all()), total or 0

    async def get_with_relaciones(self, id: int) -> CareerLevelGradeMapping | None:
        result = await self.db.execute(
            self._con_relaciones().where(CareerLevelGradeMapping.id == id)
        )
        return result.scalar_one_or_none()

    async def get_par(
        self, career_level_id: int, global_grade_id: int, exclude_id: int | None = None
    ) -> CareerLevelGradeMapping | None:
        """
        La equivalencia exacta nivel↔grade, si existe.

        Lo unico que no se repite es el PAR: un nivel puede equivaler a varios
        grades (M4 = GG17 + GG18).
        """
        query = self._con_relaciones().where(
            CareerLevelGradeMapping.career_level_id == career_level_id,
            CareerLevelGradeMapping.global_grade_id == global_grade_id,
        )
        if exclude_id:
            query = query.where(CareerLevelGradeMapping.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_activas_por_career_level(
        self, career_level_id: int
    ) -> list[CareerLevelGradeMapping]:
        """Grades del nivel, ordenados: el primero marca su posicion."""
        result = await self.db.execute(
            self._con_relaciones()
            .join(
                GlobalGrade, GlobalGrade.id == CareerLevelGradeMapping.global_grade_id
            )
            .where(
                CareerLevelGradeMapping.career_level_id == career_level_id,
                CareerLevelGradeMapping.activo.is_(True),
            )
            .order_by(GlobalGrade.orden)
        )
        return list(result.scalars().all())
