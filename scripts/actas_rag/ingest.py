# scripts/actas_rag/ingest.py
"""
Indexa PDFs y otros documentos desde reference/legal-documents/ hacia Chroma.
Ejecución típica (desde la raíz del repo, con Docker):
  docker compose exec backend python -m scripts.actas_rag.ingest
  docker compose exec backend python -m scripts.actas_rag.ingest --force
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.legal_rag_service import legal_rag_service


async def _run(*, force: bool) -> int:
    try:
        await legal_rag_service.rebuild_index(force=force)
        return 0
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - red de Ollama / deps
        print(f"Fallo inesperado: {exc}", file=sys.stderr)
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingesta documentos legales al vector store Chroma (Ollama embeddings)."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Borra el índice persistente y lo vuelve a crear desde cero.",
    )
    args = parser.parse_args()
    code = asyncio.run(_run(force=args.force))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
