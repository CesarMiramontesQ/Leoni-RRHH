from __future__ import annotations

import logging
import re
from typing import Sequence

import httpx

from app.agents.base.types import AgentMessage
from app.core.config import settings

logger = logging.getLogger(__name__)

_THINK_BLOCK_RE = re.compile(
    r"<(?:think|thinking|redacted_reasoning|redacted_thinking)[^>]*>.*?</(?:think|thinking|redacted_reasoning|redacted_thinking)>",
    re.DOTALL | re.IGNORECASE,
)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def strip_model_think_artifacts(text: str) -> str:
    cleaned = _THINK_BLOCK_RE.sub("", text or "")
    return cleaned.strip()


def extract_json_object(text: str) -> str:
    """Extrae el primer objeto JSON de la salida del modelo."""
    raw = strip_model_think_artifacts(text)
    fence = _JSON_FENCE_RE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        return raw[start : end + 1]
    return raw


class OllamaChatClient:
    """Cliente mínimo para /api/chat con opciones por agente vertical."""

    def __init__(
        self,
        *,
        model: str | None = None,
        temperature: float | None = None,
        num_predict: int | None = None,
        num_ctx: int | None = None,
        timeout: float | None = None,
    ) -> None:
        self.model = model or settings.OLLAMA_INCIDENCIAS_MODEL
        self.temperature = (
            settings.OLLAMA_INCIDENCIAS_TEMPERATURE if temperature is None else temperature
        )
        self.num_predict = (
            settings.OLLAMA_INCIDENCIAS_NUM_PREDICT if num_predict is None else num_predict
        )
        self.num_ctx = settings.OLLAMA_INCIDENCIAS_NUM_CTX if num_ctx is None else num_ctx
        self.timeout = settings.OLLAMA_HTTP_TIMEOUT if timeout is None else timeout
        self.base_url = settings.OLLAMA_URL.rstrip("/")

    async def diagnose(self) -> tuple[bool, str]:
        """Comprueba reachability de Ollama y presencia del modelo configurado."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    return False, (
                        f"Ollama respondió HTTP {resp.status_code} en {self.base_url}. "
                        "Verifica que el servicio esté activo."
                    )
        except Exception as exc:
            hint = ""
            if "localhost" in self.base_url or "127.0.0.1" in self.base_url:
                hint = (
                    " Desde Docker el backend no alcanza 127.0.0.1 del host; "
                    "usa OLLAMA_URL=http://host.docker.internal:11434 en .env y reinicia el backend."
                )
            return False, f"No se pudo conectar a Ollama en {self.base_url}: {exc}.{hint}"

        try:
            models = resp.json().get("models") or []
            names = {m.get("name", "") for m in models}
            prefix = self.model.split(":")[0]
            if any(n == self.model or n.startswith(f"{prefix}:") for n in names):
                return True, "ok"
            installed = ", ".join(sorted(n for n in names if n)) or "(ninguno)"
            return False, (
                f"Ollama está activo pero falta el modelo '{self.model}'. "
                f"Ejecuta: ollama pull {self.model}. Instalados: {installed}"
            )
        except Exception as exc:
            return False, f"Respuesta inválida de Ollama en {self.base_url}: {exc}"

    async def health_check(self) -> bool:
        ok, _ = await self.diagnose()
        return ok

    async def chat(self, messages: Sequence[AgentMessage]) -> str:
        opts: dict = {
            "temperature": max(0.0, min(float(self.temperature), 1.0)),
            "num_predict": self.num_predict,
        }
        if self.num_ctx >= 2048:
            opts["num_ctx"] = self.num_ctx

        payload: dict = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "options": opts,
        }
        model_lower = self.model.lower()
        if "qwen" in model_lower or "nemotron" in model_lower:
            payload["think"] = False

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            if resp.status_code != 200:
                logger.warning(
                    "Ollama /api/chat HTTP %s — %s",
                    resp.status_code,
                    (resp.text or "")[:500],
                )
                resp.raise_for_status()
            data = resp.json()
            msg = data.get("message") or {}
            content = strip_model_think_artifacts(str(msg.get("content") or ""))
            if content:
                return content
            return strip_model_think_artifacts(str(data.get("response") or ""))
