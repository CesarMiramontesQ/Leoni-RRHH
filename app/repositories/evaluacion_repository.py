# app/repositories/evaluacion_repository.py
"""
Repositorio de Evaluaciones de Competencias — acceso a datos async.
"""

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empleados import Empleado
from app.models.talento import Competencia, EvaluacionCompetencia


class EvaluacionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, id: int) -> EvaluacionCompetencia | None:
        result = await self.db.execute(
            select(EvaluacionCompetencia)
            .options(
                selectinload(EvaluacionCompetencia.empleado),
                selectinload(EvaluacionCompetencia.competencia),
                selectinload(EvaluacionCompetencia.evaluador),
            )
            .where(EvaluacionCompetencia.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_empleado_competencia(
        self, empleado_id: int, competencia_id: int
    ) -> EvaluacionCompetencia | None:
        result = await self.db.execute(
            select(EvaluacionCompetencia).where(
                EvaluacionCompetencia.empleado_id == empleado_id,
                EvaluacionCompetencia.competencia_id == competencia_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        empleado_id: int | None = None,
        competencia_id: int | None = None,
        area_id: int | None = None,
    ) -> tuple[list[EvaluacionCompetencia], int]:
        conditions = []
        if empleado_id is not None:
            conditions.append(EvaluacionCompetencia.empleado_id == empleado_id)
        if competencia_id is not None:
            conditions.append(EvaluacionCompetencia.competencia_id == competencia_id)
        if area_id is not None:
            conditions.append(
                EvaluacionCompetencia.empleado_id.in_(
                    select(Empleado.id).where(Empleado.area_id == area_id)
                )
            )

        # Count
        count_q = select(func.count()).select_from(EvaluacionCompetencia)
        for c in conditions:
            count_q = count_q.where(c)
        total = (await self.db.execute(count_q)).scalar_one()

        # Items
        query = (
            select(EvaluacionCompetencia)
            .options(
                selectinload(EvaluacionCompetencia.empleado),
                selectinload(EvaluacionCompetencia.competencia),
                selectinload(EvaluacionCompetencia.evaluador),
            )
            .order_by(EvaluacionCompetencia.fecha_evaluacion.desc())
            .offset(offset)
            .limit(limit)
        )
        for c in conditions:
            query = query.where(c)

        result = await self.db.execute(query)
        items = list(result.scalars().all())
        return items, total

    async def list_by_empleado(self, empleado_id: int) -> list[EvaluacionCompetencia]:
        result = await self.db.execute(
            select(EvaluacionCompetencia)
            .options(
                selectinload(EvaluacionCompetencia.empleado),
                selectinload(EvaluacionCompetencia.competencia),
                selectinload(EvaluacionCompetencia.evaluador),
            )
            .where(EvaluacionCompetencia.empleado_id == empleado_id)
            .order_by(EvaluacionCompetencia.competencia_id)
        )
        return list(result.scalars().all())

    async def list_by_area(self, area_id: int) -> list[EvaluacionCompetencia]:
        result = await self.db.execute(
            select(EvaluacionCompetencia)
            .options(
                selectinload(EvaluacionCompetencia.empleado),
                selectinload(EvaluacionCompetencia.competencia),
            )
            .where(
                EvaluacionCompetencia.empleado_id.in_(
                    select(Empleado.id).where(Empleado.area_id == area_id)
                )
            )
        )
        return list(result.scalars().all())

    async def upsert(
        self,
        empleado_id: int,
        competencia_id: int,
        nivel_actual: int,
        evaluador_id: int | None = None,
        observaciones: str | None = None,
    ) -> EvaluacionCompetencia:
        existing = await self.get_by_empleado_competencia(empleado_id, competencia_id)
        if existing:
            existing.nivel_actual = nivel_actual
            if evaluador_id is not None:
                existing.evaluador_id = evaluador_id
            if observaciones is not None:
                existing.observaciones = observaciones
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        evaluacion = EvaluacionCompetencia(
            empleado_id=empleado_id,
            competencia_id=competencia_id,
            nivel_actual=nivel_actual,
            evaluador_id=evaluador_id,
            observaciones=observaciones,
        )
        self.db.add(evaluacion)
        await self.db.flush()
        await self.db.refresh(evaluacion)
        return evaluacion

    async def list_by_empleados_and_competencias(
        self, empleado_ids: list[int], competencia_ids: list[int]
    ) -> list[EvaluacionCompetencia]:
        if not empleado_ids or not competencia_ids:
            return []
        result = await self.db.execute(
            select(EvaluacionCompetencia).where(
                EvaluacionCompetencia.empleado_id.in_(empleado_ids),
                EvaluacionCompetencia.competencia_id.in_(competencia_ids),
            )
        )
        return list(result.scalars().all())

    async def delete(self, id: int) -> bool:
        evaluacion = await self.get(id)
        if not evaluacion:
            return False
        await self.db.delete(evaluacion)
        await self.db.flush()
        return True

    async def count_by_area(self, area_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(EvaluacionCompetencia)
            .where(
                EvaluacionCompetencia.empleado_id.in_(
                    select(Empleado.id).where(Empleado.area_id == area_id)
                )
            )
        )
        return result.scalar_one()
