# app/repositories/perfil_funciones_repository.py
"""
Repositorio de Perfil de Funciones — acceso a datos async con SQLAlchemy.

Maneja: PerfilTarea, PerfilCualificacion,
        PerfilFunciones, PerfilFuncionesCualificacion, PerfilFuncionesCompetencia.
"""

from sqlalchemy import String, cast, distinct, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.talento import (
    CualificacionCatalogo,
    GradoPuesto,
    MetodoCalificacion,
    PerfilCualificacion,
    PerfilFunciones,
    PerfilFuncionesCualificacion,
    PerfilFuncionesCompetencia,
    PerfilFuncionesTarea,
    PerfilTarea,
)
from app.repositories.base import BaseRepository


class PerfilTareaRepository(BaseRepository[PerfilTarea]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilTarea, db)

    async def list_by_perfil(
        self, puesto_perfil_id: int, grado_id: int | None = None
    ) -> list[PerfilTarea]:
        """Lista tareas de un puesto perfil.

        Si grado_id se indica, incluye específicas de ese grado + generales.
        Si es None (sin filtro), lista todas.
        """
        from sqlalchemy import or_

        query = (
            select(PerfilTarea)
            .options(
                selectinload(PerfilTarea.tarea_catalogo),
                selectinload(PerfilTarea.grado),
            )
            .where(PerfilTarea.puesto_perfil_id == puesto_perfil_id)
        )
        if grado_id is not None:
            query = query.where(
                or_(
                    PerfilTarea.grado_id == grado_id,
                    PerfilTarea.grado_id.is_(None),
                )
            )
        query = query.order_by(
            PerfilTarea.grado_id.nulls_first(),
            PerfilTarea.orden,
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())


_NA_VARIANTS = ("N/A", "NA", "n.a", "n.a.", "Ninguna", "ninguna", "N/a")


class PerfilCualificacionRepository(BaseRepository[PerfilCualificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilCualificacion, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilCualificacion]:
        """Lista cualificaciones de un puesto perfil."""
        result = await self.db.execute(
            select(PerfilCualificacion)
            .options(
                selectinload(PerfilCualificacion.cualificacion_catalogo)
                .selectinload(CualificacionCatalogo.tipo_cualificacion),
                selectinload(PerfilCualificacion.cualificacion_catalogo)
                .selectinload(CualificacionCatalogo.metodo_calificacion)
                .selectinload(MetodoCalificacion.opciones),
            )
            .where(PerfilCualificacion.puesto_perfil_id == puesto_perfil_id)
            .order_by(PerfilCualificacion.id)
        )
        return list(result.scalars().all())

    async def get_with_catalogo(self, id: int) -> PerfilCualificacion | None:
        result = await self.db.execute(
            select(PerfilCualificacion)
            .options(
                selectinload(PerfilCualificacion.cualificacion_catalogo).selectinload(
                    CualificacionCatalogo.tipo_cualificacion
                ),
                selectinload(PerfilCualificacion.cualificacion_catalogo)
                .selectinload(CualificacionCatalogo.metodo_calificacion)
                .selectinload(MetodoCalificacion.opciones),
            )
            .where(PerfilCualificacion.id == id)
        )
        return result.scalar_one_or_none()

    async def buscar_sugerencias(self, tipo: str, q: str, limit: int = 10) -> list[str]:
        """Valores DISTINCT de situacion_deseada filtrados por tipo y query, excluyendo N/A."""
        stmt = (
            select(distinct(PerfilCualificacion.situacion_deseada))
            .where(
                PerfilCualificacion.tipo == tipo,
                PerfilCualificacion.situacion_deseada.notin_(_NA_VARIANTS),
            )
        )
        if q:
            stmt = stmt.where(PerfilCualificacion.situacion_deseada.ilike(f"%{q}%"))
        stmt = stmt.order_by(PerfilCualificacion.situacion_deseada).limit(limit)
        result = await self.db.execute(stmt)
        return [row[0] for row in result.all()]


class PerfilFuncionesRepository(BaseRepository[PerfilFunciones]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilFunciones, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilFunciones]:
        """Lista asignaciones activas de un puesto perfil con datos del empleado."""
        result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.empleado),
                selectinload(PerfilFunciones.grado),
            )
            .where(
                PerfilFunciones.puesto_perfil_id == puesto_perfil_id,
                PerfilFunciones.activo.is_(True),
            )
            .order_by(PerfilFunciones.id.desc())
        )
        return list(result.scalars().all())

    async def list_all_active(self) -> list[PerfilFunciones]:
        """Lista todas las asignaciones activas (todos los perfiles) con empleado, puesto y grado."""
        result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.empleado),
                selectinload(PerfilFunciones.puesto_perfil),
                selectinload(PerfilFunciones.grado),
            )
            .where(PerfilFunciones.activo.is_(True))
            .order_by(PerfilFunciones.id.desc())
        )
        return list(result.scalars().all())

    async def get_with_evaluaciones(self, id: int) -> PerfilFunciones | None:
        """Obtiene una asignacion con sus evaluaciones de cualificaciones y competencias."""
        result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.empleado),
                selectinload(PerfilFunciones.evaluaciones_cualificacion),
                selectinload(PerfilFunciones.evaluaciones_competencia),
                selectinload(PerfilFunciones.grado),
            )
            .where(PerfilFunciones.id == id, PerfilFunciones.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def buscar_empleados_disponibles(
        self, q: str, estados_activos: list[int], limit: int = 10
    ) -> list[Empleado]:
        """Empleados activos sin asignación de perfil activa que matchean ``q``.

        Filtra por nombre o ``no_empleado`` (reusa la normalización de
        ``UsuarioRepository`` con ``cast`` para evitar el error de tipos en Postgres,
        ver memoria migracion-bono-no-empleado-integer). Excluye empleados con una
        fila activa en ``levelup_perfil_funciones``.
        """
        from app.repositories.usuario_repository import UsuarioRepository

        stmt = (
            select(Empleado)
            .options(selectinload(Empleado.area))
            .where(Empleado.estado_id.in_(estados_activos))
        )
        for token in UsuarioRepository._normalize_search_text(q).split(" "):
            if not token:
                continue
            term = f"%{token}%"
            stmt = stmt.where(
                or_(
                    UsuarioRepository._normalized_sql(Empleado.nombre).ilike(term),
                    UsuarioRepository._normalized_sql(cast(Empleado.no_empleado, String)).ilike(term),
                )
            )
        asignacion_activa = select(PerfilFunciones.id).where(
            PerfilFunciones.empleado_id == Empleado.empleado_id,
            PerfilFunciones.activo.is_(True),
        )
        stmt = stmt.where(~asignacion_activa.exists()).order_by(Empleado.nombre).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_active_by_empleado_and_perfil(
        self, empleado_id: int, puesto_perfil_id: int
    ) -> PerfilFunciones | None:
        """Verifica si ya existe asignacion activa para empleado+perfil."""
        result = await self.db.execute(
            select(PerfilFunciones).where(
                PerfilFunciones.empleado_id == empleado_id,
                PerfilFunciones.puesto_perfil_id == puesto_perfil_id,
                PerfilFunciones.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()


class PerfilFuncionesCualificacionRepository(BaseRepository[PerfilFuncionesCualificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilFuncionesCualificacion, db)

    async def list_by_asignacion(self, perfil_funciones_id: int) -> list[PerfilFuncionesCualificacion]:
        """Lista evaluaciones de cualificacion de una asignacion."""
        result = await self.db.execute(
            select(PerfilFuncionesCualificacion)
            .where(PerfilFuncionesCualificacion.perfil_funciones_id == perfil_funciones_id)
            .order_by(PerfilFuncionesCualificacion.id)
        )
        return list(result.scalars().all())

    async def get_by_pair(
        self, perfil_funciones_id: int, cualificacion_id: int
    ) -> PerfilFuncionesCualificacion | None:
        """Obtiene evaluacion por par asignacion-cualificacion."""
        result = await self.db.execute(
            select(PerfilFuncionesCualificacion).where(
                PerfilFuncionesCualificacion.perfil_funciones_id == perfil_funciones_id,
                PerfilFuncionesCualificacion.cualificacion_id == cualificacion_id,
            )
        )
        return result.scalar_one_or_none()


class PerfilFuncionesCompetenciaRepository(BaseRepository[PerfilFuncionesCompetencia]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilFuncionesCompetencia, db)

    async def list_by_asignacion(self, perfil_funciones_id: int) -> list[PerfilFuncionesCompetencia]:
        """Lista evaluaciones de competencia de una asignacion."""
        result = await self.db.execute(
            select(PerfilFuncionesCompetencia)
            .where(PerfilFuncionesCompetencia.perfil_funciones_id == perfil_funciones_id)
            .order_by(PerfilFuncionesCompetencia.id)
        )
        return list(result.scalars().all())

    async def get_by_pair(
        self, perfil_funciones_id: int, competencia_requisito_id: int
    ) -> PerfilFuncionesCompetencia | None:
        """Obtiene evaluacion por par asignacion-competencia_requisito."""
        result = await self.db.execute(
            select(PerfilFuncionesCompetencia).where(
                PerfilFuncionesCompetencia.perfil_funciones_id == perfil_funciones_id,
                PerfilFuncionesCompetencia.competencia_requisito_id == competencia_requisito_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_by_asignacion_excluding(
        self, perfil_funciones_id: int, keep_requisito_ids: list[int]
    ) -> int:
        """Elimina evaluaciones de una asignación excepto las indicadas."""
        from sqlalchemy import delete

        stmt = delete(PerfilFuncionesCompetencia).where(
            PerfilFuncionesCompetencia.perfil_funciones_id == perfil_funciones_id,
        )
        if keep_requisito_ids:
            stmt = stmt.where(
                PerfilFuncionesCompetencia.competencia_requisito_id.notin_(keep_requisito_ids)
            )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount


class PerfilFuncionesTareaRepository(BaseRepository[PerfilFuncionesTarea]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilFuncionesTarea, db)

    async def list_by_asignacion(self, perfil_funciones_id: int) -> list[PerfilFuncionesTarea]:
        """Lista tareas extra de una asignacion con datos del catalogo."""
        result = await self.db.execute(
            select(PerfilFuncionesTarea)
            .options(selectinload(PerfilFuncionesTarea.tarea_catalogo))
            .where(PerfilFuncionesTarea.perfil_funciones_id == perfil_funciones_id)
            .order_by(PerfilFuncionesTarea.id)
        )
        return list(result.scalars().all())

    async def get_by_pair(
        self, perfil_funciones_id: int, tarea_catalogo_id: int
    ) -> PerfilFuncionesTarea | None:
        """Obtiene tarea extra por par asignacion-tarea_catalogo."""
        result = await self.db.execute(
            select(PerfilFuncionesTarea).where(
                PerfilFuncionesTarea.perfil_funciones_id == perfil_funciones_id,
                PerfilFuncionesTarea.tarea_catalogo_id == tarea_catalogo_id,
            )
        )
        return result.scalar_one_or_none()
