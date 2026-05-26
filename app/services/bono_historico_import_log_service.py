"""Consulta del historial de importaciones bono histórico."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bono_historico_import_log import BonoHistoricoImportLog
from app.schemas.bono_historico_import_log import (
    BonoHistoricoImportLogItem,
    BonoHistoricoImportLogListResponse,
    FuenteBonoHistoricoSchema,
)


class BonoHistoricoImportLogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def listar(
        self,
        *,
        fuente: FuenteBonoHistoricoSchema | None = None,
        corrida_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> BonoHistoricoImportLogListResponse:
        base = select(BonoHistoricoImportLog)
        count_q = select(func.count()).select_from(BonoHistoricoImportLog)

        if fuente:
            base = base.where(BonoHistoricoImportLog.fuente == fuente)
            count_q = count_q.where(BonoHistoricoImportLog.fuente == fuente)
        if corrida_id:
            base = base.where(BonoHistoricoImportLog.corrida_id == corrida_id)
            count_q = count_q.where(BonoHistoricoImportLog.corrida_id == corrida_id)
        if status:
            base = base.where(BonoHistoricoImportLog.status == status)
            count_q = count_q.where(BonoHistoricoImportLog.status == status)

        total = int((await self.db.execute(count_q)).scalar_one())
        result = await self.db.execute(
            base.order_by(BonoHistoricoImportLog.started_at.desc()).limit(limit).offset(offset)
        )
        rows = list(result.scalars().all())
        return BonoHistoricoImportLogListResponse(
            items=[BonoHistoricoImportLogItem.model_validate(r) for r in rows],
            total=total,
            limit=limit,
            offset=offset,
        )
