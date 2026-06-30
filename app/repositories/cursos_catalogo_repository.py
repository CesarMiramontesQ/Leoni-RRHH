"""Repositorios para los catálogos de cursos (categoría, tipo, clasificación, instructor externo, proveedor)."""

from typing import TypeVar

from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import Base
from app.models.cursos_catalogo import (
    CursoCategoria,
    CursoClasificacion,
    CursoInstructorExterno,
    CursoInstructorInterno,
    CursoProveedor,
    CursoTipo,
)
from app.models.empleados import Empleado
from app.repositories.base import BaseRepository

T = TypeVar("T", bound=Base)


class CursoCatalogoGenericRepository(BaseRepository[T]):
    """Repository genérico para catálogos simples (nombre + descripcion + activo)."""

    def __init__(self, model: type[T], db: AsyncSession):
        super().__init__(model, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[T], int]:
        query = select(self.model)
        if solo_activos:
            query = query.where(self.model.activo.is_(True))  # type: ignore[attr-defined]
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(
                self.model.nombre.ilike(f"%{escaped}%", escape="\\")  # type: ignore[attr-defined]
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(self.model.nombre).offset(offset).limit(limit)  # type: ignore[attr-defined]
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(self.model).where(
            func.lower(self.model.nombre) == nombre.strip().lower()  # type: ignore[attr-defined]
        )
        if exclude_id:
            query = query.where(self.model.id != exclude_id)  # type: ignore[attr-defined]
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None


class CursoCategoriaRepository(CursoCatalogoGenericRepository[CursoCategoria]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoCategoria, db)


class CursoTipoRepository(CursoCatalogoGenericRepository[CursoTipo]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoTipo, db)


class CursoClasificacionRepository(CursoCatalogoGenericRepository[CursoClasificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoClasificacion, db)


class InstructorExternoRepository(BaseRepository[CursoInstructorExterno]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoInstructorExterno, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CursoInstructorExterno], int]:
        query = select(CursoInstructorExterno)
        if solo_activos:
            query = query.where(CursoInstructorExterno.activo.is_(True))
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(
                or_(
                    CursoInstructorExterno.nombre.ilike(f"%{escaped}%", escape="\\"),
                    CursoInstructorExterno.especialidad.ilike(f"%{escaped}%", escape="\\"),
                    CursoInstructorExterno.empresa.ilike(f"%{escaped}%", escape="\\"),
                )
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(CursoInstructorExterno.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(CursoInstructorExterno).where(
            func.lower(CursoInstructorExterno.nombre) == nombre.strip().lower()
        )
        if exclude_id:
            query = query.where(CursoInstructorExterno.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None


class InstructorInternoRepository(BaseRepository[CursoInstructorInterno]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoInstructorInterno, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CursoInstructorInterno], int]:
        query = select(CursoInstructorInterno).options(joinedload(CursoInstructorInterno.empleado_rel))
        query = query.join(Empleado, CursoInstructorInterno.empleado_id == Empleado.empleado_id)
        if solo_activos:
            query = query.where(CursoInstructorInterno.activo.is_(True))
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(
                or_(
                    Empleado.nombre.ilike(f"%{escaped}%", escape="\\"),
                    func.cast(Empleado.no_empleado, String).ilike(f"%{escaped}%", escape="\\"),
                    CursoInstructorInterno.especialidad.ilike(f"%{escaped}%", escape="\\"),
                )
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(Empleado.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().unique().all()), total or 0

    async def get_by_empleado_id(self, empleado_id: int) -> CursoInstructorInterno | None:
        query = select(CursoInstructorInterno).where(CursoInstructorInterno.empleado_id == empleado_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_empleado(self, id: int) -> CursoInstructorInterno | None:
        query = (
            select(CursoInstructorInterno)
            .options(joinedload(CursoInstructorInterno.empleado_rel))
            .where(CursoInstructorInterno.id == id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def exists_active_by_empleado_id(self, empleado_id: int, exclude_id: int | None = None) -> bool:
        query = select(CursoInstructorInterno).where(
            CursoInstructorInterno.empleado_id == empleado_id,
            CursoInstructorInterno.activo.is_(True),
        )
        if exclude_id:
            query = query.where(CursoInstructorInterno.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None


class ProveedorRepository(BaseRepository[CursoProveedor]):
    def __init__(self, db: AsyncSession):
        super().__init__(CursoProveedor, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[CursoProveedor], int]:
        query = select(CursoProveedor)
        if solo_activos:
            query = query.where(CursoProveedor.activo.is_(True))
        if busqueda:
            escaped = busqueda.replace("%", r"\%").replace("_", r"\_")
            query = query.where(
                or_(
                    CursoProveedor.nombre.ilike(f"%{escaped}%", escape="\\"),
                    CursoProveedor.contacto.ilike(f"%{escaped}%", escape="\\"),
                )
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(CursoProveedor.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(CursoProveedor).where(
            func.lower(CursoProveedor.nombre) == nombre.strip().lower()
        )
        if exclude_id:
            query = query.where(CursoProveedor.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
