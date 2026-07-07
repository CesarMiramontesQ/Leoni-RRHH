# app/services/tipo_competencia_service.py
"""Logica de negocio para el catalogo de tipos de competencia."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import TipoCompetencia
from app.repositories.competencia_repository import CompetenciaRepository
from app.repositories.tipo_competencia_repository import TipoCompetenciaRepository
from app.schemas.tipos_competencia import (
    TipoCompetenciaCreate,
    TipoCompetenciaListResponse,
    TipoCompetenciaResponse,
    TipoCompetenciaUpdate,
)
from app.services.grupo_competencia_service import GrupoCompetenciaService
from app.utils.competencia_categoria import categoria_desde_grupo_nombre


class TipoCompetenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TipoCompetenciaRepository(db)
        self.competencia_repo = CompetenciaRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(tipo: TipoCompetencia) -> TipoCompetenciaResponse:
        grupo_nombre = ""
        if tipo.grupo_competencia:
            grupo_nombre = tipo.grupo_competencia.nombre
        return TipoCompetenciaResponse(
            id=tipo.id,
            nombre=tipo.nombre,
            grupo_competencia_id=tipo.grupo_competencia_id,
            grupo_nombre=grupo_nombre,
            activo=tipo.activo,
            created_at=tipo.created_at,
            updated_at=tipo.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> TipoCompetenciaListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return TipoCompetenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> TipoCompetenciaResponse:
        tipo = await self.repo.get_with_grupo(id)
        if not tipo or not tipo.activo:
            raise NotFoundError(entidad="TipoCompetencia", id=id)
        return self._to_response(tipo)

    async def crear(
        self, data: TipoCompetenciaCreate, current_user: Empleado
    ) -> TipoCompetenciaResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear tipos de competencia")

        grupo_service = GrupoCompetenciaService(self.db)
        await grupo_service.validar_grupo_activo(data.grupo_competencia_id)

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un tipo '{data.nombre}' en el catalogo"
            )

        tipo = await self.repo.create(
            {
                "nombre": data.nombre,
                "grupo_competencia_id": data.grupo_competencia_id,
                "activo": True,
            }
        )
        tipo = await self.repo.get_with_grupo(tipo.id)
        return self._to_response(tipo)

    async def actualizar(
        self, id: int, data: TipoCompetenciaUpdate, current_user: Empleado
    ) -> TipoCompetenciaResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar tipos de competencia")

        tipo = await self.repo.get(id)
        if not tipo or not tipo.activo:
            raise NotFoundError(entidad="TipoCompetencia", id=id)

        grupo_service = GrupoCompetenciaService(self.db)
        await grupo_service.validar_grupo_activo(data.grupo_competencia_id)

        if data.nombre != tipo.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un tipo '{data.nombre}' en el catalogo"
                )

        await self.repo.update(
            id,
            {
                "nombre": data.nombre,
                "grupo_competencia_id": data.grupo_competencia_id,
            },
        )
        tipo = await self.repo.get_with_grupo(id)
        if tipo and tipo.grupo_competencia:
            categoria = categoria_desde_grupo_nombre(tipo.grupo_competencia.nombre)
            await self.competencia_repo.actualizar_categoria_por_tipo(tipo.id, categoria)
        return self._to_response(tipo)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar tipos de competencia")

        tipo = await self.repo.get(id)
        if not tipo or not tipo.activo:
            raise NotFoundError(entidad="TipoCompetencia", id=id)

        en_uso = await self.repo.count_competencias_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el tipo '{tipo.nombre}' "
                    f"porque {en_uso} competencia(s) lo utilizan"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_tipo_activo(self, tipo_id: int) -> TipoCompetencia:
        tipo = await self.repo.get_activo_with_grupo(tipo_id)
        if not tipo:
            raise NotFoundError(entidad="TipoCompetencia", id=tipo_id)
        return tipo
