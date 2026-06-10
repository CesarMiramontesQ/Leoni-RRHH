# app/services/metodo_calificacion_competencia_service.py
"""Logica de negocio para metodos de calificacion de competencias."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import MetodoCalificacionCompetencia
from app.repositories.metodo_calificacion_competencia_repository import (
    MetodoCalificacionCompetenciaRepository,
)
from app.schemas.metodos_calificacion_competencia import (
    MetodoCalificacionCompetenciaListResponse,
    MetodoCalificacionCompetenciaResponse,
    MetodoCalificacionCompetenciaUpdate,
)


class MetodoCalificacionCompetenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MetodoCalificacionCompetenciaRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(metodo: MetodoCalificacionCompetencia) -> MetodoCalificacionCompetenciaResponse:
        return MetodoCalificacionCompetenciaResponse(
            id=metodo.id,
            valor=metodo.valor,
            nombre=metodo.nombre,
            orden=metodo.orden,
            activo=metodo.activo,
            created_at=metodo.created_at,
            updated_at=metodo.updated_at,
        )

    async def listar(self) -> MetodoCalificacionCompetenciaListResponse:
        items = await self.repo.list_activos()
        return MetodoCalificacionCompetenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=len(items),
        )

    async def obtener(self, id: int) -> MetodoCalificacionCompetenciaResponse:
        metodo = await self.repo.get_activo(id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacionCompetencia", id=id)
        return self._to_response(metodo)

    async def actualizar(
        self, id: int, data: MetodoCalificacionCompetenciaUpdate, current_user: Empleado
    ) -> MetodoCalificacionCompetenciaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(
                detail="Solo RH puede actualizar metodos de calificacion de competencias"
            )

        metodo = await self.repo.get_activo(id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacionCompetencia", id=id)

        if data.nombre != metodo.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un metodo de calificacion '{data.nombre}'"
                )
        if data.orden != metodo.orden:
            if await self.repo.exists_by_orden(data.orden, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un metodo de calificacion con orden {data.orden}"
                )

        await self.repo.update(id, {"nombre": data.nombre, "orden": data.orden})
        metodo = await self.repo.get(id)
        return self._to_response(metodo)

    async def listar_resumen(self) -> list[MetodoCalificacionCompetenciaResponse]:
        items = await self.repo.list_activos()
        return [self._to_response(i) for i in items]
