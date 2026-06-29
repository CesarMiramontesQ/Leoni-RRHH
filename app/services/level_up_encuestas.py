"""Lógica de negocio del flujo de encuestas post curso (Level Up).

Reglas (enunciado):
- RH habilita encuesta solo para sesiones finalizadas (estado='completada').
- Solo asistentes (asistio=True) de esa sesión pueden responder.
- No se responde si la encuesta no está activa (cerrada manual o fecha límite vencida).
- Una respuesta por (sesión, empleado).
- La valoración pertenece al curso: el promedio se calcula sobre TODAS las sesiones.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.empleados import Empleado
from app.models.level_up import (
    Curso,
    CursoEncuesta,
    CursoSesion,
    EncuestaPostCurso,
    EstadoEncuesta,
)
from app.repositories.level_up_encuestas import EncuestaRepository
from app.schemas.level_up_encuestas import (
    ComentarioItem,
    CursoEncuestasResumenResponse,
    DashboardCursoItem,
    DistribucionItem,
    EncuestaDetalleResponse,
    EncuestaEstadoResponse,
    EncuestaHabilitarRequest,
    EncuestaPendienteItem,
    EncuestaPendienteListResponse,
    EncuestaRespuestaCreate,
    EncuestaRespuestaResponse,
    EncuestaSesionResultado,
    EncuestasDashboardResponse,
    EncuestaUpdateRequest,
)


def _round(value: float | None) -> float | None:
    return round(value, 2) if value is not None else None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _enum_value(estado: object) -> str:
    return getattr(estado, "value", estado)


class EncuestaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EncuestaRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _estado_efectivo(enc: CursoEncuesta) -> str:
        if _enum_value(enc.estado) == "cerrada":
            return "cerrada"
        if enc.fecha_limite is not None and enc.fecha_limite <= _now():
            return "cerrada"
        return "activa"

    async def _sesion_del_curso(self, curso_id: int, sesion_id: int) -> CursoSesion:
        sesion = await self.db.get(CursoSesion, sesion_id)
        if not sesion or sesion.curso_id != curso_id:
            raise NotFoundError(entidad="Sesión", id=sesion_id)
        return sesion

    async def _estado_response(
        self, curso_id: int, sesion_id: int, enc: CursoEncuesta | None
    ) -> EncuestaEstadoResponse:
        asistentes = await self.repo.count_asistentes_sesion(sesion_id)
        if enc is None:
            return EncuestaEstadoResponse(
                id=None,
                curso_id=curso_id,
                sesion_id=sesion_id,
                estado_efectivo="no_habilitada",
                total_asistentes=asistentes,
                respondidas=0,
                pendientes=asistentes,
            )
        respondidas = await self.repo.count_respondidas_sesion(sesion_id)
        return EncuestaEstadoResponse(
            id=enc.id,
            curso_id=enc.curso_id,
            sesion_id=enc.sesion_id,
            estado_efectivo=self._estado_efectivo(enc),
            fecha_limite=enc.fecha_limite,
            fecha_cierre=enc.fecha_cierre,
            total_asistentes=asistentes,
            respondidas=respondidas,
            pendientes=max(asistentes - respondidas, 0),
        )

    # ── Administración (RH) ──────────────────────────────────────────────────

    async def estado_sesion(self, curso_id: int, sesion_id: int) -> EncuestaEstadoResponse:
        await self._sesion_del_curso(curso_id, sesion_id)
        enc = await self.repo.get_encuesta_by_sesion(sesion_id)
        return await self._estado_response(curso_id, sesion_id, enc)

    async def habilitar(
        self,
        curso_id: int,
        sesion_id: int,
        data: EncuestaHabilitarRequest,
        current_user: Empleado,
    ) -> EncuestaEstadoResponse:
        sesion = await self._sesion_del_curso(curso_id, sesion_id)
        if _enum_value(sesion.estado) != "completada":
            raise DomainValidationError(
                detail="Solo se puede habilitar la encuesta de una sesión finalizada"
            )

        existing = await self.repo.get_encuesta_by_sesion(sesion_id)
        if existing is not None:
            raise ConflictError(detail="La encuesta de esta sesión ya está habilitada")

        enc = CursoEncuesta(
            curso_id=curso_id,
            sesion_id=sesion_id,
            estado=EstadoEncuesta.activa,
            fecha_limite=data.fecha_limite,
            habilitada_por=current_user.empleado_id,
        )
        self.db.add(enc)
        await self.db.flush()
        await self.db.refresh(enc)
        return await self._estado_response(curso_id, sesion_id, enc)

    async def actualizar(
        self,
        curso_id: int,
        sesion_id: int,
        data: EncuestaUpdateRequest,
        current_user: Empleado,
    ) -> EncuestaEstadoResponse:
        await self._sesion_del_curso(curso_id, sesion_id)
        enc = await self.repo.get_encuesta_by_sesion(sesion_id)
        if enc is None:
            raise NotFoundError(entidad="Encuesta", id=sesion_id)

        if "estado" in data.model_fields_set and data.estado is not None:
            enc.estado = EstadoEncuesta(data.estado)
            enc.fecha_cierre = _now() if data.estado == "cerrada" else None
        if "fecha_limite" in data.model_fields_set:
            enc.fecha_limite = data.fecha_limite

        await self.db.flush()
        await self.db.refresh(enc)
        return await self._estado_response(curso_id, sesion_id, enc)

    async def deshabilitar(
        self, curso_id: int, sesion_id: int, current_user: Empleado
    ) -> None:
        await self._sesion_del_curso(curso_id, sesion_id)
        enc = await self.repo.get_encuesta_by_sesion(sesion_id)
        if enc is None:
            raise NotFoundError(entidad="Encuesta", id=sesion_id)

        respuestas = await self.repo.count_respuestas_encuesta(enc.id)
        if respuestas > 0:
            # Con respuestas ya no se elimina (preserva la valoración); solo se cierra.
            enc.estado = EstadoEncuesta.cerrada
            enc.fecha_cierre = _now()
            await self.db.flush()
            raise ConflictError(
                detail="La encuesta tiene respuestas; se cerró en lugar de eliminarse"
            )
        await self.db.delete(enc)
        await self.db.flush()

    # ── Empleado ─────────────────────────────────────────────────────────────

    async def pendientes_empleado(self, empleado_id: int) -> EncuestaPendienteListResponse:
        rows = await self.repo.pendientes_empleado(empleado_id)
        items = [
            EncuestaPendienteItem(
                encuesta_id=row[0],
                curso_id=row[1],
                curso_nombre=row[2],
                sesion_id=row[3],
                fecha_sesion=row[4],
                fecha_limite=row[5],
            )
            for row in rows
        ]
        return EncuestaPendienteListResponse(items=items, total=len(items))

    async def detalle_para_responder(
        self, encuesta_id: int, empleado_id: int
    ) -> EncuestaDetalleResponse:
        enc = await self.repo.get_encuesta(encuesta_id)
        if enc is None:
            raise NotFoundError(entidad="Encuesta", id=encuesta_id)
        if not await self.repo.asistio_a_sesion(enc.sesion_id, empleado_id):
            raise DomainValidationError(
                detail="Solo los asistentes a la sesión pueden responder la encuesta"
            )
        curso = await self.db.get(Curso, enc.curso_id)
        sesion = await self.db.get(CursoSesion, enc.sesion_id)
        return EncuestaDetalleResponse(
            encuesta_id=enc.id,
            curso_id=enc.curso_id,
            curso_nombre=curso.nombre if curso else None,
            sesion_id=enc.sesion_id,
            fecha_sesion=sesion.fecha_inicio if sesion else None,
            estado_efectivo=self._estado_efectivo(enc),
            fecha_limite=enc.fecha_limite,
            ya_respondida=await self.repo.ya_respondio(enc.sesion_id, empleado_id),
        )

    async def responder(
        self, encuesta_id: int, empleado_id: int, data: EncuestaRespuestaCreate
    ) -> EncuestaRespuestaResponse:
        enc = await self.repo.get_encuesta(encuesta_id)
        if enc is None:
            raise NotFoundError(entidad="Encuesta", id=encuesta_id)
        if self._estado_efectivo(enc) != "activa":
            raise DomainValidationError(detail="La encuesta no está activa")
        if not await self.repo.asistio_a_sesion(enc.sesion_id, empleado_id):
            raise DomainValidationError(
                detail="Solo los asistentes a la sesión pueden responder la encuesta"
            )
        if await self.repo.ya_respondio(enc.sesion_id, empleado_id):
            raise ConflictError(detail="Ya respondiste la encuesta de esta sesión")

        respuesta = EncuestaPostCurso(
            encuesta_id=enc.id,
            curso_id=enc.curso_id,
            sesion_id=enc.sesion_id,
            empleado_id=empleado_id,
            score_general=data.score_general,
            score_instructor=data.score_instructor,
            score_contenido=data.score_contenido,
            score_aplicabilidad=data.score_aplicabilidad,
            comentario=(data.comentario or None),
        )
        self.db.add(respuesta)
        try:
            await self.db.flush()
        except IntegrityError as exc:  # carrera contra el unique (sesion, empleado)
            await self.db.rollback()
            raise ConflictError(
                detail="Ya respondiste la encuesta de esta sesión"
            ) from exc
        await self.db.refresh(respuesta)
        return EncuestaRespuestaResponse.model_validate(respuesta)

    # ── Resultados / métricas ────────────────────────────────────────────────

    async def resumen_curso(self, curso_id: int) -> CursoEncuestasResumenResponse:
        curso = await self.db.get(Curso, curso_id)
        if not curso:
            raise NotFoundError(entidad="Curso", id=curso_id)

        agg = await self.repo.agregados_curso(curso_id)
        dist = await self.repo.distribucion_curso(curso_id)
        sesiones_rows = await self.repo.resultados_por_sesion(curso_id)
        comentarios_rows = await self.repo.comentarios_curso(curso_id)

        sesiones = []
        for r in sesiones_rows:
            asistentes = r.asistentes or 0
            respondidas = r.respondidas or 0
            enc = CursoEncuesta(estado=r.estado, fecha_limite=r[3])
            sesiones.append(
                EncuestaSesionResultado(
                    sesion_id=r.sesion_id,
                    fecha_sesion=r.fecha_inicio,
                    estado_efectivo=self._estado_efectivo(enc),
                    total_asistentes=asistentes,
                    respondidas=respondidas,
                    tasa_participacion=(
                        round(respondidas / asistentes, 4) if asistentes else 0.0
                    ),
                    promedio_general=_round(float(r[7]) if r[7] is not None else None),
                    promedio_instructor=_round(float(r[8]) if r[8] is not None else None),
                    promedio_contenido=_round(float(r[9]) if r[9] is not None else None),
                    promedio_aplicabilidad=_round(float(r[10]) if r[10] is not None else None),
                )
            )

        return CursoEncuestasResumenResponse(
            curso_id=curso_id,
            curso_nombre=curso.nombre,
            calificacion_promedio=_round(agg["general"]),
            total_evaluaciones=agg["total"],
            promedio_instructor=_round(agg["instructor"]),
            promedio_contenido=_round(agg["contenido"]),
            promedio_aplicabilidad=_round(agg["aplicabilidad"]),
            distribucion=[
                DistribucionItem(score=s, cantidad=dist.get(s, 0)) for s in range(5, 0, -1)
            ],
            sesiones=sesiones,
            comentarios=[
                ComentarioItem(
                    sesion_id=c[0],
                    empleado_nombre=c[1],
                    score_general=c[2],
                    comentario=c[3],
                    fecha=c[4],
                )
                for c in comentarios_rows
            ],
        )

    async def dashboard_global(self) -> EncuestasDashboardResponse:
        total, score_medio, cursos_evaluados = await self.repo.dashboard_totales()
        cursos_rows = await self.repo.dashboard_por_curso()
        dist = await self.repo.dashboard_distribucion()
        comentarios_rows = await self.repo.dashboard_comentarios()

        cursos = []
        en_alerta = 0
        for r in cursos_rows:
            prom_gen = float(r[4]) if r[4] is not None else None
            if prom_gen is not None and prom_gen < 3.5:
                en_alerta += 1
            cursos.append(
                DashboardCursoItem(
                    curso_id=r[0],
                    curso_nombre=r[1],
                    proveedor_nombre=r[2],
                    total_evaluaciones=r[3] or 0,
                    promedio_general=_round(prom_gen),
                    promedio_instructor=_round(float(r[5]) if r[5] is not None else None),
                    promedio_contenido=_round(float(r[6]) if r[6] is not None else None),
                    promedio_aplicabilidad=_round(float(r[7]) if r[7] is not None else None),
                )
            )

        return EncuestasDashboardResponse(
            total_evaluaciones=total,
            score_medio=_round(score_medio),
            cursos_evaluados=cursos_evaluados,
            cursos_en_alerta=en_alerta,
            distribucion=[
                DistribucionItem(score=s, cantidad=dist.get(s, 0)) for s in range(5, 0, -1)
            ],
            cursos=cursos,
            comentarios=[
                ComentarioItem(
                    sesion_id=c[0],
                    empleado_nombre=c[1],
                    score_general=c[2],
                    comentario=c[3],
                    fecha=c[4],
                )
                for c in comentarios_rows
            ],
        )
