# app/services/grupo_competencia_service.py
"""Logica de negocio para el catalogo de grupos de competencia."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import GrupoCompetencia
from app.repositories.grupo_competencia_repository import GrupoCompetenciaRepository
from app.schemas.grupos_competencia import (
    GrupoCompetenciaCreate,
    GrupoCompetenciaListResponse,
    GrupoCompetenciaResponse,
    GrupoCompetenciaUpdate,
)


class GrupoCompetenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GrupoCompetenciaRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(grupo: GrupoCompetencia) -> GrupoCompetenciaResponse:
        return GrupoCompetenciaResponse(
            id=grupo.id,
            nombre=grupo.nombre,
            activo=grupo.activo,
            created_at=grupo.created_at,
            updated_at=grupo.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> GrupoCompetenciaListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return GrupoCompetenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> GrupoCompetenciaResponse:
        grupo = await self.repo.get(id)
        if not grupo or not grupo.activo:
            raise NotFoundError(entidad="GrupoCompetencia", id=id)
        return self._to_response(grupo)

    async def crear(
        self, data: GrupoCompetenciaCreate, current_user: Empleado
    ) -> GrupoCompetenciaResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear grupos de competencia")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un grupo '{data.nombre}' en el catalogo"
            )

        grupo = await self.repo.create(
            {
                "nombre": data.nombre,
                "activo": True,
            }
        )
        return self._to_response(grupo)

    async def actualizar(
        self, id: int, data: GrupoCompetenciaUpdate, current_user: Empleado
    ) -> GrupoCompetenciaResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar grupos de competencia")

        grupo = await self.repo.get(id)
        if not grupo or not grupo.activo:
            raise NotFoundError(entidad="GrupoCompetencia", id=id)

        if data.nombre != grupo.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un grupo '{data.nombre}' en el catalogo"
                )

        await self.repo.update(id, {"nombre": data.nombre})
        grupo = await self.repo.get(id)
        return self._to_response(grupo)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar grupos de competencia")

        grupo = await self.repo.get(id)
        if not grupo or not grupo.activo:
            raise NotFoundError(entidad="GrupoCompetencia", id=id)

        en_uso = await self.repo.count_tipos_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el grupo '{grupo.nombre}' "
                    f"porque {en_uso} tipo(s) de competencia lo utilizan"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_grupo_activo(self, grupo_id: int) -> GrupoCompetencia:
        grupo = await self.repo.get_activo(grupo_id)
        if not grupo:
            raise NotFoundError(entidad="GrupoCompetencia", id=grupo_id)
        return grupo
