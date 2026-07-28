# app/services/categoria_tarea_service.py
"""Logica de negocio para el catalogo de categorias de tarea."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.clasificacion_puesto import CategoriaTarea
from app.models.empleados import Empleado
from app.repositories.categoria_tarea_repository import CategoriaTareaRepository
from app.schemas.categorias_tarea import (
    CategoriaTareaCreate,
    CategoriaTareaListResponse,
    CategoriaTareaResponse,
    CategoriaTareaUpdate,
)


class CategoriaTareaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CategoriaTareaRepository(db)

    @staticmethod
    def _require_modulo(current_user: Empleado, accion: str) -> None:
        if not user_has_module(current_user, "tareas-catalogo"):
            raise ForbiddenError(detail=f"Solo RH puede {accion}")

    @staticmethod
    def _to_response(item: CategoriaTarea) -> CategoriaTareaResponse:
        return CategoriaTareaResponse(
            id=item.id,
            nombre=item.nombre,
            activo=item.activo,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> CategoriaTareaListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return CategoriaTareaListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> CategoriaTareaResponse:
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CategoriaTarea", id=id)
        return self._to_response(item)

    async def crear(
        self, data: CategoriaTareaCreate, current_user: Empleado
    ) -> CategoriaTareaResponse:
        self._require_modulo(current_user, "crear categorias de tarea")
        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe la categoria '{data.nombre}' en el catalogo"
            )
        item = await self.repo.create({"nombre": data.nombre, "activo": True})
        return self._to_response(item)

    async def actualizar(
        self, id: int, data: CategoriaTareaUpdate, current_user: Empleado
    ) -> CategoriaTareaResponse:
        self._require_modulo(current_user, "actualizar categorias de tarea")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CategoriaTarea", id=id)

        if data.nombre != item.nombre and await self.repo.exists_by_nombre(
            data.nombre, exclude_id=id
        ):
            raise ConflictError(
                detail=f"Ya existe la categoria '{data.nombre}' en el catalogo"
            )

        await self.repo.update(id, {"nombre": data.nombre})
        return self._to_response(await self.repo.get(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        self._require_modulo(current_user, "eliminar categorias de tarea")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CategoriaTarea", id=id)

        en_uso = await self.repo.count_tareas_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar la categoria '{item.nombre}' porque "
                    f"{en_uso} tarea(s) la utilizan"
                )
            )
        await self.repo.update(id, {"activo": False})

    async def validar_activa(self, categoria_id: int) -> CategoriaTarea:
        item = await self.repo.get_activo(categoria_id)
        if not item:
            raise NotFoundError(entidad="CategoriaTarea", id=categoria_id)
        return item
