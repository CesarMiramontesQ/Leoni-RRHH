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


def _normalize_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _extract_text_from_docx_bytes(content: bytes) -> str:
    with zipfile.ZipFile(BytesIO(content)) as archive:
        raw = archive.read("word/document.xml")
    root = ElementTree.fromstring(raw)
    chunks: list[str] = []
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            chunks.append(node.text)
    return " ".join(chunks)


def _extract_text_from_pdf_bytes_pymupdf(content: bytes) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text() or "")
        return " ".join(parts)
    finally:
        doc.close()


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

    def _extract_doc_text(self, file_path: Path) -> str:
        content = file_path.read_bytes()
        if not content or len(content) > _MAX_LEGAL_DOC_BYTES:
            return ""
        ext = file_path.suffix.lower()
        if ext in {".txt", ".md"}:
            return content.decode("utf-8", errors="ignore")
        if ext == ".docx":
            return _extract_text_from_docx_bytes(content)
        return _extract_text_from_pdf_bytes_pymupdf(content)

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

    def _split_documents(self, file_path: Path, raw_text: str) -> list[Document]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=max(200, settings.LEGAL_RAG_CHUNK_SIZE),
            chunk_overlap=min(settings.LEGAL_RAG_CHUNK_OVERLAP, settings.LEGAL_RAG_CHUNK_SIZE - 1),
        )
        pieces = splitter.split_text(_normalize_ws(raw_text))
        docs: list[Document] = []
        for idx, piece in enumerate(pieces, start=1):
            if not piece.strip():
                continue
            docs.append(
                Document(
                    page_content=piece,
                    metadata={
                        "source": file_path.name,
                        "chunk_id": f"{file_path.name}:{idx}",
                    },
                )
            )
        return docs

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

        all_docs: list[Document] = []
        n_files = len(files)
        for idx, file_path in enumerate(files, start=1):
            print(f"[{idx}/{n_files}] Extrayendo y fragmentando: {file_path.name}", flush=True)
            raw = self._extract_doc_text(file_path)
            if not raw.strip():
                logger.warning("Sin texto extraíble: %s", file_path.name)
                continue
            split_docs = self._split_documents(file_path, raw)
            print(f"    → {len(split_docs)} fragmentos", flush=True)
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
            src = d.metadata.get("source", "documento")
            snippet = d.page_content.strip()
            if len(snippet) > max_snippet:
                snippet = f"{snippet[:max_snippet].rstrip()}..."
            out.append(f"[{src}] {snippet}")
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
