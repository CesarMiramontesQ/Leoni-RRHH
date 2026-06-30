from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.level_up import Curso, CursoSesion
from app.repositories.level_up_curso_sesiones import CursoSesionRepository
from app.repositories.level_up_cursos import CursoRepository
from app.schemas.level_up import (
    CursoSesionCreate,
    CursoSesionListResponse,
    CursoSesionResponse,
    CursoSesionUpdate,
)


class CursoSesionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CursoSesionRepository(db)
        self.curso_repo = CursoRepository(db)

    async def _validate_curso(self, curso_id: int) -> Curso:
        curso = await self.curso_repo.get(curso_id)
        if not curso or not curso.activo:
            raise NotFoundError(entidad="Curso", id=curso_id)
        return curso

    async def _get_sesion(self, curso_id: int, sesion_id: int) -> CursoSesion:
        sesion = await self.repo.get(sesion_id)
        if not sesion or sesion.curso_id != curso_id:
            raise NotFoundError(entidad="Sesión", id=sesion_id)
        return sesion

    @staticmethod
    def _resolve_instructor_nombre(sesion: CursoSesion) -> str | None:
        if sesion.instructor_tipo == "interno" and sesion.instructor_empleado_rel:
            return sesion.instructor_empleado_rel.nombre
        if sesion.instructor_tipo == "externo" and sesion.instructor_externo_rel:
            return sesion.instructor_externo_rel.nombre
        return None

    async def _to_response(self, sesion: CursoSesion) -> CursoSesionResponse:
        inscritos = await self.repo.count_inscritos(sesion.id)
        return CursoSesionResponse(
            id=sesion.id,
            curso_id=sesion.curso_id,
            fecha_inicio=sesion.fecha_inicio,
            fecha_fin=sesion.fecha_fin,
            hora_inicio=sesion.hora_inicio,
            hora_fin=sesion.hora_fin,
            tipo=sesion.tipo,
            ubicacion=sesion.ubicacion,
            instructor_tipo=sesion.instructor_tipo,
            instructor_empleado_id=sesion.instructor_empleado_id,
            instructor_externo_id=sesion.instructor_externo_id,
            instructor_nombre=self._resolve_instructor_nombre(sesion),
            cupo_max=sesion.cupo_max,
            notas=sesion.notas,
            estado=sesion.estado.value if hasattr(sesion.estado, "value") else sesion.estado,
            costo=sesion.costo,
            inscritos_count=inscritos,
            created_at=sesion.created_at,
            updated_at=sesion.updated_at,
        )

    async def listar(
        self,
        curso_id: int,
        page: int = 1,
        page_size: int = 50,
        estado: str | None = None,
    ) -> CursoSesionListResponse:
        await self._validate_curso(curso_id)
        offset = (page - 1) * page_size
        items, total = await self.repo.list_by_curso(
            curso_id=curso_id, offset=offset, limit=page_size, estado=estado
        )
        responses = [await self._to_response(s) for s in items]
        return CursoSesionListResponse(items=responses, total=total)

    async def obtener(self, curso_id: int, sesion_id: int) -> CursoSesionResponse:
        await self._validate_curso(curso_id)
        sesion = await self._get_sesion(curso_id, sesion_id)
        return await self._to_response(sesion)

    async def crear(
        self, curso_id: int, data: CursoSesionCreate, current_user: Empleado
    ) -> CursoSesionResponse:
        await self._validate_curso(curso_id)
        sesion = await self.repo.create({
            "curso_id": curso_id,
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "hora_inicio": data.hora_inicio,
            "hora_fin": data.hora_fin,
            "tipo": data.tipo,
            "ubicacion": data.ubicacion,
            "instructor_tipo": data.instructor_tipo,
            "instructor_empleado_id": data.instructor_empleado_id,
            "instructor_externo_id": data.instructor_externo_id,
            "costo": data.costo,
            "notas": data.notas,
        })
        return await self._to_response(sesion)

    async def actualizar(
        self, curso_id: int, sesion_id: int, data: CursoSesionUpdate, current_user: Empleado
    ) -> CursoSesionResponse:
        await self._validate_curso(curso_id)
        await self._get_sesion(curso_id, sesion_id)

        update_data: dict = {}
        for field in data.model_fields_set:
            update_data[field] = getattr(data, field)

        if update_data:
            await self.repo.update(sesion_id, update_data)

        sesion = await self.repo.get(sesion_id)
        return await self._to_response(sesion)

    async def eliminar(
        self, curso_id: int, sesion_id: int, current_user: Empleado
    ) -> None:
        await self._validate_curso(curso_id)
        sesion = await self._get_sesion(curso_id, sesion_id)
        inscritos = await self.repo.count_inscritos(sesion_id)
        if inscritos > 0:
            await self.repo.update(sesion_id, {"estado": "cancelada"})
        else:
            await self.repo.hard_delete(sesion_id)
