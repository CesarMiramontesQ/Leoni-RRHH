"""Acceso a datos del flujo de encuestas post curso (Level Up).

Devuelve agregados crudos (AVG/COUNT/distribución/por sesión). La lógica de estado
efectivo (fecha límite vs ahora) y el mapeo a schemas viven en el service.
"""

from __future__ import annotations

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cursos_catalogo import CursoInstructorExterno, CursoProveedor
from app.models.empleados import Empleado
from app.models.level_up import (
    Curso,
    CursoEmpleado,
    CursoEncuesta,
    CursoSesion,
    EncuestaPostCurso,
)


class EncuestaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Habilitación ─────────────────────────────────────────────────────────

    async def get_encuesta(self, encuesta_id: int) -> CursoEncuesta | None:
        return await self.db.get(CursoEncuesta, encuesta_id)

    async def get_encuesta_by_sesion(self, sesion_id: int) -> CursoEncuesta | None:
        result = await self.db.execute(
            select(CursoEncuesta).where(CursoEncuesta.sesion_id == sesion_id)
        )
        return result.scalar_one_or_none()

    # ── Conteos por sesión ───────────────────────────────────────────────────

    async def count_asistentes_sesion(self, sesion_id: int) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(CursoEmpleado).where(
                CursoEmpleado.sesion_id == sesion_id,
                CursoEmpleado.asistio.is_(True),
            )
        )
        return result.scalar() or 0

    async def count_respondidas_sesion(self, sesion_id: int) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(EncuestaPostCurso).where(
                EncuestaPostCurso.sesion_id == sesion_id
            )
        )
        return result.scalar() or 0

    async def count_respuestas_encuesta(self, encuesta_id: int) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(EncuestaPostCurso).where(
                EncuestaPostCurso.encuesta_id == encuesta_id
            )
        )
        return result.scalar() or 0

    async def asistio_a_sesion(self, sesion_id: int, empleado_id: int) -> bool:
        result = await self.db.execute(
            select(func.count()).select_from(CursoEmpleado).where(
                CursoEmpleado.sesion_id == sesion_id,
                CursoEmpleado.empleado_id == empleado_id,
                CursoEmpleado.asistio.is_(True),
            )
        )
        return (result.scalar() or 0) > 0

    async def ya_respondio(self, sesion_id: int, empleado_id: int) -> bool:
        result = await self.db.execute(
            select(func.count()).select_from(EncuestaPostCurso).where(
                EncuestaPostCurso.sesion_id == sesion_id,
                EncuestaPostCurso.empleado_id == empleado_id,
            )
        )
        return (result.scalar() or 0) > 0

    # ── Calificación de curso (catálogo/detalle) ─────────────────────────────

    async def promedios_por_curso(
        self, curso_ids: list[int]
    ) -> dict[int, tuple[float | None, int]]:
        """{curso_id: (AVG(score_general), total_evaluaciones)} para los cursos dados."""
        if not curso_ids:
            return {}
        result = await self.db.execute(
            select(
                EncuestaPostCurso.curso_id,
                func.avg(EncuestaPostCurso.score_general),
                func.count(),
            )
            .where(EncuestaPostCurso.curso_id.in_(curso_ids))
            .group_by(EncuestaPostCurso.curso_id)
        )
        return {
            row[0]: (float(row[1]) if row[1] is not None else None, row[2])
            for row in result.all()
        }

    # ── Empleado: pendientes ─────────────────────────────────────────────────

    async def pendientes_empleado(self, empleado_id: int) -> list:
        """Encuestas efectivamente activas de sesiones donde asistió y no respondió."""
        no_respondida = ~select(EncuestaPostCurso.id).where(
            EncuestaPostCurso.sesion_id == CursoEncuesta.sesion_id,
            EncuestaPostCurso.empleado_id == empleado_id,
        ).exists()

        stmt = (
            select(
                CursoEncuesta.id,
                CursoEncuesta.curso_id,
                Curso.nombre,
                CursoEncuesta.sesion_id,
                CursoSesion.fecha_inicio,
                CursoEncuesta.fecha_limite,
            )
            .join(CursoEmpleado, and_(
                CursoEmpleado.sesion_id == CursoEncuesta.sesion_id,
                CursoEmpleado.empleado_id == empleado_id,
                CursoEmpleado.asistio.is_(True),
            ))
            .join(Curso, Curso.id == CursoEncuesta.curso_id)
            .join(CursoSesion, CursoSesion.id == CursoEncuesta.sesion_id)
            .where(
                CursoEncuesta.estado == "activa",
                (CursoEncuesta.fecha_limite.is_(None))
                | (CursoEncuesta.fecha_limite > func.now()),
                no_respondida,
            )
            .order_by(CursoSesion.fecha_inicio.desc())
        )
        return list((await self.db.execute(stmt)).all())

    # ── Resultados por curso ─────────────────────────────────────────────────

    async def agregados_curso(self, curso_id: int) -> dict:
        """AVG de las 4 dimensiones + total para un curso (todas sus sesiones)."""
        row = (
            await self.db.execute(
                select(
                    func.avg(EncuestaPostCurso.score_general),
                    func.avg(EncuestaPostCurso.score_instructor),
                    func.avg(EncuestaPostCurso.score_contenido),
                    func.avg(EncuestaPostCurso.score_aplicabilidad),
                    func.count(),
                ).where(EncuestaPostCurso.curso_id == curso_id)
            )
        ).one()
        return {
            "general": float(row[0]) if row[0] is not None else None,
            "instructor": float(row[1]) if row[1] is not None else None,
            "contenido": float(row[2]) if row[2] is not None else None,
            "aplicabilidad": float(row[3]) if row[3] is not None else None,
            "total": row[4] or 0,
        }

    async def distribucion_curso(self, curso_id: int) -> dict[int, int]:
        result = await self.db.execute(
            select(EncuestaPostCurso.score_general, func.count())
            .where(EncuestaPostCurso.curso_id == curso_id)
            .group_by(EncuestaPostCurso.score_general)
        )
        return {int(row[0]): row[1] for row in result.all()}

    async def resultados_por_sesion(self, curso_id: int) -> list:
        """Por cada sesión con encuesta habilitada: asistentes, respuestas y promedios."""
        respondidas_sub = (
            select(func.count())
            .select_from(EncuestaPostCurso)
            .where(EncuestaPostCurso.sesion_id == CursoEncuesta.sesion_id)
            .correlate(CursoEncuesta)
            .scalar_subquery()
        )
        asistentes_sub = (
            select(func.count())
            .select_from(CursoEmpleado)
            .where(
                CursoEmpleado.sesion_id == CursoEncuesta.sesion_id,
                CursoEmpleado.asistio.is_(True),
            )
            .correlate(CursoEncuesta)
            .scalar_subquery()
        )
        stmt = (
            select(
                CursoEncuesta.sesion_id,
                CursoSesion.fecha_inicio,
                CursoEncuesta.estado,
                CursoEncuesta.fecha_limite,
                CursoEncuesta.fecha_cierre,
                asistentes_sub.label("asistentes"),
                respondidas_sub.label("respondidas"),
                func.avg(EncuestaPostCurso.score_general),
                func.avg(EncuestaPostCurso.score_instructor),
                func.avg(EncuestaPostCurso.score_contenido),
                func.avg(EncuestaPostCurso.score_aplicabilidad),
            )
            .join(CursoSesion, CursoSesion.id == CursoEncuesta.sesion_id)
            .outerjoin(
                EncuestaPostCurso, EncuestaPostCurso.sesion_id == CursoEncuesta.sesion_id
            )
            .where(CursoEncuesta.curso_id == curso_id)
            .group_by(
                CursoEncuesta.sesion_id,
                CursoSesion.fecha_inicio,
                CursoEncuesta.estado,
                CursoEncuesta.fecha_limite,
                CursoEncuesta.fecha_cierre,
            )
            .order_by(CursoSesion.fecha_inicio.asc())
        )
        return list((await self.db.execute(stmt)).all())

    async def comentarios_curso(self, curso_id: int, limit: int = 50) -> list:
        stmt = (
            select(
                EncuestaPostCurso.sesion_id,
                Empleado.nombre,
                EncuestaPostCurso.score_general,
                EncuestaPostCurso.comentario,
                EncuestaPostCurso.fecha,
            )
            .outerjoin(Empleado, Empleado.empleado_id == EncuestaPostCurso.empleado_id)
            .where(
                EncuestaPostCurso.curso_id == curso_id,
                EncuestaPostCurso.comentario.isnot(None),
                func.length(func.trim(EncuestaPostCurso.comentario)) > 0,
            )
            .order_by(EncuestaPostCurso.fecha.desc())
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).all())

    # ── Dashboard global ─────────────────────────────────────────────────────

    async def dashboard_por_curso(self) -> list:
        stmt = (
            select(
                Curso.id,
                Curso.nombre,
                CursoProveedor.nombre.label("proveedor_nombre"),
                func.count(EncuestaPostCurso.id).label("total"),
                func.avg(EncuestaPostCurso.score_general),
                func.avg(EncuestaPostCurso.score_instructor),
                func.avg(EncuestaPostCurso.score_contenido),
                func.avg(EncuestaPostCurso.score_aplicabilidad),
            )
            .join(EncuestaPostCurso, EncuestaPostCurso.curso_id == Curso.id)
            .outerjoin(CursoProveedor, CursoProveedor.id == Curso.proveedor_id)
            .group_by(Curso.id, Curso.nombre, CursoProveedor.nombre)
            .order_by(func.count(EncuestaPostCurso.id).desc())
        )
        return list((await self.db.execute(stmt)).all())

    async def dashboard_distribucion(self) -> dict[int, int]:
        result = await self.db.execute(
            select(EncuestaPostCurso.score_general, func.count()).group_by(
                EncuestaPostCurso.score_general
            )
        )
        return {int(row[0]): row[1] for row in result.all()}

    async def dashboard_totales(self) -> tuple[int, float | None, int]:
        row = (
            await self.db.execute(
                select(
                    func.count(),
                    func.avg(EncuestaPostCurso.score_general),
                    func.count(func.distinct(EncuestaPostCurso.curso_id)),
                )
            )
        ).one()
        return row[0] or 0, (float(row[1]) if row[1] is not None else None), row[2] or 0

    async def dashboard_comentarios(self, limit: int = 30) -> list:
        stmt = (
            select(
                EncuestaPostCurso.sesion_id,
                Empleado.nombre,
                EncuestaPostCurso.score_general,
                EncuestaPostCurso.comentario,
                EncuestaPostCurso.fecha,
            )
            .outerjoin(Empleado, Empleado.empleado_id == EncuestaPostCurso.empleado_id)
            .where(
                EncuestaPostCurso.comentario.isnot(None),
                func.length(func.trim(EncuestaPostCurso.comentario)) > 0,
            )
            .order_by(EncuestaPostCurso.fecha.desc())
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).all())
