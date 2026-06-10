from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Sequence

from app.agents.base.ollama_chat import OllamaChatClient, extract_json_object
from app.agents.base.types import AgentMessage, AgentRunResult, AgentToolTraceItem
from app.agents.incidencias.answer_format import format_tool_answer, is_valid_user_answer
from app.agents.incidencias.prompts import (
    REACT_USER_TEMPLATE,
    SYNTHESIS_SYSTEM_PROMPT,
    SYNTHESIS_USER_TEMPLATE,
    SYSTEM_PROMPT,
)
from app.agents.incidencias.query_planner import plan_query
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

    def _tools(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None,
        context_filters: dict[str, Any] | None,
        user_message: str,
    ) -> IncidenciasAgentTools:
        return IncidenciasAgentTools(
            self.svc,
            current_user,
            rh_ui_mode=rh_ui_mode,
            context_filters=context_filters,
            user_message=user_message,
        )

    def _answer_from_tool(
        self,
        tool: str,
        args: dict[str, Any],
        result: str,
        user_message: str,
    ) -> str | None:
        return format_tool_answer(tool, args, result, user_message=user_message)

    async def _try_synthesize(
        self,
        *,
        messages: Sequence[AgentMessage],
        user_message: str,
        tool: str,
        tool_args: dict[str, Any],
        tool_results: str,
        context_filters: dict[str, Any] | None,
    ) -> str | None:
        deterministic = self._answer_from_tool(tool, tool_args, tool_results, user_message)
        if deterministic:
            return deterministic

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
            return deterministic

        if str(action_data.get("action") or "").strip() == "final":
            answer = str(action_data.get("answer") or "").strip()
            if answer and is_valid_user_answer(answer):
                return answer
        return deterministic

    async def _execute_planned(
        self,
        *,
        planned_tool: str,
        planned_args: dict[str, Any],
        current_user: Empleado,
        rh_ui_mode: str | None,
        context_filters: dict[str, Any] | None,
        user_message: str,
    ) -> AgentRunResult:
        tools = self._tools(
            current_user,
            rh_ui_mode=rh_ui_mode,
            context_filters=context_filters,
            user_message=user_message,
        )
        result, ok = await tools.execute(planned_tool, planned_args)
        trace = [
            AgentToolTraceItem(
                tool=planned_tool,
                args=planned_args,
                result_preview=result[:240],
                ok=ok,
            )
        ]
        if not ok:
            return AgentRunResult(
                answer="No pude consultar los datos. Intenta de nuevo en unos segundos.",
                tool_trace=trace,
                model=self.ollama.model,
                rounds=1,
            )
        answer = self._answer_from_tool(planned_tool, planned_args, result, user_message)
        return AgentRunResult(
            answer=answer or "Consulta completada, pero no pude formatear la respuesta.",
            tool_trace=trace,
            model=self.ollama.model,
            rounds=1,
        )

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

        user_message = last.content.strip()
        planned = plan_query(user_message)
        if planned is not None:
            return await self._execute_planned(
                planned_tool=planned.tool,
                planned_args=planned.args,
                current_user=current_user,
                rh_ui_mode=rh_ui_mode,
                context_filters=context_filters,
                user_message=user_message,
            )

        tools = self._tools(
            current_user,
            rh_ui_mode=rh_ui_mode,
            context_filters=context_filters,
            user_message=user_message,
        )

        tool_trace: list[AgentToolTraceItem] = []
        tool_results_block = "(ninguno aún)"
        last_tool = ""
        last_args: dict[str, Any] = {}
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
                user_message=user_message,
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
                if last_successful_result and (
                    not answer or not is_valid_user_answer(answer)
                ):
                    answer = self._answer_from_tool(
                        last_tool, last_args, last_successful_result, user_message
                    ) or answer
                if not answer or not is_valid_user_answer(answer):
                    answer = (
                        "Necesito consultar los datos con una herramienta antes de responder. "
                        "Reformula tu pregunta, por ejemplo: "
                        "«¿Cuántas incidencias tiene el empleado 4652?»"
                    )
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
                last_tool = action
                last_args = args
                answer = await self._try_synthesize(
                    messages=messages,
                    user_message=user_message,
                    tool=action,
                    tool_args=args,
                    tool_results=result,
                    context_filters=context_filters,
                )
                if answer:
                    return AgentRunResult(
                        answer=answer,
                        tool_trace=tool_trace,
                        model=self.ollama.model,
                        rounds=rounds,
                    )

        if last_successful_result:
            answer = self._answer_from_tool(
                last_tool, last_args, last_successful_result, user_message
            )
            if answer:
                return AgentRunResult(
                    answer=answer,
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
