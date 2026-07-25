"""Repositorio de datos para el dashboard de seguimiento de cursos."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area, Puesto
from app.models.empleados import Empleado
from app.models.level_up import Curso, CursoEmpleado, CursoGrupo, CursoPuesto, CursoSesion, EstadoSesion, TipoGrupoCurso
from app.models.talento import PerfilFunciones


class LevelUpCursosDashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_cursos_activos(self) -> list[Curso]:
        result = await self.db.execute(
            select(Curso).where(Curso.activo.is_(True)).order_by(Curso.nombre)
        )
        return list(result.scalars().all())

    async def list_cursos_by_ids(self, curso_ids: set[int]) -> list[Curso]:
        if not curso_ids:
            return []
        result = await self.db.execute(
            select(Curso)
            .where(Curso.id.in_(curso_ids), Curso.activo.is_(True))
            .order_by(Curso.nombre)
        )
        return list(result.scalars().all())

    async def list_inscripciones_empleado_con_sesion(self, empleado_id: int) -> list[CursoEmpleado]:
        result = await self.db.execute(
            select(CursoEmpleado)
            .options(selectinload(CursoEmpleado.sesion))
            .where(
                CursoEmpleado.empleado_id == empleado_id,
                CursoEmpleado.sesion_id.isnot(None),
            )
        )
        return list(result.scalars().all())

    async def list_all_curso_puestos(self) -> list[CursoPuesto]:
        result = await self.db.execute(
            select(CursoPuesto).where(CursoPuesto.sesion_id.is_(None))
        )
        return list(result.scalars().all())

    async def list_all_grupos(self) -> list[CursoGrupo]:
        result = await self.db.execute(select(CursoGrupo))
        return list(result.scalars().all())

    async def list_extras_sin_sesion(self) -> list[CursoEmpleado]:
        result = await self.db.execute(
            select(CursoEmpleado).where(CursoEmpleado.sesion_id.is_(None))
        )
        return list(result.scalars().all())

    async def list_inscripciones_con_sesion(self) -> list[CursoEmpleado]:
        result = await self.db.execute(
            select(CursoEmpleado)
            .options(selectinload(CursoEmpleado.sesion))
            .where(CursoEmpleado.sesion_id.isnot(None))
        )
        return list(result.scalars().all())

    async def list_inscripciones_activas_con_sesion(self) -> list[CursoEmpleado]:
        """Inscripciones en sesiones programadas, en curso o completadas sin asistencia confirmada."""
        result = await self.db.execute(
            select(CursoEmpleado)
            .options(selectinload(CursoEmpleado.sesion))
            .join(CursoSesion, CursoSesion.id == CursoEmpleado.sesion_id)
            .where(
                CursoEmpleado.sesion_id.isnot(None),
                or_(
                    CursoSesion.estado.in_([EstadoSesion.programada, EstadoSesion.en_curso]),
                    (
                        (CursoSesion.estado == EstadoSesion.completada)
                        & or_(CursoEmpleado.asistio.is_(False), CursoEmpleado.asistio.is_(None))
                    ),
                ),
            )
        )
        return list(result.scalars().all())

    async def completed_curso_pairs(self) -> set[tuple[int, int]]:
        result = await self.db.execute(
            select(CursoEmpleado.empleado_id, CursoEmpleado.curso_id)
            .where(
                CursoEmpleado.sesion_id.isnot(None),
                CursoEmpleado.asistio.is_(True),
            )
            .distinct()
        )
        return {(int(row[0]), int(row[1])) for row in result.all()}

    async def count_completed_curso_pairs(self, empleado_ids: set[int] | None = None) -> int:
        """`empleado_ids` = None cuenta el universo; un set lo recorta a esa
        poblacion (filtro por area del resumen). Un set vacio cuenta 0, no
        todo: 'ningun empleado' no es 'todos'."""
        if empleado_ids is not None and not empleado_ids:
            return 0
        interno = select(CursoEmpleado.empleado_id, CursoEmpleado.curso_id).where(
            CursoEmpleado.sesion_id.isnot(None),
            CursoEmpleado.asistio.is_(True),
        )
        if empleado_ids is not None:
            interno = interno.where(CursoEmpleado.empleado_id.in_(empleado_ids))
        result = await self.db.execute(
            select(func.count()).select_from(interno.distinct().subquery())
        )
        return int(result.scalar_one())

    async def empleado_ids_de_area(self, area_id: int) -> set[int]:
        """Empleados activos del area. Solo lectura sobre `empleados` (Bono)."""
        from app.core.config import settings

        result = await self.db.execute(
            select(Empleado.empleado_id).where(
                Empleado.area_id == area_id,
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            )
        )
        return {int(row[0]) for row in result.all()}

    async def areas_con_registros(self) -> list[tuple[int, str]]:
        """Areas que tienen al menos un empleado con registro de curso.

        Alimenta el selector de la pantalla y se calcula SIN el filtro
        aplicado: si se recortara con el, elegir un area dejaria esa unica
        opcion y no habria forma de volver a otra."""
        result = await self.db.execute(
            select(Area.area_id, Area.descripcion)
            .join(Empleado, Empleado.area_id == Area.area_id)
            .join(CursoEmpleado, CursoEmpleado.empleado_id == Empleado.empleado_id)
            .distinct()
            .order_by(Area.descripcion)
        )
        return [(int(row[0]), row[1] or f"Area {row[0]}") for row in result.all()]

    async def list_sesiones_activas(self) -> list[CursoSesion]:
        result = await self.db.execute(
            select(CursoSesion)
            .join(Curso, Curso.id == CursoSesion.curso_id)
            .where(
                Curso.activo.is_(True),
                CursoSesion.estado.in_([EstadoSesion.programada, EstadoSesion.en_curso]),
            )
            .order_by(CursoSesion.fecha_inicio.desc())
        )
        return list(result.scalars().all())

    async def list_sesiones(self) -> list[CursoSesion]:
        result = await self.db.execute(
            select(CursoSesion)
            .join(Curso, Curso.id == CursoSesion.curso_id)
            .where(Curso.activo.is_(True))
            .order_by(CursoSesion.fecha_inicio.desc())
        )
        return list(result.scalars().all())

    async def count_inscritos_por_sesion(
        self, empleado_ids: set[int] | None = None
    ) -> dict[int, int]:
        """Inscritos por sesion. Con `empleado_ids`, cuenta solo a esa
        poblacion y **omite las sesiones sin ninguno**: el resumen usa esas
        claves para saber que sesiones tocan al area."""
        if empleado_ids is not None and not empleado_ids:
            return {}
        query = select(CursoEmpleado.sesion_id, func.count()).where(
            CursoEmpleado.sesion_id.isnot(None)
        )
        if empleado_ids is not None:
            query = query.where(CursoEmpleado.empleado_id.in_(empleado_ids))
        result = await self.db.execute(query.group_by(CursoEmpleado.sesion_id))
        return {row[0]: int(row[1]) for row in result.all()}

    async def get_empleados_map(self, empleado_ids: set[int]) -> dict[int, Empleado]:
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.area), selectinload(Empleado.puesto))
            .where(Empleado.empleado_id.in_(empleado_ids))
        )
        return {e.empleado_id: e for e in result.scalars().all()}

    async def empleados_por_puesto_perfil(self, puesto_perfil_ids: set[int]) -> dict[int, set[int]]:
        if not puesto_perfil_ids:
            return {}
        result = await self.db.execute(
            select(PerfilFunciones.puesto_perfil_id, PerfilFunciones.empleado_id).where(
                PerfilFunciones.puesto_perfil_id.in_(puesto_perfil_ids),
                PerfilFunciones.activo.is_(True),
            )
        )
        mapping: dict[int, set[int]] = {}
        for pp_id, emp_id in result.all():
            mapping.setdefault(pp_id, set()).add(emp_id)
        return mapping

    async def empleados_por_grupos(self, grupos: list[CursoGrupo]) -> dict[int, set[int]]:
        """curso_id -> empleado_ids desde grupos dinámicos."""
        if not grupos:
            return {}

        curso_empleados: dict[int, set[int]] = {}
        for g in grupos:
            if g.tipo == TipoGrupoCurso.area:
                cond = Empleado.area_id == g.referencia_id
            elif g.tipo == TipoGrupoCurso.subarea:
                cond = Empleado.subarea_id == g.referencia_id
            elif g.tipo == TipoGrupoCurso.puesto:
                cond = Empleado.puesto_id == g.referencia_id
            else:
                continue
            result = await self.db.execute(select(Empleado.empleado_id).where(cond))
            emp_ids = {row[0] for row in result.all()}
            if emp_ids:
                curso_empleados.setdefault(g.curso_id, set()).update(emp_ids)
        return curso_empleados

    async def get_empleado(self, empleado_id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.area), selectinload(Empleado.puesto))
            .where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_area_nombre(self, area_id: int | None) -> str | None:
        if area_id is None:
            return None
        area = await self.db.get(Area, area_id)
        return area.descripcion if area else None

    async def get_puesto_nombre(self, puesto_id: int | None) -> str | None:
        if puesto_id is None:
            return None
        puesto = await self.db.get(Puesto, puesto_id)
        return puesto.descripcion if puesto else None
