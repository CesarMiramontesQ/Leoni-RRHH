from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.level_up import Curso
from app.repositories.level_up_cursos import CursoRepository
from app.repositories.level_up_encuestas import EncuestaRepository
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
        self.encuestas = EncuestaRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _resolve_instructor_nombre(curso: Curso) -> str | None:
        if curso.instructor_tipo == "interno" and curso.instructor_empleado_rel:
            emp = curso.instructor_empleado_rel
            return f"{emp.nombre} {emp.apellido_paterno or ''}".strip()
        if curso.instructor_tipo == "externo" and curso.instructor_externo_rel:
            return curso.instructor_externo_rel.nombre
        return None

    @staticmethod
    def _to_response(
        curso: Curso,
        calificacion_promedio: float | None = None,
        total_evaluaciones: int = 0,
    ) -> CursoResponse:
        instructor_nombre = CursoService._resolve_instructor_nombre(curso)
        return CursoResponse(
            id=curso.id,
            nombre=curso.nombre,
            duracion_horas=curso.duracion_horas,
            cupo_max=curso.cupo_max,
            categoria_id=curso.categoria_id,
            categoria_nombre=curso.categoria_rel.nombre if curso.categoria_rel else None,
            tipo_id=curso.tipo_id,
            tipo_nombre=curso.tipo_rel.nombre if curso.tipo_rel else None,
            clasificacion_id=curso.clasificacion_id,
            clasificacion_nombre=curso.clasificacion_rel.nombre if curso.clasificacion_rel else None,
            instructor_tipo=curso.instructor_tipo,
            instructor_empleado_id=curso.instructor_empleado_id,
            instructor_externo_id=curso.instructor_externo_id,
            instructor_nombre=instructor_nombre,
            modalidad=curso.modalidad,
            sesiones_anio=curso.sesiones_anio,
            obligatorio=curso.obligatorio,
            descripcion=curso.descripcion,
            requisitos=curso.requisitos,
            centro_costos=curso.centro_costos,
            activo=curso.activo,
            calificacion_promedio=(
                round(calificacion_promedio, 2)
                if calificacion_promedio is not None
                else None
            ),
            total_evaluaciones=total_evaluaciones,
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
        ratings = await self.encuestas.promedios_por_curso([i.id for i in items])
        return CursoListResponse(
            items=[
                self._to_response(i, *ratings.get(i.id, (None, 0))) for i in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> CursoResponse:
        curso = await self.repo.get(id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=id)
        promedio, total = (await self.encuestas.promedios_por_curso([id])).get(
            id, (None, 0)
        )
        return self._to_response(curso, promedio, total)

    async def crear(
        self, data: CursoCreate, current_user: Empleado
    ) -> CursoResponse:
        if not user_has_module(current_user, "level-up"):
            raise ForbiddenError(detail="Solo RH puede crear cursos")

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un curso con nombre '{data.nombre}'"
            )

        curso = await self.repo.create({
            "nombre": data.nombre,
            "duracion_horas": data.duracion_horas,
            "cupo_max": data.cupo_max,
            "categoria_id": data.categoria_id,
            "tipo_id": data.tipo_id,
            "clasificacion_id": data.clasificacion_id,
            "instructor_tipo": data.instructor_tipo,
            "instructor_empleado_id": data.instructor_empleado_id,
            "instructor_externo_id": data.instructor_externo_id,
            "modalidad": data.modalidad,
            "sesiones_anio": data.sesiones_anio,
            "obligatorio": data.obligatorio,
            "descripcion": data.descripcion,
            "requisitos": data.requisitos,
            "centro_costos": data.centro_costos,
            "activo": True,
        })
        return self._to_response(curso)

    async def actualizar(
        self, id: int, data: CursoUpdate, current_user: Empleado
    ) -> CursoResponse:
        if not user_has_module(current_user, "level-up"):
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
        if not user_has_module(current_user, "level-up"):
            raise ForbiddenError(detail="Solo RH puede eliminar cursos")

        curso = await self.repo.get(id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=id)

        await self.repo.update(id, {"activo": False})
