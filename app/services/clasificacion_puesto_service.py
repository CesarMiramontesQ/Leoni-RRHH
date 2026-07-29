# app/services/clasificacion_puesto_service.py
"""
Logica de negocio de los catalogos de clasificacion de puesto (WTW).

Los tres catalogos comparten el mismo contrato que el resto de catalogos del
modulo: guard por modulo `puestos`, soft delete y bloqueo si la fila esta en uso.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.core.rh_module_registry import user_has_module
from app.models.clasificacion_puesto import (
    CareerPath,
    DisciplinaPuesto,
    FuncionPuesto,
    GlobalGrade,
    CareerLevelGradeMapping,
)
from app.models.empleados import Empleado
from app.repositories.clasificacion_puesto_repository import (
    CareerPathRepository,
    DisciplinaPuestoRepository,
    FuncionPuestoRepository,
    GlobalGradeRepository,
    CareerLevelGradeMappingRepository,
)
from app.repositories.grado_puesto_repository import GradoPuestoRepository
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
    EquivalenciaCreate,
    EquivalenciaListResponse,
    EquivalenciaResponse,
    EquivalenciaUpdate,
    FuncionPuestoResponse,
    FuncionPuestoUpdate,
    GlobalGradeCreate,
    GlobalGradeListResponse,
    GlobalGradeResponse,
    GlobalGradeUpdate,
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

    async def crear(
        self, data: CareerPathCreate, current_user: Empleado
    ) -> CareerPathResponse:
        _require_modulo(current_user, "crear career paths")
        await self._validar_unicidad(data)
        item = await self.repo.create(
            {"codigo": data.codigo, "nombre": data.nombre, "activo": True}
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

        # El codigo del path es el prefijo del codigo de sus career levels, asi
        # que cambiarlo dejaria a todos fuera de la regla. Renombrarlos en
        # cascada tampoco sirve: esos codigos ya quedaron escritos en el
        # historial de clasificacion y dejarian de coincidir con el catalogo.
        if data.codigo != item.codigo:
            grados = await self.repo.count_grados_usando(id)
            if grados:
                raise ConflictError(
                    detail=(
                        f"No se puede cambiar el codigo del career path "
                        f"'{item.nombre}' a '{data.codigo}' porque tiene {grados} "
                        f"career level(es) cuyo codigo empieza con '{item.codigo}' "
                        f"({item.codigo}1, {item.codigo}10). Desactivalos primero."
                    )
                )

        await self.repo.update(
            id, {"codigo": data.codigo, "nombre": data.nombre}
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
                    f"en uso ({grados} career level(es), {perfiles} perfil(es))"
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


class GlobalGradeService:
    """
    Catalogo de Global Grades.

    El Global Grade clasifica el puesto dentro de la estructura organizacional; no
    representa sueldo, banda salarial ni compensacion.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GlobalGradeRepository(db)

    @staticmethod
    def _to_response(item: GlobalGrade) -> GlobalGradeResponse:
        return GlobalGradeResponse(
            id=item.id,
            codigo=item.codigo,
            nombre=item.nombre,
            descripcion=item.descripcion,
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
    ) -> GlobalGradeListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            busqueda=busqueda,
            solo_activos=solo_activos,
        )
        return GlobalGradeListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> GlobalGradeResponse:
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="GlobalGrade", id=id)
        return self._to_response(item)

    async def _validar_unicidad(
        self,
        data: GlobalGradeCreate | GlobalGradeUpdate,
        exclude_id: int | None = None,
    ) -> None:
        # El codigo se compara contra TODOS, incluidos los inactivos: reutilizar el
        # codigo de un grado desactivado haria ambigua la lectura del historial.
        if await self.repo.exists_by_codigo(data.codigo, exclude_id=exclude_id):
            raise ConflictError(
                detail=f"Ya existe un global grade con codigo '{data.codigo}'"
            )
        if await self.repo.exists_by_orden(data.orden, exclude_id=exclude_id):
            raise ConflictError(
                detail=f"Ya existe un global grade con orden {data.orden}"
            )

    async def crear(
        self, data: GlobalGradeCreate, current_user: Empleado
    ) -> GlobalGradeResponse:
        _require_modulo(current_user, "crear global grades")
        await self._validar_unicidad(data)
        item = await self.repo.create(
            {
                "codigo": data.codigo,
                "nombre": data.nombre,
                "descripcion": data.descripcion,
                "orden": data.orden,
                "activo": True,
            }
        )
        return self._to_response(item)

    async def actualizar(
        self, id: int, data: GlobalGradeUpdate, current_user: Empleado
    ) -> GlobalGradeResponse:
        _require_modulo(current_user, "actualizar global grades")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="GlobalGrade", id=id)

        await self._validar_unicidad(data, exclude_id=id)
        await self.repo.update(
            id,
            {
                "codigo": data.codigo,
                "nombre": data.nombre,
                "descripcion": data.descripcion,
                "orden": data.orden,
            },
        )
        return self._to_response(await self.repo.get(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        _require_modulo(current_user, "eliminar global grades")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="GlobalGrade", id=id)

        # Los perfiles ya no referencian un global grade: lo heredan del tramo de
        # su career level. Lo unico que lo retiene son las equivalencias.
        equivalencias = await self.repo.count_equivalencias_usando(id)
        if equivalencias:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el global grade '{item.codigo}' porque esta "
                    f"en uso por {equivalencias} equivalencia(s) de career level"
                )
            )
        await self.repo.update(id, {"activo": False})

    async def validar_activo(self, global_grade_id: int) -> GlobalGrade:
        """Un global grade inactivo no se puede asignar a un perfil."""
        item = await self.repo.get(global_grade_id)
        if not item:
            raise NotFoundError(entidad="GlobalGrade", id=global_grade_id)
        if not item.activo:
            raise DomainValidationError(
                f"El global grade '{item.codigo}' esta inactivo y no se puede asignar"
            )
        return item


class EquivalenciaService:
    """
    Equivalencias Career Level → Global Grade.

    Las define RH; el sistema nunca las calcula. Se usan para autocompletar el
    global grade del perfil, pero no lo imponen: si no hay equivalencia, RH lo
    elige a mano.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CareerLevelGradeMappingRepository(db)
        self.grade_repo = GlobalGradeRepository(db)
        self.grado_repo = GradoPuestoRepository(db)

    @staticmethod
    def _to_response(item: CareerLevelGradeMapping) -> EquivalenciaResponse:
        nivel = item.career_level
        career_path = nivel.career_path if nivel else None
        grade = item.global_grade
        return EquivalenciaResponse(
            id=item.id,
            career_level_id=item.career_level_id,
            career_level_codigo=nivel.codigo if nivel else None,
            career_level_nombre=nivel.nombre if nivel else None,
            career_path_id=career_path.id if career_path else None,
            career_path_codigo=career_path.codigo if career_path else None,
            career_path_nombre=career_path.nombre if career_path else None,
            global_grade_id=item.global_grade_id,
            global_grade_codigo=grade.codigo if grade else None,
            global_grade_nombre=grade.nombre if grade else None,
            activo=item.activo,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> EquivalenciaListResponse:
        items, total = await self.repo.list_filtered(
            offset=(page - 1) * page_size,
            limit=page_size,
            career_path_id=career_path_id,
            solo_activos=solo_activos,
        )
        return EquivalenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> EquivalenciaResponse:
        item = await self.repo.get_with_relaciones(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerLevelGradeMapping", id=id)
        return self._to_response(item)

    async def _validar(
        self,
        data: EquivalenciaCreate | EquivalenciaUpdate,
        exclude_id: int | None = None,
    ) -> None:
        if not await self.grado_repo.get_activo(data.career_level_id):
            raise NotFoundError(entidad="GradoPuesto", id=data.career_level_id)
        grade = await self.grade_repo.get(data.global_grade_id)
        if not grade:
            raise NotFoundError(entidad="GlobalGrade", id=data.global_grade_id)
        if not grade.activo:
            raise DomainValidationError(
                f"El global grade '{grade.codigo}' esta inactivo y no se puede "
                "usar en una equivalencia"
            )
        # Lo unico que no se repite es el PAR: un nivel puede abarcar varios
        # grades (M4 = GG17 + GG18), y ahi esta la razon de que dos empleados en
        # M4 puedan estar clasificados distinto.
        existente = await self.repo.get_par(
            data.career_level_id, data.global_grade_id, exclude_id=exclude_id
        )
        if existente:
            nivel = existente.career_level
            raise ConflictError(
                detail=(
                    f"El career level '{nivel.codigo if nivel else data.career_level_id}' "
                    f"ya equivale al global grade '{grade.codigo}'"
                )
            )

    async def crear(
        self, data: EquivalenciaCreate, current_user: Empleado
    ) -> EquivalenciaResponse:
        _require_modulo(current_user, "crear equivalencias")
        await self._validar(data)
        item = await self.repo.create(
            {
                "career_level_id": data.career_level_id,
                "global_grade_id": data.global_grade_id,
                "activo": True,
            }
        )
        return self._to_response(await self.repo.get_with_relaciones(item.id))

    async def actualizar(
        self, id: int, data: EquivalenciaUpdate, current_user: Empleado
    ) -> EquivalenciaResponse:
        _require_modulo(current_user, "actualizar equivalencias")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerLevelGradeMapping", id=id)

        await self._validar(data, exclude_id=id)
        await self.repo.update(
            id,
            {
                "career_level_id": data.career_level_id,
                "global_grade_id": data.global_grade_id,
            },
        )
        return self._to_response(await self.repo.get_with_relaciones(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        _require_modulo(current_user, "eliminar equivalencias")
        item = await self.repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(entidad="CareerLevelGradeMapping", id=id)
        # Borrar una equivalencia no toca los perfiles que ya la usaron: su global
        # grade quedo grabado en el perfil, no se deriva en cada lectura.
        await self.repo.update(id, {"activo": False})

    async def resolver(self, career_level_id: int) -> list[EquivalenciaResponse]:
        """
        Grades a los que equivale el nivel, ordenados; vacio si no hay ninguno.

        Es una lista porque un nivel abarca un tramo (M4 = GG17 + GG18).
        """
        items = await self.repo.get_activas_por_career_level(career_level_id)
        return [self._to_response(i) for i in items]
