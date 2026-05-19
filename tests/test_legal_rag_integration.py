"""Pruebas de integración del RAG legal sobre índice persistente local.

Estas pruebas se saltan automáticamente si el índice Chroma no existe en el entorno.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

import app.services.legal_rag_service as legal_rag_module
from app.services.acta_service import _missing_article_citations
from app.services.legal_rag_service import LegalRagService, legal_rag_service


def _manifest_or_skip() -> dict:
    manifest = legal_rag_service._read_manifest()
    if not manifest:
        pytest.skip("Índice RAG legal no disponible en este entorno")
    return manifest


def test_rag_sources_exist_and_are_expected():
    manifest = _manifest_or_skip()
    source_names = {item["source"] for item in manifest.get("sources", [])}

    assert "LFT.pdf" in source_names
    assert "HR_Reglamento Interior de Trabajo.pdf" in source_names

    for source in source_names:
        assert (Path("reference/legal-documents") / source).exists()


def test_rag_manifest_counts_by_source_are_present():
    manifest = _manifest_or_skip()
    chunks_by_source = {
        item["source"]: item["chunks"]
        for item in manifest.get("sources", [])
    }

    assert chunks_by_source["LFT.pdf"] > 1000
    assert chunks_by_source["HR_Reglamento Interior de Trabajo.pdf"] >= 50
    assert manifest["total_chunks"] == sum(chunks_by_source.values())


def test_rag_chroma_has_no_duplicate_chunk_ids():
    _manifest_or_skip()
    db_path = legal_rag_service._chroma_dir() / "chroma.sqlite3"
    if not db_path.exists():
        pytest.skip("SQLite de Chroma no disponible")

    with sqlite3.connect(db_path) as conn:
        rows, distinct_ids = conn.execute(
            "select count(*), count(distinct string_value) "
            "from embedding_metadata where key='chunk_id'"
        ).fetchone()

    assert rows == distinct_ids


@pytest.mark.asyncio
async def test_rag_retrieval_for_typical_query_returns_lft_and_reglamento():
    _manifest_or_skip()
    try:
        chunks = await legal_rag_service.retrieve_relevant_context(
            "ausencia injustificada obligaciones trabajador",
            top_k=12,
        )
    except Exception as exc:
        pytest.skip(f"Retrieval no disponible en este entorno: {exc}")

    joined = "\n".join(chunks)
    assert "Ley Federal del Trabajo" in joined
    assert "Reglamento Interior de Trabajo" in joined
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_rag_retrieval_for_acta2_like_case_returns_multiple_related_articles():
    _manifest_or_skip()
    query = (
        "No se presentó a trabajar todo el día, acumula más de 3 faltas en 30 días, "
        "se fue de la planta sin permiso y abandonó su estación de trabajo; la ausencia "
        "generó afectación grave, por ahora solo se documentará el hecho sin sanción inmediata."
    )
    try:
        chunks = await legal_rag_service.retrieve_relevant_context(
            query,
            top_k=24,
        )
    except Exception as exc:
        pytest.skip(f"Retrieval no disponible en este entorno: {exc}")

    joined = "\n".join(chunks).lower()
    assert "ley federal del trabajo" in joined
    assert "reglamento interior de trabajo" in joined
    assert "artículo 47" in joined or "articulo 47" in joined
    assert "artículo 134" in joined or "articulo 134" in joined
    assert len(chunks) >= 4


@pytest.mark.asyncio
async def test_rag_empty_chroma_path_returns_no_context(tmp_path, monkeypatch):
    empty_index = tmp_path / "empty-chroma"
    monkeypatch.setattr(
        legal_rag_module.settings,
        "LEGAL_RAG_CHROMA_PATH",
        str(empty_index),
    )

    svc = LegalRagService()
    assert await svc.retrieve_relevant_context("ausencia injustificada") == []


def test_article_validation_rejects_unbacked_citations():
    respuesta = "FUNDAMENTACIÓN LEGAL: Aplican Artículo 47 y Artículo 999."
    contexto = "[Ley Federal del Trabajo (pág. 15)] Artículo 47.- Texto recuperado."

    assert _missing_article_citations(respuesta, contexto) == {"999"}
