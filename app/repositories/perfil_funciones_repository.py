# app/repositories/perfil_funciones_repository.py
"""
Repositorio de Perfil de Funciones — acceso a datos async con SQLAlchemy.

Maneja: PerfilTarea, PerfilCualificacion, PerfilCompetenciaRequerida,
        PerfilFunciones, PerfilFuncionesCualificacion, PerfilFuncionesCompetencia.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import selectinload

from app.models.talento import (
    PerfilCompetenciaRequerida,
    PerfilCualificacion,
    PerfilFunciones,
    PerfilFuncionesCualificacion,
    PerfilFuncionesCompetencia,
    PerfilTarea,
)
from app.repositories.base import BaseRepository


class PerfilTareaRepository(BaseRepository[PerfilTarea]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilTarea, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilTarea]:
        """Lista tareas de un puesto perfil ordenadas por 'orden'."""
        result = await self.db.execute(
            select(PerfilTarea)
            .where(PerfilTarea.puesto_perfil_id == puesto_perfil_id)
            .order_by(PerfilTarea.orden)
        )
        return list(result.scalars().all())


class PerfilCualificacionRepository(BaseRepository[PerfilCualificacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilCualificacion, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilCualificacion]:
        """Lista cualificaciones de un puesto perfil."""
        result = await self.db.execute(
            select(PerfilCualificacion)
            .where(PerfilCualificacion.puesto_perfil_id == puesto_perfil_id)
            .order_by(PerfilCualificacion.id)
        )
        return list(result.scalars().all())


class PerfilCompetenciaRequeridaRepository(BaseRepository[PerfilCompetenciaRequerida]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilCompetenciaRequerida, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilCompetenciaRequerida]:
        """Lista competencias requeridas de un puesto perfil ordenadas por 'orden'."""
        result = await self.db.execute(
            select(PerfilCompetenciaRequerida)
            .options(selectinload(PerfilCompetenciaRequerida.competencia))
            .where(PerfilCompetenciaRequerida.puesto_perfil_id == puesto_perfil_id)
            .order_by(PerfilCompetenciaRequerida.orden)
        )
        return list(result.scalars().all())

    async def exists_by_competencia_and_perfil(
        self, competencia_id: int, puesto_perfil_id: int
    ) -> bool:
        result = await self.db.execute(
            select(PerfilCompetenciaRequerida.id)
            .where(
                PerfilCompetenciaRequerida.competencia_id == competencia_id,
                PerfilCompetenciaRequerida.puesto_perfil_id == puesto_perfil_id,
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def max_orden(self, puesto_perfil_id: int) -> int:
        from sqlalchemy import func as sa_func
        result = await self.db.execute(
            select(sa_func.coalesce(sa_func.max(PerfilCompetenciaRequerida.orden), 0))
            .where(PerfilCompetenciaRequerida.puesto_perfil_id == puesto_perfil_id)
        )
        return result.scalar_one()


class PerfilFuncionesRepository(BaseRepository[PerfilFunciones]):
    def __init__(self, db: AsyncSession):
        super().__init__(PerfilFunciones, db)

    async def list_by_perfil(self, puesto_perfil_id: int) -> list[PerfilFunciones]:
        """Lista asignaciones activas de un puesto perfil con datos del empleado."""
        result = await self.db.execute(
            select(PerfilFunciones)
            .options(selectinload(PerfilFunciones.empleado))
            .where(
                PerfilFunciones.puesto_perfil_id == puesto_perfil_id,
                PerfilFunciones.activo.is_(True),
            )
            .order_by(PerfilFunciones.id.desc())
        )
        return list(result.scalars().all())

    async def get_with_evaluaciones(self, id: int) -> PerfilFunciones | None:
        """Obtiene una asignacion con sus evaluaciones de cualificaciones y competencias."""
        result = await self.db.execute(
            select(PerfilFunciones)
            .options(
                selectinload(PerfilFunciones.evaluaciones_cualificacion),
                selectinload(PerfilFunciones.evaluaciones_competencia),
            )
            .where(PerfilFunciones.id == id, PerfilFunciones.activo.is_(True))
        )
        return result.scalar_one_or_none()

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
        self, perfil_funciones_id: int, competencia_requerida_id: int
    ) -> PerfilFuncionesCompetencia | None:
        """Obtiene evaluacion por par asignacion-competencia_requerida."""
        result = await self.db.execute(
            select(PerfilFuncionesCompetencia).where(
                PerfilFuncionesCompetencia.perfil_funciones_id == perfil_funciones_id,
                PerfilFuncionesCompetencia.competencia_requerida_id == competencia_requerida_id,
            )
        )
        return result.scalar_one_or_none()
