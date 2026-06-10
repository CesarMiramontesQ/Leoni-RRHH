from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base.types import AgentMessage
from app.agents.incidencias.agent import IncidenciasAgent
from app.models.empleados import Empleado
from app.schemas.incidencias_agent import (
    AgentChatMessage,
    AgentToolTraceItemSchema,
    IncidenciaAgentChatRequest,
    IncidenciaAgentChatResponse,
    IncidenciaAgentContextFilters,
)
from app.services.incidencia_service import IncidenciaService


class IncidenciaAgentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.incidencia_svc = IncidenciaService(db)
        self.agent = IncidenciasAgent(self.incidencia_svc)

    @staticmethod
    def _context_to_dict(filters: IncidenciaAgentContextFilters | None) -> dict | None:
        if filters is None:
            return None
        return filters.model_dump(exclude_none=True)

    async def chat(
        self,
        current_user: Empleado,
        body: IncidenciaAgentChatRequest,
        *,
        rh_ui_mode: str | None = None,
    ) -> IncidenciaAgentChatResponse:
        agent_messages = [
            AgentMessage(role=m.role, content=m.content) for m in body.messages
        ]
        result = await self.agent.run(
            current_user=current_user,
            messages=agent_messages,
            rh_ui_mode=rh_ui_mode,
            context_filters=self._context_to_dict(body.context_filters),
        )
        trace = [
            AgentToolTraceItemSchema(
                tool=t.tool,
                args=t.args,
                result_preview=t.result_preview,
                ok=t.ok,
            )
            for t in result.tool_trace
        ] or None
        return IncidenciaAgentChatResponse(
            message=AgentChatMessage(role="assistant", content=result.answer),
            tool_trace=trace,
            model=result.model,
            ollama_available=True,
        )
