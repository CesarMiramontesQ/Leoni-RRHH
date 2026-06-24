# app/services/metodo_calificacion_competencia_service.py
"""Logica de negocio para metodos de calificacion de competencias."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import MetodoCalificacionCompetencia
from app.repositories.metodo_calificacion_competencia_repository import (
    MetodoCalificacionCompetenciaRepository,
)
from app.schemas.metodos_calificacion_competencia import (
    MetodoCalificacionCompetenciaCreate,
    MetodoCalificacionCompetenciaListResponse,
    MetodoCalificacionCompetenciaResponse,
    MetodoCalificacionCompetenciaUpdate,
)


class MetodoCalificacionCompetenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MetodoCalificacionCompetenciaRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(metodo: MetodoCalificacionCompetencia) -> MetodoCalificacionCompetenciaResponse:
        return MetodoCalificacionCompetenciaResponse(
            id=metodo.id,
            valor=metodo.valor,
            nombre=metodo.nombre,
            orden=metodo.orden,
            activo=metodo.activo,
            created_at=metodo.created_at,
            updated_at=metodo.updated_at,
        )

    def _require_puestos_module(self, user: Empleado) -> None:
        if not user_has_module(user, "puestos"):
            raise ForbiddenError(
                detail="Solo RH puede gestionar metodos de calificacion de competencias"
            )

    async def listar(self, solo_activos: bool = True) -> MetodoCalificacionCompetenciaListResponse:
        items = (
            await self.repo.list_activos()
            if solo_activos
            else await self.repo.list_all()
        )
        return MetodoCalificacionCompetenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=len(items),
        )

    async def obtener(self, id: int) -> MetodoCalificacionCompetenciaResponse:
        metodo = await self.repo.get(id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacionCompetencia", id=id)
        return self._to_response(metodo)

    async def crear(
        self, data: MetodoCalificacionCompetenciaCreate, current_user: Empleado
    ) -> MetodoCalificacionCompetenciaResponse:
        self._require_puestos_module(current_user)

        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un metodo de calificacion '{data.nombre}'"
            )
        if await self.repo.exists_by_orden(data.orden):
            raise ConflictError(
                detail=f"Ya existe un metodo de calificacion con orden {data.orden}"
            )

        valor = await self.repo.next_valor()
        metodo = await self.repo.create({
            "valor": valor,
            "nombre": data.nombre,
            "orden": data.orden,
            "activo": True,
        })
        return self._to_response(metodo)

    async def actualizar(
        self, id: int, data: MetodoCalificacionCompetenciaUpdate, current_user: Empleado
    ) -> MetodoCalificacionCompetenciaResponse:
        self._require_puestos_module(current_user)

        metodo = await self.repo.get(id)
        if not metodo:
            raise NotFoundError(entidad="MetodoCalificacionCompetencia", id=id)

        if data.nombre != metodo.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un metodo de calificacion '{data.nombre}'"
                )
        if data.orden != metodo.orden:
            if await self.repo.exists_by_orden(data.orden, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un metodo de calificacion con orden {data.orden}"
                )

        payload: dict = {"nombre": data.nombre, "orden": data.orden}
        if data.activo is not None:
            if data.activo is False and metodo.activo:
                requisitos = await self.repo.count_requisitos_usando_valor(metodo.valor)
                if requisitos > 0:
                    raise ConflictError(
                        detail=(
                            f"No se puede desactivar '{metodo.nombre}' porque "
                            f"esta en uso en {requisitos} requisito(s) de competencia"
                        )
                    )
            payload["activo"] = data.activo

        await self.repo.update(id, payload)
        metodo = await self.repo.get(id)
        return self._to_response(metodo)

    async def desactivar(self, id: int, current_user: Empleado) -> None:
        self._require_puestos_module(current_user)

        metodo = await self.repo.get(id)
        if not metodo or not metodo.activo:
            raise NotFoundError(entidad="MetodoCalificacionCompetencia", id=id)

        requisitos = await self.repo.count_requisitos_usando_valor(metodo.valor)
        if requisitos > 0:
            raise ConflictError(
                detail=(
                    f"No se puede desactivar '{metodo.nombre}' porque "
                    f"esta en uso en {requisitos} requisito(s) de competencia"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_nivel_requerido(self, nivel: int) -> MetodoCalificacionCompetencia:
        """Valida que el nivel corresponda a un metodo activo del catalogo."""
        if nivel <= 0:
            raise DomainValidationError("El nivel requerido debe ser mayor a 0")
        metodo = await self.repo.get_by_valor(nivel)
        if not metodo:
            raise DomainValidationError(
                f"El nivel {nivel} no esta configurado o esta inactivo en ajustes"
            )
        return metodo

    async def validar_niveles_requeridos(self, niveles: set[int]) -> None:
        if not niveles:
            return
        activos = await self.repo.valores_activos()
        invalidos = {n for n in niveles if n > 0} - activos
        if invalidos:
            raise DomainValidationError(
                f"Niveles no configurados o inactivos: {sorted(invalidos)}"
            )

    async def listar_resumen(self) -> list[MetodoCalificacionCompetenciaResponse]:
        items = await self.repo.list_activos()
        return [self._to_response(i) for i in items]

    async def max_valor_activo(self) -> int:
        valores = await self.repo.valores_activos()
        return max(valores) if valores else 0
