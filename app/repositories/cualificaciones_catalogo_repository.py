# app/repositories/cualificaciones_catalogo_repository.py
"""Repositorios para el catálogo configurable de cualificaciones."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import (
    CualificacionCatalogo,
    MetodoCalificacion,
    OpcionCalificacion,
    PerfilCualificacion,
    TipoCualificacionCatalogo,
)
from app.repositories.base import BaseRepository


class TipoCualificacionRepository(BaseRepository[TipoCualificacionCatalogo]):
    def __init__(self, db: AsyncSession):
        super().__init__(TipoCualificacionCatalogo, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
        con_catalogos: bool = False,
    ) -> tuple[list[TipoCualificacionCatalogo], int]:
        query = select(TipoCualificacionCatalogo)
        if con_catalogos:
            query = query.options(
                selectinload(TipoCualificacionCatalogo.cualificaciones).selectinload(
                    CualificacionCatalogo.metodo_calificacion
                ).selectinload(MetodoCalificacion.opciones)
            )
        if solo_activos:
            query = query.where(TipoCualificacionCatalogo.activo.is_(True))
        if busqueda:
            query = query.where(TipoCualificacionCatalogo.nombre.ilike(f"%{busqueda}%"))
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(TipoCualificacionCatalogo.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def exists_by_nombre(self, nombre: str, exclude_id: int | None = None) -> bool:
        query = select(TipoCualificacionCatalogo).where(
            func.lower(TipoCualificacionCatalogo.nombre) == nombre.lower()
        )
        if exclude_id:
            query = query.where(TipoCualificacionCatalogo.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def count_cualificaciones_usando(self, tipo_id: int) -> int:
        result = await self.db.scalar(
            select(func.count()).select_from(CualificacionCatalogo).where(
                CualificacionCatalogo.tipo_cualificacion_id == tipo_id,
                CualificacionCatalogo.activo.is_(True),
            )
        )
        return result or 0

    async def count_perfiles_usando_tipo(self, tipo_id: int) -> int:
        result = await self.db.scalar(
            select(func.count())
            .select_from(PerfilCualificacion)
            .join(
                CualificacionCatalogo,
                PerfilCualificacion.cualificacion_catalogo_id == CualificacionCatalogo.id,
            )
            .where(CualificacionCatalogo.tipo_cualificacion_id == tipo_id)
        )
        return result or 0


class MetodoCalificacionRepository(BaseRepository[MetodoCalificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(MetodoCalificacion, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
        con_opciones: bool = False,
    ) -> tuple[list[MetodoCalificacion], int]:
        query = select(MetodoCalificacion)
        if con_opciones:
            query = query.options(selectinload(MetodoCalificacion.opciones))
        if solo_activos:
            query = query.where(MetodoCalificacion.activo.is_(True))
        if busqueda:
            query = query.where(MetodoCalificacion.nombre.ilike(f"%{busqueda}%"))
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(MetodoCalificacion.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def get_with_opciones(self, id: int) -> MetodoCalificacion | None:
        result = await self.db.execute(
            select(MetodoCalificacion)
            .options(selectinload(MetodoCalificacion.opciones))
            .where(MetodoCalificacion.id == id)
        )
        return result.scalar_one_or_none()

    async def count_cualificaciones_usando(self, metodo_id: int) -> int:
        result = await self.db.scalar(
            select(func.count()).select_from(CualificacionCatalogo).where(
                CualificacionCatalogo.metodo_calificacion_id == metodo_id,
                CualificacionCatalogo.activo.is_(True),
            )
        )
        return result or 0


class OpcionCalificacionRepository(BaseRepository[OpcionCalificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(OpcionCalificacion, db)

    async def list_by_metodo(self, metodo_id: int, solo_activos: bool = True) -> list[OpcionCalificacion]:
        query = select(OpcionCalificacion).where(OpcionCalificacion.metodo_calificacion_id == metodo_id)
        if solo_activos:
            query = query.where(OpcionCalificacion.activo.is_(True))
        query = query.order_by(OpcionCalificacion.orden, OpcionCalificacion.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def exists_valor_en_metodo(
        self, metodo_id: int, valor: str, exclude_id: int | None = None
    ) -> bool:
        query = select(OpcionCalificacion).where(
            OpcionCalificacion.metodo_calificacion_id == metodo_id,
            OpcionCalificacion.activo.is_(True),
            func.lower(OpcionCalificacion.valor) == valor.lower(),
        )
        if exclude_id:
            query = query.where(OpcionCalificacion.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None


class CualificacionCatalogoRepository(BaseRepository[CualificacionCatalogo]):
    def __init__(self, db: AsyncSession):
        super().__init__(CualificacionCatalogo, db)

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        tipo_id: int | None = None,
        solo_activos: bool = True,
        con_relaciones: bool = False,
    ) -> tuple[list[CualificacionCatalogo], int]:
        query = select(CualificacionCatalogo)
        if con_relaciones:
            query = query.options(
                selectinload(CualificacionCatalogo.tipo_cualificacion),
                selectinload(CualificacionCatalogo.metodo_calificacion).selectinload(
                    MetodoCalificacion.opciones
                ),
            )
        if solo_activos:
            query = query.where(CualificacionCatalogo.activo.is_(True))
        if tipo_id:
            query = query.where(CualificacionCatalogo.tipo_cualificacion_id == tipo_id)
        if busqueda:
            query = query.where(CualificacionCatalogo.nombre.ilike(f"%{busqueda}%"))
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        query = query.order_by(CualificacionCatalogo.nombre).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total or 0

    async def get_with_relaciones(self, id: int) -> CualificacionCatalogo | None:
        result = await self.db.execute(
            select(CualificacionCatalogo)
            .options(
                selectinload(CualificacionCatalogo.tipo_cualificacion),
                selectinload(CualificacionCatalogo.metodo_calificacion).selectinload(
                    MetodoCalificacion.opciones
                ),
            )
            .where(CualificacionCatalogo.id == id)
        )
        return result.scalar_one_or_none()

    async def get_primario_por_tipo(self, tipo_id: int) -> CualificacionCatalogo | None:
        result = await self.db.execute(
            select(CualificacionCatalogo)
            .options(
                selectinload(CualificacionCatalogo.metodo_calificacion).selectinload(
                    MetodoCalificacion.opciones
                ),
            )
            .where(
                CualificacionCatalogo.tipo_cualificacion_id == tipo_id,
                CualificacionCatalogo.activo.is_(True),
            )
            .order_by(CualificacionCatalogo.id)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_by_legacy_tipo(self, legacy_tipo: str) -> CualificacionCatalogo | None:
        result = await self.db.execute(
            select(CualificacionCatalogo)
            .options(
                selectinload(CualificacionCatalogo.metodo_calificacion).selectinload(
                    MetodoCalificacion.opciones
                ),
            )
            .where(CualificacionCatalogo.legacy_tipo == legacy_tipo, CualificacionCatalogo.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def count_perfiles_usando(self, cualificacion_id: int) -> int:
        result = await self.db.scalar(
            select(func.count()).select_from(PerfilCualificacion).where(
                PerfilCualificacion.cualificacion_catalogo_id == cualificacion_id
            )
        )
        return result or 0

    async def list_all_activas_con_relaciones(self) -> list[CualificacionCatalogo]:
        result = await self.db.execute(
            select(CualificacionCatalogo)
            .options(
                selectinload(CualificacionCatalogo.tipo_cualificacion),
                selectinload(CualificacionCatalogo.metodo_calificacion).selectinload(
                    MetodoCalificacion.opciones
                ),
            )
            .where(CualificacionCatalogo.activo.is_(True))
            .order_by(CualificacionCatalogo.nombre)
        )
        return list(result.scalars().all())
