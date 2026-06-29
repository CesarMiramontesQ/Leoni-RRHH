"""Resolución compartida de asignaciones curso ↔ empleado (puestos, grupos, extras)."""

from __future__ import annotations

from sqlalchemy import or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.models.level_up import CursoEmpleado, CursoGrupo, CursoPuesto, TipoGrupoCurso
from app.models.talento import PerfilFunciones


class LevelUpAsignacionesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def empleados_por_puesto_curso(self, curso_id: int) -> set[int]:
        stmt = (
            select(PerfilFunciones.empleado_id)
            .join(CursoPuesto, CursoPuesto.puesto_perfil_id == PerfilFunciones.puesto_perfil_id)
            .where(
                CursoPuesto.curso_id == curso_id,
                CursoPuesto.sesion_id.is_(None),
                PerfilFunciones.activo.is_(True),
            )
        )
        result = await self.db.execute(stmt)
        return {row[0] for row in result.all()}

    async def empleados_por_grupos_curso(self, curso_id: int) -> set[int]:
        grupos_result = await self.db.execute(
            select(CursoGrupo).where(CursoGrupo.curso_id == curso_id)
        )
        grupos = grupos_result.scalars().all()
        if not grupos:
            return set()

        conditions = []
        for g in grupos:
            if g.tipo == TipoGrupoCurso.area:
                conditions.append(Empleado.area_id == g.referencia_id)
            elif g.tipo == TipoGrupoCurso.subarea:
                conditions.append(Empleado.subarea_id == g.referencia_id)
            elif g.tipo == TipoGrupoCurso.puesto:
                conditions.append(Empleado.puesto_id == g.referencia_id)

        if not conditions:
            return set()

        emp_result = await self.db.execute(
            select(Empleado.empleado_id).where(or_(*conditions))
        )
        return {row[0] for row in emp_result.all()}

    async def empleados_extra_curso(self, curso_id: int) -> set[int]:
        covered = await self.empleados_por_puesto_curso(curso_id)
        stmt = select(CursoEmpleado.empleado_id).where(
            CursoEmpleado.curso_id == curso_id,
            CursoEmpleado.sesion_id.is_(None),
        )
        if covered:
            stmt = stmt.where(CursoEmpleado.empleado_id.notin_(covered))
        result = await self.db.execute(stmt)
        return {row[0] for row in result.all()}

    async def empleados_asignados_a_curso(self, curso_id: int) -> set[int]:
        por_puesto = await self.empleados_por_puesto_curso(curso_id)
        por_grupo = await self.empleados_por_grupos_curso(curso_id)
        extras = await self.empleados_extra_curso(curso_id)
        return por_puesto | por_grupo | extras

    async def origen_asignacion(self, empleado_id: int, curso_id: int) -> str | None:
        if empleado_id in await self.empleados_por_puesto_curso(curso_id):
            return "puesto"
        if empleado_id in await self.empleados_por_grupos_curso(curso_id):
            return "grupo"
        if empleado_id in await self.empleados_extra_curso(curso_id):
            return "extra"
        return None

    async def cursos_asignados_a_empleado(self, empleado_id: int) -> set[int]:
        emp = await self.db.get(Empleado, empleado_id)
        if not emp:
            return set()

        from_puestos = (
            select(CursoPuesto.curso_id)
            .join(PerfilFunciones, PerfilFunciones.puesto_perfil_id == CursoPuesto.puesto_perfil_id)
            .where(
                PerfilFunciones.empleado_id == empleado_id,
                PerfilFunciones.activo.is_(True),
                CursoPuesto.sesion_id.is_(None),
            )
        )
        from_extras = select(CursoEmpleado.curso_id).where(
            CursoEmpleado.empleado_id == empleado_id,
            CursoEmpleado.sesion_id.is_(None),
        )

        grupo_conditions = []
        if emp.area_id is not None:
            grupo_conditions.append(
                (CursoGrupo.tipo == TipoGrupoCurso.area) & (CursoGrupo.referencia_id == emp.area_id)
            )
        if emp.subarea_id is not None:
            grupo_conditions.append(
                (CursoGrupo.tipo == TipoGrupoCurso.subarea)
                & (CursoGrupo.referencia_id == emp.subarea_id)
            )
        if emp.puesto_id is not None:
            grupo_conditions.append(
                (CursoGrupo.tipo == TipoGrupoCurso.puesto)
                & (CursoGrupo.referencia_id == emp.puesto_id)
            )

        queries = [from_puestos, from_extras]
        if grupo_conditions:
            from_grupos = select(CursoGrupo.curso_id).where(or_(*grupo_conditions))
            queries.append(from_grupos)

        combined = union(*queries)
        result = await self.db.execute(combined)
        return {row[0] for row in result.all()}

    async def empleados_elegibles_sesion(
        self,
        curso_id: int,
        sesion_id: int,
        q: str = "",
        limit: int = 30,
    ) -> list[tuple[int, str | None, str | None, str]]:
        """Retorna (empleado_id, nombre, no_empleado, origen) deduplicados."""
        from sqlalchemy import String, cast

        already_inscribed = select(CursoEmpleado.empleado_id).where(
            CursoEmpleado.sesion_id == sesion_id
        ).scalar_subquery()

        from_puestos = (
            select(Empleado.empleado_id, Empleado.nombre, Empleado.no_empleado)
            .join(PerfilFunciones, PerfilFunciones.empleado_id == Empleado.empleado_id)
            .join(CursoPuesto, CursoPuesto.puesto_perfil_id == PerfilFunciones.puesto_perfil_id)
            .where(
                CursoPuesto.curso_id == curso_id,
                PerfilFunciones.activo.is_(True),
                Empleado.empleado_id.notin_(already_inscribed),
            )
        )

        from_extras = (
            select(Empleado.empleado_id, Empleado.nombre, Empleado.no_empleado)
            .join(CursoEmpleado, CursoEmpleado.empleado_id == Empleado.empleado_id)
            .where(
                CursoEmpleado.curso_id == curso_id,
                CursoEmpleado.sesion_id.is_(None),
                Empleado.empleado_id.notin_(already_inscribed),
            )
        )

        grupos_result = await self.db.execute(
            select(CursoGrupo).where(CursoGrupo.curso_id == curso_id)
        )
        grupos = grupos_result.scalars().all()
        from_grupos_conditions = []
        for g in grupos:
            if g.tipo == TipoGrupoCurso.area:
                from_grupos_conditions.append(Empleado.area_id == g.referencia_id)
            elif g.tipo == TipoGrupoCurso.subarea:
                from_grupos_conditions.append(Empleado.subarea_id == g.referencia_id)
            elif g.tipo == TipoGrupoCurso.puesto:
                from_grupos_conditions.append(Empleado.puesto_id == g.referencia_id)

        queries = [from_puestos, from_extras]
        if from_grupos_conditions:
            from_grupos = (
                select(Empleado.empleado_id, Empleado.nombre, Empleado.no_empleado)
                .where(or_(*from_grupos_conditions), Empleado.empleado_id.notin_(already_inscribed))
            )
            queries.append(from_grupos)

        if q.strip():
            search = f"%{q.strip()}%"
            filtered = []
            for stmt in queries:
                filtered.append(
                    stmt.where(
                        Empleado.nombre.ilike(search)
                        | cast(Empleado.no_empleado, String).ilike(search)
                    )
                )
            queries = filtered

        from sqlalchemy import union_all

        combined = union_all(*queries).limit(limit)
        result = await self.db.execute(combined)
        rows = result.all()

        seen: set[int] = set()
        response: list[tuple[int, str | None, str | None, str]] = []
        for row in rows:
            if row[0] in seen:
                continue
            seen.add(row[0])
            response.append((row[0], row[1], str(row[2]) if row[2] is not None else None, "puesto"))
        return response

    def covered_by_puesto_subquery(self, curso_id: int):
        return (
            select(PerfilFunciones.empleado_id)
            .join(CursoPuesto, CursoPuesto.puesto_perfil_id == PerfilFunciones.puesto_perfil_id)
            .where(
                CursoPuesto.curso_id == curso_id,
                CursoPuesto.sesion_id.is_(None),
                PerfilFunciones.activo.is_(True),
            )
        ).scalar_subquery()
