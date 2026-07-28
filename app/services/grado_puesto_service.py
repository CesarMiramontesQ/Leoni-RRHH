# app/services/grado_puesto_service.py
"""
Logica de negocio del catalogo de Career Levels (Willis Towers Watson).

Cada nivel pertenece a un career path y su codigo/nombre/orden son unicos DENTRO
de ese path, no en toda la tabla: P1 y M1 conviven.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import GradoPuesto
from app.repositories.clasificacion_puesto_repository import CareerPathRepository
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
        self.career_path_repo = CareerPathRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(grado: GradoPuesto) -> GradoPuestoResponse:
        career_path = grado.career_path
        equivalencia = grado.equivalencia
        grade = equivalencia.global_grade if equivalencia else None
        return GradoPuestoResponse(
            id=grado.id,
            career_path_id=grado.career_path_id,
            career_path_codigo=career_path.codigo if career_path else None,
            career_path_nombre=career_path.nombre if career_path else None,
            codigo=grado.codigo,
            nombre=grado.nombre,
            global_grade_id=grade.id if grade else None,
            global_grade_codigo=grade.codigo if grade else None,
            global_grade_orden=grade.orden if grade else None,
            activo=grado.activo,
            created_at=grado.created_at,
            updated_at=grado.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> GradoPuestoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            career_path_id=career_path_id,
            solo_activos=solo_activos,
        )
        return GradoPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> GradoPuestoResponse:
        grado = await self.repo.get_with_career_path(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)
        return self._to_response(grado)

    async def _validar_career_path(self, career_path_id: int) -> None:
        if not await self.career_path_repo.get_activo(career_path_id):
            raise NotFoundError(entidad="CareerPath", id=career_path_id)

    async def _validar_unicidad(
        self,
        data: GradoPuestoCreate | GradoPuestoUpdate,
        exclude_id: int | None = None,
    ) -> None:
        if await self.repo.exists_by_codigo(
            data.career_path_id, data.codigo, exclude_id=exclude_id
        ):
            raise ConflictError(
                detail=f"Ya existe el career level '{data.codigo}' en ese career path"
            )
        if await self.repo.exists_by_nombre(
            data.career_path_id, data.nombre, exclude_id=exclude_id
        ):
            raise ConflictError(
                detail=f"Ya existe un career level '{data.nombre}' en ese career path"
            )

    async def crear(
        self, data: GradoPuestoCreate, current_user: Empleado
    ) -> GradoPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear career levels")

        await self._validar_career_path(data.career_path_id)
        await self._validar_unicidad(data)

        grado = await self.repo.create({
            "career_path_id": data.career_path_id,
            "codigo": data.codigo,
            "nombre": data.nombre,
            "activo": True,
        })
        return self._to_response(await self.repo.get_with_career_path(grado.id))

    async def actualizar(
        self, id: int, data: GradoPuestoUpdate, current_user: Empleado
    ) -> GradoPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar career levels")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        await self._validar_career_path(data.career_path_id)
        await self._validar_unicidad(data, exclude_id=id)

        # Mover un nivel de career path rompe los perfiles que ya lo usan: sus
        # grados dejarian de compartir path y el rango quedaria invalido.
        if data.career_path_id != grado.career_path_id:
            requisitos = await self.repo.count_requisitos_usando(id)
            asignaciones = await self.repo.count_asignaciones_usando(id)
            if requisitos > 0 or asignaciones > 0:
                raise ConflictError(
                    detail=(
                        f"No se puede mover '{grado.nombre}' a otro career path "
                        f"porque esta en uso ({requisitos} requisito(s), "
                        f"{asignaciones} asignacion(es) activa(s))"
                    )
                )

        await self.repo.update(
            id,
            {
                "career_path_id": data.career_path_id,
                "codigo": data.codigo,
                "nombre": data.nombre,
            },
        )
        return self._to_response(await self.repo.get_with_career_path(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar career levels")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        requisitos = await self.repo.count_requisitos_usando(id)
        asignaciones = await self.repo.count_asignaciones_usando(id)
        if requisitos > 0 or asignaciones > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el career level '{grado.nombre}' "
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
