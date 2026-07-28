# app/repositories/clasificacion_puesto_repository.py
"""Repositorios de los catalogos de clasificacion de puesto — acceso a datos async."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clasificacion_puesto import (
    CareerPath,
    DisciplinaPuesto,
    FuncionPuesto,
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

        query = query.order_by(CareerPath.orden).offset(offset).limit(limit)
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

    async def exists_by_orden(self, orden: int, exclude_id: int | None = None) -> bool:
        query = select(func.count()).select_from(CareerPath).where(
            CareerPath.orden == orden,
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
