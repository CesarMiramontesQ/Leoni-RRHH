# app/services/cualificaciones_catalogo_service.py
"""Lógica de negocio para el catálogo configurable de cualificaciones."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import (
    CualificacionCatalogo,
    MetodoCalificacion,
    OpcionCalificacion,
    TipoCualificacionCatalogo,
)
from app.repositories.cualificaciones_catalogo_repository import (
    CualificacionCatalogoRepository,
    MetodoCalificacionRepository,
    OpcionCalificacionRepository,
    TipoCualificacionRepository,
)
from app.schemas.cualificaciones_catalogo import (
    TIPOS_REQUIEREN_OPCIONES,
    CatalogoCompletoResponse,
    CualificacionCatalogoCreate,
    CualificacionCatalogoListResponse,
    CualificacionCatalogoResponse,
    CualificacionCatalogoUpdate,
    MetodoCalificacionCreate,
    MetodoCalificacionListResponse,
    MetodoCalificacionResponse,
    MetodoCalificacionUpdate,
    OpcionCalificacionCreate,
    OpcionCalificacionResponse,
    OpcionCalificacionUpdate,
    TipoCualificacionCreate,
    TipoCualificacionListResponse,
    TipoCualificacionResponse,
    TipoCualificacionUpdate,
)


class CualificacionesCatalogoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.tipo_repo = TipoCualificacionRepository(db)
        self.metodo_repo = MetodoCalificacionRepository(db)
        self.opcion_repo = OpcionCalificacionRepository(db)
        self.cualificacion_repo = CualificacionCatalogoRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    def _require_rh(self, user: Empleado) -> None:
        if self._get_rol(user) != "rh":
            raise ForbiddenError(detail="Solo RH puede administrar el catálogo de cualificaciones")

    @staticmethod
    def _to_opcion_response(op: OpcionCalificacion) -> OpcionCalificacionResponse:
        return OpcionCalificacionResponse.model_validate(op)

    @staticmethod
    def _to_metodo_response(metodo: MetodoCalificacion, incluir_opciones: bool = True) -> MetodoCalificacionResponse:
        opciones = []
        if incluir_opciones and metodo.opciones:
            opciones = [
                OpcionCalificacionResponse.model_validate(o)
                for o in sorted(metodo.opciones, key=lambda x: (x.orden, x.id))
                if o.activo
            ]
        return MetodoCalificacionResponse(
            id=metodo.id,
            nombre=metodo.nombre,
            tipo=metodo.tipo,
            descripcion=metodo.descripcion,
            config=metodo.config or {},
            activo=metodo.activo,
            created_at=metodo.created_at,
            updated_at=metodo.updated_at,
            opciones=opciones,
        )

    @staticmethod
    def _catalogo_primario_de_tipo(tipo: TipoCualificacionCatalogo) -> CualificacionCatalogo | None:
        activos = [c for c in (tipo.cualificaciones or []) if c.activo]
        if not activos:
            return None
        con_legacy = [c for c in activos if c.legacy_tipo]
        return (con_legacy or activos)[0]

    def _to_tipo_response(
        self,
        tipo: TipoCualificacionCatalogo,
        catalogo: CualificacionCatalogo | None = None,
    ) -> TipoCualificacionResponse:
        cat = catalogo or self._catalogo_primario_de_tipo(tipo)
        metodo = cat.metodo_calificacion if cat else None
        opciones: list[OpcionCalificacionResponse] = []
        if metodo and metodo.opciones:
            opciones = [
                OpcionCalificacionResponse.model_validate(o)
                for o in sorted(metodo.opciones, key=lambda x: (x.orden, x.id))
                if o.activo
            ]
        return TipoCualificacionResponse(
            id=tipo.id,
            nombre=tipo.nombre,
            descripcion=tipo.descripcion,
            activo=tipo.activo,
            metodo_calificacion_id=cat.metodo_calificacion_id if cat else None,
            metodo_nombre=metodo.nombre if metodo else "",
            metodo_tipo=metodo.tipo if metodo else "",
            metodo_config=metodo.config if metodo else {},
            opciones=opciones,
            cualificacion_catalogo_id=cat.id if cat else None,
            created_at=tipo.created_at,
            updated_at=tipo.updated_at,
        )

    async def _sync_catalogo_para_tipo(
        self,
        tipo: TipoCualificacionCatalogo,
        metodo_id: int,
        *,
        activo: bool | None = None,
    ) -> CualificacionCatalogo:
        metodo = await self.metodo_repo.get(metodo_id)
        if not metodo or not metodo.activo:
            raise NotFoundError(entidad="MetodoCalificacion", id=metodo_id)
        catalogo = await self.cualificacion_repo.get_primario_por_tipo(tipo.id)
        payload = {
            "tipo_cualificacion_id": tipo.id,
            "metodo_calificacion_id": metodo_id,
            "nombre": tipo.nombre,
            "descripcion": tipo.descripcion,
            "obligatorio": True,
            "activo": tipo.activo if activo is None else activo,
        }
        if catalogo:
            catalogo = await self.cualificacion_repo.update(catalogo.id, payload)
        else:
            catalogo = await self.cualificacion_repo.create(payload)
        refreshed = await self.cualificacion_repo.get_with_relaciones(catalogo.id)
        return refreshed  # type: ignore[return-value]

    @staticmethod
    def _to_cualificacion_response(c: CualificacionCatalogo) -> CualificacionCatalogoResponse:
        metodo = c.metodo_calificacion
        opciones = []
        if metodo and metodo.opciones:
            opciones = [
                OpcionCalificacionResponse.model_validate(o)
                for o in sorted(metodo.opciones, key=lambda x: (x.orden, x.id))
                if o.activo
            ]
        return CualificacionCatalogoResponse(
            id=c.id,
            tipo_cualificacion_id=c.tipo_cualificacion_id,
            tipo_nombre=c.tipo_cualificacion.nombre if c.tipo_cualificacion else "",
            metodo_calificacion_id=c.metodo_calificacion_id,
            metodo_nombre=metodo.nombre if metodo else "",
            metodo_tipo=metodo.tipo if metodo else "",
            metodo_config=metodo.config if metodo else {},
            nombre=c.nombre,
            descripcion=c.descripcion,
            obligatorio=c.obligatorio,
            activo=c.activo,
            opciones=opciones,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )

    # ── Tipos ───────────────────────────────────────────────────────────────

    async def listar_tipos(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> TipoCualificacionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.tipo_repo.list_filtered(
            offset, page_size, busqueda, solo_activos, con_catalogos=True
        )
        return TipoCualificacionListResponse(
            items=[self._to_tipo_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_tipo(self, data: TipoCualificacionCreate, user: Empleado) -> TipoCualificacionResponse:
        self._require_rh(user)
        if await self.tipo_repo.exists_by_nombre(data.nombre):
            raise ConflictError(detail=f"Ya existe el tipo '{data.nombre}'")
        tipo = await self.tipo_repo.create({
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "activo": True,
        })
        catalogo = await self._sync_catalogo_para_tipo(tipo, data.metodo_calificacion_id)
        return self._to_tipo_response(tipo, catalogo)

    async def actualizar_tipo(
        self, id: int, data: TipoCualificacionUpdate, user: Empleado
    ) -> TipoCualificacionResponse:
        self._require_rh(user)
        tipo = await self.tipo_repo.get(id)
        if not tipo:
            raise NotFoundError(entidad="TipoCualificacion", id=id)
        update_data: dict = {}
        if data.nombre is not None and data.nombre != tipo.nombre:
            if await self.tipo_repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(detail=f"Ya existe el tipo '{data.nombre}'")
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            tipo = await self.tipo_repo.update(id, update_data)
        catalogo = None
        if data.metodo_calificacion_id is not None or update_data:
            metodo_id = data.metodo_calificacion_id
            if metodo_id is None:
                existente = await self.cualificacion_repo.get_primario_por_tipo(id)
                if not existente:
                    raise DomainValidationError(
                        "Se requiere metodo_calificacion_id para tipos sin catálogo vinculado"
                    )
                metodo_id = existente.metodo_calificacion_id
            catalogo = await self._sync_catalogo_para_tipo(
                tipo,
                metodo_id,
                activo=data.activo if data.activo is not None else tipo.activo,
            )
        elif data.activo is not None:
            existente = await self.cualificacion_repo.get_primario_por_tipo(id)
            if existente:
                catalogo = await self.cualificacion_repo.update(
                    existente.id, {"activo": data.activo}
                )
                catalogo = await self.cualificacion_repo.get_with_relaciones(existente.id)
        if catalogo is None:
            catalogo = await self.cualificacion_repo.get_primario_por_tipo(id)
        return self._to_tipo_response(tipo, catalogo)

    async def eliminar_tipo(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        tipo = await self.tipo_repo.get(id)
        if not tipo or not tipo.activo:
            raise NotFoundError(entidad="TipoCualificacion", id=id)
        en_uso = await self.tipo_repo.count_perfiles_usando_tipo(id)
        if en_uso > 0:
            raise ConflictError(
                detail=f"No se puede eliminar el tipo porque {en_uso} perfil(es) lo utilizan"
            )
        catalogo = await self.cualificacion_repo.get_primario_por_tipo(id)
        if catalogo:
            await self.cualificacion_repo.update(catalogo.id, {"activo": False})
        await self.tipo_repo.update(id, {"activo": False})

    # ── Métodos ─────────────────────────────────────────────────────────────

    async def listar_metodos(
        self, page: int, page_size: int, busqueda: str | None = None, solo_activos: bool = True
    ) -> MetodoCalificacionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.metodo_repo.list_filtered(
            offset, page_size, busqueda, solo_activos, con_opciones=True
        )
        return MetodoCalificacionListResponse(
            items=[self._to_metodo_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear_metodo(self, data: MetodoCalificacionCreate, user: Empleado) -> MetodoCalificacionResponse:
        self._require_rh(user)
        config = data.config.model_dump()
        if data.tipo in TIPOS_REQUIEREN_OPCIONES:
            config["requiere_opciones"] = True
        metodo = await self.metodo_repo.create({
            "nombre": data.nombre,
            "tipo": data.tipo,
            "descripcion": data.descripcion,
            "config": config,
            "activo": True,
        })
        metodo = await self.metodo_repo.get_with_opciones(metodo.id)
        return self._to_metodo_response(metodo)  # type: ignore[arg-type]

    async def actualizar_metodo(
        self, id: int, data: MetodoCalificacionUpdate, user: Empleado
    ) -> MetodoCalificacionResponse:
        self._require_rh(user)
        metodo = await self.metodo_repo.get_with_opciones(id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacion", id=id)
        update_data: dict = {}
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.tipo is not None:
            update_data["tipo"] = data.tipo
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.config is not None:
            update_data["config"] = data.config.model_dump()
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            metodo = await self.metodo_repo.update(id, update_data)
            metodo = await self.metodo_repo.get_with_opciones(id)
        return self._to_metodo_response(metodo)  # type: ignore[arg-type]

    async def eliminar_metodo(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        metodo = await self.metodo_repo.get(id)
        if not metodo or not metodo.activo:
            raise NotFoundError(entidad="MetodoCalificacion", id=id)
        en_uso = await self.metodo_repo.count_cualificaciones_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=f"No se puede eliminar el método porque {en_uso} cualificación(es) lo utilizan"
            )
        await self.metodo_repo.update(id, {"activo": False})

    # ── Opciones ──────────────────────────────────────────────────────────

    async def listar_opciones(self, metodo_id: int) -> list[OpcionCalificacionResponse]:
        metodo = await self.metodo_repo.get(metodo_id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacion", id=metodo_id)
        opciones = await self.opcion_repo.list_by_metodo(metodo_id, solo_activos=False)
        return [self._to_opcion_response(o) for o in opciones]

    async def crear_opcion(
        self, metodo_id: int, data: OpcionCalificacionCreate, user: Empleado
    ) -> OpcionCalificacionResponse:
        self._require_rh(user)
        metodo = await self.metodo_repo.get(metodo_id)
        if not metodo or not metodo.activo:
            raise NotFoundError(entidad="MetodoCalificacion", id=metodo_id)
        if await self.opcion_repo.exists_valor_en_metodo(metodo_id, data.valor):
            raise ConflictError(detail=f"Ya existe la opción con valor '{data.valor}'")
        config = metodo.config or {}
        if config.get("comparador") == "ordinal_gte" and data.peso is None:
            raise ConflictError(detail="Las opciones de métodos ordinales requieren peso")
        opcion = await self.opcion_repo.create({
            "metodo_calificacion_id": metodo_id,
            "etiqueta": data.etiqueta,
            "valor": data.valor,
            "orden": data.orden,
            "peso": data.peso,
            "activo": True,
        })
        return self._to_opcion_response(opcion)

    async def actualizar_opcion(
        self, metodo_id: int, opcion_id: int, data: OpcionCalificacionUpdate, user: Empleado
    ) -> OpcionCalificacionResponse:
        self._require_rh(user)
        opcion = await self.opcion_repo.get(opcion_id)
        if not opcion or opcion.metodo_calificacion_id != metodo_id:
            raise NotFoundError(entidad="OpcionCalificacion", id=opcion_id)
        update_data: dict = {}
        if data.etiqueta is not None:
            update_data["etiqueta"] = data.etiqueta
        if data.valor is not None and data.valor != opcion.valor:
            if await self.opcion_repo.exists_valor_en_metodo(metodo_id, data.valor, exclude_id=opcion_id):
                raise ConflictError(detail=f"Ya existe la opción con valor '{data.valor}'")
            update_data["valor"] = data.valor
        if data.orden is not None:
            update_data["orden"] = data.orden
        if data.peso is not None:
            update_data["peso"] = data.peso
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            opcion = await self.opcion_repo.update(opcion_id, update_data)
        return self._to_opcion_response(opcion)

    async def eliminar_opcion(self, metodo_id: int, opcion_id: int, user: Empleado) -> None:
        self._require_rh(user)
        opcion = await self.opcion_repo.get(opcion_id)
        if not opcion or opcion.metodo_calificacion_id != metodo_id:
            raise NotFoundError(entidad="OpcionCalificacion", id=opcion_id)
        await self.opcion_repo.update(opcion_id, {"activo": False})

    # ── Cualificaciones catálogo ────────────────────────────────────────────

    async def listar_cualificaciones(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        tipo_id: int | None = None,
        solo_activos: bool = True,
    ) -> CualificacionCatalogoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.cualificacion_repo.list_filtered(
            offset, page_size, busqueda, tipo_id, solo_activos, con_relaciones=True
        )
        return CualificacionCatalogoListResponse(
            items=[self._to_cualificacion_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener_cualificacion(self, id: int) -> CualificacionCatalogoResponse:
        c = await self.cualificacion_repo.get_with_relaciones(id)
        if not c or not c.activo:
            raise NotFoundError(entidad="CualificacionCatalogo", id=id)
        return self._to_cualificacion_response(c)

    async def crear_cualificacion(
        self, data: CualificacionCatalogoCreate, user: Empleado
    ) -> CualificacionCatalogoResponse:
        self._require_rh(user)
        tipo = await self.tipo_repo.get(data.tipo_cualificacion_id)
        if not tipo or not tipo.activo:
            raise NotFoundError(entidad="TipoCualificacion", id=data.tipo_cualificacion_id)
        metodo = await self.metodo_repo.get(data.metodo_calificacion_id)
        if not metodo or not metodo.activo:
            raise NotFoundError(entidad="MetodoCalificacion", id=data.metodo_calificacion_id)
        c = await self.cualificacion_repo.create({
            "tipo_cualificacion_id": data.tipo_cualificacion_id,
            "metodo_calificacion_id": data.metodo_calificacion_id,
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "obligatorio": data.obligatorio,
            "activo": True,
        })
        c = await self.cualificacion_repo.get_with_relaciones(c.id)
        return self._to_cualificacion_response(c)  # type: ignore[arg-type]

    async def actualizar_cualificacion(
        self, id: int, data: CualificacionCatalogoUpdate, user: Empleado
    ) -> CualificacionCatalogoResponse:
        self._require_rh(user)
        c = await self.cualificacion_repo.get_with_relaciones(id)
        if not c:
            raise NotFoundError(entidad="CualificacionCatalogo", id=id)
        update_data: dict = {}
        if data.tipo_cualificacion_id is not None:
            tipo = await self.tipo_repo.get(data.tipo_cualificacion_id)
            if not tipo or not tipo.activo:
                raise NotFoundError(entidad="TipoCualificacion", id=data.tipo_cualificacion_id)
            update_data["tipo_cualificacion_id"] = data.tipo_cualificacion_id
        if data.metodo_calificacion_id is not None:
            metodo = await self.metodo_repo.get(data.metodo_calificacion_id)
            if not metodo or not metodo.activo:
                raise NotFoundError(entidad="MetodoCalificacion", id=data.metodo_calificacion_id)
            update_data["metodo_calificacion_id"] = data.metodo_calificacion_id
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.obligatorio is not None:
            update_data["obligatorio"] = data.obligatorio
        if data.activo is not None:
            update_data["activo"] = data.activo
        if update_data:
            c = await self.cualificacion_repo.update(id, update_data)
            c = await self.cualificacion_repo.get_with_relaciones(id)
        return self._to_cualificacion_response(c)  # type: ignore[arg-type]

    async def eliminar_cualificacion(self, id: int, user: Empleado) -> None:
        self._require_rh(user)
        c = await self.cualificacion_repo.get(id)
        if not c or not c.activo:
            raise NotFoundError(entidad="CualificacionCatalogo", id=id)
        en_uso = await self.cualificacion_repo.count_perfiles_usando(id)
        if en_uso > 0:
            raise ConflictError(
                detail=f"No se puede eliminar la cualificación porque {en_uso} perfil(es) la utilizan"
            )
        await self.cualificacion_repo.update(id, {"activo": False})

    async def obtener_catalogo_completo(self) -> CatalogoCompletoResponse:
        tipos_items, _ = await self.tipo_repo.list_filtered(0, 500, solo_activos=True)
        metodos_items, _ = await self.metodo_repo.list_filtered(
            0, 500, solo_activos=True, con_opciones=True
        )
        cualificaciones = await self.cualificacion_repo.list_all_activas_con_relaciones()
        return CatalogoCompletoResponse(
            tipos=[TipoCualificacionResponse.model_validate(t) for t in tipos_items],
            metodos=[self._to_metodo_response(m) for m in metodos_items],
            cualificaciones=[self._to_cualificacion_response(c) for c in cualificaciones],
        )
