# app/repositories/puesto_perfil_repository.py
"""
Repositorio de Puestos Perfil — acceso a datos async con SQLAlchemy.
"""

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clasificacion_puesto import (
    CareerLevelGradeMapping,
    PuestoPerfilClasificacionHistorial,
)
from app.models.empleados import Empleado
from app.models.level_up import CursoPuesto
from app.models.talento import (
    CompetenciaRequisito,
    GradoPuesto,
    PerfilCualificacion,
    PerfilFunciones,
    PerfilFuncionesCualificacion,
    PerfilFuncionesCompetencia,
    PerfilTarea,
    PuestoPerfil,
    PuestoPerfilGrado,
)
from app.repositories.base import BaseRepository


class PuestoPerfilRepository(BaseRepository[PuestoPerfil]):
    def __init__(self, db: AsyncSession):
        super().__init__(PuestoPerfil, db)

    @staticmethod
    def _carga_clasificacion() -> tuple:
        """
        Relaciones que el response denormaliza.

        Se precargan siempre: leerlas en lazy dentro de una sesion async revienta
        con MissingGreenlet, y SQLite no lo reproduce.
        """
        return (
            selectinload(PuestoPerfil.area),
            selectinload(PuestoPerfil.career_path),
            selectinload(PuestoPerfil.funcion),
            selectinload(PuestoPerfil.disciplina),
            selectinload(PuestoPerfil.global_grade),
            selectinload(PuestoPerfil.grados_config)
            .selectinload(PuestoPerfilGrado.grado)
            .selectinload(GradoPuesto.career_path),
            # La posicion del nivel sale de su equivalencia con el global grade;
            # sin precargarla, el rango del perfil se calcularia como si ninguno
            # tuviera posicion.
            selectinload(PuestoPerfil.grados_config)
            .selectinload(PuestoPerfilGrado.grado)
            .selectinload(GradoPuesto.equivalencia)
            .selectinload(CareerLevelGradeMapping.global_grade),
        )

    async def get_with_relations(self, id: int) -> PuestoPerfil | None:
        result = await self.db.execute(
            select(PuestoPerfil)
            .options(*self._carga_clasificacion())
            .where(PuestoPerfil.id == id, PuestoPerfil.activo.is_(True))
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        area_id: int | None = None,
        grado_id: int | None = None,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        funcion_id: int | None = None,
        disciplina_id: int | None = None,
        global_grade_id: int | None = None,
        estado: str | None = None,
        clasificacion_pendiente: bool | None = None,
    ) -> tuple[list[PuestoPerfil], int]:
        """Lista paginada con filtros opcionales. Retorna (items, total)."""
        query = (
            select(PuestoPerfil)
            .options(*self._carga_clasificacion())
            .where(PuestoPerfil.activo.is_(True))
        )

        if area_id is not None:
            query = query.where(PuestoPerfil.area_id == area_id)
        if grado_id is not None:
            query = query.where(
                PuestoPerfil.grados_config.any(
                    PuestoPerfilGrado.grado_id == grado_id
                )
            )
        if career_path_id is not None:
            query = query.where(PuestoPerfil.career_path_id == career_path_id)
        if funcion_id is not None:
            query = query.where(PuestoPerfil.funcion_id == funcion_id)
        if disciplina_id is not None:
            query = query.where(PuestoPerfil.disciplina_id == disciplina_id)
        if global_grade_id is not None:
            query = query.where(PuestoPerfil.global_grade_id == global_grade_id)
        if estado is not None:
            query = query.where(PuestoPerfil.estado == estado)
        if clasificacion_pendiente is not None:
            # Un perfil esta clasificado cuando tiene los cuatro campos; el rango de
            # career levels ya es obligatorio desde el alta.
            completa = (
                PuestoPerfil.career_path_id.isnot(None)
                & PuestoPerfil.funcion_id.isnot(None)
                & PuestoPerfil.disciplina_id.isnot(None)
                & PuestoPerfil.global_grade_id.isnot(None)
            )
            query = query.where(~completa if clasificacion_pendiente else completa)
        if busqueda:
            pattern = f"%{busqueda}%"
            query = query.where(
                or_(
                    PuestoPerfil.nombre.ilike(pattern),
                    PuestoPerfil.codigo.ilike(pattern),
                )
            )

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # Items
        query = query.order_by(PuestoPerfil.id.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total or 0

    async def list_by_area(self, area_id: int) -> list[PuestoPerfil]:
        """Lista todos los puestos perfil activos de un area."""
        result = await self.db.execute(
            select(PuestoPerfil)
            # Carga completa: la matriz por area ordena los niveles por la
            # posicion que da su global grade, y sin precargar la equivalencia
            # se cae con MissingGreenlet.
            .options(*self._carga_clasificacion())
            .where(PuestoPerfil.area_id == area_id, PuestoPerfil.activo.is_(True))
            .order_by(PuestoPerfil.nombre)
        )
        return list(result.scalars().all())

    async def exists_by_codigo(
        self, codigo: str, exclude_id: int | None = None
    ) -> bool:
        """Verifica si ya existe un puesto perfil con el mismo codigo."""
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.codigo.ilike(codigo),
        )
        if exclude_id:
            query = query.where(PuestoPerfil.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    async def exists_by_nombre_y_area(
        self, nombre: str, area_id: int, exclude_id: int | None = None
    ) -> bool:
        """Verifica si ya existe un puesto perfil activo con el mismo nombre y area."""
        query = select(func.count()).select_from(PuestoPerfil).where(
            PuestoPerfil.nombre.ilike(nombre),
            PuestoPerfil.area_id == area_id,
            PuestoPerfil.activo.is_(True),
        )
        if exclude_id:
            query = query.where(PuestoPerfil.id != exclude_id)
        count = await self.db.scalar(query)
        return (count or 0) > 0

    # ── Grados por perfil ─────────────────────────────────────────────────────
    #
    # Aqui vivia `grados_ocupados_en_area`, que sostenia la regla "un career level
    # no puede repetirse en otro perfil de la misma area". Con la metodologia WTW
    # esa regla es invalida: el nivel mide el tamano del puesto, no lo ocupa en
    # exclusiva, y varios puestos distintos de Ingenieria pueden estar en P10.

    async def get_grado_ids(self, perfil_id: int) -> set[int]:
        """Conjunto de grado_ids configurados para un perfil."""
        result = await self.db.execute(
            select(PuestoPerfilGrado.grado_id).where(
                PuestoPerfilGrado.puesto_perfil_id == perfil_id
            )
        )
        return set(result.scalars().all())

    async def set_grados(self, perfil_id: int, grado_ids: list[int]) -> None:
        """Reemplaza (delete + insert) los grados configurados de un perfil."""
        await self.db.execute(
            delete(PuestoPerfilGrado).where(
                PuestoPerfilGrado.puesto_perfil_id == perfil_id
            )
        )
        for grado_id in grado_ids:
            self.db.add(
                PuestoPerfilGrado(puesto_perfil_id=perfil_id, grado_id=grado_id)
            )
        await self.db.flush()

    async def grados_en_uso_por_perfil(
        self, perfil_id: int, grado_ids: list[int]
    ) -> dict[str, int]:
        """Cuenta requisitos/tareas/asignaciones activas que usan alguno de los
        grados indicados dentro del perfil. Devuelve solo las claves con conteo > 0."""
        if not grado_ids:
            return {}
        reqs = await self.db.scalar(
            select(func.count()).select_from(CompetenciaRequisito).where(
                CompetenciaRequisito.puesto_perfil_id == perfil_id,
                CompetenciaRequisito.grado_id.in_(grado_ids),
            )
        )
        tareas = await self.db.scalar(
            select(func.count()).select_from(PerfilTarea).where(
                PerfilTarea.puesto_perfil_id == perfil_id,
                PerfilTarea.grado_id.in_(grado_ids),
            )
        )
        asignaciones = await self.db.scalar(
            select(func.count()).select_from(PerfilFunciones).where(
                PerfilFunciones.puesto_perfil_id == perfil_id,
                PerfilFunciones.grado_id.in_(grado_ids),
                PerfilFunciones.activo.is_(True),
            )
        )
        uso: dict[str, int] = {}
        if reqs:
            uso["requisitos"] = reqs
        if tareas:
            uso["tareas"] = tareas
        if asignaciones:
            uso["asignaciones"] = asignaciones
        return uso

    async def get_resumen_tarjetas(self) -> list[dict]:
        """Obtiene perfiles activos con metricas agregadas para la vista de tarjetas."""
        # Subquery: personas por perfil
        personas_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFunciones.id).label("personas"),
            )
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: total requeridos (cualificaciones + competencias) por perfil
        cualif_count_sq = (
            select(
                PerfilCualificacion.puesto_perfil_id,
                func.count(PerfilCualificacion.id).label("total_cualif"),
            )
            .group_by(PerfilCualificacion.puesto_perfil_id)
            .subquery()
        )
        comp_count_sq = (
            select(
                CompetenciaRequisito.puesto_perfil_id,
                func.count(CompetenciaRequisito.id).label("total_comp"),
            )
            .group_by(CompetenciaRequisito.puesto_perfil_id)
            .subquery()
        )

        # Subquery: evaluaciones realizadas de cualificacion
        eval_cualif_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFuncionesCualificacion.id).label("eval_cualif"),
            )
            .join(PerfilFunciones, PerfilFuncionesCualificacion.perfil_funciones_id == PerfilFunciones.id)
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: evaluaciones realizadas de competencia
        eval_comp_sq = (
            select(
                PerfilFunciones.puesto_perfil_id,
                func.count(PerfilFuncionesCompetencia.id).label("eval_comp"),
            )
            .join(PerfilFunciones, PerfilFuncionesCompetencia.perfil_funciones_id == PerfilFunciones.id)
            .where(PerfilFunciones.activo.is_(True))
            .group_by(PerfilFunciones.puesto_perfil_id)
            .subquery()
        )

        # Subquery: cursos asignados por perfil
        cursos_sq = (
            select(
                CursoPuesto.puesto_perfil_id,
                func.count(CursoPuesto.id).label("cursos"),
            )
            .group_by(CursoPuesto.puesto_perfil_id)
            .subquery()
        )

        # Main query
        query = (
            select(
                PuestoPerfil.id,
                PuestoPerfil.codigo,
                PuestoPerfil.nombre,
                func.coalesce(personas_sq.c.personas, 0).label("personas"),
                func.coalesce(cualif_count_sq.c.total_cualif, 0).label("total_cualif"),
                func.coalesce(comp_count_sq.c.total_comp, 0).label("total_comp"),
                func.coalesce(eval_cualif_sq.c.eval_cualif, 0).label("eval_cualif"),
                func.coalesce(eval_comp_sq.c.eval_comp, 0).label("eval_comp"),
                func.coalesce(cursos_sq.c.cursos, 0).label("cursos"),
            )
            .outerjoin(personas_sq, personas_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(cualif_count_sq, cualif_count_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(comp_count_sq, comp_count_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(eval_cualif_sq, eval_cualif_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(eval_comp_sq, eval_comp_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .outerjoin(cursos_sq, cursos_sq.c.puesto_perfil_id == PuestoPerfil.id)
            .where(PuestoPerfil.activo.is_(True))
            .order_by(PuestoPerfil.nombre)
        )

        result = await self.db.execute(query)
        rows = result.all()

        items = []
        for row in rows:
            personas = row.personas
            total_cualif = row.total_cualif
            total_comp = row.total_comp
            eval_cualif = row.eval_cualif
            eval_comp = row.eval_comp

            # Cumplimiento: evaluaciones completadas / (requeridas × personas)
            total_requeridos = (total_cualif + total_comp) * personas
            total_evaluados = eval_cualif + eval_comp
            cumplimiento_pct = (
                round((total_evaluados / total_requeridos) * 100)
                if total_requeridos > 0
                else 0
            )

            # Brechas: requeridos sin evaluar
            brechas = max(0, total_requeridos - total_evaluados)

            items.append({
                "id": row.id,
                "codigo": row.codigo,
                "nombre": row.nombre,
                "grados": [],  # se completa en la segunda pasada
                "personas": personas,
                "cumplimiento_pct": cumplimiento_pct,
                "brechas": brechas,
                "cursos": row.cursos,
            })

        # Cargar area_nombre y grados en segunda pasada (selectinload no
        # funciona con columnas explícitas, cargamos por separado)
        perfil_ids = [item["id"] for item in items]
        if perfil_ids:
            perfiles_result = await self.db.execute(
                select(PuestoPerfil)
                .options(
                    selectinload(PuestoPerfil.area),
                    selectinload(PuestoPerfil.grados_config).selectinload(
                        PuestoPerfilGrado.grado
                    ).selectinload(GradoPuesto.equivalencia).selectinload(
                        CareerLevelGradeMapping.global_grade
                    ),
                )
                .where(PuestoPerfil.id.in_(perfil_ids))
            )
            perfiles_map = {p.id: p for p in perfiles_result.scalars().all()}
            for item in items:
                perfil = perfiles_map.get(item["id"])
                item["area_nombre"] = perfil.area.descripcion if perfil and perfil.area else None
                # La posicion del nivel es la de su global grade; los que no
                # tienen equivalencia van al final.
                item["grados"] = sorted(
                    (
                        {
                            "id": g.grado.id,
                            "nombre": g.grado.nombre,
                            "codigo": g.grado.codigo,
                            "orden": (
                                g.grado.equivalencia.global_grade.orden
                                if g.grado.equivalencia
                                and g.grado.equivalencia.global_grade
                                else None
                            ),
                        }
                        for g in (perfil.grados_config if perfil else [])
                        if g.grado
                    ),
                    key=lambda x: (x["orden"] is None, x["orden"] or 0, x["codigo"]),
                )

        return items


class ClasificacionHistorialRepository(BaseRepository[PuestoPerfilClasificacionHistorial]):
    """Bitacora append-only de la clasificacion. Nunca se actualiza ni se borra."""

    def __init__(self, db: AsyncSession):
        super().__init__(PuestoPerfilClasificacionHistorial, db)

    async def list_by_perfil(
        self, puesto_perfil_id: int, limit: int = 100
    ) -> list[tuple[PuestoPerfilClasificacionHistorial, str | None]]:
        """Eventos del perfil, del mas reciente al mas antiguo, con el nombre del autor."""
        result = await self.db.execute(
            select(PuestoPerfilClasificacionHistorial, Empleado.nombre)
            .outerjoin(
                Empleado,
                Empleado.empleado_id == PuestoPerfilClasificacionHistorial.changed_by,
            )
            .where(
                PuestoPerfilClasificacionHistorial.puesto_perfil_id == puesto_perfil_id
            )
            .order_by(PuestoPerfilClasificacionHistorial.created_at.desc())
            .limit(limit)
        )
        return [(row[0], row[1]) for row in result.all()]

    async def ultimo_de_perfil(
        self, puesto_perfil_id: int
    ) -> tuple[PuestoPerfilClasificacionHistorial, str | None] | None:
        filas = await self.list_by_perfil(puesto_perfil_id, limit=1)
        return filas[0] if filas else None
