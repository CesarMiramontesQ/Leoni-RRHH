"""Lógica de negocio para los catálogos de cursos."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.repositories.cursos_catalogo_repository import (
    CursoCategoriaRepository,
    CursoClasificacionRepository,
    CursoTipoRepository,
    InstructorExternoRepository,
    ProveedorRepository,
)
from app.schemas.cursos_catalogo import (
    CursoCatSimpleCreate,
    CursoCatSimpleListResponse,
    CursoCatSimpleResponse,
    CursoCatSimpleUpdate,
    InstructorExternoCreate,
    InstructorExternoListResponse,
    InstructorExternoResponse,
    InstructorExternoUpdate,
    ProveedorCreate,
    ProveedorListResponse,
    ProveedorResponse,
    ProveedorUpdate,
)


class CursosCatalogoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.categoria_repo = CursoCategoriaRepository(db)
        self.tipo_repo = CursoTipoRepository(db)
        self.clasificacion_repo = CursoClasificacionRepository(db)
        self.instructor_repo = InstructorExternoRepository(db)
        self.proveedor_repo = ProveedorRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    def _require_rh(self, user: Empleado) -> None:
        if self._get_rol(user) != "rh":
            raise ForbiddenError(detail="Solo RH puede administrar catálogos de cursos")

    # ── Categorías ─────────────────────────────────────────────────────────────

    async def listar_categorias(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> CursoCatSimpleListResponse:
        offset = (page - 1) * page_size
        items, total = await self.categoria_repo.list_filtered(offset, page_size, busqueda, solo_activos)
        return CursoCatSimpleListResponse(
            items=[CursoCatSimpleResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_categoria(self, data: CursoCatSimpleCreate, user: Empleado) -> CursoCatSimpleResponse:
        self._require_rh(user)
        if await self.categoria_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe la categoría '{data.nombre}'")
        item = await self.categoria_repo.create({"nombre": data.nombre, "descripcion": data.descripcion, "activo": True})
        return CursoCatSimpleResponse.model_validate(item)

    async def actualizar_categoria(
        self, id: int, data: CursoCatSimpleUpdate, user: Empleado
    ) -> CursoCatSimpleResponse:
        self._require_rh(user)
        item = await self.categoria_repo.get(id)
        if not item:
            raise NotFoundError(detail=f"Categoría {id} no encontrada")
        update_data: dict = {}
        if data.nombre is not None and data.nombre != item.nombre:
            if await self.categoria_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe la categoría '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            item = await self.categoria_repo.update(id, update_data)
        return CursoCatSimpleResponse.model_validate(item)

    async def eliminar_categoria(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        item = await self.categoria_repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(detail=f"Categoría {id} no encontrada")
        await self.categoria_repo.update(id, {"activo": False})

    # ── Tipos ──────────────────────────────────────────────────────────────────

    async def listar_tipos(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> CursoCatSimpleListResponse:
        offset = (page - 1) * page_size
        items, total = await self.tipo_repo.list_filtered(offset, page_size, busqueda, solo_activos)
        return CursoCatSimpleListResponse(
            items=[CursoCatSimpleResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_tipo(self, data: CursoCatSimpleCreate, user: Empleado) -> CursoCatSimpleResponse:
        self._require_rh(user)
        if await self.tipo_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe el tipo '{data.nombre}'")
        item = await self.tipo_repo.create({"nombre": data.nombre, "descripcion": data.descripcion, "activo": True})
        return CursoCatSimpleResponse.model_validate(item)

    async def actualizar_tipo(
        self, id: int, data: CursoCatSimpleUpdate, user: Empleado
    ) -> CursoCatSimpleResponse:
        self._require_rh(user)
        item = await self.tipo_repo.get(id)
        if not item:
            raise NotFoundError(detail=f"Tipo {id} no encontrado")
        update_data: dict = {}
        if data.nombre is not None and data.nombre != item.nombre:
            if await self.tipo_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe el tipo '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            item = await self.tipo_repo.update(id, update_data)
        return CursoCatSimpleResponse.model_validate(item)

    async def eliminar_tipo(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        item = await self.tipo_repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(detail=f"Tipo {id} no encontrado")
        await self.tipo_repo.update(id, {"activo": False})

    # ── Clasificaciones ────────────────────────────────────────────────────────

    async def listar_clasificaciones(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> CursoCatSimpleListResponse:
        offset = (page - 1) * page_size
        items, total = await self.clasificacion_repo.list_filtered(offset, page_size, busqueda, solo_activos)
        return CursoCatSimpleListResponse(
            items=[CursoCatSimpleResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_clasificacion(self, data: CursoCatSimpleCreate, user: Empleado) -> CursoCatSimpleResponse:
        self._require_rh(user)
        if await self.clasificacion_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe la clasificación '{data.nombre}'")
        item = await self.clasificacion_repo.create({"nombre": data.nombre, "descripcion": data.descripcion, "activo": True})
        return CursoCatSimpleResponse.model_validate(item)

    async def actualizar_clasificacion(
        self, id: int, data: CursoCatSimpleUpdate, user: Empleado
    ) -> CursoCatSimpleResponse:
        self._require_rh(user)
        item = await self.clasificacion_repo.get(id)
        if not item:
            raise NotFoundError(detail=f"Clasificación {id} no encontrada")
        update_data: dict = {}
        if data.nombre is not None and data.nombre != item.nombre:
            if await self.clasificacion_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe la clasificación '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            item = await self.clasificacion_repo.update(id, update_data)
        return CursoCatSimpleResponse.model_validate(item)

    async def eliminar_clasificacion(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        item = await self.clasificacion_repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(detail=f"Clasificación {id} no encontrada")
        await self.clasificacion_repo.update(id, {"activo": False})

    # ── Instructores Externos ──────────────────────────────────────────────────

    async def listar_instructores_externos(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> InstructorExternoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.instructor_repo.list_filtered(offset, page_size, busqueda, solo_activos)
        return InstructorExternoListResponse(
            items=[InstructorExternoResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_instructor_externo(
        self, data: InstructorExternoCreate, user: Empleado
    ) -> InstructorExternoResponse:
        self._require_rh(user)
        if await self.instructor_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe el instructor '{data.nombre}'")
        item = await self.instructor_repo.create({
            "nombre": data.nombre,
            "especialidad": data.especialidad,
            "empresa": data.empresa,
            "contacto": data.contacto,
            "activo": True,
        })
        return InstructorExternoResponse.model_validate(item)

    async def actualizar_instructor_externo(
        self, id: int, data: InstructorExternoUpdate, user: Empleado
    ) -> InstructorExternoResponse:
        self._require_rh(user)
        item = await self.instructor_repo.get(id)
        if not item:
            raise NotFoundError(detail=f"Instructor externo {id} no encontrado")
        update_data: dict = {}
        if data.nombre is not None and data.nombre != item.nombre:
            if await self.instructor_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe el instructor '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.especialidad is not None:
            update_data["especialidad"] = data.especialidad
        if data.empresa is not None:
            update_data["empresa"] = data.empresa
        if data.contacto is not None:
            update_data["contacto"] = data.contacto
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            item = await self.instructor_repo.update(id, update_data)
        return InstructorExternoResponse.model_validate(item)

    async def eliminar_instructor_externo(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        item = await self.instructor_repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(detail=f"Instructor externo {id} no encontrado")
        await self.instructor_repo.update(id, {"activo": False})

    # ── Proveedores ────────────────────────────────────────────────────────────

    async def listar_proveedores(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> ProveedorListResponse:
        offset = (page - 1) * page_size
        items, total = await self.proveedor_repo.list_filtered(offset, page_size, busqueda, solo_activos)
        return ProveedorListResponse(
            items=[ProveedorResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_proveedor(self, data: ProveedorCreate, user: Empleado) -> ProveedorResponse:
        self._require_rh(user)
        if await self.proveedor_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe el proveedor '{data.nombre}'")
        item = await self.proveedor_repo.create({
            "nombre": data.nombre,
            "contacto": data.contacto,
            "telefono": data.telefono,
            "email": data.email,
            "direccion": data.direccion,
            "activo": True,
        })
        return ProveedorResponse.model_validate(item)

    async def actualizar_proveedor(
        self, id: int, data: ProveedorUpdate, user: Empleado
    ) -> ProveedorResponse:
        self._require_rh(user)
        item = await self.proveedor_repo.get(id)
        if not item:
            raise NotFoundError(detail=f"Proveedor {id} no encontrado")
        update_data: dict = {}
        if data.nombre is not None and data.nombre != item.nombre:
            if await self.proveedor_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe el proveedor '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.contacto is not None:
            update_data["contacto"] = data.contacto
        if data.telefono is not None:
            update_data["telefono"] = data.telefono
        if data.email is not None:
            update_data["email"] = data.email
        if data.direccion is not None:
            update_data["direccion"] = data.direccion
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            item = await self.proveedor_repo.update(id, update_data)
        return ProveedorResponse.model_validate(item)

    async def eliminar_proveedor(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        item = await self.proveedor_repo.get(id)
        if not item or not item.activo:
            raise NotFoundError(detail=f"Proveedor {id} no encontrado")
        await self.proveedor_repo.update(id, {"activo": False})
