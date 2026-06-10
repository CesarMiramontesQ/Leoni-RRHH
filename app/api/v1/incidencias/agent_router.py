from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.incidencias_agent import IncidenciaAgentChatRequest, IncidenciaAgentChatResponse
from app.services.incidencia_agent_service import IncidenciaAgentService

router = APIRouter(prefix="/agent", tags=["Incidencias — Agente IA"])


def _svc(db: AsyncSession = Depends(get_db)) -> IncidenciaAgentService:
    return IncidenciaAgentService(db)


@router.post("/chat", response_model=IncidenciaAgentChatResponse)
async def incidencias_agent_chat(
    body: IncidenciaAgentChatRequest,
    current_user: Empleado = Depends(
        role_checker(["rh", "gerente", "supervisor", "director"])
    ),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: IncidenciaAgentService = Depends(_svc),
):
    """Asistente conversacional de solo lectura sobre incidencias (Ollama local)."""
    return await svc.chat(current_user, body, rh_ui_mode=rh_ui_mode)
