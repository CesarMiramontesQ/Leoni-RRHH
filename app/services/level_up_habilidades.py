from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.level_up import Habilidad
from app.repositories.level_up_habilidades import HabilidadRepository
from app.schemas.level_up import (
    HabilidadCreate,
    HabilidadListResponse,
    HabilidadResponse,
    HabilidadUpdate,
)


class HabilidadService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HabilidadRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(hab: Habilidad) -> HabilidadResponse:
        return HabilidadResponse(
            id=hab.id,
            nombre=hab.nombre,
            descripcion=hab.descripcion,
            tipo=hab.tipo,
            niveles_descripcion=hab.niveles_descripcion,
            activo=hab.activo,
            created_at=hab.created_at,
            updated_at=hab.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        tipo: str | None = None,
        busqueda: str | None = None,
    ) -> HabilidadListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            tipo=tipo,
            busqueda=busqueda,
        )
        return HabilidadListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> HabilidadResponse:
        hab = await self.repo.get(id)
        if not hab or not hab.activo:
            raise NotFoundError(entidad="Habilidad", id=id)
        return self._to_response(hab)

    async def crear(
        self, data: HabilidadCreate, current_user: Empleado
    ) -> HabilidadResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear habilidades")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe una habilidad con nombre '{data.nombre}'"
            )

        hab = await self.repo.create({
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "tipo": data.tipo,
            "niveles_descripcion": data.niveles_descripcion,
            "activo": True,
        })
        return self._to_response(hab)

    async def actualizar(
        self, id: int, data: HabilidadUpdate, current_user: Empleado
    ) -> HabilidadResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar habilidades")

        hab = await self.repo.get(id)
        if not hab or not hab.activo:
            raise NotFoundError(entidad="Habilidad", id=id)

        if data.nombre is not None and data.nombre != hab.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe una habilidad con nombre '{data.nombre}'"
                )

        update_data: dict = {}
        for field in data.model_fields_set:
            update_data[field] = getattr(data, field)

        if update_data:
            await self.repo.update(id, update_data)

        hab = await self.repo.get(id)
        return self._to_response(hab)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede eliminar habilidades")

        hab = await self.repo.get(id)
        if not hab or not hab.activo:
            raise NotFoundError(entidad="Habilidad", id=id)

        await self.repo.update(id, {"activo": False})
