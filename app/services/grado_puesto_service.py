# app/services/grado_puesto_service.py
"""Logica de negocio para el catalogo de grados de puesto."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import GradoPuesto
from app.repositories.grado_puesto_repository import GradoPuestoRepository
from app.schemas.grados_puesto import (
    GradoPuestoCreate,
    GradoPuestoListResponse,
    GradoPuestoResponse,
    GradoPuestoUpdate,
)


class GradoPuestoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GradoPuestoRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(grado: GradoPuesto) -> GradoPuestoResponse:
        return GradoPuestoResponse(
            id=grado.id,
            nombre=grado.nombre,
            orden=grado.orden,
            activo=grado.activo,
            created_at=grado.created_at,
            updated_at=grado.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> GradoPuestoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return GradoPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> GradoPuestoResponse:
        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)
        return self._to_response(grado)

    async def crear(
        self, data: GradoPuestoCreate, current_user: Empleado
    ) -> GradoPuestoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear grados de puesto")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un grado '{data.nombre}' en el catalogo"
            )
        if await self.repo.exists_by_orden(data.orden):
            raise ConflictError(
                detail=f"Ya existe un grado con orden {data.orden} en el catalogo"
            )

        grado = await self.repo.create({
            "nombre": data.nombre,
            "orden": data.orden,
            "activo": True,
        })
        return self._to_response(grado)

    async def actualizar(
        self, id: int, data: GradoPuestoUpdate, current_user: Empleado
    ) -> GradoPuestoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar grados de puesto")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        if data.nombre != grado.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un grado '{data.nombre}' en el catalogo"
                )
        if data.orden != grado.orden:
            if await self.repo.exists_by_orden(data.orden, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un grado con orden {data.orden} en el catalogo"
                )

        await self.repo.update(id, {"nombre": data.nombre, "orden": data.orden})
        grado = await self.repo.get(id)
        return self._to_response(grado)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede eliminar grados de puesto")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        requisitos = await self.repo.count_requisitos_usando(id)
        asignaciones = await self.repo.count_asignaciones_usando(id)
        if requisitos > 0 or asignaciones > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el grado '{grado.nombre}' "
                    f"porque esta en uso ({requisitos} requisito(s), "
                    f"{asignaciones} asignacion(es) activa(s))"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_grado_activo(self, grado_id: int) -> GradoPuesto:
        grado = await self.repo.get_activo(grado_id)
        if not grado:
            raise NotFoundError(entidad="GradoPuesto", id=grado_id)
        return grado
