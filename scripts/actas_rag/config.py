# scripts/actas_rag/config.py
"""
Parámetros expuestos para la CLI (delegan en app.core.config).
Mantiene una sola fuente de verdad con el backend en Docker (variables OLLAMA_*, LEGAL_RAG_*).
"""

from app.core.config import settings

# Modelos Ollama
OLLAMA_URL = settings.OLLAMA_URL
OLLAMA_MODEL = settings.OLLAMA_MODEL
OLLAMA_EMBED_MODEL = settings.OLLAMA_EMBED_MODEL
OLLAMA_ACTA_TEMPERATURE = settings.OLLAMA_ACTA_TEMPERATURE

# RAG
LEGAL_RAG_CHROMA_PATH = settings.LEGAL_RAG_CHROMA_PATH
LEGAL_RAG_TOP_K = settings.LEGAL_RAG_TOP_K
LEGAL_RAG_CHUNK_SIZE = settings.LEGAL_RAG_CHUNK_SIZE
LEGAL_RAG_CHUNK_OVERLAP = settings.LEGAL_RAG_CHUNK_OVERLAP
