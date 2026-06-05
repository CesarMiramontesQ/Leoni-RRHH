# app/repositories/puesto_perfil_repository.py
"""
Repositorio de Puestos Perfil — acceso a datos async con SQLAlchemy.
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.level_up import CursoPuesto
from app.models.talento import (
    CompetenciaRequisito,
    PerfilCualificacion,
    PerfilFunciones,
    PerfilFuncionesCualificacion,
    PerfilFuncionesCompetencia,
    PuestoPerfil,
)
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

    async def get_resumen_tarjetas(self) -> list[dict]:
        """Obtiene perfiles activos con metricas agregadas para la vista de tarjetas."""
        # Subquery: personas por perfil
        personas_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFunciones.id).label("personas"),
            )
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: total requeridos (cualificaciones + competencias) por perfil
        cualif_count_sq = (
            select(
                PerfilCualificacion.puesto_perfil_id,
                func.count(PerfilCualificacion.id).label("total_cualif"),
            )
            .group_by(PerfilCualificacion.puesto_perfil_id)
            .subquery()
        )
        comp_count_sq = (
            select(
                CompetenciaRequisito.puesto_perfil_id,
                func.count(CompetenciaRequisito.id).label("total_comp"),
            )
            .group_by(CompetenciaRequisito.puesto_perfil_id)
            .subquery()
        )

        # Subquery: evaluaciones realizadas de cualificacion
        eval_cualif_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFuncionesCualificacion.id).label("eval_cualif"),
            )
            .join(PerfilFunciones, PerfilFuncionesCualificacion.perfil_funciones_id == PerfilFunciones.id)
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: evaluaciones realizadas de competencia
        eval_comp_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFuncionesCompetencia.id).label("eval_comp"),
            )
            .join(PerfilFunciones, PerfilFuncionesCompetencia.perfil_funciones_id == PerfilFunciones.id)
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: cursos asignados por perfil
        cursos_sq = (
            select(
                CursoPuesto.puesto_perfil_id,
                func.count(CursoPuesto.id).label("cursos"),
            )
            .group_by(CursoPuesto.puesto_perfil_id)
            .subquery()
        )

        # Main query
        query = (
            select(
                PuestoPerfil.id,
                PuestoPerfil.codigo,
                PuestoPerfil.nombre,
                PuestoPerfil.nivel,
                func.coalesce(personas_sq.c.personas, 0).label("personas"),
                func.coalesce(cualif_count_sq.c.total_cualif, 0).label("total_cualif"),
                func.coalesce(comp_count_sq.c.total_comp, 0).label("total_comp"),
                func.coalesce(eval_cualif_sq.c.eval_cualif, 0).label("eval_cualif"),
                func.coalesce(eval_comp_sq.c.eval_comp, 0).label("eval_comp"),
                func.coalesce(cursos_sq.c.cursos, 0).label("cursos"),
            )
            .outerjoin(personas_sq, personas_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(cualif_count_sq, cualif_count_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(comp_count_sq, comp_count_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(eval_cualif_sq, eval_cualif_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(eval_comp_sq, eval_comp_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(cursos_sq, cursos_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .where(PuestoPerfil.activo.is_(True))
            .order_by(PuestoPerfil.nombre)
        )

        result = await self.db.execute(query)
        rows = result.all()

        items = []
        for row in rows:
            personas = row.personas
            total_cualif = row.total_cualif
            total_comp = row.total_comp
            eval_cualif = row.eval_cualif
            eval_comp = row.eval_comp

            # Cumplimiento: evaluaciones completadas / (requeridas × personas)
            total_requeridos = (total_cualif + total_comp) * personas
            total_evaluados = eval_cualif + eval_comp
            cumplimiento_pct = (
                round((total_evaluados / total_requeridos) * 100)
                if total_requeridos > 0
                else 0
            )

            # Brechas: requeridos sin evaluar
            brechas = max(0, total_requeridos - total_evaluados)

            items.append({
                "id": row.id,
                "codigo": row.codigo,
                "nombre": row.nombre,
                "nivel": row.nivel,
                "personas": personas,
                "cumplimiento_pct": cumplimiento_pct,
                "brechas": brechas,
                "cursos": row.cursos,
            })

        # Cargar area_nombre en segunda pasada (selectinload no funciona con
        # columnas explícitas, cargamos por separado)
        perfil_ids = [item["id"] for item in items]
        if perfil_ids:
            perfiles_result = await self.db.execute(
                select(PuestoPerfil)
                .options(selectinload(PuestoPerfil.area))
                .where(PuestoPerfil.id.in_(perfil_ids))
            )
            perfiles_map = {p.id: p for p in perfiles_result.scalars().all()}
            for item in items:
                perfil = perfiles_map.get(item["id"])
                item["area_nombre"] = perfil.area.descripcion if perfil and perfil.area else None

        return items
