from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.level_up import Curso
from app.repositories.level_up_cursos import CursoRepository
from app.schemas.level_up import (
    CursoCreate,
    CursoListResponse,
    CursoResponse,
    CursoUpdate,
)


class CursoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CursoRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(curso: Curso) -> CursoResponse:
        return CursoResponse(
            id=curso.id,
            nombre=curso.nombre,
            proveedor=curso.proveedor,
            duracion_horas=curso.duracion_horas,
            cupo_max=curso.cupo_max,
            instructor=curso.instructor,
            categoria=curso.categoria.value if curso.categoria and hasattr(curso.categoria, "value") else curso.categoria,
            modalidad=curso.modalidad,
            sesiones_anio=curso.sesiones_anio,
            tipo=curso.tipo.value if curso.tipo and hasattr(curso.tipo, "value") else curso.tipo,
            clasificacion=curso.clasificacion.value if curso.clasificacion and hasattr(curso.clasificacion, "value") else curso.clasificacion,
            obligatorio=curso.obligatorio,
            descripcion=curso.descripcion,
            activo=curso.activo,
            created_at=curso.created_at,
            updated_at=curso.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        tipo: str | None = None,
        clasificacion: str | None = None,
        obligatorio: bool | None = None,
        categoria: str | None = None,
        busqueda: str | None = None,
    ) -> CursoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            tipo=tipo,
            clasificacion=clasificacion,
            obligatorio=obligatorio,
            categoria=categoria,
            busqueda=busqueda,
        )
        return CursoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> CursoResponse:
        curso = await self.repo.get(id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=id)
        return self._to_response(curso)

    async def crear(
        self, data: CursoCreate, current_user: Empleado
    ) -> CursoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear cursos")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un curso con nombre '{data.nombre}'"
            )

        curso = await self.repo.create({
            "nombre": data.nombre,
            "proveedor": data.proveedor,
            "duracion_horas": data.duracion_horas,
            "cupo_max": data.cupo_max,
            "instructor": data.instructor,
            "categoria": data.categoria,
            "modalidad": data.modalidad,
            "sesiones_anio": data.sesiones_anio,
            "tipo": data.tipo,
            "clasificacion": data.clasificacion,
            "obligatorio": data.obligatorio,
            "descripcion": data.descripcion,
            "activo": True,
        })
        return self._to_response(curso)

    async def actualizar(
        self, id: int, data: CursoUpdate, current_user: Empleado
    ) -> CursoResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar cursos")

        curso = await self.repo.get(id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=id)

        if data.nombre is not None and data.nombre != curso.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un curso con nombre '{data.nombre}'"
                )

        update_data: dict = {}
        for field in data.model_fields_set:
            update_data[field] = getattr(data, field)

        if update_data:
            await self.repo.update(id, update_data)

        curso = await self.repo.get(id)
        return self._to_response(curso)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede eliminar cursos")

        curso = await self.repo.get(id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=id)

        await self.repo.update(id, {"activo": False})
