# app/repositories/puesto_perfil_repository.py
"""
Repositorio de Puestos Perfil — acceso a datos async con SQLAlchemy.
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import PuestoPerfil
from app.repositories.base import BaseRepository


class PuestoPerfilRepository(BaseRepository[PuestoPerfil]):
    def __init__(self, db: AsyncSession):
        super().__init__(PuestoPerfil, db)

    async def get_with_relations(self, id: int) -> PuestoPerfil | None:
        result = await self.db.execute(
            select(PuestoPerfil)
            .options(selectinload(PuestoPerfil.area))
            .where(PuestoPerfil.id == id, PuestoPerfil.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        area_id: int | None = None,
        nivel: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[PuestoPerfil], int]:
        """Lista paginada con filtros opcionales. Retorna (items, total)."""
        query = (
            select(PuestoPerfil)
            .options(selectinload(PuestoPerfil.area))
            .where(PuestoPerfil.activo.is_(True))
        )

        if area_id is not None:
            query = query.where(PuestoPerfil.area_id == area_id)
        if nivel is not None:
            query = query.where(PuestoPerfil.nivel == nivel)
        if busqueda:
            query = query.where(PuestoPerfil.nombre.ilike(f"%{busqueda}%"))

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # Items
        query = query.order_by(PuestoPerfil.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def list_by_area(self, area_id: int) -> list[PuestoPerfil]:
        """Lista todos los puestos perfil activos de un area."""
        result = await self.db.execute(
            select(PuestoPerfil)
            .where(PuestoPerfil.area_id == area_id, PuestoPerfil.activo.is_(True))
            .order_by(PuestoPerfil.nombre)
        )
        return list(result.scalars().all())

    async def get_next_codigo(self) -> str:
        """Genera el siguiente codigo PRF-{YYYY}-{NNN}."""
        year = datetime.now(timezone.utc).year
        prefix = f"PRF-{year}-"

        # Buscar el maximo secuencial del anio actual
        result = await self.db.execute(
            select(func.max(PuestoPerfil.codigo))
            .where(PuestoPerfil.codigo.like(f"{prefix}%"))
        )
        max_codigo = result.scalar_one_or_none()

        if max_codigo:
            try:
                seq = int(max_codigo.replace(prefix, ""))
                next_seq = seq + 1
            except (ValueError, AttributeError):
                next_seq = 1
        else:
            next_seq = 1

        return f"{prefix}{next_seq:03d}"

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        """Verifica si ya existe un puesto perfil con el mismo nombre."""
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.nombre.ilike(nombre),
            PuestoPerfil.activo.is_(True),
        )
        if exclude_id:
            query = query.where(PuestoPerfil.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0
