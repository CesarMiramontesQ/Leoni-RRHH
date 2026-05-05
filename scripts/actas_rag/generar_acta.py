# scripts/actas_rag/generar_acta.py
"""
Genera un borrador de acta administrativa con RAG + LLM local (Ollama).
Requiere índice creado previamente con ingest.py.

  docker compose exec backend python -m scripts.actas_rag.generar_acta
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.services.acta_rag_prompts import (
    SYSTEM_GENERAR_ACTA_FORMAL,
    USER_GENERAR_ACTA_TEMPLATE,
)
from app.services.legal_rag_service import legal_rag_service

_ACTA_START_MARKER = "<<<ACTA>>>"
_ACTA_END_MARKER = "<<<FIN>>>"


def _extract_acta_between_markers(text: str) -> str | None:
    if _ACTA_START_MARKER not in text:
        return None
    i = text.index(_ACTA_START_MARKER) + len(_ACTA_START_MARKER)
    if _ACTA_END_MARKER in text[i:]:
        j = text.index(_ACTA_END_MARKER, i)
        inner = text[i:j].strip()
    else:
        inner = text[i:].strip()
    return inner if inner else None


def _collect_interactive() -> dict:
    print("--- Datos del incidente (acta administrativa) ---\n")
    nombre = input("Nombre completo del empleado: ").strip()
    puesto_area = input("Puesto / área: ").strip()
    fecha = input("Fecha del incidente (AAAA-MM-DD o texto libre): ").strip()
    print("\nTipo de falta: 1=ausencia 2=tardanza 3=conducta 4=negligencia 5=otro")
    tipo_raw = input("Opción o texto libre: ").strip()
    tipo_map = {
        "1": "ausencia",
        "2": "tardanza",
        "3": "conducta",
        "4": "negligencia",
        "5": "otro",
    }
    tipo_falta = tipo_map.get(tipo_raw, tipo_raw or "otro")
    desc = input("\nDescripción detallada del incidente:\n").strip()
    testigos = input("\nTestigos (opcional, Enter para omitir): ").strip()
    medida = input("Medida disciplinaria sugerida (opcional): ").strip()

    return {
        "empleado_objetivo": {
            "nombre": nombre,
            "puesto_area": puesto_area,
        },
        "fecha_incidente": fecha,
        "tipo_falta": tipo_falta,
        "descripcion_hechos": desc,
        "personas_relacionadas_testigos": testigos or "(no proporcionado)",
        "medida_disciplinaria_sugerida": medida or "(no proporcionado)",
    }


def _sync_llm_acta(user_content: str) -> str:
    llm = ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_URL.rstrip("/"),
        temperature=settings.OLLAMA_ACTA_TEMPERATURE,
        num_predict=settings.OLLAMA_NUM_PREDICT,
    )
    out = llm.invoke(
        [
            SystemMessage(content=SYSTEM_GENERAR_ACTA_FORMAL),
            HumanMessage(content=user_content),
        ]
    )
    return str(getattr(out, "content", "") or "")


async def _run(*, output_path: Path | None) -> int:
    if not await legal_rag_service.has_documents():
        print(
            "No hay índice RAG en disco (o está vacío).\n"
            "Genera primero el vector store con:\n"
            "  docker compose exec backend python -m scripts.actas_rag.ingest",
            file=sys.stderr,
        )
        return 1

    datos = _collect_interactive()
    rag_query = (
        f"tipo_falta: {datos['tipo_falta']}\n"
        f"hechos: {datos['descripcion_hechos']}\n"
        f"empleado: {datos['empleado_objetivo'].get('nombre', '')}\n"
    )
    chunks = await legal_rag_service.retrieve_relevant_context(
        rag_query,
        top_k=settings.LEGAL_RAG_TOP_K,
    )
    if not chunks:
        print(
            "No se recuperaron fragmentos del vector store. "
            "Verifica documentos en reference/legal-documents/ y vuelve a ingestar.",
            file=sys.stderr,
        )
        return 1

    merged = "\n\n".join(chunks)
    lim = settings.LEGAL_REFERENCE_PROMPT_MAX_CHARS
    if len(merged) > lim:
        merged = f"{merged[:lim].rstrip()}\n... [truncado]"

    contexto = dict(datos)
    contexto["documentos_legales_referencia"] = merged

    ctx_json = json.dumps(contexto, ensure_ascii=False, indent=2)
    user_content = USER_GENERAR_ACTA_TEMPLATE.format(contexto=ctx_json)

    print("\nGenerando acta con Ollama (puede tardar)...\n", flush=True)
    texto = await asyncio.to_thread(_sync_llm_acta, user_content)

    limpio = _extract_acta_between_markers(texto) or texto.strip()

    print("=" * 72)
    print(limpio)
    print("=" * 72)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(limpio, encoding="utf-8")
        print(f"\nGuardado en: {output_path}")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera borrador de acta con RAG + Ollama (CLI).")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Opcional: guardar el texto en un archivo .txt",
    )
    args = parser.parse_args()
    code = asyncio.run(_run(output_path=args.output))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
