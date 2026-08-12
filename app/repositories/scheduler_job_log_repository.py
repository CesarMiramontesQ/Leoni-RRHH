"""Lecturas del historial de corridas de los jobs."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduler_job_log import SchedulerJobLog


class SchedulerJobLogRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _filtrado(self, stmt, *, job_id, resultado, desde, hasta):
        if job_id:
            stmt = stmt.where(SchedulerJobLog.job_id == job_id)
        if resultado:
            stmt = stmt.where(SchedulerJobLog.resultado == resultado)
        if desde:
            stmt = stmt.where(SchedulerJobLog.inicio_at >= desde)
        if hasta:
            stmt = stmt.where(SchedulerJobLog.inicio_at <= hasta)
        return stmt

    async def listar(
        self,
        *,
        job_id: str | None = None,
        resultado: str | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SchedulerJobLog], int]:
        filtros = {
            "job_id": job_id,
            "resultado": resultado,
            "desde": desde,
            "hasta": hasta,
        }
        total = await self.db.scalar(
            self._filtrado(
                select(func.count()).select_from(SchedulerJobLog), **filtros
            )
        )
        stmt = self._filtrado(select(SchedulerJobLog), **filtros)
        stmt = (
            stmt.order_by(SchedulerJobLog.inicio_at.desc(), SchedulerJobLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = (await self.db.execute(stmt)).scalars().all()
        return list(items), int(total or 0)

    async def obtener(self, log_id: int) -> SchedulerJobLog | None:
        return await self.db.get(SchedulerJobLog, log_id)
