# app/integrations/ollama_client.py
"""
Integración Ollama LLM — Plataforma RH Leoni Cable.

Propósito: generación automática de borradores de actas administrativas
usando el modelo LLM local (llama3 por defecto).

Principios de diseño:
  - NON-BLOCKING: Ollama NUNCA bloquea decisiones de negocio
  - Fallback silencioso: si Ollama falla → plantilla manual con campos [COMPLETAR]
  - Cola interna asyncio.Queue: máximo 1 generación concurrente
  - Timeout 60s: la generación puede ser lenta en hardware local
  - Circuit breaker suave: tras 3 fallos consecutivos, espera 60s antes de reintentar
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Plantilla de fallback ─────────────────────────────────────────────────────

_FALLBACK_TEMPLATE = """ACTA ADMINISTRATIVA No. [COMPLETAR]
Fecha: [COMPLETAR]

ANTECEDENTES:
Empleado: [COMPLETAR]
No. Empleado: [COMPLETAR]
Departamento: [COMPLETAR]
Puesto: [COMPLETAR]

HECHOS:
Tipo de Incidencia: [COMPLETAR]
Fecha de la Incidencia: [COMPLETAR]

Descripción de los hechos:
[COMPLETAR - Describir detalladamente los hechos ocurridos]

Evidencias:
[COMPLETAR - Listar documentos y evidencias adjuntas]

MEDIDA DISCIPLINARIA:
[COMPLETAR - Especificar la medida disciplinaria aplicada según reglamento interno]

FIRMAS:

_______________________          _______________________
Empleado                         Supervisor Inmediato
Nombre: [COMPLETAR]              Nombre: [COMPLETAR]
Fecha:                           Fecha:

_______________________          _______________________
Gerente de Área                  Director
Nombre: [COMPLETAR]              Nombre: [COMPLETAR]
Fecha:                           Fecha:

_______________________
Recursos Humanos
Nombre: [COMPLETAR]
Fecha:
"""

# ── Prompt system ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "Eres un asistente de Recursos Humanos especializado en documentos administrativos formales. "
    "Redactas actas administrativas con lenguaje claro, formal y jurídicamente apropiado para "
    "el contexto laboral mexicano."
)

_USER_PROMPT_TEMPLATE = """Genera un acta administrativa con la siguiente estructura:

ACTA ADMINISTRATIVA No. [NUMERO]
Fecha: [FECHA]

ANTECEDENTES:
[Datos del empleado y contexto]

HECHOS:
[Descripción detallada de la incidencia]

MEDIDA DISCIPLINARIA:
[Consecuencias según reglamento interno]

FIRMAS:
[Espacios para firma del empleado, supervisor, gerente, director y RH]

Datos: {contexto_json}
Responde SOLO con el texto del acta, sin explicaciones adicionales."""


# ── OllamaClient ─────────────────────────────────────────────────────────────

class OllamaClient:
    """
    Cliente HTTP para Ollama LLM corriendo en localhost.
    Temperatura 0.3 — documentos legales/formales.

    Thread-safety: usar el singleton `ollama_client` en lugar de instanciar directamente.
    """

    _CIRCUIT_BREAKER_THRESHOLD = 3      # fallos consecutivos antes de abrir circuito
    _CIRCUIT_BREAKER_RESET_SECS = 60    # segundos antes de cerrar circuito y reintentar

    def __init__(self) -> None:
        # Cola interna: garantiza máximo 1 generación simultánea
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=1)
        self._semaphore = asyncio.Semaphore(1)

        # Circuit breaker suave
        self._fallos_consecutivos: int = 0
        self._circuito_abierto_desde: datetime | None = None

    # ── Public API ────────────────────────────────────────────────────────────

    async def generar_acta(self, contexto: dict) -> str:
        """
        Genera borrador de acta administrativa.

        contexto = {
            "empleado_nombre": str,
            "num_empleado": str,
            "departamento": str,
            "tipo_incidencia": str,
            "fecha_incidencia": str,
            "descripcion": str,
            "evidencias": list[str],  # nombres de archivos
        }

        Retorna: texto del borrador estructurado.
        Fallback si Ollama no responde: retorna borrador con campos [COMPLETAR].
        """
        if self._circuito_abierto():
            logger.warning(
                "OLLAMA | event=CIRCUIT_OPEN | accion=fallback_manual | "
                "fallos_consecutivos=%d",
                self._fallos_consecutivos,
            )
            return self._fallback_con_datos(contexto)

        async with self._semaphore:
            return await self._generar_con_fallback(contexto)

    async def health_check(self) -> bool:
        """Verifica si Ollama está disponible. Timeout: 2s."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
                disponible = resp.status_code == 200
                logger.debug("OLLAMA | event=HEALTH_CHECK | disponible=%s", disponible)
                return disponible
        except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
            logger.debug("OLLAMA | event=HEALTH_CHECK_FAIL | error=%s", str(exc))
            return False

    # ── Internals ─────────────────────────────────────────────────────────────

    def _circuito_abierto(self) -> bool:
        """Verifica estado del circuit breaker suave."""
        if self._fallos_consecutivos < self._CIRCUIT_BREAKER_THRESHOLD:
            return False
        if self._circuito_abierto_desde is None:
            return False

        segundos_transcurridos = (
            datetime.now(timezone.utc) - self._circuito_abierto_desde
        ).total_seconds()

        if segundos_transcurridos >= self._CIRCUIT_BREAKER_RESET_SECS:
            # Reset del circuito — intentar de nuevo
            logger.info(
                "OLLAMA | event=CIRCUIT_RESET | intentando_reconexion=true"
            )
            self._fallos_consecutivos = 0
            self._circuito_abierto_desde = None
            return False

        return True

    async def _generar_con_fallback(self, contexto: dict) -> str:
        """Intenta generación con Ollama; retorna fallback si falla."""
        try:
            texto = await self._llamar_ollama(contexto)
            # Éxito — reset contador de fallos
            self._fallos_consecutivos = 0
            self._circuito_abierto_desde = None
            return texto
        except Exception as exc:
            self._fallos_consecutivos += 1
            if self._fallos_consecutivos >= self._CIRCUIT_BREAKER_THRESHOLD:
                self._circuito_abierto_desde = datetime.now(timezone.utc)

            logger.warning(
                "OLLAMA | event=GENERACION_FAILED | error=%s | tipo=%s | "
                "fallos_consecutivos=%d | accion=fallback_manual",
                str(exc),
                type(exc).__name__,
                self._fallos_consecutivos,
            )
            return self._fallback_con_datos(contexto)

    async def _llamar_ollama(self, contexto: dict) -> str:
        """
        Realiza la llamada HTTP a Ollama /api/generate.
        Timeout: 60 segundos (generación LLM puede ser lenta).
        """
        prompt = _USER_PROMPT_TEMPLATE.format(
            contexto_json=json.dumps(contexto, ensure_ascii=False, indent=2)
        )

        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "system": _SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": settings.OLLAMA_TEMPERATURE,
                "num_predict": 2048,
            },
        }

        logger.info(
            "OLLAMA | event=GENERACION_START | model=%s | num_empleado=%s",
            settings.OLLAMA_MODEL,
            contexto.get("num_empleado", "?"),
        )
        inicio = datetime.now(timezone.utc)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()

        duracion_ms = int(
            (datetime.now(timezone.utc) - inicio).total_seconds() * 1000
        )

        data = resp.json()
        texto = data.get("response", "").strip()

        if not texto:
            raise ValueError("Ollama retornó respuesta vacía")

        logger.info(
            "OLLAMA | event=GENERACION_OK | duracion_ms=%d | chars=%d",
            duracion_ms,
            len(texto),
        )
        return texto

    def _fallback_con_datos(self, contexto: dict) -> str:
        """
        Genera una plantilla pre-llenada con los datos disponibles
        para que RH pueda completarla manualmente.
        """
        hoy = datetime.now().strftime("%d/%m/%Y")
        nombre = contexto.get("empleado_nombre", "[COMPLETAR]")
        num = contexto.get("num_empleado", "[COMPLETAR]")
        depto = contexto.get("departamento", "[COMPLETAR]")
        tipo = contexto.get("tipo_incidencia", "[COMPLETAR]")
        fecha_inc = contexto.get("fecha_incidencia", "[COMPLETAR]")
        descripcion = contexto.get("descripcion", "[COMPLETAR]")
        evidencias = contexto.get("evidencias", [])
        evidencias_str = (
            "\n".join(f"  - {e}" for e in evidencias)
            if evidencias
            else "  [COMPLETAR - Listar evidencias]"
        )

        return f"""ACTA ADMINISTRATIVA No. [COMPLETAR]
Fecha: {hoy}

ANTECEDENTES:
Empleado: {nombre}
No. Empleado: {num}
Departamento: {depto}
Puesto: {contexto.get('puesto', '[COMPLETAR]')}

HECHOS:
Tipo de Incidencia: {tipo}
Fecha de la Incidencia: {fecha_inc}

Descripción de los hechos:
{descripcion}

Evidencias:
{evidencias_str}

MEDIDA DISCIPLINARIA:
[COMPLETAR - Especificar la medida disciplinaria aplicada según reglamento interno]

FIRMAS:

_______________________          _______________________
Empleado                         Supervisor Inmediato
Nombre: {nombre}                 Nombre: [COMPLETAR]
Fecha:                           Fecha:

_______________________          _______________________
Gerente de Área                  Director
Nombre: [COMPLETAR]              Nombre: [COMPLETAR]
Fecha:                           Fecha:

_______________________
Recursos Humanos
Nombre: [COMPLETAR]
Fecha:

---
NOTA: Este borrador fue generado automáticamente con datos del sistema.
El contenido marcado con [COMPLETAR] debe ser revisado y completado por RH.
"""


# ── Singleton ─────────────────────────────────────────────────────────────────

ollama_client = OllamaClient()
