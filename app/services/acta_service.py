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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.integrations.tress.queue import encolar_tress
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.empleados import Empleado
from app.repositories.acta_repository import ActaAprobacionRepository, ActaRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.acta_rag_prompts import (
    SYSTEM_GENERAR_ACTA_FORMAL,
    USER_GENERAR_ACTA_TEMPLATE,
)
from app.services.legal_rag_service import legal_rag_service
from app.schemas import PaginatedResponse
from app.schemas.actas import (
    ActaAprobacionResponse,
    ActaCreateRequest,
    ActaEditarRequest,
    ActaFirmarRequest,
    ActaGenerarRequest,
    ActaResponse,
)
from app.utils.audit_logger import audit_background

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

_ACTA_START_MARKER = "<<<ACTA>>>"
_ACTA_END_MARKER = "<<<FIN>>>"


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
) -> str:
    """
    Qwen3 puede devolver `response` vacío en /api/generate si todo el presupuesto va a "thinking".
    /api/chat con think=false es el camino estable.
    """
    model = settings.OLLAMA_MODEL
    base_temp = settings.OLLAMA_TEMPERATURE if temperature is None else temperature
    temp = max(0.0, min(base_temp, 1.0))
    opts = {
        "temperature": temp,
        "num_predict": settings.OLLAMA_NUM_PREDICT,
    }
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

    gen_body: dict = {
        "model": model,
        "prompt": user_prompt,
        "system": system_prompt,
        "temperature": temp,
        "stream": False,
        "options": {"num_predict": settings.OLLAMA_NUM_PREDICT},
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
    """Stub de llamada a Ollama. Implementacion completa en fase integraciones."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": f"Genera un acta administrativa formal para: {contexto}",
                    "temperature": settings.OLLAMA_TEMPERATURE,
                    "stream": False,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("response", "")
    except Exception:
        pass
    # Fallback: borrador vacio para edicion manual
    return (
        "[Borrador generado automaticamente - Completar manualmente]\n\n"
        f"Empleado: {contexto.get('empleado_nombre', '')}\n"
        f"Fecha: {contexto.get('fecha', '')}\n"
        f"Tipo: {contexto.get('tipo_incidencia', '')}\n"
    )


async def _mejorar_redaccion_acta(contexto: dict) -> str:
    ctx_str = json.dumps(contexto, ensure_ascii=False, indent=2)
    prompt = USER_GENERAR_ACTA_TEMPLATE.format(contexto=ctx_str)
    prompt = (
        f"{prompt}\n\n"
        "Reglas de identidad y roles (obligatorias):\n"
        "- El unico empleado sujeto del acta es el definido en empleado_objetivo.\n"
        "- NO cambies el empleado sujeto por ninguna persona mencionada en personas relacionadas.\n"
        "- personas_relacionadas_testigos solo puede figurar como testigos.\n"
        "- persona_responsable_legal solo como responsable legal/RH.\n"
        "- Si faltan datos, conserva neutralidad y no inventes nombres, cargos ni relaciones."
    )
    timeout = httpx.Timeout(
        timeout=settings.OLLAMA_HTTP_TIMEOUT,
        connect=15.0,
    )
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            texto_raw = await _ollama_completar_redaccion_acta(
                client,
                user_prompt=prompt,
                system_prompt=SYSTEM_GENERAR_ACTA_FORMAL,
                temperature=settings.OLLAMA_ACTA_TEMPERATURE,
            )
            texto_raw = _strip_model_think_artifacts(texto_raw)
            texto_raw = _trim_preface_before_acta(texto_raw)
            marcado = _extract_acta_between_markers(texto_raw)
            if marcado:
                return marcado
            if _looks_like_visible_reasoning_dump(texto_raw) and not _response_has_spanish_acta_signals(
                texto_raw
            ):
                raise ValueError(
                    "El modelo devolvio razonamiento visible en lugar del texto del acta"
                )
            if not texto_raw.strip():
                raise ValueError("Respuesta vacia de Ollama")
            return texto_raw.strip()
    except Exception as exc:
        logger.warning(
            "No se pudo mejorar redaccion del acta con IA: %s",
            exc,
        )
        raise ServiceUnavailableError(
            detail="No fue posible generar la sugerencia con IA en este momento. Intenta nuevamente."
        ) from exc


class ActaService:
    def __init__(self, db: AsyncSession):
        self.repo = ActaRepository(db)
        self.aprobacion_repo = ActaAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    @staticmethod
    def _normalizar_numero_empleado(numero: str | None) -> str | None:
        if numero is None:
            return None
        raw = str(numero).strip()
        if not raw:
            return None
        if raw.endswith(".0"):
            entero = raw[:-2]
            if entero.isdigit():
                return entero
        return raw

    async def _build_response(self, acta: ActaAdministrativa) -> ActaResponse:
        aprobaciones = getattr(acta, "aprobaciones", []) or []
        roles_firmados = {a.rol_firmante for a in aprobaciones if a.firma_timestamp}
        firmantes_pendientes = sorted(_ROLES_FIRMANTES_REQUERIDOS - roles_firmados)
        r = ActaResponse.model_validate(acta)

        # En registros historicos puede existir desalineacion entre empleado_id y numero_empleado.
        # Si el acta trae numero_empleado, priorizamos resolver el empleado por ese numero.
        numero_acta = self._normalizar_numero_empleado(getattr(acta, "numero_empleado", None))
        empleado_por_numero = None
        if numero_acta:
            candidatos = [numero_acta]
            if numero_acta.isdigit():
                # Compatibilidad con datos legacy que guardaron numero como decimal string.
                candidatos.append(f"{numero_acta}.0")
            result_emp = await self.db.execute(
                select(Empleado)
                .options(selectinload(Empleado.puesto))
                .where(Empleado.no_empleado.in_(candidatos))
            )
            empleado_por_numero = result_emp.scalar_one_or_none()

        if empleado_por_numero:
            r.empleado_nombre = empleado_por_numero.nombre
            r.numero_empleado = empleado_por_numero.no_empleado
            r.puesto = (
                empleado_por_numero.puesto.descripcion
                if empleado_por_numero.puesto
                else None
            )
        else:
            empleado_rel = getattr(acta, "empleado", None)
            if empleado_rel:
                r.empleado_nombre = empleado_rel.nombre
                r.numero_empleado = empleado_rel.no_empleado
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
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
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
        texto_original = (acta.descripcion_hechos or "").strip()
        if not texto_original:
            raise ConflictError(
                detail="El acta no tiene descripcion de hechos para mejorar con IA"
            )

        desc_ia = texto_original
        lim_desc = settings.ACTA_DESCRIPCION_IA_MAX_CHARS
        if len(desc_ia) > lim_desc:
            desc_ia = (
                f"{desc_ia[:lim_desc].rstrip()}\n"
                "...[descripcion truncada para la llamada a IA; conserva este texto si editas]"
            )

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
        }
        # RAG legal: recupera solo fragmentos relevantes; si falla, conserva fallback completo.
        try:
            rag_query = (
                f"tipo_falta: {acta.tipo_falta or ''}\n"
                f"fundamento_legal: {acta.fundamento_legal or ''}\n"
                f"articulo_inciso: {acta.articulo_inciso or ''}\n"
                f"hechos: {texto_original}\n"
                f"area: {acta.area_departamento or ''}\n"
                f"puesto: {acta.puesto or ''}\n"
            )
            documentos_texto = await legal_rag_service.retrieve_relevant_context(rag_query)
        except Exception as exc:
            logger.warning("RAG legal no disponible, usando fallback de documentos completos: %s", exc)
            documentos_texto = _load_legal_reference_documents()

        if not documentos_texto:
            documentos_texto = _load_legal_reference_documents()

        if documentos_texto:
            merged_refs = "\n\n".join(documentos_texto)
            lim_refs = settings.LEGAL_REFERENCE_PROMPT_MAX_CHARS
            if len(merged_refs) > lim_refs:
                merged_refs = (
                    f"{merged_refs[:lim_refs].rstrip()}\n"
                    "...[fragmentos legales truncados por limite seguro]"
                )
            contexto["documentos_legales_referencia"] = merged_refs

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
        if rol != "rh":
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
            "estado": "draft",
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
        if rol != "rh":
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
            "estado": "draft",
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
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede editar actas")

        acta = await self.repo.get(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado != "draft":
            raise ConflictError(
                detail=f"Solo se pueden editar actas en estado 'draft', estado actual: '{acta.estado}'"
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
