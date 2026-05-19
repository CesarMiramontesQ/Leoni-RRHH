# app/services/legal_rag_service.py
"""RAG legal: Chroma persistente + embeddings Ollama (LangChain)."""

from __future__ import annotations

import os

os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
os.environ.setdefault("CHROMA_TELEMETRY", "false")

import asyncio
import hashlib
import json
import logging
import re
import shutil
import warnings
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

import httpx

try:
    from chromadb.config import Settings as ChromaSettings
    from langchain_core.documents import Document
    from langchain_ollama import OllamaEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    try:
        from langchain_chroma import Chroma
    except ImportError:  # pragma: no cover - compatibilidad hasta reconstruir imagen
        from langchain_community.vectorstores import Chroma  # type: ignore[no-redef]
    _HAS_LANGCHAIN = True
except ImportError:
    _HAS_LANGCHAIN = False

from app.core.config import settings

logger = logging.getLogger(__name__)
_CHROMA_TELEMETRY_LOGGER = logging.getLogger("chromadb.telemetry.product.posthog")
_CHROMA_TELEMETRY_LOGGER.setLevel(logging.CRITICAL)
_CHROMA_TELEMETRY_LOGGER.disabled = True
warnings.filterwarnings("ignore", message=r".*The class `Chroma` was deprecated.*")

_LEGAL_DOCS_BASE = Path(__file__).resolve().parents[2] / "reference" / "legal-documents"
_LEGAL_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}
_MAX_LEGAL_DOC_BYTES = 8 * 1024 * 1024
_CHROMA_COLLECTION = "legal_rag"
_MANIFEST_FILENAME = "manifest.json"
_EXPECTED_LEGAL_SOURCES = (
    "LFT.pdf",
    "HR_Reglamento Interior de Trabajo.pdf",
)
_BALANCED_RETRIEVAL_DOCUMENTS = (
    "Ley Federal del Trabajo",
    "Reglamento Interior de Trabajo",
)
_DOCUMENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Reglamento Interior de Trabajo": (
        "reglamento",
        "falta",
        "faltas",
        "ausencia",
        "ausencias",
        "inasistencia",
        "retardo",
        "permiso",
        "disciplina",
        "interno",
        "jornada",
        "supervisor",
        "reloj checador",
    ),
    "Ley Federal del Trabajo": (
        "ley federal",
        "lft",
        "rescisión",
        "rescision",
        "obligaciones",
        "trabajador",
        "patrón",
        "patron",
        "relación de trabajo",
        "relacion de trabajo",
        "causa justificada",
        "artículo",
        "articulo",
    ),
}

_ARTICLE_REF_RE = re.compile(
    r"\b(?:art[íi]?culo|art\.?)\s*(\d{1,4})(?:\s*(?:bis|ter|qu[aá]ter))?\b",
    re.IGNORECASE,
)
_ABSENCE_OR_ABANDONMENT_RE = re.compile(
    r"\b("
    r"ausen(?:cia|to|tarse|t[oó])|"
    r"inasistencia|"
    r"falt(?:a|ar|o|ó)|"
    r"abandon(?:o|ó|ar)|"
    r"sin autorizaci[oó]n|"
    r"sin permiso"
    r")\b",
    re.IGNORECASE,
)

# Metadatos por archivo (no alteran el texto indexado).
_DOCUMENT_CATALOG: dict[str, dict[str, str]] = {
    "HR_Reglamento Interior de Trabajo.pdf": {
        "document_name": "Reglamento Interior de Trabajo",
        "document_type": "reglamento interno",
        "source": "documento original proporcionado",
    },
    "LFT.pdf": {
        "document_name": "Ley Federal del Trabajo",
        "document_type": "ley federal",
        "source": "documento oficial vigente",
    },
    "1044_Ley_Federal_del_Trabajo.pdf": {
        "document_name": "Ley Federal del Trabajo",
        "document_type": "ley federal",
        "source": "documento original proporcionado",
    },
    "Plantilla_Acta_Administrativa.docx": {
        "document_name": "Plantilla de Acta Administrativa",
        "document_type": "plantilla de formato",
        "source": "plantilla oficial proporcionada",
    },
}

# Encabezados de artículo al inicio de línea (reglamento y ley federal).
_LEGAL_ARTICLE_HEAD = re.compile(
    r"^[\s]*(?:ART[ÍI]?CULO\s+\d+[\.\-]|Art[íi]?culo\s+\d+)",
    re.MULTILINE | re.IGNORECASE,
)

_SECTION_HEAD_RE = re.compile(
    r"^(?:ART[ÍI]?CULO|Art[íi]?culo)\s+(\d+[\wº\.]*)",
    re.IGNORECASE | re.MULTILINE,
)


def _normalize_ws(value: str) -> str:
    """Solo para consultas de búsqueda; no usar sobre texto legal indexado."""
    return re.sub(r"\s+", " ", value).strip()


def _lower_no_accents(value: str) -> str:
    table = str.maketrans("áéíóúüÁÉÍÓÚÜ", "aeiouuAEIOUU")
    return value.translate(table).lower()


def _extract_article_numbers(value: str) -> set[str]:
    return {match.group(1) for match in _ARTICLE_REF_RE.finditer(value or "")}


def _augment_legal_query(query: str) -> str:
    """Agrega anclas legales determinísticas para supuestos laborales frecuentes."""
    if not _ABSENCE_OR_ABANDONMENT_RE.search(query or ""):
        return query
    anchors = (
        "Ley Federal del Trabajo artículo 47 rescisión relación de trabajo "
        "sin responsabilidad para el patrón faltas de asistencia sin permiso "
        "causa justificada; artículo 134 obligaciones de los trabajadores "
        "cumplir disposiciones normas de trabajo; Reglamento Interior ausencias "
        "injustificadas permisos sanciones disciplinarias."
    )
    return f"{query}\n{anchors}"


def _document_meta(file_path: Path, *, ingested_at: str) -> dict[str, str]:
    catalog = _DOCUMENT_CATALOG.get(file_path.name, {})
    return {
        "source": file_path.name,
        "document_name": catalog.get("document_name", file_path.stem),
        "document_type": catalog.get("document_type", "documento legal"),
        "source_type": catalog.get("source", "documento original proporcionado"),
        "ingested_at": ingested_at,
    }


def _sha256_file(file_path: Path) -> str:
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _chroma_client_settings(path: Path) -> ChromaSettings:
    return ChromaSettings(
        anonymized_telemetry=False,
        is_persistent=True,
        persist_directory=str(path),
    )


def _section_label(text: str) -> str:
    match = _SECTION_HEAD_RE.search(text)
    if match:
        prefix = text[: match.start()].strip()
        article = match.group(0).strip()
        if prefix:
            head = prefix.split("\n")[-1].strip()[:80]
            return f"{head} | {article}"[:200]
        return article[:200]
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:200]
    return ""


def _resolve_page(offset: int, page_offsets: list[tuple[int, int]]) -> int | None:
    if not page_offsets:
        return None
    page = page_offsets[0][1]
    for start, num in page_offsets:
        if offset >= start:
            page = num
        else:
            break
    return page


def _split_by_legal_articles(text: str) -> list[str]:
    """Divide por artículos conservando el texto íntegro (sin perder separadores)."""
    matches = list(_LEGAL_ARTICLE_HEAD.finditer(text))
    if not matches:
        return [text] if text.strip() else []

    sections: list[str] = []
    if matches[0].start() > 0:
        sections.append(text[: matches[0].start()])

    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        sections.append(text[start:end])

    return [s for s in sections if s.strip()]


def _subsplit_section(section: str, *, chunk_size: int, chunk_overlap: int) -> list[str]:
    if len(section) <= chunk_size:
        return [section]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(section)


def _extract_text_from_docx_bytes(content: bytes) -> str:
    with zipfile.ZipFile(BytesIO(content)) as archive:
        raw = archive.read("word/document.xml")
    root = ElementTree.fromstring(raw)
    chunks: list[str] = []
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            chunks.append(node.text)
    return "\n".join(chunks)


def _extract_pdf_pages(content: bytes) -> list[tuple[int, str]]:
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")
    try:
        return [(i + 1, doc[i].get_text() or "") for i in range(doc.page_count)]
    finally:
        doc.close()


def _pages_to_text(pages: list[tuple[int, str]]) -> tuple[str, list[tuple[int, int]]]:
    """Concatena páginas con salto de línea y registra offset → número de página."""
    parts: list[str] = []
    page_offsets: list[tuple[int, int]] = []
    offset = 0
    for page_num, page_text in pages:
        page_offsets.append((offset, page_num))
        parts.append(page_text)
        offset += len(page_text)
        if page_num < len(pages):
            parts.append("\n")
            offset += 1
    return "".join(parts), page_offsets


def _extract_text_from_pdf_bytes_pymupdf(content: bytes) -> str:
    pages = _extract_pdf_pages(content)
    text, _ = _pages_to_text(pages)
    return text


class LegalRagService:
    """Vector store legal en disco; la ingesta explícita vía scripts o rebuild_index."""

    def __init__(self) -> None:
        if not _HAS_LANGCHAIN:
            logger.warning("langchain no disponible — RAG legal deshabilitado")

    @staticmethod
    def _project_root() -> Path:
        return Path(__file__).resolve().parents[2]

    def _chroma_dir(self) -> Path:
        raw = settings.LEGAL_RAG_CHROMA_PATH
        p = Path(raw)
        if p.is_absolute():
            return p
        return self._project_root() / p

    def _manifest_path(self) -> Path:
        return self._chroma_dir() / _MANIFEST_FILENAME

    def _make_embeddings(self):  # type: ignore[return]
        if not _HAS_LANGCHAIN:
            return None
        base = settings.OLLAMA_URL.rstrip("/")
        return OllamaEmbeddings(model=settings.OLLAMA_EMBED_MODEL, base_url=base)

    def _sync_check_ollama(self) -> None:
        """Valida que Ollama responda antes de ingestión o embedding."""
        base = settings.OLLAMA_URL.rstrip("/")
        try:
            r = httpx.get(f"{base}/api/tags", timeout=8.0)
            r.raise_for_status()
        except Exception as exc:
            raise RuntimeError(
                f"No se pudo conectar con Ollama en {base}. "
                "Asegúrate de que el servicio esté en ejecución (p. ej. `ollama serve`)."
            ) from exc
        emb = self._make_embeddings()
        try:
            emb.embed_query("ping")
        except Exception as exc:
            raise RuntimeError(
                f"Ollama responde pero falló el modelo de embeddings "
                f"'{settings.OLLAMA_EMBED_MODEL}'. Ejecuta: ollama pull {settings.OLLAMA_EMBED_MODEL}"
            ) from exc

    def _iter_legal_files(self) -> list[Path]:
        if not _LEGAL_DOCS_BASE.exists():
            return []
        files: list[Path] = []
        for p in sorted(_LEGAL_DOCS_BASE.rglob("*")):
            if not p.is_file():
                continue
            if p.name.lower() == "readme.md":
                continue
            if p.suffix.lower() not in _LEGAL_ALLOWED_EXTENSIONS:
                continue
            files.append(p)
        return files

    def _extract_doc_text_with_pages(self, file_path: Path) -> tuple[str, list[tuple[int, int]]]:
        content = file_path.read_bytes()
        if not content or len(content) > _MAX_LEGAL_DOC_BYTES:
            return "", []
        ext = file_path.suffix.lower()
        if ext in {".txt", ".md"}:
            text = content.decode("utf-8", errors="ignore")
            return text, [(0, 1)] if text else []
        if ext == ".docx":
            text = _extract_text_from_docx_bytes(content)
            return text, [(0, 1)] if text else []
        pages = _extract_pdf_pages(content)
        return _pages_to_text(pages)

    def _extract_doc_text(self, file_path: Path) -> str:
        text, _ = self._extract_doc_text_with_pages(file_path)
        return text

    def _sync_document_count(self) -> int:
        path = self._chroma_dir()
        if not path.exists():
            return 0
        try:
            emb = self._make_embeddings()
            store = Chroma(
                persist_directory=str(path),
                embedding_function=emb,
                collection_name=_CHROMA_COLLECTION,
                client_settings=_chroma_client_settings(path),
            )
            data = store.get()
            ids = (data or {}).get("ids") or []
            return len(ids)
        except Exception as exc:
            logger.warning("No se pudo leer colección Chroma: %s", exc)
            return 0

    def _build_manifest(
        self,
        *,
        ingested_at: str,
        files: list[Path],
        chunk_counts: dict[str, int],
        coverage_by_source: dict[str, dict[str, int | float | bool]],
        total_chunks: int,
    ) -> dict:
        return {
            "version": 1,
            "collection": _CHROMA_COLLECTION,
            "ingested_at": ingested_at,
            "embedding_model": settings.OLLAMA_EMBED_MODEL,
            "ollama_url": settings.OLLAMA_URL.rstrip("/"),
            "chunk_size": max(200, settings.LEGAL_RAG_CHUNK_SIZE),
            "chunk_overlap": min(
                settings.LEGAL_RAG_CHUNK_OVERLAP,
                max(200, settings.LEGAL_RAG_CHUNK_SIZE) - 1,
            ),
            "total_chunks": total_chunks,
            "sources": [
                {
                    "source": file_path.name,
                    "document_name": _document_meta(
                        file_path, ingested_at=ingested_at
                    )["document_name"],
                    "document_type": _document_meta(
                        file_path, ingested_at=ingested_at
                    )["document_type"],
                    "sha256": _sha256_file(file_path),
                    "bytes": file_path.stat().st_size,
                    "mtime_ns": file_path.stat().st_mtime_ns,
                    "chunks": chunk_counts.get(file_path.name, 0),
                    "coverage": coverage_by_source.get(file_path.name, {}),
                }
                for file_path in files
            ],
        }

    def _write_manifest(self, manifest: dict) -> None:
        self._manifest_path().write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _read_manifest(self) -> dict | None:
        path = self._manifest_path()
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("No se pudo leer manifest RAG legal: %s", exc)
            return None

    def _sync_validate_index_freshness(self) -> None:
        manifest = self._read_manifest()
        if not manifest:
            raise RuntimeError(
                "El índice RAG legal no tiene manifest. Reindexa con "
                "`python -m scripts.actas_rag.ingest`."
            )

        if manifest.get("embedding_model") != settings.OLLAMA_EMBED_MODEL:
            raise RuntimeError(
                "El índice RAG legal fue creado con otro modelo de embeddings "
                f"({manifest.get('embedding_model')!r}); modelo actual: "
                f"{settings.OLLAMA_EMBED_MODEL!r}. Reindexa antes de usar IA."
            )

        current_files = self._iter_legal_files()
        current_by_name = {p.name: p for p in current_files}
        manifest_sources = manifest.get("sources") or []
        manifest_by_name = {
            str(item.get("source")): item
            for item in manifest_sources
            if item.get("source")
        }

        current_names = set(current_by_name)
        manifest_names = set(manifest_by_name)
        expected_names = set(_EXPECTED_LEGAL_SOURCES)
        if not expected_names.issubset(current_names):
            missing_expected = sorted(expected_names - current_names)
            raise RuntimeError(
                "Faltan fuentes legales esperadas para el RAG: "
                f"{missing_expected}. Agrega los archivos y reindexa."
            )
        if current_names != manifest_names:
            missing = sorted(current_names - manifest_names)
            stale = sorted(manifest_names - current_names)
            raise RuntimeError(
                "Las fuentes del RAG legal cambiaron desde la última ingesta. "
                f"Nuevas: {missing or 'ninguna'}; removidas: {stale or 'ninguna'}. "
                "Reindexa antes de usar IA."
            )

        for name, file_path in current_by_name.items():
            item = manifest_by_name[name]
            current_hash = _sha256_file(file_path)
            if item.get("sha256") != current_hash:
                raise RuntimeError(
                    f"La fuente legal {name} cambió desde la última ingesta. "
                    "Reindexa antes de usar IA."
                )

            if item.get("chunks", 0) <= 0:
                raise RuntimeError(
                    f"La fuente legal {name} no tiene chunks indexados. "
                    "Reindexa y valida que el documento tenga texto seleccionable."
                )

    async def validate_index_freshness(self) -> None:
        await asyncio.to_thread(self._sync_validate_index_freshness)

    def _sync_status(self) -> dict:
        manifest = self._read_manifest()
        errors: list[str] = []
        try:
            self._sync_validate_index_freshness()
            fresh = True
        except Exception as exc:
            fresh = False
            errors.append(str(exc))

        chroma_chunks = self._sync_document_count()
        ollama_ok = False
        embedding_ok = False
        try:
            base = settings.OLLAMA_URL.rstrip("/")
            r = httpx.get(f"{base}/api/tags", timeout=3.0)
            r.raise_for_status()
            ollama_ok = True
            emb = self._make_embeddings()
            emb.embed_query("ping")
            embedding_ok = True
        except Exception as exc:
            errors.append(f"Ollama/embeddings no disponible: {exc}")

        return {
            "status": (
                "ok"
                if fresh and chroma_chunks > 0 and ollama_ok and embedding_ok
                else "attention"
            ),
            "fresh": fresh,
            "chroma_path": str(self._chroma_dir()),
            "collection": _CHROMA_COLLECTION,
            "chunks_indexed": chroma_chunks,
            "ollama": {
                "url": settings.OLLAMA_URL.rstrip("/"),
                "available": ollama_ok,
                "embedding_model": settings.OLLAMA_EMBED_MODEL,
                "embedding_available": embedding_ok,
            },
            "retrieval": {
                "top_k": settings.LEGAL_RAG_TOP_K,
                "score_threshold": settings.LEGAL_RAG_SCORE_THRESHOLD,
                "balanced_documents": list(_BALANCED_RETRIEVAL_DOCUMENTS),
            },
            "expected_sources": list(_EXPECTED_LEGAL_SOURCES),
            "manifest": manifest,
            "errors": errors,
        }

    async def status(self) -> dict:
        return await asyncio.to_thread(self._sync_status)

    async def has_documents(self) -> bool:
        """True si existe índice Chroma con al menos un documento."""
        if not _HAS_LANGCHAIN:
            return False
        n = await asyncio.to_thread(self._sync_document_count)
        return n > 0

    async def index_chunk_count(self) -> int:
        """Número de chunks en el índice Chroma (0 si no existe o falla lectura)."""
        return await asyncio.to_thread(self._sync_document_count)

    def _split_documents(
        self,
        file_path: Path,
        raw_text: str,
        page_offsets: list[tuple[int, int]],
        *,
        ingested_at: str,
    ) -> list[Document]:
        chunk_size = max(200, settings.LEGAL_RAG_CHUNK_SIZE)
        chunk_overlap = min(settings.LEGAL_RAG_CHUNK_OVERLAP, chunk_size - 1)
        base_meta = _document_meta(file_path, ingested_at=ingested_at)

        sections = _split_by_legal_articles(raw_text)
        if not sections:
            sections = [raw_text] if raw_text.strip() else []

        pieces: list[tuple[str, int]] = []
        cursor = 0
        for section in sections:
            start = raw_text.find(section, cursor)
            if start < 0:
                start = cursor
            for piece in _subsplit_section(
                section, chunk_size=chunk_size, chunk_overlap=chunk_overlap
            ):
                pieces.append((piece, start))
            cursor = start + max(len(section), 1)

        docs: list[Document] = []
        for idx, (piece, offset) in enumerate(pieces, start=1):
            if not piece.strip():
                continue
            page = _resolve_page(offset, page_offsets)
            meta = {
                **base_meta,
                "chunk_id": f"{file_path.name}:{idx}",
                "section": _section_label(piece),
            }
            if page is not None:
                meta["page"] = str(page)
            docs.append(Document(page_content=piece, metadata=meta))
        return docs

    @staticmethod
    def verify_source_coverage(file_path: Path, chunks: list[Document]) -> dict[str, int | float | bool]:
        """Comprueba que los chunks reconstruyan el texto fuente sin pérdida."""
        source_text = LegalRagService()._extract_doc_text(file_path)
        source_len = len(source_text)
        if source_len == 0:
            return {
                "source_chars": 0,
                "indexed_chars": 0,
                "coverage_ratio": 0.0,
                "complete": False,
            }
        indexed = "".join(d.page_content for d in chunks)
        indexed_len = len(indexed)
        # Permite solapamiento entre chunks; la cobertura mínima es la longitud fuente.
        ratio = indexed_len / source_len if source_len else 0.0
        return {
            "source_chars": source_len,
            "indexed_chars": indexed_len,
            "coverage_ratio": round(ratio, 4),
            "complete": indexed_len >= source_len,
        }

    def _sync_rebuild_index(self, force: bool) -> None:
        self._sync_check_ollama()
        chroma_path = self._chroma_dir()
        files = self._iter_legal_files()
        if not files:
            raise RuntimeError(
                f"No hay documentos legales en {_LEGAL_DOCS_BASE}. "
                "Coloca PDFs (u otros formatos soportados) y vuelve a ejecutar la ingesta."
            )
        file_names = {p.name for p in files}
        missing_expected = sorted(set(_EXPECTED_LEGAL_SOURCES) - file_names)
        if missing_expected:
            raise RuntimeError(
                "Faltan fuentes legales esperadas para el RAG: "
                f"{missing_expected}. Se esperan: {list(_EXPECTED_LEGAL_SOURCES)}"
            )

        # Rebuild idempotente: siempre reemplaza el índice completo para evitar
        # duplicados o mezcla de versiones si la ingesta se ejecuta más de una vez.
        if chroma_path.exists():
            shutil.rmtree(chroma_path)
        chroma_path.mkdir(parents=True, exist_ok=True)

        ingested_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        all_docs: list[Document] = []
        chunk_counts: dict[str, int] = {}
        coverage_by_source: dict[str, dict[str, int | float | bool]] = {}
        n_files = len(files)
        for idx, file_path in enumerate(files, start=1):
            print(f"[{idx}/{n_files}] Extrayendo y fragmentando: {file_path.name}", flush=True)
            raw, page_offsets = self._extract_doc_text_with_pages(file_path)
            if not raw.strip():
                logger.warning("Sin texto extraíble: %s", file_path.name)
                continue
            split_docs = self._split_documents(
                file_path, raw, page_offsets, ingested_at=ingested_at
            )
            coverage = self.verify_source_coverage(file_path, split_docs)
            coverage_by_source[file_path.name] = coverage
            chunk_counts[file_path.name] = len(split_docs)
            status = "OK" if coverage["complete"] else "REVISAR"
            print(
                f"    → {len(split_docs)} fragmentos | "
                f"texto fuente {coverage['source_chars']} chars | "
                f"indexado {coverage['indexed_chars']} chars | "
                f"cobertura {coverage['coverage_ratio']} [{status}]",
                flush=True,
            )
            if not coverage["complete"]:
                logger.warning(
                    "Cobertura incompleta en %s (ratio=%s)",
                    file_path.name,
                    coverage["coverage_ratio"],
                )
            all_docs.extend(split_docs)

        if not all_docs:
            raise RuntimeError(
                "No se generaron fragmentos (chunks) a partir de los PDFs. "
                "Verifica que los archivos contengan texto seleccionable."
            )

        print(f"Generando embeddings e indexando {len(all_docs)} fragmentos en Chroma...", flush=True)
        emb = self._make_embeddings()
        Chroma.from_documents(
            documents=all_docs,
            embedding=emb,
            persist_directory=str(chroma_path),
            collection_name=_CHROMA_COLLECTION,
            client_settings=_chroma_client_settings(chroma_path),
        )
        manifest = self._build_manifest(
            ingested_at=ingested_at,
            files=files,
            chunk_counts=chunk_counts,
            coverage_by_source=coverage_by_source,
            total_chunks=len(all_docs),
        )
        self._write_manifest(manifest)
        print(f"Listo. Índice guardado en: {chroma_path}", flush=True)
        logger.info(
            "Índice legal RAG reconstruido: %s fragmentos en %s",
            len(all_docs),
            chroma_path,
        )

    async def rebuild_index(self, *, force: bool = False) -> None:
        """Borra (si force) y regenera el índice Chroma desde reference/legal-documents/."""
        if not _HAS_LANGCHAIN:
            logger.warning("rebuild_index omitido: langchain no disponible")
            return
        await asyncio.to_thread(self._sync_rebuild_index, force)

    def _format_retrieved_docs(self, docs: list[Document]) -> list[str]:
        max_snippet = max(400, settings.LEGAL_RAG_SNIPPET_MAX_CHARS)
        out: list[str] = []
        seen: set[str] = set()
        for d in docs:
            chunk_id = str(d.metadata.get("chunk_id") or "")
            if chunk_id and chunk_id in seen:
                continue
            if chunk_id:
                seen.add(chunk_id)
            label = d.metadata.get("document_name") or d.metadata.get("source", "documento")
            page = d.metadata.get("page")
            section = d.metadata.get("section")
            if page:
                label = f"{label} (pág. {page})"
            if section:
                label = f"{label}, {section}"
            snippet = d.page_content.strip()
            if len(snippet) > max_snippet:
                snippet = f"{snippet[:max_snippet].rstrip()}..."
            out.append(f"[{label}] {snippet}")
        return out

    def _document_priority(self, query: str) -> list[str]:
        low = _lower_no_accents(query)
        scored: list[tuple[int, str]] = []
        for document_name in _BALANCED_RETRIEVAL_DOCUMENTS:
            score = sum(1 for kw in _DOCUMENT_KEYWORDS[document_name] if kw in low)
            scored.append((score, document_name))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [document_name for _, document_name in scored]

    def _lexical_bonus(self, query: str, doc: Document) -> float:
        query_low = _lower_no_accents(query)
        text_low = _lower_no_accents(
            " ".join(
                [
                    str(doc.metadata.get("document_name") or ""),
                    str(doc.metadata.get("section") or ""),
                    doc.page_content,
                ]
            )
        )
        document_name = str(doc.metadata.get("document_name") or "")
        bonus = 0.0

        for kw in _DOCUMENT_KEYWORDS.get(document_name, ()):
            if kw in query_low and kw in text_low:
                bonus += 0.035

        query_articles = _extract_article_numbers(query)
        if query_articles:
            doc_articles = _extract_article_numbers(text_low)
            bonus += 0.12 * len(query_articles & doc_articles)

        return min(bonus, 0.25)

    def _rerank_pairs(
        self,
        query: str,
        pairs: list[tuple[Document, float]],
        *,
        limit: int,
    ) -> list[Document]:
        threshold = max(0.0, min(settings.LEGAL_RAG_SCORE_THRESHOLD, 1.0))
        ranked: list[tuple[float, float, Document]] = []
        seen: set[str] = set()
        for doc, raw_score in pairs:
            chunk_id = str(doc.metadata.get("chunk_id") or "")
            if chunk_id and chunk_id in seen:
                continue
            if chunk_id:
                seen.add(chunk_id)
            score = float(raw_score)
            if score < threshold:
                continue
            final_score = score + self._lexical_bonus(query, doc)
            ranked.append((final_score, score, doc))

        ranked.sort(key=lambda item: (-item[0], -item[1]))
        return [doc for _, _, doc in ranked[:limit]]

    @staticmethod
    def _dedupe_docs(docs: list[Document], *, limit: int) -> list[Document]:
        out: list[Document] = []
        seen: set[str] = set()
        for doc in docs:
            chunk_id = str(doc.metadata.get("chunk_id") or "")
            marker = chunk_id or f"{doc.metadata.get('source')}:{doc.page_content[:80]}"
            if marker in seen:
                continue
            seen.add(marker)
            out.append(doc)
            if len(out) >= limit:
                break
        return out

    def _exact_article_docs(self, store, query: str) -> list[Document]:  # type: ignore[no-untyped-def]
        article_numbers = _extract_article_numbers(query)
        if not article_numbers:
            return []

        docs: list[Document] = []
        for num in sorted(article_numbers, key=lambda x: (len(x), x)):
            patterns = (
                f"Artículo {num}.-",
                f"Artículo {num}.",
                f"ARTICULO {num}.-",
                f"ARTICULO {num}.",
                f"ARTÍCULO {num}.-",
                f"ARTÍCULO {num}.",
            )
            for pattern in patterns:
                try:
                    data = store.get(where_document={"$contains": pattern}, limit=6)
                except Exception as exc:
                    logger.debug("Búsqueda exacta de artículo falló (%s): %s", pattern, exc)
                    continue
                for text, meta in zip(
                    data.get("documents") or [],
                    data.get("metadatas") or [],
                    strict=False,
                ):
                    if text:
                        docs.append(Document(page_content=text, metadata=meta or {}))
        return self._dedupe_docs(docs, limit=max(2, len(article_numbers) * 4))

    def _sync_similarity_search(self, query: str, k: int) -> list[str]:
        path = self._chroma_dir()
        if not path.exists() or self._sync_document_count() == 0:
            return []
        self._sync_validate_index_freshness()
        try:
            emb = self._make_embeddings()
            store = Chroma(
                persist_directory=str(path),
                embedding_function=emb,
                collection_name=_CHROMA_COLLECTION,
                client_settings=_chroma_client_settings(path),
            )
            normalized_query = _augment_legal_query(_normalize_ws(query))
            exact_docs = self._exact_article_docs(store, normalized_query)
            per_source_k = max(2, k // len(_BALANCED_RETRIEVAL_DOCUMENTS))
            source_docs: list[Document] = []
            for document_name in self._document_priority(normalized_query):
                source_pairs = (
                    store.similarity_search_with_relevance_scores(
                        normalized_query,
                        k=per_source_k,
                        filter={"document_name": document_name},
                    )
                )
                source_docs.extend(
                    self._rerank_pairs(
                        normalized_query,
                        source_pairs,
                        limit=per_source_k,
                    )
                )

            general_pairs = store.similarity_search_with_relevance_scores(
                normalized_query,
                k=k,
            )
            general_docs = self._rerank_pairs(normalized_query, general_pairs, limit=k)
            docs = self._dedupe_docs(exact_docs + source_docs + general_docs, limit=k)
        except Exception as exc:
            logger.warning("Fallo similarity_search RAG legal: %s", exc)
            raise RuntimeError("No fue posible recuperar contexto del RAG legal.") from exc

        if not docs:
            logger.info(
                "RAG legal sin resultados sobre threshold %.2f para consulta: %s",
                settings.LEGAL_RAG_SCORE_THRESHOLD,
                normalized_query[:300],
            )
            return []

        return self._format_retrieved_docs(docs)

    async def retrieve_relevant_context(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[str]:
        if not _HAS_LANGCHAIN:
            return []
        k = top_k or settings.LEGAL_RAG_TOP_K
        k = max(1, k)
        return await asyncio.to_thread(self._sync_similarity_search, query, k)


legal_rag_service = LegalRagService()
