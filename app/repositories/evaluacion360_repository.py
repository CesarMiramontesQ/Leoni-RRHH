# app/repositories/evaluacion360_repository.py
"""
Capa de acceso a datos del modulo Evaluacion 360.

Solo queries (SQLAlchemy async). La logica de negocio vive en el service.
Hereda de BaseRepository para el CRUD generico sobre la campana y agrega
consultas especializadas con eager-loading de hijos.
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.evaluacion360 import (
    Eval360Campana,
    Eval360CampanaCompetencia,
    Eval360CampanaEvaluadorTipo,
    Eval360Comentario,
    Eval360Config,
    Eval360Escala,
    Eval360Evaluacion,
    Eval360Participante,
    Eval360Pregunta,
    Eval360Respuesta,
    Eval360Resultado,
)
from app.repositories.base import BaseRepository


class Evaluacion360Repository(BaseRepository[Eval360Campana]):
    def __init__(self, db: AsyncSession):
        super().__init__(Eval360Campana, db)

    # ── Configuracion ─────────────────────────────────────────────────────────
    async def get_config(self) -> Optional[Eval360Config]:
        result = await self.db.execute(
            select(Eval360Config).order_by(Eval360Config.id).limit(1)
        )
        return result.scalar_one_or_none()

    # ── Escalas ───────────────────────────────────────────────────────────────
    async def list_escalas(self, solo_activas: bool = False) -> Sequence[Eval360Escala]:
        query = select(Eval360Escala).order_by(Eval360Escala.id)
        if solo_activas:
            query = query.where(Eval360Escala.activo.is_(True))
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_escala(self, escala_id: int) -> Optional[Eval360Escala]:
        result = await self.db.execute(
            select(Eval360Escala).where(Eval360Escala.id == escala_id)
        )
        return result.scalar_one_or_none()

    # ── Preguntas ─────────────────────────────────────────────────────────────
    async def list_preguntas(
        self, competencia_id: Optional[int] = None, solo_activas: bool = False
    ) -> Sequence[Eval360Pregunta]:
        query = select(Eval360Pregunta).order_by(
            Eval360Pregunta.competencia_id, Eval360Pregunta.orden, Eval360Pregunta.id
        )
        if competencia_id is not None:
            query = query.where(Eval360Pregunta.competencia_id == competencia_id)
        if solo_activas:
            query = query.where(Eval360Pregunta.activo.is_(True))
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_pregunta(self, pregunta_id: int) -> Optional[Eval360Pregunta]:
        result = await self.db.execute(
            select(Eval360Pregunta).where(Eval360Pregunta.id == pregunta_id)
        )
        return result.scalar_one_or_none()

    async def count_preguntas_activas(self, competencia_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Eval360Pregunta)
            .where(
                Eval360Pregunta.competencia_id == competencia_id,
                Eval360Pregunta.activo.is_(True),
            )
        )
        return result.scalar_one()

    # ── Campanas ──────────────────────────────────────────────────────────────
    async def list_campanas(
        self, filters: list, page: int, page_size: int, order_desc: bool = True
    ) -> tuple[Sequence[Eval360Campana], int]:
        base = select(Eval360Campana)
        for cond in filters:
            base = base.where(cond)

        total_res = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = total_res.scalar_one()

        order = Eval360Campana.id.desc() if order_desc else Eval360Campana.id.asc()
        query = (
            base.order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_campana_detalle(self, campana_id: int) -> Optional[Eval360Campana]:
        result = await self.db.execute(
            select(Eval360Campana)
            .where(Eval360Campana.id == campana_id)
            .options(
                selectinload(Eval360Campana.competencias),
                selectinload(Eval360Campana.evaluador_tipos),
                selectinload(Eval360Campana.escala),
                selectinload(Eval360Campana.participantes),
            )
        )
        return result.scalar_one_or_none()

    async def get_campana(self, campana_id: int) -> Optional[Eval360Campana]:
        return await self.get(campana_id)

    # ── Participantes ─────────────────────────────────────────────────────────
    async def list_participantes(
        self, campana_id: int
    ) -> Sequence[Eval360Participante]:
        result = await self.db.execute(
            select(Eval360Participante)
            .where(Eval360Participante.campana_id == campana_id)
            .options(
                selectinload(Eval360Participante.empleado),
                selectinload(Eval360Participante.evaluaciones),
            )
            .order_by(Eval360Participante.id)
        )
        return result.scalars().all()

    async def get_participante(
        self, participante_id: int
    ) -> Optional[Eval360Participante]:
        result = await self.db.execute(
            select(Eval360Participante)
            .where(Eval360Participante.id == participante_id)
            .options(
                selectinload(Eval360Participante.empleado),
                selectinload(Eval360Participante.evaluaciones),
            )
        )
        return result.scalar_one_or_none()

    # ── Evaluaciones ──────────────────────────────────────────────────────────
    async def list_evaluaciones_campana(
        self, campana_id: int
    ) -> Sequence[Eval360Evaluacion]:
        result = await self.db.execute(
            select(Eval360Evaluacion)
            .where(Eval360Evaluacion.campana_id == campana_id)
            .options(selectinload(Eval360Evaluacion.respuestas))
        )
        return result.scalars().all()

    async def list_mis_evaluaciones(
        self, evaluador_empleado_id: int, estado: Optional[str] = None
    ) -> Sequence[Eval360Evaluacion]:
        query = (
            select(Eval360Evaluacion)
            .where(Eval360Evaluacion.evaluador_empleado_id == evaluador_empleado_id)
            .options(
                selectinload(Eval360Evaluacion.participante).selectinload(
                    Eval360Participante.empleado
                ),
                selectinload(Eval360Evaluacion.respuestas),
            )
            .order_by(Eval360Evaluacion.id.desc())
        )
        if estado:
            query = query.where(Eval360Evaluacion.estado == estado)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_evaluacion(
        self, evaluacion_id: int
    ) -> Optional[Eval360Evaluacion]:
        result = await self.db.execute(
            select(Eval360Evaluacion)
            .where(Eval360Evaluacion.id == evaluacion_id)
            .options(
                selectinload(Eval360Evaluacion.respuestas),
                selectinload(Eval360Evaluacion.comentarios),
                selectinload(Eval360Evaluacion.participante).selectinload(
                    Eval360Participante.empleado
                ),
            )
        )
        return result.scalar_one_or_none()

    async def get_respuestas_evaluacion(
        self, evaluacion_id: int
    ) -> Sequence[Eval360Respuesta]:
        result = await self.db.execute(
            select(Eval360Respuesta).where(
                Eval360Respuesta.evaluacion_id == evaluacion_id
            )
        )
        return result.scalars().all()

    async def delete_respuestas_evaluacion(self, evaluacion_id: int) -> None:
        for r in await self.get_respuestas_evaluacion(evaluacion_id):
            await self.db.delete(r)
        await self.db.flush()

    async def delete_comentarios_evaluacion(self, evaluacion_id: int) -> None:
        result = await self.db.execute(
            select(Eval360Comentario).where(
                Eval360Comentario.evaluacion_id == evaluacion_id
            )
        )
        for c in result.scalars().all():
            await self.db.delete(c)
        await self.db.flush()

    # ── Resultados ────────────────────────────────────────────────────────────
    async def list_resultados_participante(
        self, participante_id: int
    ) -> Sequence[Eval360Resultado]:
        result = await self.db.execute(
            select(Eval360Resultado).where(
                Eval360Resultado.participante_id == participante_id
            )
        )
        return result.scalars().all()

    async def delete_resultados_participante(self, participante_id: int) -> None:
        for r in await self.list_resultados_participante(participante_id):
            await self.db.delete(r)
        await self.db.flush()

    # ── Helpers de agregacion para dashboard ──────────────────────────────────
    async def count_campanas_por_estado(self, estados: list[str]) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Eval360Campana)
            .where(
                Eval360Campana.activo.is_(True),
                Eval360Campana.estado.in_(estados),
            )
        )
        return result.scalar_one()

    async def count_evaluaciones_por_estado(self, estados: list[str]) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Eval360Evaluacion)
            .where(Eval360Evaluacion.estado.in_(estados))
        )
        return result.scalar_one()

    async def count_participantes(self) -> int:
        result = await self.db.execute(
            select(func.count(func.distinct(Eval360Participante.empleado_id)))
        )
        return result.scalar_one()
