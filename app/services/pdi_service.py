"""Service para Plan de Desarrollo Individual (PDI)."""

from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import PlanDesarrolloIndividual
from app.repositories.pdi_repository import PDIRepository
from app.schemas.pdi import PDICreate, PDIUpdate, PDIResponse, PDIListResponse, PDIGestionListResponse, PDIGestionItem, PDIResumenResponse


VALID_TRANSITIONS = {
    "pendiente": {"en_proceso", "cancelado"},
    "en_proceso": {"completado", "cancelado"},
    "completado": set(),
    "cancelado": set(),
}


class PDIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PDIRepository(db)

    async def listar(
        self,
        empleado_id: int,
        current_user: Empleado,
        estado: Optional[str] = None,
        competencia_id: Optional[int] = None,
    ) -> PDIListResponse:
        self._check_read_access(empleado_id, current_user)
        items = await self.repo.list_by_empleado(empleado_id, estado=estado, competencia_id=competencia_id)
        total = await self.repo.count_by_empleado(empleado_id, estado=estado, competencia_id=competencia_id)
        return PDIListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
        )

    async def crear(
        self,
        empleado_id: int,
        data: PDICreate,
        current_user: Empleado,
    ) -> PDIResponse:
        self._check_write_access(current_user)
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
            creado_por=current_user.empleado_id,
        )
        instance = await self.repo.create(instance)
        return self._to_response(instance)

    async def actualizar(
        self,
        empleado_id: int,
        pdi_id: int,
        data: PDIUpdate,
        current_user: Empleado,
    ) -> PDIResponse:
        self._check_write_access(current_user)
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("Acción PDI no encontrada")

        if item.estado in ("completado", "cancelado"):
            raise ForbiddenError("No se puede modificar una acción en estado terminal")

        if data.estado and data.estado != item.estado:
            allowed = VALID_TRANSITIONS.get(item.estado, set())
            if data.estado not in allowed:
                raise ForbiddenError(
                    f"Transición de '{item.estado}' a '{data.estado}' no permitida"
                )
            item.estado = data.estado

        if data.accion is not None:
            item.accion = data.accion
        if data.tipo is not None:
            item.tipo = data.tipo
        if data.duracion_horas is not None:
            item.duracion_horas = data.duracion_horas
        if data.fecha_inicio is not None:
            item.fecha_inicio = data.fecha_inicio
        if data.fecha_fin is not None:
            item.fecha_fin = data.fecha_fin
        if data.responsable is not None:
            item.responsable = data.responsable

        await self.db.flush()
        await self.db.refresh(item, attribute_names=["competencia"])
        return self._to_response(item)

    async def eliminar(
        self,
        empleado_id: int,
        pdi_id: int,
        current_user: Empleado,
    ) -> None:
        self._check_write_access(current_user)
        item = await self.repo.get(pdi_id)
        if not item or item.empleado_id != empleado_id:
            raise NotFoundError("Acción PDI no encontrada")
        await self.repo.delete(pdi_id)

    def _check_read_access(self, empleado_id: int, user: Empleado) -> None:
        if user_has_module(user, "evaluaciones"):
            return
        if hasattr(user, "rol") and user.rol and user.rol.nombre == "supervisor":
            return
        if user.empleado_id != empleado_id:
            raise ForbiddenError("No tienes acceso a este recurso")

    def _check_write_access(self, user: Empleado) -> None:
        if not user_has_module(user, "evaluaciones"):
            raise ForbiddenError("Solo RH puede gestionar el PDI")

    def _resolve_area_scope(self, current_user: Empleado) -> list[int] | None:
        if user_has_module(current_user, "evaluaciones"):
            return None
        if hasattr(current_user, "rol") and current_user.rol and current_user.rol.nombre in ("supervisor", "gerente"):
            if current_user.area_id:
                return [current_user.area_id]
            return []
        raise ForbiddenError("No tienes acceso a la gestión de PDI")

    async def listar_consolidado(
        self,
        current_user: Empleado,
        page: int = 1,
        page_size: int = 10,
        area_id: int | None = None,
        estado: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        search: str | None = None,
        solo_vencidas: bool = False,
    ) -> PDIGestionListResponse:
        area_ids = self._resolve_area_scope(current_user)
        offset = (page - 1) * page_size
        items, total = await self.repo.list_consolidated(
            offset=offset,
            limit=page_size,
            area_id=area_id,
            area_ids=area_ids,
            estado=estado,
            fecha_inicio_desde=fecha_inicio,
            fecha_fin_hasta=fecha_fin,
            search=search,
            solo_vencidas=solo_vencidas,
        )
        return PDIGestionListResponse(
            items=[self._to_gestion_item(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener_resumen(self, current_user: Empleado) -> PDIResumenResponse:
        area_ids = self._resolve_area_scope(current_user)
        data = await self.repo.resumen(area_ids=area_ids)
        return PDIResumenResponse(**data)

    def _to_gestion_item(self, item: PlanDesarrolloIndividual) -> PDIGestionItem:
        emp = item.empleado
        emp_nombre = emp.nombre if emp else "—"
        area_nombre = emp.area.descripcion if emp and emp.area else None
        puesto_nombre = None
        comp_nombre = item.competencia.nombre if item.competencia else "—"
        today = date.today()
        vencida = item.fecha_fin < today and item.estado not in ("completado", "cancelado")
        return PDIGestionItem(
            id=item.id,
            empleado_id=item.empleado_id,
            empleado_nombre=emp_nombre,
            area_nombre=area_nombre,
            puesto_nombre=puesto_nombre,
            competencia_id=item.competencia_id,
            competencia_nombre=comp_nombre,
            accion=item.accion,
            tipo=item.tipo,
            duracion_horas=item.duracion_horas,
            fecha_inicio=item.fecha_inicio,
            fecha_fin=item.fecha_fin,
            responsable=item.responsable,
            estado=item.estado,
            vencida=vencida,
            created_at=item.created_at.isoformat() if item.created_at else "",
            updated_at=item.updated_at.isoformat() if item.updated_at else "",
        )

    def _to_response(self, item: PlanDesarrolloIndividual) -> PDIResponse:
        comp_nombre = item.competencia.nombre if item.competencia else "—"
        return PDIResponse(
            id=item.id,
            empleado_id=item.empleado_id,
            competencia_id=item.competencia_id,
            competencia_nombre=comp_nombre,
            accion=item.accion,
            tipo=item.tipo,
            duracion_horas=item.duracion_horas,
            fecha_inicio=item.fecha_inicio,
            fecha_fin=item.fecha_fin,
            responsable=item.responsable,
            estado=item.estado,
            creado_por=item.creado_por,
            creado_por_nombre=None,
            created_at=item.created_at.isoformat() if item.created_at else "",
            updated_at=item.updated_at.isoformat() if item.updated_at else "",
        )
