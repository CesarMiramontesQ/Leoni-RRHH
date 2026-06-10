from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Sequence

from app.agents.base.ollama_chat import OllamaChatClient, extract_json_object
from app.agents.base.types import AgentMessage, AgentRunResult, AgentToolTraceItem
from app.agents.incidencias.prompts import (
    REACT_USER_TEMPLATE,
    SYNTHESIS_SYSTEM_PROMPT,
    SYNTHESIS_USER_TEMPLATE,
    SYSTEM_PROMPT,
)
from app.agents.incidencias.tools import ALLOWED_TOOLS, IncidenciasAgentTools
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError
from app.models.empleados import Empleado
from app.services.incidencia_service import IncidenciaService

logger = logging.getLogger(__name__)


def _format_history(messages: Sequence[AgentMessage]) -> str:
    if not messages:
        return "(sin historial previo)"
    lines: list[str] = []
    for m in messages[:-1]:
        role = "Usuario" if m.role == "user" else "Asistente"
        lines.append(f"{role}: {m.content.strip()}")
    return "\n".join(lines) if lines else "(sin historial previo)"


def _fallback_answer_from_tool_json(tool_results: str) -> str | None:
    """Respuesta mínima si el modelo no devuelve JSON final."""
    try:
        data = json.loads(tool_results)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    if "total_incidencias" in data:
        total = data["total_incidencias"]
        return f"Hay {total} incidencia(s) en el período consultado."
    if "total" in data and "items" in data:
        return f"Encontré {data['total']} incidencia(s); mostrando {len(data.get('items') or [])} en esta página."
    if "items" in data and isinstance(data["items"], list) and data["items"]:
        preview = ", ".join(str(x) for x in data["items"][:5])
        return f"Datos disponibles: {preview}."
    return None


def _parse_agent_action(raw: str) -> dict[str, Any]:
    blob = extract_json_object(raw)
    data = json.loads(blob)
    if not isinstance(data, dict):
        raise ValueError("La respuesta del modelo no es un objeto JSON")
    action = str(data.get("action") or "").strip()
    if not action:
        raise ValueError("Falta campo action en JSON")
    return data


class IncidenciasAgent:
    def __init__(self, svc: IncidenciaService) -> None:
        self.svc = svc
        self.ollama = OllamaChatClient()

    def _system_prompt(self) -> str:
        return SYSTEM_PROMPT.replace("{today}", date.today().isoformat())

    async def _try_synthesize(
        self,
        *,
        messages: Sequence[AgentMessage],
        user_message: str,
        tool_results: str,
        context_filters: dict[str, Any] | None,
    ) -> str | None:
        prompt = SYNTHESIS_USER_TEMPLATE.format(
            history=_format_history(messages),
            context_filters=json.dumps(context_filters or {}, ensure_ascii=False),
            user_message=user_message.strip(),
            tool_results=tool_results,
        )
        llm_messages = [
            AgentMessage(role="system", content=SYNTHESIS_SYSTEM_PROMPT),
            AgentMessage(role="user", content=prompt),
        ]
        raw = await self.ollama.chat(llm_messages)
        try:
            action_data = _parse_agent_action(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Synthesis JSON parse error: %s — raw=%s", exc, raw[:300])
            return _fallback_answer_from_tool_json(tool_results)

        if str(action_data.get("action") or "").strip() == "final":
            answer = str(action_data.get("answer") or "").strip()
            if answer:
                return answer
        return _fallback_answer_from_tool_json(tool_results)

    async def run(
        self,
        *,
        current_user: Empleado,
        messages: Sequence[AgentMessage],
        rh_ui_mode: str | None = None,
        context_filters: dict[str, Any] | None = None,
    ) -> AgentRunResult:
        if not messages:
            raise ValueError("Se requiere al menos un mensaje")
        last = messages[-1]
        if last.role != "user":
            raise ValueError("El último mensaje debe ser del usuario")

        if not await self.ollama.health_check():
            _, detail = await self.ollama.diagnose()
            raise ServiceUnavailableError(detail=detail)

        tools = IncidenciasAgentTools(
            self.svc,
            current_user,
            rh_ui_mode=rh_ui_mode,
            context_filters=context_filters,
        )

        tool_trace: list[AgentToolTraceItem] = []
        tool_results_block = "(ninguno aún)"
        last_successful_result: str | None = None
        rounds = 0
        max_rounds = settings.OLLAMA_INCIDENCIAS_MAX_TOOL_ROUNDS
        system_prompt = self._system_prompt()

        while rounds < max_rounds:
            rounds += 1
            user_prompt = REACT_USER_TEMPLATE.format(
                history=_format_history(messages),
                context_filters=json.dumps(context_filters or {}, ensure_ascii=False),
                tool_results=tool_results_block,
                user_message=last.content.strip(),
            )
            llm_messages = [
                AgentMessage(role="system", content=system_prompt),
                AgentMessage(role="user", content=user_prompt),
            ]
            raw = await self.ollama.chat(llm_messages)

            try:
                action_data = _parse_agent_action(raw)
            except (json.JSONDecodeError, ValueError) as exc:
                logger.warning("Agent JSON parse error: %s — raw=%s", exc, raw[:300])
                return AgentRunResult(
                    answer=(
                        "No pude interpretar la respuesta del modelo. "
                        "Intenta reformular tu pregunta sobre incidencias."
                    ),
                    tool_trace=tool_trace,
                    model=self.ollama.model,
                    rounds=rounds,
                )

            action = str(action_data.get("action") or "").strip()
            if action == "final":
                answer = str(action_data.get("answer") or "").strip()
                if not answer:
                    answer = "No tengo una respuesta concreta con los datos disponibles."
                return AgentRunResult(
                    answer=answer,
                    tool_trace=tool_trace,
                    model=self.ollama.model,
                    rounds=rounds,
                )

            if action not in ALLOWED_TOOLS:
                tool_trace.append(
                    AgentToolTraceItem(
                        tool=action,
                        args=action_data.get("args") if isinstance(action_data.get("args"), dict) else {},
                        result_preview="herramienta no permitida",
                        ok=False,
                    )
                )
                tool_results_block = json.dumps(
                    {"error": f"Herramienta '{action}' no permitida. Usa solo las del catálogo."},
                    ensure_ascii=False,
                )
                continue

            args = action_data.get("args") if isinstance(action_data.get("args"), dict) else {}
            result, ok = await tools.execute(action, args)
            tool_trace.append(
                AgentToolTraceItem(
                    tool=action,
                    args=args,
                    result_preview=result[:240],
                    ok=ok,
                )
            )
            tool_results_block = result
            if ok:
                last_successful_result = result
                synthesized = await self._try_synthesize(
                    messages=messages,
                    user_message=last.content,
                    tool_results=result,
                    context_filters=context_filters,
                )
                if synthesized:
                    return AgentRunResult(
                        answer=synthesized,
                        tool_trace=tool_trace,
                        model=self.ollama.model,
                        rounds=rounds,
                    )

        if last_successful_result:
            synthesized = await self._try_synthesize(
                messages=messages,
                user_message=last.content,
                tool_results=last_successful_result,
                context_filters=context_filters,
            )
            if synthesized:
                return AgentRunResult(
                    answer=synthesized,
                    tool_trace=tool_trace,
                    model=self.ollama.model,
                    rounds=rounds,
                )
            fallback = _fallback_answer_from_tool_json(last_successful_result)
            if fallback:
                return AgentRunResult(
                    answer=fallback,
                    tool_trace=tool_trace,
                    model=self.ollama.model,
                    rounds=rounds,
                )

        return AgentRunResult(
            answer=(
                "Consulté varias fuentes pero no alcancé a sintetizar una respuesta final. "
                "Prueba una pregunta más específica (por ejemplo: total del mes en un área)."
            ),
            tool_trace=tool_trace,
            model=self.ollama.model,
            rounds=rounds,
        )
