# app/services/tarea_catalogo_service.py
"""Logica de negocio para el catalogo centralizado de tareas."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import TareaCatalogo
from app.repositories.tarea_catalogo_repository import TareaCatalogoRepository
from app.schemas.tareas_catalogo import (
    TareaCatalogoCreate,
    TareaCatalogoListResponse,
    TareaCatalogoResponse,
    TareaCatalogoUpdate,
)


class TareaCatalogoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TareaCatalogoRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(tarea: TareaCatalogo) -> TareaCatalogoResponse:
        return TareaCatalogoResponse(
            id=tarea.id,
            nombre=tarea.nombre,
            categoria=tarea.categoria,
            es_complemento=tarea.es_complemento,
            activo=tarea.activo,
            created_at=tarea.created_at,
            updated_at=tarea.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        categoria: str | None = None,
        busqueda: str | None = None,
    ) -> TareaCatalogoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            categoria=categoria,
            busqueda=busqueda,
        )
        return TareaCatalogoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> TareaCatalogoResponse:
        tarea = await self.repo.get(id)
        if not tarea or not tarea.activo:
            raise NotFoundError(entidad="TareaCatalogo", id=id)
        return self._to_response(tarea)

    async def crear(
        self, data: TareaCatalogoCreate, current_user: Empleado
    ) -> TareaCatalogoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear tareas en el catalogo")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe una tarea '{data.nombre}' en el catalogo")

        tarea = await self.repo.create({
            "nombre": data.nombre,
            "categoria": data.categoria,
            "es_complemento": data.es_complemento,
            "activo": True,
        })
        return self._to_response(tarea)

    async def actualizar(
        self, id: int, data: TareaCatalogoUpdate, current_user: Empleado
    ) -> TareaCatalogoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar tareas del catalogo")

        tarea = await self.repo.get(id)
        if not tarea or not tarea.activo:
            raise NotFoundError(entidad="TareaCatalogo", id=id)

        if data.nombre and data.nombre != tarea.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe una tarea '{data.nombre}' en el catalogo")

        update_data: dict = {}
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.categoria is not None:
            update_data["categoria"] = data.categoria
        if data.es_complemento is not None:
            update_data["es_complemento"] = data.es_complemento

        if update_data:
            await self.repo.update(id, update_data)

        tarea = await self.repo.get(id)
        return self._to_response(tarea)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede eliminar tareas del catalogo")

        tarea = await self.repo.get(id)
        if not tarea or not tarea.activo:
            raise NotFoundError(entidad="TareaCatalogo", id=id)

        await self.repo.update(id, {"activo": False})
