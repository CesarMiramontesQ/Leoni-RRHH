"""Servicio para Plan de Desarrollo Individual (PDI)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import Competencia, PlanDesarrolloIndividual
from app.repositories.pdi_repository import PDIRepository
from app.schemas.pdi import PDICreate, PDIListResponse, PDIResponse, PDIUpdate

ESTADOS_VALIDOS = {"pendiente", "en_proceso", "completado", "cancelado"}
ESTADOS_TERMINALES = {"completado", "cancelado"}


class PDIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PDIRepository(db)

    def _check_read_permission(self, current_user: Empleado, empleado_id: int):
        if user_has_module(current_user, "evaluaciones"):
            return
        rol = current_user.rol.nombre if current_user.rol else None
        if rol == "supervisor":
            if current_user.area_id is not None:
                return
        if current_user.id == empleado_id:
            return
        raise ForbiddenError("Sin permiso para ver el PDI de este empleado")

    async def _get_empleado(self, empleado_id: int) -> Empleado:
        result = await self.db.execute(
            select(Empleado).where(Empleado.id == empleado_id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise NotFoundError("Empleado", empleado_id)
        return emp

    async def _get_competencia(self, competencia_id: int) -> Competencia:
        result = await self.db.execute(
            select(Competencia).where(Competencia.id == competencia_id)
        )
        comp = result.scalar_one_or_none()
        if not comp:
            raise NotFoundError("Competencia", competencia_id)
        return comp

    def _to_response(self, item: PlanDesarrolloIndividual) -> PDIResponse:
        competencia_nombre = item.competencia.nombre if item.competencia else "—"
        creador = item.creador
        creado_por_nombre = creador.nombre if creador else "—"

        return PDIResponse(
            id=item.id,
            empleado_id=item.empleado_id,
            competencia_id=item.competencia_id,
            competencia_nombre=competencia_nombre,
            accion=item.accion,
            tipo=item.tipo,
            duracion_horas=item.duracion_horas,
            fecha_inicio=item.fecha_inicio,
            fecha_fin=item.fecha_fin,
            responsable=item.responsable,
            estado=item.estado,
            creado_por=item.creado_por,
            creado_por_nombre=creado_por_nombre,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def listar(
        self,
        empleado_id: int,
        current_user: Empleado,
        estado: str | None = None,
        competencia_id: int | None = None,
    ) -> PDIListResponse:
        self._check_read_permission(current_user, empleado_id)
        await self._get_empleado(empleado_id)

        items, total = await self.repo.list_by_empleado(
            empleado_id=empleado_id, estado=estado, competencia_id=competencia_id
        )
        return PDIListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
        )

    async def crear(
        self, empleado_id: int, data: PDICreate, current_user: Empleado
    ) -> PDIResponse:
        await self._get_empleado(empleado_id)
        await self._get_competencia(data.competencia_id)

        instance = PlanDesarrolloIndividual(
            empleado_id=empleado_id,
            competencia_id=data.competencia_id,
            accion=data.accion,
            tipo=data.tipo,
            duracion_horas=data.duracion_horas,
            fecha_inicio=data.fecha_inicio,
            fecha_fin=data.fecha_fin,
            responsable=data.responsable,
            estado="pendiente",
            creado_por=current_user.id,
        )
        created = await self.repo.create(instance)
        await self.db.commit()
        await self.db.refresh(created)
        return self._to_response(created)

    async def actualizar(
        self, empleado_id: int, pdi_id: int, data: PDIUpdate, current_user: Empleado
    ) -> PDIResponse:
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("PDI", pdi_id)

        if item.estado in ESTADOS_TERMINALES:
            raise ForbiddenError(
                f"No se puede modificar una acción en estado '{item.estado}'"
            )

        if data.estado and data.estado not in ESTADOS_VALIDOS:
            raise ForbiddenError(f"Estado inválido: {data.estado}")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(item)
        return self._to_response(item)

    async def eliminar(self, empleado_id: int, pdi_id: int) -> None:
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("PDI", pdi_id)
        await self.repo.delete(pdi_id)
        await self.db.commit()
