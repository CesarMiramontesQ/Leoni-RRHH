# app/services/legal_rag_service.py
"""RAG legal: Chroma persistente + embeddings Ollama (LangChain)."""

from __future__ import annotations

# Antes de importar Chroma → evita telemetría de chromadb y errores ruidosos en consola.
import os

os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")

import asyncio
import logging
import re
import shutil
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

import httpx

try:
    from langchain_community.vectorstores import Chroma
    from langchain_core.documents import Document
    from langchain_ollama import OllamaEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    _HAS_LANGCHAIN = True
except ImportError:
    _HAS_LANGCHAIN = False

from app.core.config import settings

logger = logging.getLogger(__name__)

_LEGAL_DOCS_BASE = Path(__file__).resolve().parents[2] / "reference" / "legal-documents"
_LEGAL_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}
_MAX_LEGAL_DOC_BYTES = 8 * 1024 * 1024
_CHROMA_COLLECTION = "legal_rag"

# Metadatos por archivo (no alteran el texto indexado).
_DOCUMENT_CATALOG: dict[str, dict[str, str]] = {
    "HR_Reglamento Interior de Trabajo.pdf": {
        "document_name": "Reglamento Interior de Trabajo",
        "document_type": "reglamento interno",
        "source": "documento original proporcionado",
    },
    "1044_Ley_Federal_del_Trabajo.pdf": {
        "document_name": "Ley Federal del Trabajo",
        "document_type": "ley federal",
        "source": "documento original proporcionado",
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


def _document_meta(file_path: Path, *, ingested_at: str) -> dict[str, str]:
    catalog = _DOCUMENT_CATALOG.get(file_path.name, {})
    return {
        "source": file_path.name,
        "document_name": catalog.get("document_name", file_path.stem),
        "document_type": catalog.get("document_type", "documento legal"),
        "source_type": catalog.get("source", "documento original proporcionado"),
        "ingested_at": ingested_at,
    }


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
            )
            data = store.get()
            ids = (data or {}).get("ids") or []
            return len(ids)
        except Exception as exc:
            logger.warning("No se pudo leer colección Chroma: %s", exc)
            return 0

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

        if force and chroma_path.exists():
            shutil.rmtree(chroma_path)
        chroma_path.mkdir(parents=True, exist_ok=True)

        ingested_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        all_docs: list[Document] = []
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
        )
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

    def _sync_similarity_search(self, query: str, k: int) -> list[str]:
        path = self._chroma_dir()
        if not path.exists() or self._sync_document_count() == 0:
            return []
        try:
            emb = self._make_embeddings()
            store = Chroma(
                persist_directory=str(path),
                embedding_function=emb,
                collection_name=_CHROMA_COLLECTION,
            )
            docs = store.similarity_search(_normalize_ws(query), k=k)
        except Exception as exc:
            logger.warning("Fallo similarity_search RAG legal: %s", exc)
            return []

        max_snippet = max(400, settings.LEGAL_RAG_SNIPPET_MAX_CHARS)
        out: list[str] = []
        for d in docs:
            label = d.metadata.get("document_name") or d.metadata.get("source", "documento")
            page = d.metadata.get("page")
            if page:
                label = f"{label} (pág. {page})"
            snippet = d.page_content.strip()
            if len(snippet) > max_snippet:
                snippet = f"{snippet[:max_snippet].rstrip()}..."
            out.append(f"[{label}] {snippet}")
        return out

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
