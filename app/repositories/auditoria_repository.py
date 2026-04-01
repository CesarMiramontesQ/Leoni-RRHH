# app/repositories/auditoria_repository.py
"""
Repositorio de AuditLog — solo lectura.
Las escrituras se realizan exclusivamente via audit_logger.py.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auditoria import AuditLog
from app.repositories.base import BaseRepository


class AuditoriaRepository(BaseRepository[AuditLog]):
    def __init__(self, db: AsyncSession):
        super().__init__(AuditLog, db)

    async def list_logs(
        self,
        cursor: int | None,
        limit: int,
        filtros: dict | None = None,
    ) -> tuple[list[AuditLog], int | None]:
        conditions: list = []

        if filtros:
            if filtros.get("modulo"):
                conditions.append(AuditLog.modulo == filtros["modulo"])
            if filtros.get("usuario_id"):
                conditions.append(AuditLog.usuario_id == filtros["usuario_id"])
            if filtros.get("accion"):
                conditions.append(AuditLog.accion == filtros["accion"])
            if filtros.get("fecha_desde"):
                fecha_desde: datetime = filtros["fecha_desde"]
                conditions.append(AuditLog.timestamp >= fecha_desde)
            if filtros.get("fecha_hasta"):
                fecha_hasta: datetime = filtros["fecha_hasta"]
                conditions.append(AuditLog.timestamp <= fecha_hasta)

        query = select(AuditLog)
        for cond in conditions:
            query = query.where(cond)

        if cursor is not None:
            query = query.where(AuditLog.id > cursor)

        query = query.order_by(AuditLog.id).limit(limit + 1)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            next_cursor = items[-1].id

        return items, next_cursor
