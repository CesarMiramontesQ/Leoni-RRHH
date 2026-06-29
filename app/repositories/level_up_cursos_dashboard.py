"""Repositorio de datos para el dashboard de seguimiento de cursos."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalogos import Area, Puesto
from app.models.empleados import Empleado
from app.models.level_up import Curso, CursoEmpleado, CursoGrupo, CursoPuesto, CursoSesion, TipoGrupoCurso
from app.models.talento import PerfilFunciones


class LevelUpCursosDashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_cursos_activos(self) -> list[Curso]:
        result = await self.db.execute(
            select(Curso).where(Curso.activo.is_(True)).order_by(Curso.nombre)
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

    async def list_sesiones(self) -> list[CursoSesion]:
        result = await self.db.execute(
            select(CursoSesion)
            .join(Curso, Curso.id == CursoSesion.curso_id)
            .where(Curso.activo.is_(True))
            .order_by(CursoSesion.fecha_inicio.desc())
        )
        return list(result.scalars().all())

    async def count_inscritos_por_sesion(self) -> dict[int, int]:
        result = await self.db.execute(
            select(CursoEmpleado.sesion_id, func.count())
            .where(CursoEmpleado.sesion_id.isnot(None))
            .group_by(CursoEmpleado.sesion_id)
        )
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
        conditions = []
        curso_por_condition: list[tuple[int, object]] = []
        for g in grupos:
            if g.tipo == TipoGrupoCurso.area:
                cond = Empleado.area_id == g.referencia_id
            elif g.tipo == TipoGrupoCurso.subarea:
                cond = Empleado.subarea_id == g.referencia_id
            elif g.tipo == TipoGrupoCurso.puesto:
                cond = Empleado.puesto_id == g.referencia_id
            else:
                continue
            conditions.append(cond)
            curso_por_condition.append((g.curso_id, cond))

        if not conditions:
            return {}

        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.area_id, Empleado.subarea_id, Empleado.puesto_id)
        )
        empleados = result.all()

        curso_empleados: dict[int, set[int]] = {}
        for g in grupos:
            emp_set: set[int] = set()
            for emp_id, area_id, subarea_id, puesto_id in empleados:
                if g.tipo == TipoGrupoCurso.area and area_id == g.referencia_id:
                    emp_set.add(emp_id)
                elif g.tipo == TipoGrupoCurso.subarea and subarea_id == g.referencia_id:
                    emp_set.add(emp_id)
                elif g.tipo == TipoGrupoCurso.puesto and puesto_id == g.referencia_id:
                    emp_set.add(emp_id)
            if emp_set:
                curso_empleados.setdefault(g.curso_id, set()).update(emp_set)
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
