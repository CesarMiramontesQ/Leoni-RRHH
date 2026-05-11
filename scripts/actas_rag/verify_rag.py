# scripts/actas_rag/verify_rag.py
"""
Comprueba que el índice legal RAG exista, tenga volumen razonable y devuelva
fragmentos relevantes para consultas de prueba.

Uso (Docker):
  docker compose exec backend python -m scripts.actas_rag.verify_rag
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.config import settings
from app.services.legal_rag_service import legal_rag_service


_QUERIES_DEFAULT = (
    "obligaciones del trabajador asistencia jornada",
    "ausencia injustificada falta trabajo",
    "suspensión relaciones de trabajo artículo",
    "medidas disciplinarias despido",
)


async def _run(*, queries: tuple[str, ...]) -> int:
    try:
        n = await legal_rag_service.index_chunk_count()
    except Exception as exc:
        print(f"No se pudo leer el índice Chroma: {exc}", file=sys.stderr)
        return 1

    print(f"Ruta índice: {settings.LEGAL_RAG_CHROMA_PATH}")
    print(f"Chunks indexados: {n}")
    print(
        f"Config: TOP_K={settings.LEGAL_RAG_TOP_K}, "
        f"CHUNK_SIZE={settings.LEGAL_RAG_CHUNK_SIZE}, "
        f"SNIPPET_MAX={settings.LEGAL_RAG_SNIPPET_MAX_CHARS}, "
        f"PROMPT_LEGAL_MAX={settings.LEGAL_REFERENCE_PROMPT_MAX_CHARS}\n"
    )

    if n == 0:
        print(
            "El índice está vacío o no existe. Coloca PDFs en reference/legal-documents/ "
            "y ejecuta:\n  docker compose exec backend python -m scripts.actas_rag.ingest --force",
            file=sys.stderr,
        )
        return 1

    if n < 50:
        print(
            "Advertencia: muy pocos chunks para una ley completa. Suele indicar PDF sin texto "
            "(escaneado sin OCR) o ingesta incompleta.\n",
            file=sys.stderr,
        )

    for q in queries:
        chunks = await legal_rag_service.retrieve_relevant_context(q)
        print(f"--- Consulta: {q!r} → {len(chunks)} fragmentos ---")
        for i, c in enumerate(chunks, 1):
            preview = c.replace("\n", " ")[:320]
            print(f"  {i}. {preview}{'...' if len(c) > 320 else ''}")
        print()

    merged = "\n\n".join(
        await legal_rag_service.retrieve_relevant_context(queries[0], top_k=settings.LEGAL_RAG_TOP_K)
    )
    print(
        f"Tamaño aproximado inyectado (1ª consulta, TOP_K): "
        f"{len(merged)} caracteres (tope configurado {settings.LEGAL_REFERENCE_PROMPT_MAX_CHARS})."
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Verifica índice RAG legal y búsquedas de prueba.")
    parser.add_argument(
        "-q",
        "--query",
        action="append",
        dest="queries",
        help="Consulta adicional (repetible). Si no se pasa, se usan consultas por defecto.",
    )
    args = parser.parse_args()
    queries = tuple(args.queries) if args.queries else _QUERIES_DEFAULT
    code = asyncio.run(_run(queries=queries))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
