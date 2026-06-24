# app/services/acta_service.py
"""
Logica de negocio del dominio actas administrativas.

Flujo de estados:
  DRAFT → (edicion) → PENDING_SIGN → SIGNED → ARCHIVED

Al firmar con los 3 roles requeridos (gerente, director, rh) → estado SIGNED.
Se encola la generacion del PDF en TRESS una vez firmado.
Stub de Ollama para generacion de contenido de acta.
"""

import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.core.rh_module_registry import user_has_module
from app.integrations.tress.queue import encolar_tress
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.empleados import Empleado
from app.repositories.acta_repository import ActaAprobacionRepository, ActaRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.acta_rag_prompts import (
    FORMATO_ACTA_ADMINISTRATIVA_LEONI,
    SYSTEM_GENERAR_ACTA_FORMAL,
    SYSTEM_RECOMENDACION_LEGAL_IA,
    USER_GENERAR_ACTA_TEMPLATE,
    USER_RECOMENDACION_LEGAL_IA_TEMPLATE,
)
from app.services.legal_rag_service import legal_rag_service
from app.schemas import PaginatedResponse
from app.schemas.actas import (
    ActaAnularRequest,
    ActaAprobacionResponse,
    ActaCreateRequest,
    ActaEditarRequest,
    ActaFirmarRequest,
    ActaGenerarRequest,
    ActasDashboardMetricasResponse,
    ActaResponse,
    ActasPageResponse,
)
from app.utils.audit_logger import audit_background, log_action

logger = logging.getLogger(__name__)

# Tags de razonamiento que algunos modelos (p. ej. Qwen3) usan y deben excluirse del texto final.
_THINK_BLOCK_RE = re.compile(
    r"<(?:think|thinking|redacted_reasoning|redacted_thinking)[^>]*>.*?</(?:think|thinking|redacted_reasoning|redacted_thinking)>",
    re.DOTALL | re.IGNORECASE,
)

# Salida visible tipo “cadena de pensamiento” en inglés (Qwen u otros sin suppression completa).
_REASONING_LEAK_START_RE = re.compile(
    r"(?is)^\s*("
    r"okay\b|"
    r"let'?s\b|"
    r"wait\b|"
    r"hmm\b|"
    r"alternatively\b|"
    r"first\b|"
    r"i need to\b|"
    r"the user wants\b|"
    r"the user is\b|"
    r"i should\b|"
    r"i have to\b"
    r")",
)

_ARTICLE_CITATION_RE = re.compile(
    r"\b(?:art[íi]?culo|art\.?)\s*(\d{1,4})(?:\s*(bis|ter|qu[aá]ter))?\b",
    re.IGNORECASE,
)

_ACTA_START_MARKER = "<<<ACTA>>>"
_ACTA_END_MARKER = "<<<FIN>>>"

_ACTA_FORMAT_REQUIRED_ANCHORS = (
    "ACTA ADMINISTRATIVA",
    "En la ciudad de Cuauhtémoc, Chihuahua",
    "LEONI CABLE, S.A. DE C.V.",
    "HECHOS",
    "En uso de la palabra y con relación a los hechos citados",
    "En mérito de lo anterior",
    "Siendo las",
    "Todos debidamente apercibidos",
    "En caso de que el trabajador se niegue a firmar",
    "Testigo 1 C.",
    "Testigo 2 C.",
)


def _dato_o_marcador(value: object, marker: str) -> str:
    text = str(value or "").strip()
    return text if text else marker


def _fecha_larga_o_marcador(value: object, marker: str = "[FECHA]") -> str:
    if not value:
        return marker
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    raw = str(value).strip()
    if not raw:
        return marker
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return raw


def _validar_formato_acta_leoni(text: str) -> list[str]:
    normalized = (text or "").upper()
    return [anchor for anchor in _ACTA_FORMAT_REQUIRED_ANCHORS if anchor.upper() not in normalized]


def _split_testigos(value: object) -> tuple[str, str]:
    raw = str(value or "").strip()
    if not raw:
        return "[TESTIGO_1]", "[TESTIGO_2]"
    parts = [p.strip() for p in re.split(r"\s+y\s+|,|;", raw) if p.strip()]
    first = parts[0] if len(parts) >= 1 else "[TESTIGO_1]"
    second = parts[1] if len(parts) >= 2 else "[TESTIGO_2]"
    return first, second


def _fallback_acta_administrativa_leoni(contexto: dict) -> str:
    empleado_objetivo = contexto.get("empleado_objetivo")
    if not isinstance(empleado_objetivo, dict):
        empleado_objetivo = {}
    empleado_nombre = _dato_o_marcador(
        contexto.get("empleado_nombre") or empleado_objetivo.get("nombre"),
        "[NOMBRE_TRABAJADOR]",
    )
    numero_empleado = _dato_o_marcador(
        contexto.get("num_empleado")
        or contexto.get("numero_empleado")
        or empleado_objetivo.get("numero_empleado"),
        "[NUMERO_EMPLEADO]",
    )
    puesto = _dato_o_marcador(
        contexto.get("puesto") or empleado_objetivo.get("puesto"),
        "[PUESTO_TRABAJADOR]",
    )
    fecha_evento = _fecha_larga_o_marcador(
        contexto.get("fecha_evento")
        or contexto.get("fecha_incidencia")
        or contexto.get("fecha")
    )
    hechos = _dato_o_marcador(
        contexto.get("descripcion_hechos") or contexto.get("descripcion"),
        "[DESCRIPCION_HECHOS]",
    )
    responsable_rh = _dato_o_marcador(
        contexto.get("persona_responsable_legal") or contexto.get("responsable_rh"),
        "[REPRESENTANTE_LEGAL]",
    )
    puesto_representante = _dato_o_marcador(
        contexto.get("puesto_representante"),
        "[PUESTO_REPRESENTANTE]",
    )
    testigo_1, testigo_2 = _split_testigos(
        contexto.get("personas_relacionadas_testigos") or contexto.get("testigos")
    )
    capitulo_reglamento = _dato_o_marcador(
        contexto.get("capitulo_reglamento"),
        "[CAPITULO_REGLAMENTO]",
    )
    articulos_reglamento = _dato_o_marcador(
        contexto.get("articulo_inciso"),
        "[ARTICULOS_REGLAMENTO]",
    )
    fecha_ingreso = _fecha_larga_o_marcador(
        contexto.get("fecha_ingreso"),
        "[FECHA_INGRESO]",
    )

    return f"""ACTA ADMINISTRATIVA

En la ciudad de Cuauhtémoc, Chihuahua, siendo las [HORA_INICIO] horas del día {fecha_evento}, reunidos en el local que ocupan las oficinas de LEONI CABLE, S.A. DE C.V., ubicado en Ave. Río Conchos No. 9700 del Parque Industrial Cuauhtémoc. Se reunieron el C. {responsable_rh}, representante legal de la empresa y quien ocupa el puesto de {puesto_representante}, y quien actúa con los C. {testigo_1} y {testigo_2}, como testigos, quienes ocupan los puestos de [PUESTOS_TESTIGOS], se procedió a instrumentar la presente acta en contra del C. {empleado_nombre}, quien tiene el puesto de {puesto}, con número de empleado {numero_empleado}.

HECHOS

Asimismo, se hace constar que el motivo de la presente acta es porque el C. {empleado_nombre}, {hechos}. Se aceptan los hechos como una violación al Reglamento Interior de Trabajo, Capítulo {capitulo_reglamento}, Artículo(s) {articulos_reglamento}.

En uso de la palabra y con relación a los hechos citados, el trabajador manifiesta de su puño y letra lo siguiente:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

En mérito de lo anterior, se procede a levantar la presente acta administrativa al C. {empleado_nombre}, empleado de la moral LEONI CABLE, S.A. DE C.V., quien ocupa el puesto de {puesto}, quien se desempeña en horarios rotativos los cuales no exceden los máximos establecidos por la Ley Federal del Trabajo, con fundamento en el artículo 59 de esta Ley, con fecha de ingreso {fecha_ingreso}.

Siendo las [HORA_CIERRE] hrs. del día {fecha_evento}, el representante patronal da por concluida la presente ACTA ADMINISTRATIVA, remitiendo la misma al área de Recursos Humanos para los efectos legales conducentes.

Todos debidamente apercibidos de las consecuencias legales que contrae para los que declaran con falsedad, mismos quienes han oído y presenciado lo declarado por los comparecientes, lo cual se asentó en esta acta, la que se da por concluida, y firmando al margen y calce para constancia legal, los que en ella intervinieron y así quisieron hacerlo.

En caso de que el trabajador se niegue a firmar la presente acta y/o exponer por escrito lo que a su derecho convenga en el espacio proporcionado para tal efecto, se hace constar por los testigos lo siguiente:

Testigo 1 C. {testigo_1} manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

Testigo 2 C. {testigo_2} manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________
"""


def _strip_model_think_artifacts(text: str) -> str:
    """Quita bloques  y normaliza espacios sin aplastar párrafos del acta."""
    if not text:
        return ""
    cleaned = _THINK_BLOCK_RE.sub("", text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.split("\n")]
    out: list[str] = []
    prev_empty = False
    for line in lines:
        empty = not line
        if empty and prev_empty:
            continue
        out.append(line)
        prev_empty = empty
    return "\n".join(out).strip()


def _looks_like_visible_reasoning_dump(text: str) -> bool:
    sample = (text or "")[:900]
    return bool(_REASONING_LEAK_START_RE.match(sample))


def _response_has_spanish_acta_signals(text: str) -> bool:
    """True si el texto parece contener cuerpo de acta en español (no solo razonamiento)."""
    low = (text or "").lower()
    signals = (
        "acta administrativa",
        "ley federal del trabajo",
        "reglamento interior",
        "antecedentes",
        "fundamento legal",
        "comparece",
        "por medio del presente",
    )
    return sum(1 for s in signals if s in low) >= 2


def _response_has_spanish_recomendacion_signals(text: str) -> bool:
    """True si la respuesta parece una recomendación legal en español (no solo razonamiento)."""
    low = (text or "").lower()
    signals = (
        "ley federal del trabajo",
        "fundamento",
        "fundamentación",
        "fundamentacion",
        "recomendación",
        "recomendacion",
        "resumen",
        "riesgo",
        "trabajador",
        "patrón",
        "patron",
        "artículo",
        "articulo",
        "incumplimiento",
        "lft",
        "comparecen",
        "antecedentes",
    )
    return sum(1 for s in signals if s in low) >= 2


def _trim_preface_before_acta(text: str) -> str:
    """
    Modelos tipo Qwen3 Thinking suelen volcar párrafos en inglés antes del acta en español.
    Recorta hasta el primer ancla clara del documento formal.
    """
    if not text or len(text) < 80:
        return text
    lower = text.lower()
    anchors: list[tuple[int, str]] = []
    for needle in (
        "<<<acta>>>",
        "acta administrativa",
        "por medio del presente",
        "comparezco para",
        "i. antecedentes",
        "1. antecedentes",
        "antecedentes",
    ):
        pos = lower.find(needle)
        if pos != -1:
            anchors.append((pos, needle))
    if not anchors:
        return text
    best_pos = min(anchors, key=lambda x: x[0])[0]
    # Solo recortar si hay un preámbulo sustancial (evita falsos positivos al inicio)
    if best_pos >= 120:
        return text[best_pos:].strip()
    return text


def _extract_acta_between_markers(text: str) -> Optional[str]:
    if _ACTA_START_MARKER not in text:
        return None
    i = text.index(_ACTA_START_MARKER) + len(_ACTA_START_MARKER)
    if _ACTA_END_MARKER in text[i:]:
        j = text.index(_ACTA_END_MARKER, i)
        inner = text[i:j].strip()
    else:
        inner = text[i:].strip()
    return inner if inner else None


async def _ollama_completar_redaccion_acta(
    client: httpx.AsyncClient,
    *,
    user_prompt: str,
    system_prompt: str,
    temperature: float | None = None,
    num_predict: int | None = None,
) -> str:
    """
    Qwen3 puede devolver `response` vacío en /api/generate si todo el presupuesto va a "thinking".
    /api/chat con think=false es el camino estable.
    """
    model = settings.OLLAMA_MODEL
    base_temp = settings.OLLAMA_TEMPERATURE if temperature is None else temperature
    temp = max(0.0, min(base_temp, 1.0))
    predict = num_predict if num_predict is not None else settings.OLLAMA_NUM_PREDICT
    opts: dict = {
        "temperature": temp,
        "num_predict": predict,
    }
    if settings.OLLAMA_NUM_CTX >= 2048:
        opts["num_ctx"] = settings.OLLAMA_NUM_CTX
    url_base = settings.OLLAMA_URL.rstrip("/")

    chat_payload: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": opts,
    }
    if "qwen" in model.lower():
        chat_payload["think"] = False

    resp = await client.post(f"{url_base}/api/chat", json=chat_payload)
    if resp.status_code == 200:
        data = resp.json()
        msg = data.get("message") or {}
        content = _strip_model_think_artifacts(str(msg.get("content") or ""))
        if content:
            return content
    else:
        logger.debug(
            "Ollama /api/chat HTTP %s — %s",
            resp.status_code,
            (resp.text or "")[:500],
        )

    gen_opts: dict = {"num_predict": predict}
    if settings.OLLAMA_NUM_CTX >= 2048:
        gen_opts["num_ctx"] = settings.OLLAMA_NUM_CTX
    gen_body: dict = {
        "model": model,
        "prompt": user_prompt,
        "system": system_prompt,
        "temperature": temp,
        "stream": False,
        "options": gen_opts,
    }
    if "qwen" in model.lower():
        gen_body["think"] = False

    resp2 = await client.post(
        f"{url_base}/api/generate",
        json=gen_body,
    )
    resp2.raise_for_status()
    data2 = resp2.json()
    return _strip_model_think_artifacts(str(data2.get("response") or ""))

# Roles que deben firmar para que un acta quede SIGNED
_ROLES_FIRMANTES_REQUERIDOS = {"gerente", "director", "rh"}

# Directorio de PDFs generados
_PDF_BASE = Path("/data/actas/pdf")
_LEGAL_DOCS_BASE = Path(__file__).resolve().parents[2] / "reference" / "legal-documents"
_MAX_LEGAL_DOC_BYTES = 8 * 1024 * 1024
_MAX_LEGAL_DOC_TEXT = 12000
_MAX_TOTAL_LEGAL_CONTEXT = 24000
_LEGAL_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


def _truncate_text(value: str, max_len: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[:max_len].rstrip()}..."


def _extract_text_from_docx_bytes(content: bytes) -> str:
    with zipfile.ZipFile(BytesIO(content)) as archive:
        raw = archive.read("word/document.xml")
    root = ElementTree.fromstring(raw)
    chunks: list[str] = []
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            chunks.append(node.text)
    return " ".join(chunks)


def _extract_text_from_pdf_bytes(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except Exception as exc:
        raise ServiceUnavailableError(
            detail="No fue posible leer PDFs legales en este momento."
        ) from exc
    reader = PdfReader(BytesIO(content))
    texts: list[str] = []
    for page in reader.pages:
        texts.append(page.extract_text() or "")
    return " ".join(texts)


def _extract_legal_document_text(file_path: Path) -> str:
    filename = file_path.name
    ext = Path(filename).suffix.lower()
    if ext not in _LEGAL_ALLOWED_EXTENSIONS:
        return ""
    content = file_path.read_bytes()
    if not content:
        return ""
    if len(content) > _MAX_LEGAL_DOC_BYTES:
        logger.warning(
            "Documento legal omitido por tamano: %s",
            filename,
        )
        return ""
    if ext in {".txt", ".md"}:
        text = content.decode("utf-8", errors="ignore")
    elif ext == ".docx":
        text = _extract_text_from_docx_bytes(content)
    else:
        text = _extract_text_from_pdf_bytes(content)
    cleaned = _truncate_text(text, _MAX_LEGAL_DOC_TEXT)
    if not cleaned:
        return ""
    return cleaned


def _load_legal_reference_documents() -> list[str]:
    if not _LEGAL_DOCS_BASE.exists() or not _LEGAL_DOCS_BASE.is_dir():
        return []
    chunks: list[str] = []
    total_chars = 0
    for file_path in sorted(_LEGAL_DOCS_BASE.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.name.lower() == "readme.md":
            continue
        text = _extract_legal_document_text(file_path)
        if not text:
            continue
        chunk = f"[{file_path.name}] {text}"
        if total_chars + len(chunk) > _MAX_TOTAL_LEGAL_CONTEXT:
            break
        chunks.append(chunk)
        total_chars += len(chunk)
    return chunks


async def _llamar_ollama(contexto: dict) -> str:
    """Genera borrador de acta con formato interno LEONI y fallback deterministico."""
    prompt = USER_GENERAR_ACTA_TEMPLATE.format(contexto=json.dumps(contexto, ensure_ascii=False, indent=2))
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": SYSTEM_GENERAR_ACTA_FORMAL,
                    "temperature": settings.OLLAMA_TEMPERATURE,
                    "stream": False,
                },
            )
            if resp.status_code == 200:
                raw = _strip_model_think_artifacts(str(resp.json().get("response") or ""))
                acta = _extract_acta_between_markers(raw) or _trim_preface_before_acta(raw)
                if acta and not _looks_like_visible_reasoning_dump(acta):
                    missing = _validar_formato_acta_leoni(acta)
                    if not missing:
                        return acta.strip()
                    logger.warning(
                        "Ollama genero acta sin formato LEONI requerido; faltan anclas: %s",
                        ", ".join(missing),
                    )
    except Exception:
        pass
    return _fallback_acta_administrativa_leoni(contexto)


def _trim_preface_hasta_resumen_hechos(text: str) -> str:
    """
    Si el modelo añade unas lineas antes de RESUMEN DE HECHOS:, recorta hasta esa ancla.
    """
    s = (text or "").strip()
    if not s:
        return s
    low = s.lower()
    key = "resumen de hechos"
    pos = low.find(key)
    if pos <= 0 or pos > 1400:
        return s
    return s[pos:].strip()


def _recomendacion_legal_ia_es_basura_meta(text: str) -> bool:
    """
    Detecta respuestas que repiten instrucciones o hablan de claves JSON en lugar de redactar.
    No exige que el titulo sea la primera linea literal (evita falsos rechazos).
    """
    raw = (text or "").strip()
    if len(raw) < 120:
        return True
    if _validar_formato_acta_leoni(raw) == [] and len(raw) >= 700:
        return False
    if _response_has_spanish_recomendacion_signals(raw) and len(raw) >= 700:
        return False
    t = raw.lower()
    head = t[:3200]
    if "basado en la información proporcionada" in head:
        return True
    if "basado en la informacion proporcionada" in head:
        return True
    if "se pueden extraer las siguientes conclusiones" in head:
        return True
    if "siguientes conclusiones" in head and "empleado_objetivo" in head[:2800]:
        return True
    if "reglas de identidad y roles" in t:
        return True
    if "detalle del acta (json)" in head or "`documentos_legales_referencia`" in head[:1500]:
        return True
    if head.count("empleado_objetivo") >= 2 and "resumen de hechos" not in head:
        return True
    # Debe parecer el entregable estructurado (secciones del prompt o acta sustancial).
    anclas = (
        "resumen de hechos",
        "fundamentación legal",
        "fundamentacion legal",
        "artículos aplicables",
        "articulos aplicables",
        "posibles incumplimientos",
        "redacción formal del acta administrativa",
        "redaccion formal del acta administrativa",
        "limitaciones:",
    )
    n_anclas = sum(1 for a in anclas if a in t)
    if n_anclas >= 2:
        return False
    if n_anclas >= 1 and len(t) >= 900:
        return False
    if "acta administrativa" in t and len(t) >= 1000:
        return False
    return True


def _normalizar_respuesta_recomendacion_ia(text: str, contexto: dict) -> str:
    """Si el modelo devolvió solo el acta, envuelve el texto en el formato obligatorio."""
    raw = (text or "").strip()
    if not raw:
        return raw
    low = raw.lower()
    if "resumen de hechos:" in low:
        return raw
    if _validar_formato_acta_leoni(raw):
        return raw
    hechos = _dato_o_marcador(
        contexto.get("descripcion_hechos") or contexto.get("descripcion"),
        "[DESCRIPCION_HECHOS]",
    )
    fundamento = _dato_o_marcador(contexto.get("fundamento_legal"), "[FUNDAMENTO_LEGAL]")
    articulos = _dato_o_marcador(contexto.get("articulo_inciso"), "[ARTICULOS]")
    return (
        f"RESUMEN DE HECHOS:\n{hechos}\n\n"
        f"FUNDAMENTACIÓN LEGAL:\n{fundamento}\n\n"
        f"ARTÍCULOS APLICABLES:\n{articulos}\n\n"
        f"POSIBLES INCUMPLIMIENTOS:\n"
        f"[Relacionar hechos del acta con obligaciones e incumplimientos respaldados en "
        f"documentos_legales_referencia.]\n\n"
        f"REDACCIÓN FORMAL DEL ACTA ADMINISTRATIVA:\n{raw}\n\n"
        f"LIMITACIONES:\n"
        f"Secciones analíticas completadas automáticamente; revisar fundamentación y citas."
    )


def _fallback_recomendacion_legal_ia(contexto: dict) -> str:
    """Escrito determinístico cuando Ollama no entrega formato utilizable."""
    hechos = _dato_o_marcador(
        contexto.get("descripcion_hechos") or contexto.get("descripcion"),
        "[DESCRIPCION_HECHOS]",
    )
    acta = _fallback_acta_administrativa_leoni(contexto)
    refs = str(contexto.get("documentos_legales_referencia") or "").strip()
    fundamento = (
        "Revisar manualmente los fragmentos RAG adjuntos al expediente."
        if refs
        else "Sin fragmentos RAG disponibles en esta ejecución."
    )
    return (
        f"RESUMEN DE HECHOS:\n{hechos}\n\n"
        f"FUNDAMENTACIÓN LEGAL:\n{fundamento}\n\n"
        f"ARTÍCULOS APLICABLES:\n"
        f"No identificados automáticamente; validar contra el material legal recuperado.\n\n"
        f"POSIBLES INCUMPLIMIENTOS:\n"
        f"[Completar según hechos y normativa aplicable.]\n\n"
        f"REDACCIÓN FORMAL DEL ACTA ADMINISTRATIVA:\n{acta}\n\n"
        f"LIMITACIONES:\n"
        f"Borrador generado sin respuesta utilizable del modelo de lenguaje. "
        f"Revisar fundamentación, citas y datos antes de usar."
    )


def _extract_article_citations(text: str) -> set[str]:
    citations: set[str] = set()
    for match in _ARTICLE_CITATION_RE.finditer(text or ""):
        suffix = (match.group(2) or "").lower()
        suffix = suffix.replace("á", "a")
        citations.add(f"{match.group(1)} {suffix}".strip())
    return citations


def _missing_article_citations(text: str, legal_context: str) -> set[str]:
    cited = _extract_article_citations(text)
    if not cited:
        return set()
    available = _extract_article_citations(legal_context)
    return cited - available


def _rag_sources_present(legal_context: str) -> set[str]:
    sources: set[str] = set()
    if "Ley Federal del Trabajo" in legal_context:
        sources.add("Ley Federal del Trabajo")
    if "Reglamento Interior de Trabajo" in legal_context:
        sources.add("Reglamento Interior de Trabajo")
    return sources


def _missing_required_sources(text: str, legal_context: str) -> set[str]:
    required = _rag_sources_present(legal_context)
    if len(required) < 2:
        return set()
    return {source for source in required if source not in (text or "")}


def _validate_recomendacion_against_rag(text: str, contexto: dict) -> None:
    legal_context = str(contexto.get("documentos_legales_referencia") or "")
    missing = _missing_article_citations(text, legal_context)
    if missing:
        ordered = ", ".join(sorted(missing, key=lambda x: (len(x), x)))
        raise ValueError(
            "El modelo citó artículos no presentes literalmente en el contexto RAG: "
            f"{ordered}"
        )
    missing_sources = _missing_required_sources(text, legal_context)
    if missing_sources:
        ordered = ", ".join(sorted(missing_sources))
        raise ValueError(
            "El modelo omitió fuentes legales presentes en el contexto RAG: "
            f"{ordered}"
        )


def _group_legal_context_by_source(chunks: list[str]) -> str:
    lft = [c for c in chunks if c.startswith("[Ley Federal del Trabajo")]
    reglamento = [c for c in chunks if c.startswith("[Reglamento Interior de Trabajo")]
    otros = [c for c in chunks if c not in lft and c not in reglamento]
    blocks: list[str] = []
    if lft:
        blocks.append("=== LEY FEDERAL DEL TRABAJO (LFT) ===\n" + "\n\n".join(lft))
    if reglamento:
        blocks.append("=== REGLAMENTO INTERIOR DE TRABAJO ===\n" + "\n\n".join(reglamento))
    if otros:
        blocks.append("=== OTROS DOCUMENTOS LEGALES ===\n" + "\n\n".join(otros))
    return "\n\n".join(blocks)


def _build_full_acta_rag_query(acta: ActaResponse, *, evidencia: str, texto_original: str) -> str:
    evidencia_text = (evidencia or "").strip()
    contenido_ia = (acta.contenido_ia or "").strip()
    contenido_final = (acta.contenido_final or "").strip()
    fecha_evento = str(acta.fecha_evento) if acta.fecha_evento else ""

    parts = [
        "Analiza TODO el expediente del acta administrativa; no reduzcas a una sola frase.",
        "Recupera de forma amplia artículos y fracciones aplicables de la Ley Federal del Trabajo",
        "y del Reglamento Interior de Trabajo para inasistencia, abandono de labores,",
        "salida sin permiso, obligaciones del trabajador y afectación a la operación.",
        "",
        f"acta_id: {acta.id}",
        f"tipo_falta: {acta.tipo_falta or ''}",
        f"fundamento_legal_capturado: {acta.fundamento_legal or ''}",
        f"articulo_inciso_capturado: {acta.articulo_inciso or ''}",
        f"fecha_evento: {fecha_evento}",
        f"lugar_incidente: {acta.lugar_incidente or ''}",
        f"area_departamento: {acta.area_departamento or ''}",
        f"puesto: {acta.puesto or ''}",
        f"empleado: {acta.empleado_nombre or ''}",
        f"numero_empleado: {acta.numero_empleado or ''}",
        f"supervisor_directo: {acta.supervisor_directo or ''}",
        f"personas_involucradas: {acta.personas_involucradas or ''}",
        f"testigos: {acta.testigos or ''}",
        "hechos_completos:",
        texto_original,
        "evidencia:",
        evidencia_text,
    ]
    if contenido_ia:
        parts.extend(["borrador_contenido_ia:", contenido_ia])
    if contenido_final:
        parts.extend(["borrador_contenido_final:", contenido_final])

    parts.extend(
        [
            "situaciones_objetivo:",
            "- no presentarse a trabajar todo el dia",
            "- mas de 3 faltas en 30 dias",
            "- irse de la planta/empresa sin permiso",
            "- abandonar estacion o area de trabajo",
            "- afectacion grave a la operacion",
            "- documentar el hecho sin sancion inmediata",
            "terminos_legales_prioritarios: "
            "articulo 47 fraccion X; articulo 47 fraccion XI; articulo 47 fraccion XV; "
            "articulo 134; articulo 134 fraccion III; articulo 134 fraccion IV; "
            "Reglamento Interior de Trabajo.",
        ]
    )
    return "\n".join(parts).strip()


async def _mejorar_redaccion_acta(contexto: dict) -> str:
    ctx_str = json.dumps(contexto, ensure_ascii=False, indent=2)
    base_prompt = USER_RECOMENDACION_LEGAL_IA_TEMPLATE.format(detalle_acta=ctx_str)
    timeout = httpx.Timeout(
        timeout=settings.OLLAMA_HTTP_TIMEOUT,
        connect=15.0,
    )
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            last_missing: set[str] = set()
            last_missing_sources: set[str] = set()
            last_missing_format: list[str] = []
            last_meta_basura = False
            for attempt in range(2):
                prompt = base_prompt
                if attempt > 0 and (
                    last_missing
                    or last_missing_sources
                    or last_missing_format
                    or last_meta_basura
                ):
                    prompt += (
                        "\n\nCORRECCIÓN OBLIGATORIA:\n"
                        "Regenera la salida cumpliendo estas reglas de validación: "
                    )
                    if last_meta_basura:
                        prompt += (
                            "NO expliques el JSON, NO listes campos como empleado_objetivo, "
                            "NO uses frases tipo 'basado en la información proporcionada'. "
                            "Empieza directamente con la línea exacta RESUMEN DE HECHOS: y luego "
                            "todas las secciones obligatorias en orden. "
                        )
                    if last_missing:
                        prompt += (
                            "elimina o sustituye los artículos que no aparecen literalmente "
                            "en `documentos_legales_referencia`: "
                            f"{', '.join(sorted(last_missing))}. "
                        )
                    if last_missing_sources:
                        prompt += (
                            "incluye fundamentos y artículos aplicables de estas fuentes que "
                            "sí aparecen en el contexto RAG: "
                            f"{', '.join(sorted(last_missing_sources))}. "
                        )
                    if last_missing_format:
                        prompt += (
                            "la REDACCIÓN FORMAL DEL ACTA ADMINISTRATIVA debe respetar "
                            "el formato interno de LEONI y contiene estas anclas faltantes: "
                            f"{', '.join(last_missing_format)}. "
                        )
                    prompt += "No inventes numeración, no omitas fuentes recuperadas y no cambies el orden de secciones."

                texto_raw = await _ollama_completar_redaccion_acta(
                    client,
                    user_prompt=prompt,
                    system_prompt=SYSTEM_RECOMENDACION_LEGAL_IA,
                    temperature=settings.OLLAMA_ACTA_TEMPERATURE,
                    num_predict=settings.OLLAMA_ACTA_NUM_PREDICT,
                )
                texto_raw = _strip_model_think_artifacts(texto_raw)
                texto_raw = _trim_preface_hasta_resumen_hechos(texto_raw)
                texto_raw = _normalizar_respuesta_recomendacion_ia(texto_raw, contexto)
                last_meta_basura = False
                if _looks_like_visible_reasoning_dump(texto_raw) and not _response_has_spanish_recomendacion_signals(
                    texto_raw
                ):
                    raise ValueError(
                        "El modelo devolvio razonamiento visible en lugar de la recomendacion legal"
                    )
                if _recomendacion_legal_ia_es_basura_meta(texto_raw):
                    last_meta_basura = True
                    if attempt == 0:
                        continue
                    raise ValueError(
                        "El modelo devolvio meta-instrucciones en lugar del escrito legal estructurado"
                    )
                if not texto_raw.strip():
                    raise ValueError("Respuesta vacia de Ollama")

                last_missing = _missing_article_citations(
                    texto_raw,
                    str(contexto.get("documentos_legales_referencia") or ""),
                )
                if last_missing:
                    if attempt == 0:
                        continue
                    ordered = ", ".join(sorted(last_missing, key=lambda x: (len(x), x)))
                    raise ValueError(
                        "El modelo citó artículos no presentes literalmente en el contexto RAG: "
                        f"{ordered}"
                    )

                last_missing_sources = _missing_required_sources(
                    texto_raw,
                    str(contexto.get("documentos_legales_referencia") or ""),
                )
                if last_missing_sources:
                    if attempt == 0:
                        continue
                    ordered = ", ".join(sorted(last_missing_sources))
                    raise ValueError(
                        "El modelo omitió fuentes legales presentes en el contexto RAG: "
                        f"{ordered}"
                    )

                _validate_recomendacion_against_rag(texto_raw, contexto)
                last_missing_format = _validar_formato_acta_leoni(texto_raw)
                if last_missing_format:
                    if attempt == 0:
                        continue
                    raise ValueError(
                        "El modelo no respetó el formato interno de acta LEONI; faltan: "
                        f"{', '.join(last_missing_format)}"
                    )
                return texto_raw.strip()
            raise ValueError("No fue posible validar las citas legales contra el RAG")
    except ServiceUnavailableError:
        raise
    except Exception as exc:
        logger.warning(
            "No se pudo mejorar la redacción del acta (asistente legal): %s — usando fallback",
            exc,
        )
        return _fallback_recomendacion_legal_ia(contexto).strip()


class ActaService:
    def __init__(self, db: AsyncSession):
        self.repo = ActaRepository(db)
        self.aprobacion_repo = ActaAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    async def _ensure_puede_ver_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
    ) -> None:
        rol = self._get_rol(current_user)
        if rol in ("rh", "gerente", "director"):
            return
        if rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = {e.id for e in subordinados}
            if empleado_id in ids or empleado_id == current_user.id:
                return
            raise ForbiddenError(detail="No tienes acceso a este empleado")
        if empleado_id == current_user.id:
            return
        raise ForbiddenError(detail="No tienes acceso a este empleado")

    @staticmethod
    def _normalizar_numero_empleado(numero: str | int | None) -> str | None:
        if numero is None:
            return None
        raw = str(numero).strip()
        if not raw:
            return None
        if raw.endswith(".0"):
            entero = raw[:-2]
            if entero.isdigit():
                return entero
        if raw.isdigit():
            return raw
        try:
            as_float = float(raw)
            if as_float.is_integer():
                return str(int(as_float))
        except ValueError:
            pass
        return raw

    @staticmethod
    def _no_empleado_a_entero(numero: str | int | None) -> int | None:
        norm = ActaService._normalizar_numero_empleado(numero)
        if not norm or not norm.isdigit():
            return None
        return int(norm)

    async def _build_response(self, acta: ActaAdministrativa) -> ActaResponse:
        aprobaciones = getattr(acta, "aprobaciones", []) or []
        roles_firmados = {a.rol_firmante for a in aprobaciones if a.firma_timestamp}
        firmantes_pendientes = sorted(_ROLES_FIRMANTES_REQUERIDOS - roles_firmados)
        r = ActaResponse.model_validate(acta)

        # En registros historicos puede existir desalineacion entre empleado_id y numero_empleado.
        # Si el acta trae numero_empleado, priorizamos resolver el empleado por ese numero.
        numero_acta = self._normalizar_numero_empleado(getattr(acta, "numero_empleado", None))
        empleado_por_numero = None
        no_int = self._no_empleado_a_entero(numero_acta)
        if no_int is not None:
            result_emp = await self.db.execute(
                select(Empleado)
                .options(selectinload(Empleado.puesto))
                .where(Empleado.no_empleado == no_int)
            )
            empleado_por_numero = result_emp.scalar_one_or_none()

        if empleado_por_numero:
            r.empleado_nombre = empleado_por_numero.nombre
            r.numero_empleado = self._normalizar_numero_empleado(empleado_por_numero.no_empleado)
            r.puesto = (
                empleado_por_numero.puesto.descripcion
                if empleado_por_numero.puesto
                else None
            )
        else:
            empleado_rel = getattr(acta, "empleado", None)
            if empleado_rel:
                r.empleado_nombre = empleado_rel.nombre
                r.numero_empleado = self._normalizar_numero_empleado(empleado_rel.no_empleado)
                r.puesto = (
                    empleado_rel.puesto.descripcion
                    if getattr(empleado_rel, "puesto", None)
                    else None
                )

        numero_rel = self._normalizar_numero_empleado(r.numero_empleado)
        if numero_acta and numero_acta != numero_rel:
            r.numero_empleado = numero_acta

        if not r.numero_empleado and numero_acta:
            r.numero_empleado = numero_acta
        r.numero_empleado = self._normalizar_numero_empleado(r.numero_empleado)
        r.aprobaciones = [ActaAprobacionResponse.model_validate(a) for a in aprobaciones]
        r.firmantes_pendientes = firmantes_pendientes
        return r

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_actas(
        self,
        cursor: int | None,
        limit: int,
        current_user: Empleado,
    ) -> PaginatedResponse[ActaResponse]:
        rol = self._get_rol(current_user)

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()
        elif rol == "gerente":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            items, next_cursor = await self.repo.list_paginated(
                cursor=cursor,
                limit=limit,
                filters=[ActaAdministrativa.empleado_id.in_(ids)],
            )
            total = await self.repo.count(
                filters=[ActaAdministrativa.empleado_id.in_(ids)]
            )
        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id,
                cursor=cursor,
                limit=limit,
            )
            total = await self.repo.count(
                filters=[ActaAdministrativa.empleado_id == current_user.id]
            )

        # Cargar aprobaciones para cada acta
        response_items = []
        for item in items:
            acta = await self.repo.get_with_aprobaciones(item.id)
            response_items.append(await self._build_response(acta))

        return PaginatedResponse(
            items=response_items,
            next_cursor=next_cursor,
            total=total,
        )

    async def list_actas_empleado_page(
        self,
        empleado_id: int,
        page: int,
        page_size: int,
        current_user: Empleado,
    ) -> ActasPageResponse:
        """Actas administrativas de un empleado (Vista 360)."""
        await self._ensure_puede_ver_empleado(current_user, empleado_id)
        empleado = await self.empleado_repo.get_with_area_y_lider(empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        items, total = await self.repo.list_by_empleado_page(
            empleado_id=empleado_id,
            page=page,
            page_size=page_size,
        )
        puesto_txt: str | None = None
        if empleado.puesto is not None:
            desc = getattr(empleado.puesto, "descripcion", None)
            if desc and str(desc).strip():
                puesto_txt = str(desc).strip()
        response_items: list[ActaResponse] = []
        for acta in items:
            r = ActaResponse.model_validate(acta)
            r.empleado_nombre = empleado.nombre
            r.numero_empleado = self._normalizar_numero_empleado(empleado.no_empleado)
            if puesto_txt:
                r.puesto = puesto_txt
            r.aprobaciones = []
            r.firmantes_pendientes = []
            response_items.append(r)

        return ActasPageResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_dashboard_metricas(
        self,
        current_user: Empleado,
    ) -> ActasDashboardMetricasResponse:
        """Cuenta actas en proceso y pendientes de firma con el mismo alcance que list_actas."""
        rol = self._get_rol(current_user)
        emp_filters: list = []
        if rol in ("director", "rh"):
            pass
        elif rol == "gerente":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.empleado_id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            emp_filters = [ActaAdministrativa.empleado_id.in_(ids)]
        else:
            emp_filters = [ActaAdministrativa.empleado_id == current_user.id]

        async def _count_estados(estados: tuple[str, ...]) -> int:
            where_parts = [ActaAdministrativa.estado.in_(estados), *emp_filters]
            result = await self.db.execute(select(func.count()).where(*where_parts))
            return int(result.scalar_one())

        en_proceso = await _count_estados(("draft", "pending_sign"))
        pendientes_firma = await _count_estados(("pending_sign",))
        return ActasDashboardMetricasResponse(
            en_proceso=en_proceso,
            pendientes_firma=pendientes_firma,
        )

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_acta(
        self,
        id: int,
        current_user: Empleado,
    ) -> ActaResponse:
        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            if acta.empleado_id != current_user.id:
                raise ForbiddenError(detail="No tienes acceso a esta acta")

        return await self._build_response(acta)

    async def mejorar_redaccion_acta(
        self,
        id: int,
        current_user: Empleado,
    ) -> str:
        acta = await self.get_acta(id=id, current_user=current_user)
        if acta.estado in ("signed", "archived", "cancelled"):
            raise ConflictError(
                detail="El escrito no se puede modificar porque el acta ya está cerrada"
            )
        texto_original = (acta.descripcion_hechos or "").strip()
        if not texto_original:
            raise ConflictError(
                detail="El acta no tiene descripción de hechos para generar el escrito de apoyo."
            )

        desc_ia = texto_original
        lim_desc = settings.ACTA_DESCRIPCION_IA_MAX_CHARS
        if len(desc_ia) > lim_desc:
            desc_ia = (
                f"{desc_ia[:lim_desc].rstrip()}\n"
                "...[descripción truncada por límite de contexto; conserva este texto si editas]"
            )

        def _trunc_campo_acta(val: str | None, lim: int, etiqueta: str) -> str:
            s = (val or "").strip()
            if len(s) <= lim:
                return s
            return f"{s[:lim].rstrip()}\n...[{etiqueta} truncada por límite de contexto]"

        evidencia_rag = _trunc_campo_acta(acta.evidencia, 2500, "evidencia")
        evidencia_ctx = _trunc_campo_acta(acta.evidencia, lim_desc, "evidencia")
        borrador_ia = _trunc_campo_acta(acta.contenido_ia, lim_desc, "borrador IA")
        borrador_final = _trunc_campo_acta(acta.contenido_final, lim_desc, "borrador contenido final")

        contexto = {
            "empleado_objetivo": {
                "nombre": acta.empleado_nombre or "",
                "numero_empleado": acta.numero_empleado or "",
                "area_departamento": acta.area_departamento or "",
                "puesto": acta.puesto or "",
                "supervisor_directo": acta.supervisor_directo or "",
            },
            "tipo_falta": acta.tipo_falta or "",
            "fundamento_legal": acta.fundamento_legal or "",
            "articulo_inciso": acta.articulo_inciso or "",
            "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else "",
            "lugar_incidente": acta.lugar_incidente or "",
            "descripcion_hechos": desc_ia,
            "personas_involucradas": acta.personas_involucradas or "",
            "personas_relacionadas_testigos": acta.testigos or "",
            "persona_responsable_legal": acta.responsable_rh or "",
            "evidencia": evidencia_ctx,
            "incidencia_id": acta.incidencia_id,
            "borrador_contenido_ia": borrador_ia or None,
            "borrador_contenido_final": borrador_final or None,
        }
        # RAG legal: recupera fragmentos relevantes de LFT y Reglamento.
        # Si el índice no está listo o quedó desactualizado, se detiene la generación
        # para evitar recomendaciones legales con fuentes no trazables.
        try:
            rag_query = _build_full_acta_rag_query(
                acta,
                evidencia=evidencia_rag,
                texto_original=texto_original,
            )
            rag_top_k = max(settings.LEGAL_RAG_TOP_K, 24)
            documentos_texto, rag_trace = await legal_rag_service.retrieve_relevant_context_with_trace(
                rag_query,
                top_k=rag_top_k,
            )
            logger.info(
                "RAG legal acta_id=%s query=%s",
                acta.id,
                rag_query,
            )
            logger.info(
                "RAG legal acta_id=%s trace=%s",
                acta.id,
                json.dumps(rag_trace, ensure_ascii=False),
            )
        except Exception as exc:
            logger.warning("RAG legal no disponible o desactualizado: %s", exc)
            raise ServiceUnavailableError(
                detail=(
                    "El índice legal RAG no está disponible o no coincide con las "
                    "fuentes actuales. Reindexa los documentos legales antes de generar IA."
                )
            ) from exc

        if not documentos_texto:
            raise ServiceUnavailableError(
                detail=(
                    "El RAG legal no encontró fragmentos suficientes en la LFT ni en el "
                    "Reglamento Interior para generar una recomendación trazable."
                )
            )

        if documentos_texto:
            merged_refs = _group_legal_context_by_source(documentos_texto)
            lim_refs = settings.LEGAL_REFERENCE_PROMPT_MAX_CHARS
            if len(merged_refs) > lim_refs:
                merged_refs = (
                    f"{merged_refs[:lim_refs].rstrip()}\n"
                    "...[fragmentos legales truncados por limite seguro]"
                )
            contexto["documentos_legales_referencia"] = merged_refs
            logger.info(
                "RAG legal acta_id=%s articulos_finales=%s",
                acta.id,
                sorted(_extract_article_citations(merged_refs), key=lambda x: (len(x), x)),
            )
            logger.info(
                "RAG legal acta_id=%s docs_finales=%s",
                acta.id,
                json.dumps(documentos_texto, ensure_ascii=False),
            )

        texto_mejorado = await _mejorar_redaccion_acta(contexto)
        texto_mejorado = texto_mejorado.strip()

        # Persistir recomendacion por acta para recuperarla entre sesiones.
        await self.repo.update(
            id,
            {"ia_recomendacion": texto_mejorado},
        )
        return texto_mejorado

    # ── Generar ───────────────────────────────────────────────────────────────

    async def generar_acta(
        self,
        data: ActaGenerarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if not user_has_module(current_user, "actas"):
            raise ForbiddenError(detail="Solo RH puede generar actas")

        result_emp = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.area), selectinload(Empleado.puesto))
            .where(Empleado.id == data.empleado_id)
        )
        empleado = result_emp.scalar_one_or_none()
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        tipo_incidencia = "no especificado"
        if data.incidencia_id:
            from app.models.incidencias import Incidencia
            result = await self.db.execute(
                select(Incidencia).where(Incidencia.id == data.incidencia_id)
            )
            incidencia = result.scalar_one_or_none()
            if not incidencia:
                raise NotFoundError(entidad="Incidencia", id=data.incidencia_id)
            tipo_incidencia = incidencia.tipo

        contexto = {
            "empleado_nombre": empleado.nombre,
            "num_empleado": empleado.no_empleado,
            "departamento": (
                empleado.area.descripcion if empleado.area else ""
            ),
            "puesto": (empleado.puesto.descripcion if empleado.puesto else ""),
            "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "tipo_incidencia": tipo_incidencia,
        }
        contenido_ia = await _llamar_ollama(contexto)

        acta = await self.repo.create({
            "empleado_id": data.empleado_id,
            "incidencia_id": data.incidencia_id,
            "contenido_ia": contenido_ia,
            "contenido_final": None,
            "estado": "pending_sign",
            "generado_por": current_user.id,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_GENERATED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=acta.id,
            datos_despues={
                "empleado_id": acta.empleado_id,
                "estado": acta.estado,
                "incidencia_id": acta.incidencia_id,
            },
        )

        acta = await self.repo.get_with_aprobaciones(acta.id)
        return await self._build_response(acta)

    async def crear_acta_desde_formulario(
        self,
        data: ActaCreateRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if not user_has_module(current_user, "actas"):
            raise ForbiddenError(detail="Solo RH puede crear actas")

        result_emp = await self.db.execute(
            select(Empleado).where(Empleado.id == data.empleado_id)
        )
        empleado = result_emp.scalar_one_or_none()
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        acta = await self.repo.create({
            "empleado_id": data.empleado_id,
            "numero_empleado": self._normalizar_numero_empleado(data.numero_empleado),
            "area_departamento": data.area_departamento,
            "supervisor_directo": data.supervisor_directo,
            "tipo_falta": data.tipo_falta,
            "fundamento_legal": data.fundamento_legal,
            "articulo_inciso": data.articulo_inciso,
            "fecha_evento": data.fecha_evento,
            "lugar_incidente": data.lugar_incidente,
            "descripcion_hechos": data.descripcion_hechos,
            "personas_involucradas": data.personas_involucradas,
            "testigos": data.testigos,
            "responsable_rh": data.responsable_rh,
            # Opcional por ahora: no bloquear guardado sin evidencia.
            "evidencia": data.evidencia,
            "incidencia_id": None,
            "contenido_ia": None,
            "contenido_final": None,
            "estado": "pending_sign",
            "generado_por": current_user.id,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_CREATED_FROM_FORM",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=acta.id,
            datos_despues={
                "empleado_id": acta.empleado_id,
                "estado": acta.estado,
                "fundamento_legal": acta.fundamento_legal,
                "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else None,
            },
        )

        acta = await self.repo.get_with_aprobaciones(acta.id)
        return await self._build_response(acta)

    # ── Editar ────────────────────────────────────────────────────────────────

    async def editar_acta(
        self,
        id: int,
        data: ActaEditarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if not user_has_module(current_user, "actas"):
            raise ForbiddenError(detail="Solo RH puede editar actas")

        acta = await self.repo.get(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado not in ("draft", "pending_sign"):
            raise ConflictError(
                detail=f"Solo se pueden editar actas en estado 'pending_sign', estado actual: '{acta.estado}'"
            )

        datos_antes = {
            "tipo_falta": acta.tipo_falta,
            "fundamento_legal": acta.fundamento_legal,
            "articulo_inciso": acta.articulo_inciso,
            "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else None,
            "lugar_incidente": acta.lugar_incidente,
            "descripcion_hechos": acta.descripcion_hechos,
            "personas_involucradas": acta.personas_involucradas,
            "testigos": acta.testigos,
            "responsable_rh": acta.responsable_rh,
            "evidencia": acta.evidencia,
            "estado": acta.estado,
        }
        acta = await self.repo.update(id, {
            "tipo_falta": data.tipo_falta,
            "fundamento_legal": data.fundamento_legal,
            "articulo_inciso": data.articulo_inciso,
            "fecha_evento": data.fecha_evento,
            "lugar_incidente": data.lugar_incidente,
            "descripcion_hechos": data.descripcion_hechos,
            "personas_involucradas": data.personas_involucradas,
            "testigos": data.testigos,
            "responsable_rh": data.responsable_rh,
            "evidencia": data.evidencia,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_EDITED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues={
                "tipo_falta": data.tipo_falta,
                "fundamento_legal": data.fundamento_legal,
                "articulo_inciso": data.articulo_inciso,
                "fecha_evento": str(data.fecha_evento),
                "lugar_incidente": data.lugar_incidente,
                "descripcion_hechos": data.descripcion_hechos,
                "personas_involucradas": data.personas_involucradas,
                "testigos": data.testigos,
                "responsable_rh": data.responsable_rh,
                "evidencia": data.evidencia,
                "estado": acta.estado,
            },
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    # ── Firmar ────────────────────────────────────────────────────────────────

    async def firmar_acta(
        self,
        id: int,
        request: ActaFirmarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("gerente", "director", "rh"):
            raise ForbiddenError(detail="Solo gerente, director o rh pueden firmar actas")

        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado not in ("pending_sign",):
            raise ConflictError(
                detail=f"El acta no esta en estado 'pending_sign', estado actual: '{acta.estado}'"
            )

        # Verificar que este firmante no haya firmado ya
        firma_existente = await self.repo.get_aprobacion_by_firmante(
            acta_id=id,
            firmante_id=current_user.id,
        )
        if firma_existente and firma_existente.firma_timestamp:
            raise ConflictError(detail="Ya has firmado este acta anteriormente")

        ahora = datetime.now(timezone.utc)

        if firma_existente:
            # Actualizar registro existente sin timestamp → poner timestamp
            await self.aprobacion_repo.update(
                firma_existente.id,
                {"firma_timestamp": ahora, "comentario": request.comentario},
            )
        else:
            # Crear nuevo registro de firma
            await self.aprobacion_repo.create({
                "acta_id": id,
                "firmante_id": current_user.id,
                "rol_firmante": rol,
                "firma_timestamp": ahora,
                "comentario": request.comentario,
            })

        # Verificar si todos los firmantes requeridos han firmado
        firmadas = await self.aprobacion_repo.count_firmadas(id)
        if firmadas >= len(_ROLES_FIRMANTES_REQUERIDOS):
            acta = await self.repo.update(id, {"estado": "signed"})

            # Encolar generacion de PDF
            await encolar_tress(
                db=self.db,
                accion="GENERAR_ACTA_PDF",
                payload={
                    "acta_id": id,
                    "empleado_id": acta.empleado_id,
                },
            )

            # Notificar al empleado
            empleado_id = acta.empleado_id

            async def _notify_acta_signed() -> None:
                from app.services.notificacion_service import NotificacionService
                svc = NotificacionService(self.db)
                await svc.enviar(
                    destinatario_id=empleado_id,
                    asunto="Tu acta administrativa ha sido firmada",
                    cuerpo=(
                        "El acta administrativa de tu expediente ha sido <b>firmada</b> "
                        "por todos los responsables. Puedes consultarla en la plataforma."
                    ),
                    canal="in_app",
                    target_url=f"#/actas/{id}",
                    metadata={"entidad": "acta", "estado": "signed", "acta_id": id},
                )

            background_tasks.add_task(_notify_acta_signed)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_FIRMADA",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_despues={"firmante_id": current_user.id, "rol": rol},
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    async def aprobar_acta(
        self,
        id: int,
        current_user: Empleado,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if not user_has_module(current_user, "actas"):
            raise ForbiddenError(detail="Solo RH puede aprobar actas")

        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado == "cancelled":
            raise ConflictError(detail="No se puede aprobar un acta anulada")
        if acta.estado in ("signed", "archived"):
            raise ConflictError(detail="El acta ya se encuentra aprobada")

        ahora = datetime.now(timezone.utc)
        firma_existente = await self.repo.get_aprobacion_by_firmante(
            acta_id=id,
            firmante_id=current_user.id,
        )
        if firma_existente and firma_existente.firma_timestamp:
            raise ConflictError(detail="Ya aprobaste esta acta anteriormente")

        if firma_existente:
            await self.aprobacion_repo.update(
                firma_existente.id,
                {
                    "firma_timestamp": ahora,
                    "comentario": "Aprobación de acta",
                    "rol_firmante": "rh",
                },
            )
        else:
            await self.aprobacion_repo.create({
                "acta_id": id,
                "firmante_id": current_user.id,
                "rol_firmante": "rh",
                "firma_timestamp": ahora,
                "comentario": "Aprobación de acta",
            })

        await self.repo.update(id, {"estado": "archived"})

        await log_action(
            db=self.db,
            accion="ACTA_APPROVED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_despues={
                "accion": "Aprobación de acta",
                "acta_id": id,
                "aprobador_id": current_user.id,
                "aprobador_nombre": current_user.nombre,
                "rol": rol,
                "fecha_aprobacion": ahora.isoformat(),
                "estado": "archived",
            },
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    async def anular_acta(
        self,
        id: int,
        data: ActaAnularRequest,
        current_user: Empleado,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if not user_has_module(current_user, "actas"):
            raise ForbiddenError(detail="Solo RH puede anular actas")

        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado == "cancelled":
            raise ConflictError(detail="El acta ya está anulada")
        if acta.estado in ("signed", "archived"):
            raise ConflictError(detail="No se puede anular un acta ya aprobada")

        motivo = (data.motivo or "").strip() or None
        await self.repo.update(id, {"estado": "cancelled"})

        await log_action(
            db=self.db,
            accion="ACTA_CANCELLED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_despues={
                "accion": "Anulación de acta",
                "acta_id": id,
                "motivo": motivo,
                "estado": "cancelled",
            },
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    # ── PDF ───────────────────────────────────────────────────────────────────

    async def get_acta_pdf(
        self,
        id: int,
        current_user: Empleado,
    ) -> str:
        """Retorna el path del PDF del acta. Retorna NotFoundError si aun no existe."""
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="Se requiere rol rh o gerente para descargar el PDF")

        acta = await self.repo.get(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        pdf_path = _PDF_BASE / f"acta_{id}.pdf"
        if not pdf_path.exists():
            raise NotFoundError(
                entidad="PDF del Acta",
                id=id,
            )

        return str(pdf_path)
