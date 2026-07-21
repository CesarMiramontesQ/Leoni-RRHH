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

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.encuestas_rh import (
    Encuesta,
    EncuestaParticipante,
    EncuestaPlantilla,
    EncuestaPregunta,
    EncuestaRespuesta,
    EncuestaRespuestaGrupo,
    EncuestaRespuestaOpcion,
)
from app.repositories.base import BaseRepository

# Dimensiones validas de segmentacion -> columna de EncuestaRespuestaGrupo.
_SEGMENTO_COLUMNAS = {
    "area": EncuestaRespuestaGrupo.segmento_area,
    "turno": EncuestaRespuestaGrupo.segmento_turno,
    "clasificacion": EncuestaRespuestaGrupo.segmento_clasificacion,
}


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

    # ── Resultados / analitica (Tarea 4) ───────────────────────────────────
    # Solo agregaciones SQL (func.avg/count + group_by); el service aplica la
    # regla min-N y arma los schemas. Iterar filas en Python queda reservado
    # a los textos abiertos (contenido + shuffle), no a metricas.

    @staticmethod
    def _segmento_columna(dimension: str):
        try:
            return _SEGMENTO_COLUMNAS[dimension]
        except KeyError:
            raise ValueError(
                f"dimension invalida: {dimension!r} (validas: {', '.join(_SEGMENTO_COLUMNAS)})"
            ) from None

    async def count_grupos_respuesta(self, encuesta_id: int) -> int:
        """Total de "sobres" de respuesta (n global) de la encuesta."""
        result = await self.db.execute(
            select(func.count())
            .select_from(EncuestaRespuestaGrupo)
            .where(EncuestaRespuestaGrupo.encuesta_id == encuesta_id)
        )
        return result.scalar_one()

    async def count_participantes(self, encuesta_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(EncuestaParticipante)
            .where(EncuestaParticipante.encuesta_id == encuesta_id)
        )
        return result.scalar_one()

    async def count_participantes_respondidos(self, encuesta_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(EncuestaParticipante)
            .where(
                EncuestaParticipante.encuesta_id == encuesta_id,
                EncuestaParticipante.estado == "respondida",
            )
        )
        return result.scalar_one()

    async def count_grupos_por_segmento(
        self, encuesta_id: int, dimension: str
    ) -> dict[Optional[str], int]:
        columna = self._segmento_columna(dimension)
        result = await self.db.execute(
            select(columna, func.count(EncuestaRespuestaGrupo.id))
            .where(EncuestaRespuestaGrupo.encuesta_id == encuesta_id)
            .group_by(columna)
        )
        return {valor: total for valor, total in result.all()}

    async def respuesta_count_global(self, pregunta_id: int) -> int:
        """n = numero de "sobres" que respondieron esta pregunta (para
        likert/opcion_multiple/texto — la fila EncuestaRespuesta solo existe
        si la pregunta fue efectivamente respondida, ver EncuestasRhService.responder)."""
        result = await self.db.execute(
            select(func.count())
            .select_from(EncuestaRespuesta)
            .where(EncuestaRespuesta.pregunta_id == pregunta_id)
        )
        return result.scalar_one()

    async def respuesta_count_por_segmento(
        self, encuesta_id: int, pregunta_id: int, dimension: str
    ) -> dict[Optional[str], int]:
        columna = self._segmento_columna(dimension)
        result = await self.db.execute(
            select(columna, func.count(EncuestaRespuesta.id))
            .select_from(EncuestaRespuesta)
            .join(EncuestaRespuestaGrupo, EncuestaRespuestaGrupo.id == EncuestaRespuesta.grupo_id)
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuestaGrupo.encuesta_id == encuesta_id,
            )
            .group_by(columna)
        )
        return {valor: total for valor, total in result.all()}

    async def likert_stats_global(self, pregunta_id: int) -> tuple[Optional[float], int]:
        """(promedio, n) de valores likert no nulos de una pregunta."""
        result = await self.db.execute(
            select(func.avg(EncuestaRespuesta.valor_likert), func.count(EncuestaRespuesta.id))
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuesta.valor_likert.isnot(None),
            )
        )
        promedio, n = result.one()
        return (float(promedio) if promedio is not None else None), n

    async def likert_distribucion_global(self, pregunta_id: int) -> dict[int, int]:
        result = await self.db.execute(
            select(EncuestaRespuesta.valor_likert, func.count(EncuestaRespuesta.id))
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuesta.valor_likert.isnot(None),
            )
            .group_by(EncuestaRespuesta.valor_likert)
        )
        return {int(valor): total for valor, total in result.all()}

    async def likert_stats_por_segmento(
        self, encuesta_id: int, pregunta_id: int, dimension: str
    ) -> dict[Optional[str], tuple[Optional[float], int]]:
        columna = self._segmento_columna(dimension)
        result = await self.db.execute(
            select(
                columna,
                func.avg(EncuestaRespuesta.valor_likert),
                func.count(EncuestaRespuesta.id),
            )
            .select_from(EncuestaRespuesta)
            .join(EncuestaRespuestaGrupo, EncuestaRespuestaGrupo.id == EncuestaRespuesta.grupo_id)
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuesta.valor_likert.isnot(None),
                EncuestaRespuestaGrupo.encuesta_id == encuesta_id,
            )
            .group_by(columna)
        )
        return {
            valor: (float(promedio) if promedio is not None else None, total)
            for valor, promedio, total in result.all()
        }

    async def likert_distribucion_por_segmento(
        self, encuesta_id: int, pregunta_id: int, dimension: str
    ) -> dict[Optional[str], dict[int, int]]:
        columna = self._segmento_columna(dimension)
        result = await self.db.execute(
            select(columna, EncuestaRespuesta.valor_likert, func.count(EncuestaRespuesta.id))
            .select_from(EncuestaRespuesta)
            .join(EncuestaRespuestaGrupo, EncuestaRespuestaGrupo.id == EncuestaRespuesta.grupo_id)
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuesta.valor_likert.isnot(None),
                EncuestaRespuestaGrupo.encuesta_id == encuesta_id,
            )
            .group_by(columna, EncuestaRespuesta.valor_likert)
        )
        salida: dict[Optional[str], dict[int, int]] = {}
        for valor_segmento, valor_likert, total in result.all():
            salida.setdefault(valor_segmento, {})[int(valor_likert)] = total
        return salida

    async def opcion_conteos_global(self, pregunta_id: int) -> dict[int, int]:
        result = await self.db.execute(
            select(EncuestaRespuestaOpcion.opcion_id, func.count(EncuestaRespuestaOpcion.id))
            .select_from(EncuestaRespuestaOpcion)
            .join(EncuestaRespuesta, EncuestaRespuesta.id == EncuestaRespuestaOpcion.respuesta_id)
            .where(EncuestaRespuesta.pregunta_id == pregunta_id)
            .group_by(EncuestaRespuestaOpcion.opcion_id)
        )
        return {opcion_id: total for opcion_id, total in result.all()}

    async def opcion_conteos_por_segmento(
        self, encuesta_id: int, pregunta_id: int, dimension: str
    ) -> dict[Optional[str], dict[int, int]]:
        columna = self._segmento_columna(dimension)
        result = await self.db.execute(
            select(columna, EncuestaRespuestaOpcion.opcion_id, func.count(EncuestaRespuestaOpcion.id))
            .select_from(EncuestaRespuestaOpcion)
            .join(EncuestaRespuesta, EncuestaRespuesta.id == EncuestaRespuestaOpcion.respuesta_id)
            .join(EncuestaRespuestaGrupo, EncuestaRespuestaGrupo.id == EncuestaRespuesta.grupo_id)
            .where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuestaGrupo.encuesta_id == encuesta_id,
            )
            .group_by(columna, EncuestaRespuestaOpcion.opcion_id)
        )
        salida: dict[Optional[str], dict[int, int]] = {}
        for valor_segmento, opcion_id, total in result.all():
            salida.setdefault(valor_segmento, {})[opcion_id] = total
        return salida

    async def list_textos(self, pregunta_id: int) -> list[str]:
        """Textos no vacios de una pregunta tipo texto. El shuffle y la regla
        min-N viven en el service — aqui solo se trae el contenido."""
        result = await self.db.execute(
            select(EncuestaRespuesta.texto).where(
                EncuestaRespuesta.pregunta_id == pregunta_id,
                EncuestaRespuesta.texto.isnot(None),
            )
        )
        return [texto for (texto,) in result.all() if texto]
