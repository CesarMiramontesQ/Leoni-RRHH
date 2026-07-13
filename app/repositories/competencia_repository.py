# app/repositories/competencia_repository.py
"""
Repositorio de Competencias y CompetenciaRequisito — acceso a datos async.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    GrupoCompetencia,
    PuestoPerfil,
    TipoCompetencia,
)
from app.repositories.base import BaseRepository


class CompetenciaRepository(BaseRepository[Competencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(Competencia, db)

    async def get_with_relations(self, id: int) -> Competencia | None:
        result = await self.db.execute(
            select(Competencia)
            .options(
                selectinload(Competencia.area),
                selectinload(Competencia.tipo_competencia).selectinload(
                    TipoCompetencia.grupo_competencia
                ),
            )
            .where(Competencia.id == id, Competencia.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        categoria: str | None = None,
        area_id: int | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Competencia], int]:
        """Lista paginada con filtros opcionales."""
        query = (
            select(Competencia)
            .options(
                selectinload(Competencia.area),
                selectinload(Competencia.tipo_competencia).selectinload(
                    TipoCompetencia.grupo_competencia
                ),
            )
            .where(Competencia.activo.is_(True))
        )

        if categoria:
            query = query.where(Competencia.categoria == categoria)
        if area_id is not None:
            query = query.where(Competencia.area_id == area_id)
        if busqueda:
            query = query.where(Competencia.nombre.ilike(f"%{busqueda}%"))

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # Items
        query = query.order_by(Competencia.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def list_by_area(self, area_id: int) -> list[Competencia]:
        """Lista todas las competencias activas de un area."""
        result = await self.db.execute(
            select(Competencia)
            .where(Competencia.area_id == area_id, Competencia.activo.is_(True))
            .order_by(Competencia.categoria, Competencia.nombre)
        )
        return list(result.scalars().all())

    async def exists_by_nombre_categoria(
        self, nombre: str, categoria: str, exclude_id: int | None = None
    ) -> bool:
        """Verifica duplicado por nombre+categoria."""
        query = select(func.count()).select_from(Competencia).where(
            Competencia.nombre.ilike(nombre),
            Competencia.categoria == categoria,
            Competencia.activo.is_(True),
        )
        if exclude_id:
            query = query.where(Competencia.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def actualizar_categoria_por_tipo(self, tipo_id: int, categoria: str) -> int:
        """Recalcula categoria denormalizada de competencias activas de un tipo."""
        result = await self.db.execute(
            update(Competencia)
            .where(
                Competencia.tipo_competencia_id == tipo_id,
                Competencia.activo.is_(True),
            )
            .values(categoria=categoria)
        )
        await self.db.flush()
        return result.rowcount or 0

    async def actualizar_categoria_por_grupo(self, grupo_id: int, categoria: str) -> int:
        """Recalcula categoria denormalizada de competencias activas cuyo tipo pertenece al grupo."""
        subq = select(TipoCompetencia.id).where(
            TipoCompetencia.grupo_competencia_id == grupo_id
        )
        result = await self.db.execute(
            update(Competencia)
            .where(
                Competencia.tipo_competencia_id.in_(subq),
                Competencia.activo.is_(True),
            )
            .values(categoria=categoria)
        )
        await self.db.flush()
        return result.rowcount or 0


class CompetenciaRequisitoRepository(BaseRepository[CompetenciaRequisito]):
    def __init__(self, db: AsyncSession):
        super().__init__(CompetenciaRequisito, db)

    async def get_by_pair(
        self,
        competencia_id: int,
        puesto_perfil_id: int,
        grado_id: int | None,
    ) -> CompetenciaRequisito | None:
        """Obtiene el requisito por par competencia-puesto-grado (None = general)."""
        query = select(CompetenciaRequisito).where(
            CompetenciaRequisito.competencia_id == competencia_id,
            CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id,
        )
        if grado_id is None:
            query = query.where(CompetenciaRequisito.grado_id.is_(None))
        else:
            query = query.where(CompetenciaRequisito.grado_id == grado_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_puesto(self, puesto_perfil_id: int) -> list[CompetenciaRequisito]:
        """Lista requisitos de un puesto."""
        result = await self.db.execute(
            select(CompetenciaRequisito)
            .options(selectinload(CompetenciaRequisito.competencia))
            .where(CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id)
            .order_by(CompetenciaRequisito.id)
        )
        return list(result.scalars().all())

    async def list_by_area(self, area_id: int) -> list[CompetenciaRequisito]:
        """Lista todos los requisitos de puestos de un area."""
        result = await self.db.execute(
            select(CompetenciaRequisito)
            .join(PuestoPerfil, CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id)
            .options(
                selectinload(CompetenciaRequisito.competencia),
                selectinload(CompetenciaRequisito.puesto_perfil),
            )
            .where(
                PuestoPerfil.area_id == area_id,
                PuestoPerfil.activo.is_(True),
            )
        )
        return list(result.scalars().all())

    async def list_by_puesto_with_competencia(
        self, puesto_perfil_id: int, grado_id: int | None = None
    ) -> list[CompetenciaRequisito]:
        """Lista requisitos de un puesto.

        Si grado_id se indica, incluye específicas de ese grado + generales
        (grado_id IS NULL). Si es None, lista todas.
        """
        from sqlalchemy import or_

        query = (
            select(CompetenciaRequisito)
            .options(
                selectinload(CompetenciaRequisito.competencia)
                .selectinload(Competencia.tipo_competencia)
                .selectinload(TipoCompetencia.grupo_competencia),
                selectinload(CompetenciaRequisito.grado),
            )
            .where(CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id)
        )
        if grado_id is not None:
            query = query.where(
                or_(
                    CompetenciaRequisito.grado_id == grado_id,
                    CompetenciaRequisito.grado_id.is_(None),
                )
            )
        query = query.order_by(
            CompetenciaRequisito.grado_id.nulls_first(),
            CompetenciaRequisito.orden.nulls_last(),
            CompetenciaRequisito.id,
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def exists_by_competencia_and_perfil(
        self,
        competencia_id: int,
        puesto_perfil_id: int,
        grado_id: int | None,
    ) -> bool:
        """Verifica si ya existe la combinacion competencia+puesto+grado (None = general)."""
        query = select(CompetenciaRequisito.id).where(
            CompetenciaRequisito.competencia_id == competencia_id,
            CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id,
        )
        if grado_id is None:
            query = query.where(CompetenciaRequisito.grado_id.is_(None))
        else:
            query = query.where(CompetenciaRequisito.grado_id == grado_id)
        result = await self.db.execute(query.limit(1))
        return result.scalar_one_or_none() is not None

    async def max_orden(
        self, puesto_perfil_id: int, grado_id: int | None
    ) -> int:
        """Obtiene el maximo orden actual para un puesto y grado (None = generales)."""
        query = select(func.coalesce(func.max(CompetenciaRequisito.orden), 0)).where(
            CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id,
        )
        if grado_id is None:
            query = query.where(CompetenciaRequisito.grado_id.is_(None))
        else:
            query = query.where(CompetenciaRequisito.grado_id == grado_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def upsert(
        self,
        competencia_id: int,
        puesto_perfil_id: int,
        grado_id: int | None,
        nivel_requerido: int,
    ) -> CompetenciaRequisito:
        """Crea o actualiza un requisito de competencia. Nivel 0 se mantiene (no elimina)."""
        existing = await self.get_by_pair(competencia_id, puesto_perfil_id, grado_id)

        if existing:
            existing.nivel_requerido = nivel_requerido
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        else:
            return await self.create({
                "competencia_id": competencia_id,
                "puesto_perfil_id": puesto_perfil_id,
                "grado_id": grado_id,
                "nivel_requerido": nivel_requerido,
            })

    async def count_by_area(self, area_id: int) -> int:
        """Cuenta requisitos activos de un area."""
        result = await self.db.execute(
            select(func.count())
            .select_from(CompetenciaRequisito)
            .join(PuestoPerfil, CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id)
            .where(
                PuestoPerfil.area_id == area_id,
                PuestoPerfil.activo.is_(True),
            )
        )
        return result.scalar_one() or 0

    async def list_by_puesto_and_tipo(
        self,
        puesto_perfil_id: int,
        tipo_competencia_id: int,
        grado_id: int | None,
    ) -> list[CompetenciaRequisito]:
        """Lista requisitos de un puesto filtrados por tipo y grado (None = generales)."""
        query = (
            select(CompetenciaRequisito)
            .join(Competencia, CompetenciaRequisito.competencia_id == Competencia.id)
            .options(selectinload(CompetenciaRequisito.competencia))
            .where(
                CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id,
                Competencia.tipo_competencia_id == tipo_competencia_id,
            )
        )
        if grado_id is None:
            query = query.where(CompetenciaRequisito.grado_id.is_(None))
        else:
            query = query.where(CompetenciaRequisito.grado_id == grado_id)
        query = query.order_by(
            CompetenciaRequisito.orden.nulls_last(), CompetenciaRequisito.id
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_by_ids(self, ids: list[int]) -> int:
        """Elimina requisitos por lista de IDs."""
        if not ids:
            return 0
        from sqlalchemy import delete

        result = await self.db.execute(
            delete(CompetenciaRequisito).where(CompetenciaRequisito.id.in_(ids))
        )
        await self.db.flush()
        return result.rowcount

    async def bulk_delete_by_puesto(self, puesto_perfil_id: int) -> int:
        """Elimina todos los requisitos de un puesto."""
        from sqlalchemy import delete

        result = await self.db.execute(
            delete(CompetenciaRequisito).where(
                CompetenciaRequisito.puesto_perfil_id == puesto_perfil_id
            )
        )
        await self.db.flush()
        return result.rowcount
