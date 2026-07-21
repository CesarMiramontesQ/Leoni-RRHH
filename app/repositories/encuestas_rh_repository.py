# app/repositories/encuestas_rh_repository.py
"""Capa de acceso a datos del modulo Encuestas RH.

Solo queries (SQLAlchemy async). La logica de negocio (ciclo de vida,
audiencia, validacion de respuestas, anonimato) vive en el service.
Precarga con selectinload donde el service necesita atravesar relaciones
lazy en contexto async (evita MissingGreenlet).
"""

from __future__ import annotations

from datetime import date as date_type
from typing import Optional, Sequence

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.encuestas_rh import (
    Encuesta,
    EncuestaParticipante,
    EncuestaPlantilla,
    EncuestaPregunta,
    EncuestaRespuestaGrupo,
)
from app.repositories.base import BaseRepository


class EncuestasRhRepository(BaseRepository[Encuesta]):
    def __init__(self, db: AsyncSession):
        super().__init__(Encuesta, db)

    # ── Encuesta ──────────────────────────────────────────────────────────
    async def get_detalle(self, encuesta_id: int) -> Optional[Encuesta]:
        """Encuesta con preguntas + opciones precargadas (ordenadas)."""
        result = await self.db.execute(
            select(Encuesta)
            .where(Encuesta.id == encuesta_id)
            .options(
                selectinload(Encuesta.preguntas).selectinload(EncuestaPregunta.opciones),
            )
        )
        return result.scalar_one_or_none()

    async def list_encuestas(self, estado: Optional[str] = None) -> Sequence[Encuesta]:
        query = (
            select(Encuesta)
            .options(
                selectinload(Encuesta.preguntas).selectinload(EncuestaPregunta.opciones),
            )
            .order_by(Encuesta.id.desc())
        )
        if estado:
            query = query.where(Encuesta.estado == estado)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_publicadas_vencidas(self, hoy: date_type) -> Sequence[Encuesta]:
        result = await self.db.execute(
            select(Encuesta).where(
                Encuesta.estado == "publicada",
                Encuesta.fecha_cierre_programada.isnot(None),
                Encuesta.fecha_cierre_programada < hoy,
            )
        )
        return result.scalars().all()

    # ── Participantes ─────────────────────────────────────────────────────
    async def list_participantes(self, encuesta_id: int) -> Sequence[EncuestaParticipante]:
        result = await self.db.execute(
            select(EncuestaParticipante)
            .where(EncuestaParticipante.encuesta_id == encuesta_id)
            .options(selectinload(EncuestaParticipante.empleado))
            .order_by(EncuestaParticipante.id)
        )
        return result.scalars().all()

    async def get_participante(
        self, encuesta_id: int, empleado_id: int
    ) -> Optional[EncuestaParticipante]:
        result = await self.db.execute(
            select(EncuestaParticipante)
            .where(
                EncuestaParticipante.encuesta_id == encuesta_id,
                EncuestaParticipante.empleado_id == empleado_id,
            )
            .options(
                selectinload(EncuestaParticipante.empleado).selectinload(Empleado.area),
                selectinload(EncuestaParticipante.empleado).selectinload(Empleado.clasificacion),
                selectinload(EncuestaParticipante.empleado).selectinload(Empleado.turno_empleado),
            )
        )
        return result.scalar_one_or_none()

    async def list_empleado_ids_participantes(self, encuesta_id: int) -> set[int]:
        result = await self.db.execute(
            select(EncuestaParticipante.empleado_id).where(
                EncuestaParticipante.encuesta_id == encuesta_id
            )
        )
        return {row[0] for row in result.all()}

    async def list_participaciones_empleado(
        self, empleado_id: int
    ) -> Sequence[EncuestaParticipante]:
        """Participaciones respondidas + pendientes de encuestas aun publicadas."""
        result = await self.db.execute(
            select(EncuestaParticipante)
            .join(Encuesta, Encuesta.id == EncuestaParticipante.encuesta_id)
            .where(
                EncuestaParticipante.empleado_id == empleado_id,
                or_(
                    EncuestaParticipante.estado == "respondida",
                    and_(
                        EncuestaParticipante.estado == "pendiente",
                        Encuesta.estado == "publicada",
                    ),
                ),
            )
            .options(selectinload(EncuestaParticipante.encuesta))
            .order_by(EncuestaParticipante.id.desc())
        )
        return result.scalars().all()

    # ── Audiencia (poblacion candidata) ───────────────────────────────────
    async def list_empleados_activos(self) -> Sequence[Empleado]:
        """Empleados activos con relaciones necesarias para segmentar
        (area, clasificacion, turno, rol) precargadas — sin lazy-load async."""
        result = await self.db.execute(
            select(Empleado)
            .where(Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS))
            .options(
                selectinload(Empleado.area),
                selectinload(Empleado.clasificacion),
                selectinload(Empleado.turno_empleado),
            )
        )
        return result.scalars().all()

    # ── Plantillas ────────────────────────────────────────────────────────
    async def get_plantilla(self, plantilla_id: int) -> Optional[EncuestaPlantilla]:
        result = await self.db.execute(
            select(EncuestaPlantilla).where(EncuestaPlantilla.id == plantilla_id)
        )
        return result.scalar_one_or_none()

    async def list_plantillas(self) -> Sequence[EncuestaPlantilla]:
        result = await self.db.execute(
            select(EncuestaPlantilla).order_by(EncuestaPlantilla.id)
        )
        return result.scalars().all()

    # ── Respuestas ────────────────────────────────────────────────────────
    async def get_grupo_respuesta(self, grupo_id) -> Optional[EncuestaRespuestaGrupo]:
        result = await self.db.execute(
            select(EncuestaRespuestaGrupo)
            .where(EncuestaRespuestaGrupo.id == grupo_id)
            .options(selectinload(EncuestaRespuestaGrupo.respuestas))
        )
        return result.scalar_one_or_none()
