from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AgentChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("content no puede estar vacío")
        return s


class IncidenciaAgentContextFilters(BaseModel):
    model_config = {"extra": "ignore"}

    tipo: str | None = None
    area: str | None = None
    subarea: str | None = None
    no_empleado: str | None = None
    nombre: str | None = None
    empleado_id: int | None = None
    categoria: str | None = None
    fecha: date | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    tendencia_agrupacion: Literal["dia", "semana", "mes"] | None = None


class IncidenciaAgentChatRequest(BaseModel):
    messages: list[AgentChatMessage] = Field(min_length=1, max_length=40)
    context_filters: IncidenciaAgentContextFilters | None = None


class AgentToolTraceItemSchema(BaseModel):
    tool: str
    args: dict
    result_preview: str
    ok: bool = True


class IncidenciaAgentChatResponse(BaseModel):
    message: AgentChatMessage
    tool_trace: list[AgentToolTraceItemSchema] | None = None
    model: str
    ollama_available: bool = True
