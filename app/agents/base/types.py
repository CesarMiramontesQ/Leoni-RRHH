from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


AgentRole = Literal["user", "assistant", "system"]


@dataclass
class AgentMessage:
    role: AgentRole
    content: str


@dataclass
class AgentToolTraceItem:
    tool: str
    args: dict[str, Any]
    result_preview: str
    ok: bool = True


@dataclass
class AgentRunResult:
    answer: str
    tool_trace: list[AgentToolTraceItem] = field(default_factory=list)
    model: str = ""
    rounds: int = 0
