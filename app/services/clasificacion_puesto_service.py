# app/services/clasificacion_puesto_service.py
"""
Logica de negocio de los catalogos de clasificacion de puesto (WTW).

Los tres catalogos comparten el mismo contrato que el resto de catalogos del
modulo: guard por modulo `puestos`, soft delete y bloqueo si la fila esta en uso.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.clasificacion_puesto import (
    CareerPath,
    DisciplinaPuesto,
    FuncionPuesto,
)
from app.models.empleados import Empleado
from app.repositories.clasificacion_puesto_repository import (
    CareerPathRepository,
    DisciplinaPuestoRepository,
    FuncionPuestoRepository,
)
from app.schemas.clasificacion_puesto import (
    CareerPathCreate,
    CareerPathListResponse,
    CareerPathResponse,
    CareerPathUpdate,
    DisciplinaPuestoCreate,
    DisciplinaPuestoListResponse,
    DisciplinaPuestoResponse,
    DisciplinaPuestoUpdate,
    FuncionPuestoCreate,
    FuncionPuestoListResponse,
    FuncionPuestoResponse,
    FuncionPuestoUpdate,
)

MODULO = "puestos"


def _require_modulo(current_user: Empleado, accion: str) -> None:
    if not user_has_module(current_user, MODULO):
        raise ForbiddenError(detail=f"Solo RH puede {accion}")


class CareerPathService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CareerPathRepository(db)

    @staticmethod
    def _to_response(item: CareerPath) -> CareerPathResponse:
        return CareerPathResponse(
            id=item.id,
            codigo=item.codigo,
            nombre=item.nombre,
            orden=item.orden,
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
    ) -> CareerPathListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return CareerPathListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> CareerPathResponse:
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerPath", id=id)
        return self._to_response(item)

    async def _validar_unicidad(
        self, data: CareerPathCreate | CareerPathUpdate, exclude_id: int | None = None
    ) -> None:
        if await self.repo.exists_by_codigo(data.codigo, exclude_id=exclude_id):
            raise ConflictError(
                detail=f"Ya existe un career path con codigo '{data.codigo}'"
            )
        if await self.repo.exists_by_nombre(data.nombre, exclude_id=exclude_id):
            raise ConflictError(detail=f"Ya existe un career path '{data.nombre}'")
        if await self.repo.exists_by_orden(data.orden, exclude_id=exclude_id):
            raise ConflictError(
                detail=f"Ya existe un career path con orden {data.orden}"
            )

    async def crear(
        self, data: CareerPathCreate, current_user: Empleado
    ) -> CareerPathResponse:
        _require_modulo(current_user, "crear career paths")
        await self._validar_unicidad(data)
        item = await self.repo.create(
            {
                "codigo": data.codigo,
                "nombre": data.nombre,
                "orden": data.orden,
                "activo": True,
            }
        )
        return self._to_response(item)

    async def actualizar(
        self, id: int, data: CareerPathUpdate, current_user: Empleado
    ) -> CareerPathResponse:
        _require_modulo(current_user, "actualizar career paths")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerPath", id=id)

        await self._validar_unicidad(data, exclude_id=id)
        await self.repo.update(
            id, {"codigo": data.codigo, "nombre": data.nombre, "orden": data.orden}
        )
        item = await self.repo.get(id)
        return self._to_response(item)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        _require_modulo(current_user, "eliminar career paths")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerPath", id=id)

        grados = await self.repo.count_grados_usando(id)
        perfiles = await self.repo.count_perfiles_usando(id)
        if grados or perfiles:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el career path '{item.nombre}' porque esta "
                    f"en uso ({grados} global level(es), {perfiles} perfil(es))"
                )
            )
        await self.repo.update(id, {"activo": False})

    async def validar_activo(self, career_path_id: int) -> CareerPath:
        item = await self.repo.get_activo(career_path_id)
        if not item:
            raise NotFoundError(entidad="CareerPath", id=career_path_id)
        return item


class FuncionPuestoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FuncionPuestoRepository(db)

    @staticmethod
    def _to_response(item: FuncionPuesto) -> FuncionPuestoResponse:
        return FuncionPuestoResponse(
            id=item.id,
            codigo=item.codigo,
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
    ) -> FuncionPuestoListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return FuncionPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> FuncionPuestoResponse:
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="FuncionPuesto", id=id)
        return self._to_response(item)

    async def _validar_unicidad(
        self,
        data: FuncionPuestoCreate | FuncionPuestoUpdate,
        exclude_id: int | None = None,
    ) -> None:
        if await self.repo.exists_by_codigo(data.codigo, exclude_id=exclude_id):
            raise ConflictError(
                detail=f"Ya existe una funcion con codigo '{data.codigo}'"
            )
        if await self.repo.exists_by_nombre(data.nombre, exclude_id=exclude_id):
            raise ConflictError(detail=f"Ya existe una funcion '{data.nombre}'")

    async def crear(
        self, data: FuncionPuestoCreate, current_user: Empleado
    ) -> FuncionPuestoResponse:
        _require_modulo(current_user, "crear funciones")
        await self._validar_unicidad(data)
        item = await self.repo.create(
            {"codigo": data.codigo, "nombre": data.nombre, "activo": True}
        )
        return self._to_response(item)

    async def actualizar(
        self, id: int, data: FuncionPuestoUpdate, current_user: Empleado
    ) -> FuncionPuestoResponse:
        _require_modulo(current_user, "actualizar funciones")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="FuncionPuesto", id=id)

        await self._validar_unicidad(data, exclude_id=id)
        await self.repo.update(id, {"codigo": data.codigo, "nombre": data.nombre})
        item = await self.repo.get(id)
        return self._to_response(item)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        _require_modulo(current_user, "eliminar funciones")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="FuncionPuesto", id=id)

        disciplinas = await self.repo.count_disciplinas_usando(id)
        perfiles = await self.repo.count_perfiles_usando(id)
        if disciplinas or perfiles:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar la funcion '{item.nombre}' porque esta en "
                    f"uso ({disciplinas} disciplina(s), {perfiles} perfil(es))"
                )
            )
        await self.repo.update(id, {"activo": False})

    async def validar_activa(self, funcion_id: int) -> FuncionPuesto:
        item = await self.repo.get_activo(funcion_id)
        if not item:
            raise NotFoundError(entidad="FuncionPuesto", id=funcion_id)
        return item


class DisciplinaPuestoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DisciplinaPuestoRepository(db)
        self.funcion_repo = FuncionPuestoRepository(db)

    @staticmethod
    def _to_response(item: DisciplinaPuesto) -> DisciplinaPuestoResponse:
        return DisciplinaPuestoResponse(
            id=item.id,
            funcion_id=item.funcion_id,
            funcion_nombre=item.funcion.nombre if item.funcion else None,
            nombre=item.nombre,
            codigo=item.codigo,
            activo=item.activo,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        funcion_id: int | None = None,
        busqueda: str | None = None,
        solo_activos: bool = True,
    ) -> DisciplinaPuestoListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            funcion_id=funcion_id,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return DisciplinaPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> DisciplinaPuestoResponse:
        item = await self.repo.get_with_funcion(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="DisciplinaPuesto", id=id)
        return self._to_response(item)

    async def _validar_funcion(self, funcion_id: int) -> None:
        if not await self.funcion_repo.get_activo(funcion_id):
            raise NotFoundError(entidad="FuncionPuesto", id=funcion_id)

    async def crear(
        self, data: DisciplinaPuestoCreate, current_user: Empleado
    ) -> DisciplinaPuestoResponse:
        _require_modulo(current_user, "crear disciplinas")
        await self._validar_funcion(data.funcion_id)
        if await self.repo.exists_by_nombre(data.funcion_id, data.nombre):
            raise ConflictError(
                detail=f"Ya existe la disciplina '{data.nombre}' en esa funcion"
            )

        item = await self.repo.create(
            {
                "funcion_id": data.funcion_id,
                "nombre": data.nombre,
                "codigo": data.codigo,
                "activo": True,
            }
        )
        return self._to_response(await self.repo.get_with_funcion(item.id))

    async def actualizar(
        self, id: int, data: DisciplinaPuestoUpdate, current_user: Empleado
    ) -> DisciplinaPuestoResponse:
        _require_modulo(current_user, "actualizar disciplinas")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="DisciplinaPuesto", id=id)

        await self._validar_funcion(data.funcion_id)
        if await self.repo.exists_by_nombre(data.funcion_id, data.nombre, exclude_id=id):
            raise ConflictError(
                detail=f"Ya existe la disciplina '{data.nombre}' en esa funcion"
            )

        await self.repo.update(
            id,
            {
                "funcion_id": data.funcion_id,
                "nombre": data.nombre,
                "codigo": data.codigo,
            },
        )
        return self._to_response(await self.repo.get_with_funcion(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        _require_modulo(current_user, "eliminar disciplinas")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="DisciplinaPuesto", id=id)

        perfiles = await self.repo.count_perfiles_usando(id)
        if perfiles:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar la disciplina '{item.nombre}' porque "
                    f"{perfiles} perfil(es) la utilizan"
                )
            )
        await self.repo.update(id, {"activo": False})

    async def validar_activa(self, disciplina_id: int) -> DisciplinaPuesto:
        item = await self.repo.get_activo(disciplina_id)
        if not item:
            raise NotFoundError(entidad="DisciplinaPuesto", id=disciplina_id)
        return item
