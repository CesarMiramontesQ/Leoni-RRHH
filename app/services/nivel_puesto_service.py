# app/services/nivel_puesto_service.py
"""Logica de negocio para el catalogo de niveles de puesto."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import NivelPuesto
from app.repositories.nivel_puesto_repository import NivelPuestoRepository
from app.schemas.niveles_puesto import (
    NivelPuestoCreate,
    NivelPuestoListResponse,
    NivelPuestoResponse,
    NivelPuestoUpdate,
)


class NivelPuestoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NivelPuestoRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(nivel: NivelPuesto) -> NivelPuestoResponse:
        return NivelPuestoResponse(
            id=nivel.id,
            nombre=nivel.nombre,
            activo=nivel.activo,
            created_at=nivel.created_at,
            updated_at=nivel.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> NivelPuestoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return NivelPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> NivelPuestoResponse:
        nivel = await self.repo.get(id)
        if not nivel or not nivel.activo:
            raise NotFoundError(entidad="NivelPuesto", id=id)
        return self._to_response(nivel)

    async def crear(
        self, data: NivelPuestoCreate, current_user: Empleado
    ) -> NivelPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear niveles de puesto")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un nivel '{data.nombre}' en el catalogo"
            )

        nivel = await self.repo.create({"nombre": data.nombre, "activo": True})
        return self._to_response(nivel)

    async def actualizar(
        self, id: int, data: NivelPuestoUpdate, current_user: Empleado
    ) -> NivelPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar niveles de puesto")

        nivel = await self.repo.get(id)
        if not nivel or not nivel.activo:
            raise NotFoundError(entidad="NivelPuesto", id=id)

        if data.nombre != nivel.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un nivel '{data.nombre}' en el catalogo"
                )

        await self.repo.update(id, {"nombre": data.nombre})
        nivel = await self.repo.get(id)
        return self._to_response(nivel)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar niveles de puesto")

        nivel = await self.repo.get(id)
        if not nivel or not nivel.activo:
            raise NotFoundError(entidad="NivelPuesto", id=id)

        en_uso = await self.repo.count_puestos_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el nivel '{nivel.nombre}' "
                    f"porque {en_uso} perfil(es) de puesto lo utilizan"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_nivel_activo(self, nivel_id: int) -> NivelPuesto:
        nivel = await self.repo.get_activo(nivel_id)
        if not nivel:
            raise NotFoundError(entidad="NivelPuesto", id=nivel_id)
        return nivel
