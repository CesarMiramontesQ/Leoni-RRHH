# tests/test_legal_rag_service.py
"""Pruebas de fragmentación legal sin Chroma ni Ollama."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.legal_rag_service import (
    LegalRagService,
    _split_by_legal_articles,
    _subsplit_section,
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
