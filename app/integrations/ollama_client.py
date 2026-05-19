# app/integrations/ollama_client.py
"""
Integración Ollama LLM — Plataforma RH Leoni Cable.

Propósito: generación automática de borradores de actas administrativas
usando el modelo LLM local configurado en OLLAMA_MODEL.

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

_FORMATO_ACTA_LEONI = """ACTA ADMINISTRATIVA

En la ciudad de Cuauhtémoc, Chihuahua, siendo las [HORA_INICIO] horas del día [FECHA_ACTA], reunidos en el local que ocupan las oficinas de LEONI CABLE, S.A. DE C.V., ubicado en Ave. Río Conchos No. 9700 del Parque Industrial Cuauhtémoc. Se reunieron el C. [REPRESENTANTE_LEGAL], representante legal de la empresa y quien ocupa el puesto de [PUESTO_REPRESENTANTE], y quien actúa con los C. [TESTIGO_1] y [TESTIGO_2], como testigos, quienes ocupan los puestos de [PUESTOS_TESTIGOS], se procedió a instrumentar la presente acta en contra del C. [NOMBRE_TRABAJADOR], quien tiene el puesto de [PUESTO_TRABAJADOR], con número de empleado [NUMERO_EMPLEADO].

HECHOS

Asimismo, se hace constar que el motivo de la presente acta es porque el C. [NOMBRE_TRABAJADOR], [DESCRIPCION_HECHOS]. Se aceptan los hechos como una violación al Reglamento Interior de Trabajo, Capítulo [CAPITULO_REGLAMENTO], Artículo(s) [ARTICULOS_REGLAMENTO].

En uso de la palabra y con relación a los hechos citados, el trabajador manifiesta de su puño y letra lo siguiente:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

En mérito de lo anterior, se procede a levantar la presente acta administrativa al C. [NOMBRE_TRABAJADOR], empleado de la moral LEONI CABLE, S.A. DE C.V., quien ocupa el puesto de [PUESTO_TRABAJADOR], quien se desempeña en horarios rotativos los cuales no exceden los máximos establecidos por la Ley Federal del Trabajo, con fundamento en el artículo 59 de esta Ley, con fecha de ingreso [FECHA_INGRESO].

Siendo las [HORA_CIERRE] hrs. del día [FECHA_CIERRE], el representante patronal da por concluida la presente ACTA ADMINISTRATIVA, remitiendo la misma al área de Recursos Humanos para los efectos legales conducentes.

Todos debidamente apercibidos de las consecuencias legales que contrae para los que declaran con falsedad, mismos quienes han oído y presenciado lo declarado por los comparecientes, lo cual se asentó en esta acta, la que se da por concluida, y firmando al margen y calce para constancia legal, los que en ella intervinieron y así quisieron hacerlo.

En caso de que el trabajador se niegue a firmar la presente acta y/o exponer por escrito lo que a su derecho convenga en el espacio proporcionado para tal efecto, se hace constar por los testigos lo siguiente:

Testigo 1 C. [TESTIGO_1] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

Testigo 2 C. [TESTIGO_2] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________"""

# ── Prompt system ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "Eres un asistente de Recursos Humanos especializado en documentos administrativos formales. "
    "Redactas actas administrativas con lenguaje claro, formal y jurídicamente apropiado para "
    "el contexto laboral mexicano. Respeta estrictamente Plantilla_Acta_Administrativa.docx: "
    "titulo ACTA ADMINISTRATIVA, parrafo inicial de comparecencia, HECHOS, manifestacion "
    "del trabajador con lineas, cierre, constancia por negativa y manifestaciones de testigos. "
    "No inventes datos faltantes; usa marcadores entre corchetes."
)

_USER_PROMPT_TEMPLATE = """Genera un acta administrativa siguiendo exactamente este orden de secciones:

{formato_acta}

Datos: {contexto_json}
Reglas:
- Responde SOLO con el texto del acta, sin explicaciones adicionales.
- Mantén saltos de línea y lineas de guiones bajos de la plantilla.
- Usa marcadores entre corchetes para datos faltantes.
- No agregues DECLARACIONES, DETERMINACIÓN, FIRMAS ni secciones ajenas a la plantilla.
- No cites capítulos o artículos del Reglamento si no están presentes en los datos o referencias proporcionadas."""


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
            formato_acta=_FORMATO_ACTA_LEONI,
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
        nombre = contexto.get("empleado_nombre") or "[NOMBRE_TRABAJADOR]"
        num = contexto.get("num_empleado") or "[NUMERO_EMPLEADO]"
        puesto = contexto.get("puesto") or "[PUESTO_TRABAJADOR]"
        fecha_inc = contexto.get("fecha_incidencia") or contexto.get("fecha") or "[FECHA]"
        descripcion = contexto.get("descripcion") or "[DESCRIPCION_HECHOS]"

        return f"""ACTA ADMINISTRATIVA

En la ciudad de Cuauhtémoc, Chihuahua, siendo las [HORA_INICIO] horas del día {fecha_inc}, reunidos en el local que ocupan las oficinas de LEONI CABLE, S.A. DE C.V., ubicado en Ave. Río Conchos No. 9700 del Parque Industrial Cuauhtémoc. Se reunieron el C. [REPRESENTANTE_LEGAL], representante legal de la empresa y quien ocupa el puesto de [PUESTO_REPRESENTANTE], y quien actúa con los C. [TESTIGO_1] y [TESTIGO_2], como testigos, quienes ocupan los puestos de [PUESTOS_TESTIGOS], se procedió a instrumentar la presente acta en contra del C. {nombre}, quien tiene el puesto de {puesto}, con número de empleado {num}.

HECHOS

Asimismo, se hace constar que el motivo de la presente acta es porque el C. {nombre}, {descripcion}. Se aceptan los hechos como una violación al Reglamento Interior de Trabajo, Capítulo [CAPITULO_REGLAMENTO], Artículo(s) [ARTICULOS_REGLAMENTO].

En uso de la palabra y con relación a los hechos citados, el trabajador manifiesta de su puño y letra lo siguiente:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

En mérito de lo anterior, se procede a levantar la presente acta administrativa al C. {nombre}, empleado de la moral LEONI CABLE, S.A. DE C.V., quien ocupa el puesto de {puesto}, quien se desempeña en horarios rotativos los cuales no exceden los máximos establecidos por la Ley Federal del Trabajo, con fundamento en el artículo 59 de esta Ley, con fecha de ingreso [FECHA_INGRESO].

Siendo las [HORA_CIERRE] hrs. del día {fecha_inc}, el representante patronal da por concluida la presente ACTA ADMINISTRATIVA, remitiendo la misma al área de Recursos Humanos para los efectos legales conducentes.

Todos debidamente apercibidos de las consecuencias legales que contrae para los que declaran con falsedad, mismos quienes han oído y presenciado lo declarado por los comparecientes, lo cual se asentó en esta acta, la que se da por concluida, y firmando al margen y calce para constancia legal, los que en ella intervinieron y así quisieron hacerlo.

En caso de que el trabajador se niegue a firmar la presente acta y/o exponer por escrito lo que a su derecho convenga en el espacio proporcionado para tal efecto, se hace constar por los testigos lo siguiente:

Testigo 1 C. [TESTIGO_1] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

Testigo 2 C. [TESTIGO_2] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________
"""


# ── Singleton ─────────────────────────────────────────────────────────────────

ollama_client = OllamaClient()
