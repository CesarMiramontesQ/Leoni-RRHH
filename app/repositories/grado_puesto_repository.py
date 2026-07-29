# app/repositories/grado_puesto_repository.py
"""
Repositorio de GradoPuesto (Career Level) — acceso a datos async.

La unicidad de `codigo` y `nombre` es POR career path, no global: P1 y M1 conviven.
Toda comprobacion de duplicados recibe el career path.

El nivel no tiene orden propio: se ordena por el `orden` del Global Grade al que
equivale. Los niveles sin equivalencia van al final (`NULLS LAST`) y, dentro del
mismo grado, se desempata por codigo para que el listado sea estable.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clasificacion_puesto import (
    CareerLevelGradeMapping,
    CareerPath,
    GlobalGrade,
)
from app.models.talento import (
    CompetenciaRequisito,
    GradoPuesto,
    PerfilFunciones,
    PuestoPerfil,
    PuestoPerfilGrado,
)
from app.repositories.base import BaseRepository


class GradoPuestoRepository(BaseRepository[GradoPuesto]):
    def __init__(self, db: AsyncSession):
        super().__init__(GradoPuesto, db)

    @staticmethod
    def _carga_completa() -> tuple:
        """Career path y equivalencias: sin ellas el nivel no sabe su tramo."""
        return (
            selectinload(GradoPuesto.career_path),
            selectinload(GradoPuesto.equivalencias).selectinload(
                CareerLevelGradeMapping.global_grade
            ),
        )

    @staticmethod
    def _orden_minimo():
        """
        Subquery escalar con el `orden` mas bajo de los grados del nivel.

        Se usa para ordenar SIN join: un nivel con dos equivalencias produciria
        dos filas, duplicando el nivel en el listado y descuadrando el `total`
        respecto a la paginacion.
        """
        return (
            select(func.min(GlobalGrade.orden))
            .select_from(CareerLevelGradeMapping)
            .join(
                GlobalGrade, GlobalGrade.id == CareerLevelGradeMapping.global_grade_id
            )
            .where(
                CareerLevelGradeMapping.career_level_id == GradoPuesto.id,
                CareerLevelGradeMapping.activo.is_(True),
            )
            .correlate(GradoPuesto)
            .scalar_subquery()
        )

    async def list_filtered(
        self,
        offset: int,
        limit: int,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> tuple[list[GradoPuesto], int]:
        query = select(GradoPuesto)
        if solo_activos:
            query = query.where(GradoPuesto.activo.is_(True))
        if career_path_id:
            query = query.where(GradoPuesto.career_path_id == career_path_id)
        if busqueda:
            query = query.where(
                GradoPuesto.nombre.ilike(f"%{busqueda}%")
                | GradoPuesto.codigo.ilike(f"%{busqueda}%")
            )

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # El career path y las equivalencias se precargan: el response los
        # denormaliza y leerlos en lazy dentro de una sesion async revienta con
        # MissingGreenlet.
        query = (
            query.options(*self._carga_completa())
            .join(CareerPath, CareerPath.id == GradoPuesto.career_path_id)
            .order_by(
                CareerPath.codigo,
                self._orden_minimo().nulls_last(),
                GradoPuesto.codigo,
            )
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().unique().all()), total or 0

    async def get_por_nombre(
        self, career_path_id: int, nombre: str, exclude_id: int | None = None
    ) -> GradoPuesto | None:
        """
        Nivel con ese nombre en el path, **incluidos los desactivados**.

        Las uniques de la tabla (`career_path_id, codigo` y `career_path_id,
        nombre`) cubren todas las filas, no solo las activas. Filtrar por
        `activo` aqui hacia que el duplicado pasara la validacion y reventara
        en el INSERT como 500.
        """
        return await self._uno_por(GradoPuesto.nombre.ilike(nombre), career_path_id, exclude_id)

    async def get_por_codigo(
        self, career_path_id: int, codigo: str, exclude_id: int | None = None
    ) -> GradoPuesto | None:
        """Nivel con ese codigo en el path, incluidos los desactivados."""
        return await self._uno_por(GradoPuesto.codigo.ilike(codigo), career_path_id, exclude_id)

    async def _uno_por(
        self, criterio, career_path_id: int, exclude_id: int | None
    ) -> GradoPuesto | None:
        query = select(GradoPuesto).where(
            GradoPuesto.career_path_id == career_path_id, criterio
        )
        if exclude_id:
            query = query.where(GradoPuesto.id != exclude_id)
        result = await self.db.execute(query.limit(1))
        return result.scalar_one_or_none()


    async def count_requisitos_usando(self, grado_id: int) -> int:
        """
        Requisitos que usan el nivel, **solo de perfiles vivos**.

        Un perfil borrado es un borrado suave y no se puede restaurar desde
        ninguna pantalla: dejar que sus requisitos retengan el nivel lo dejaba
        imposible de eliminar para siempre. Mismo criterio que
        `CareerPathRepository.count_perfiles_usando`.
        """
        query = (
            select(func.count())
            .select_from(CompetenciaRequisito)
            .join(
                PuestoPerfil, PuestoPerfil.id == CompetenciaRequisito.puesto_perfil_id
            )
            .where(
                CompetenciaRequisito.grado_id == grado_id,
                PuestoPerfil.activo.is_(True),
            )
        )
        count = await self.db.scalar(query)
        return count or 0

    async def count_asignaciones_usando(self, grado_id: int) -> int:
        """Asignaciones activas del nivel, **solo de perfiles vivos**."""
        query = (
            select(func.count())
            .select_from(PerfilFunciones)
            .join(PuestoPerfil, PuestoPerfil.id == PerfilFunciones.puesto_perfil_id)
            .where(
                PerfilFunciones.grado_id == grado_id,
                PerfilFunciones.activo.is_(True),
                PuestoPerfil.activo.is_(True),
            )
        )
        count = await self.db.scalar(query)
        return count or 0

    async def perfiles_usando(self, grado_id: int, limite: int = 5) -> list[str]:
        """Codigos de los perfiles vivos que usan el nivel, para el mensaje de error."""
        query = (
            select(PuestoPerfil.codigo)
            .where(
                PuestoPerfil.activo.is_(True),
                PuestoPerfil.grados_config.any(
                    PuestoPerfilGrado.grado_id == grado_id
                ),
            )
            .order_by(PuestoPerfil.codigo)
            .limit(limite)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_activos_by_ids(self, ids: list[int]) -> list[GradoPuesto]:
        """Devuelve los grados activos cuyos ids esten en la lista."""
        if not ids:
            return []
        result = await self.db.execute(
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(
                GradoPuesto.id.in_(ids),
                GradoPuesto.activo.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_activo(self, id: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(
                GradoPuesto.id == id,
                GradoPuesto.activo.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_with_career_path(self, id: int) -> GradoPuesto | None:
        result = await self.db.execute(
            select(GradoPuesto)
            .options(*self._carga_completa())
            .where(GradoPuesto.id == id)
        )
        return result.scalar_one_or_none()

