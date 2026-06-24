# app/services/tarea_catalogo_service.py
"""Logica de negocio para el catalogo centralizado de tareas."""

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import PerfilTarea, TareaCatalogo
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
        if not user_has_module(current_user, "tareas-catalogo"):
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
        if not user_has_module(current_user, "tareas-catalogo"):
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
            await self._propagar_cambios_a_perfiles(id, update_data)

        tarea = await self.repo.get(id)
        return self._to_response(tarea)

    async def _propagar_cambios_a_perfiles(
        self, catalogo_id: int, update_data: dict
    ) -> None:
        """Sincroniza nombre/tipo en perfiles que referencian esta tarea del catálogo."""
        perfil_updates: dict = {}
        if "nombre" in update_data:
            perfil_updates["descripcion"] = update_data["nombre"]
        if "es_complemento" in update_data:
            perfil_updates["es_complemento"] = update_data["es_complemento"]
        if not perfil_updates:
            return

        await self.db.execute(
            update(PerfilTarea)
            .where(PerfilTarea.tarea_catalogo_id == catalogo_id)
            .values(**perfil_updates)
        )
        await self.db.flush()

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "tareas-catalogo"):
            raise ForbiddenError(detail="Solo RH puede eliminar tareas del catalogo")

        tarea = await self.repo.get(id)
        if not tarea or not tarea.activo:
            raise NotFoundError(entidad="TareaCatalogo", id=id)

        await self.repo.update(id, {"activo": False})
