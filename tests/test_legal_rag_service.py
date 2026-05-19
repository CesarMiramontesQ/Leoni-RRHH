# tests/test_legal_rag_service.py
"""Pruebas de fragmentación legal sin Chroma ni Ollama."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.legal_rag_service import (
    LegalRagService,
    _augment_legal_query,
    _document_meta,
    _extract_article_numbers,
    _split_by_legal_articles,
    _subsplit_section,
)
import app.services.legal_rag_service as legal_rag_module
from app.services.acta_service import (
    _group_legal_context_by_source,
    _missing_article_citations,
    _missing_required_sources,
)

_REGLEMENTO_PDF = (
    Path(__file__).resolve().parents[1]
    / "reference"
    / "legal-documents"
    / "HR_Reglamento Interior de Trabajo.pdf"
)


def test_article_split_preserves_full_text():
    sample = (
        "REGLAMENTO INTERIOR\n\n"
        "PRIMERA.- Declaración inicial.\n\n"
        "ARTICULO 1.- Primera disposición del reglamento.\n\n"
        "ARTICULO 2.- Segunda disposición con texto adicional."
    )
    parts = _split_by_legal_articles(sample)
    assert "".join(parts) == sample
    assert len(parts) == 3
    assert "ARTICULO 1" in parts[1]


def test_subsplit_does_not_normalize_whitespace():
    section = "ARTICULO 1.- Línea uno.\n\nLínea dos   con   espacios."
    pieces = _subsplit_section(section, chunk_size=30, chunk_overlap=5)
    assert any("   con   espacios" in p for p in pieces)


def test_split_documents_metadata():
    svc = LegalRagService()
    raw = "ARTICULO 1.- Texto de prueba para metadatos."
    docs = svc._split_documents(
        Path("HR_Reglamento Interior de Trabajo.pdf"),
        raw,
        [(0, 1)],
        ingested_at="2026-05-18T00:00:00+00:00",
    )
    assert len(docs) == 1
    meta = docs[0].metadata
    assert meta["document_name"] == "Reglamento Interior de Trabajo"
    assert meta["document_type"] == "reglamento interno"
    assert meta["source"] == "HR_Reglamento Interior de Trabajo.pdf"
    assert meta["ingested_at"] == "2026-05-18T00:00:00+00:00"
    assert docs[0].page_content == raw


def test_lft_pdf_metadata_uses_canonical_document_name():
    meta = _document_meta(Path("LFT.pdf"), ingested_at="2026-05-19T00:00:00+00:00")
    assert meta["document_name"] == "Ley Federal del Trabajo"
    assert meta["document_type"] == "ley federal"
    assert meta["source_type"] == "documento oficial vigente"


def test_extract_article_numbers_for_reranking():
    assert _extract_article_numbers("Aplican Artículo 47 y art. 134 bis.") == {
        "47",
        "134",
    }


def test_augment_legal_query_for_absence_cases():
    q = _augment_legal_query("se ausento de su area laboral sin autorizacion")
    assert "artículo 47" in q
    assert "artículo 134" in q
    assert "Reglamento Interior" in q


def test_missing_article_citations_detects_unbacked_numbers():
    respuesta = "FUNDAMENTACIÓN LEGAL: Aplican Artículo 47 y Artículo 999."
    contexto = "[Ley Federal del Trabajo] Artículo 47.- Texto legal recuperado."
    assert _missing_article_citations(respuesta, contexto) == {"999"}


def test_missing_required_sources_requires_lft_and_reglamento_when_context_has_both():
    contexto = (
        "[Ley Federal del Trabajo (pág. 15)] Artículo 47.- Texto recuperado.\n"
        "[Reglamento Interior de Trabajo (pág. 5)] ARTICULO 15.- Texto recuperado."
    )
    respuesta = "ARTÍCULOS APLICABLES: Ley Federal del Trabajo, Artículo 47."
    assert _missing_required_sources(respuesta, contexto) == {"Reglamento Interior de Trabajo"}


def test_group_legal_context_by_source_separates_lft_and_reglamento():
    grouped = _group_legal_context_by_source(
        [
            "[Reglamento Interior de Trabajo (pág. 5)] ARTICULO 15.- Texto.",
            "[Ley Federal del Trabajo (pág. 15)] Artículo 47.- Texto.",
        ]
    )
    assert "=== LEY FEDERAL DEL TRABAJO (LFT) ===" in grouped
    assert "=== REGLAMENTO INTERIOR DE TRABAJO ===" in grouped
    assert grouped.index("LEY FEDERAL") < grouped.index("REGLAMENTO")


def test_manifest_detects_changed_source(tmp_path, monkeypatch):
    docs_dir = tmp_path / "legal-documents"
    docs_dir.mkdir()
    source = docs_dir / "LFT.pdf"
    reglamento = docs_dir / "HR_Reglamento Interior de Trabajo.pdf"
    source.write_text("ARTICULO 1.- Texto legal vigente.", encoding="utf-8")
    reglamento.write_text("ARTICULO 1.- Reglamento vigente.", encoding="utf-8")

    index_dir = tmp_path / "index"
    index_dir.mkdir()
    monkeypatch.setattr(legal_rag_module, "_LEGAL_DOCS_BASE", docs_dir)
    monkeypatch.setattr(legal_rag_module.settings, "LEGAL_RAG_CHROMA_PATH", str(index_dir))

    svc = LegalRagService()
    manifest = svc._build_manifest(
        ingested_at="2026-05-19T00:00:00+00:00",
        files=[source, reglamento],
        chunk_counts={
            "LFT.pdf": 1,
            "HR_Reglamento Interior de Trabajo.pdf": 1,
        },
        coverage_by_source={
            "LFT.pdf": {
                "source_chars": 32,
                "indexed_chars": 32,
                "coverage_ratio": 1.0,
                "complete": True,
            },
            "HR_Reglamento Interior de Trabajo.pdf": {
                "source_chars": 31,
                "indexed_chars": 31,
                "coverage_ratio": 1.0,
                "complete": True,
            }
        },
        total_chunks=2,
    )
    svc._write_manifest(manifest)
    svc._sync_validate_index_freshness()

    source.write_text("ARTICULO 1.- Texto legal modificado.", encoding="utf-8")
    with pytest.raises(RuntimeError, match="cambió"):
        svc._sync_validate_index_freshness()


@pytest.mark.skipif(not _REGLEMENTO_PDF.exists(), reason="PDF no presente en el entorno")
def test_reglamento_pdf_extract_and_coverage():
    svc = LegalRagService()
    raw, page_offsets = svc._extract_doc_text_with_pages(_REGLEMENTO_PDF)
    assert len(raw) > 40_000
    assert len(page_offsets) == 17

    docs = svc._split_documents(
        _REGLEMENTO_PDF,
        raw,
        page_offsets,
        ingested_at="2026-05-18T00:00:00+00:00",
    )
    assert len(docs) >= 50
    assert all(d.page_content in raw for d in docs)

    coverage = svc.verify_source_coverage(_REGLEMENTO_PDF, docs)
    assert coverage["complete"] is True
    assert coverage["source_chars"] == len(raw)

    reglamento_chunks = [
        d for d in docs if d.metadata.get("document_name") == "Reglamento Interior de Trabajo"
    ]
    assert len(reglamento_chunks) == len(docs)
    assert any("ARTICULO 64" in d.page_content or "ARTÍCULO 64" in d.page_content for d in docs)
