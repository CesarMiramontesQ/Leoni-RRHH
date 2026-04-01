# app/services/auditoria_service.py
"""
Servicio de auditoria — solo lectura.
Las escrituras ocurren exclusivamente via audit_logger.py.
"""

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.repositories.auditoria_repository import AuditoriaRepository
from app.schemas import PaginatedResponse
from app.schemas.auditoria import AuditLogResponse

logger = logging.getLogger(__name__)


class AuditoriaService:
    def __init__(self, db: AsyncSession):
        self.repo = AuditoriaRepository(db)

    def _get_rol(self, user: Empleado) -> str:
        return user.rol.nombre if user.rol else ""

    async def list_logs(
        self,
        current_user: Empleado,
        cursor: int | None,
        limit: int,
        modulo: str | None = None,
        usuario_id: int | None = None,
        accion: str | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ) -> PaginatedResponse[AuditLogResponse]:
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar logs de auditoria")

        filtros: dict = {}
        if modulo:
            filtros["modulo"] = modulo
        if usuario_id:
            filtros["usuario_id"] = usuario_id
        if accion:
            filtros["accion"] = accion
        if fecha_desde:
            filtros["fecha_desde"] = fecha_desde
        if fecha_hasta:
            filtros["fecha_hasta"] = fecha_hasta

        items, next_cursor = await self.repo.list_logs(
            cursor=cursor,
            limit=limit,
            filtros=filtros if filtros else None,
        )
        return PaginatedResponse(
            items=[AuditLogResponse.model_validate(log) for log in items],
            next_cursor=next_cursor,
            total=len(items),
        )

    async def get_log(
        self,
        log_id: int,
        current_user: Empleado,
    ) -> AuditLogResponse:
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar logs de auditoria")

        log = await self.repo.get(log_id)
        if not log:
            raise NotFoundError(entidad="AuditLog", id=log_id)
        return AuditLogResponse.model_validate(log)
