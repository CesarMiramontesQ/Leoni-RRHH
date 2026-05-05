# Documentos legales de referencia

Coloca en esta carpeta los archivos legales que la IA debe usar como contexto al generar recomendaciones en actas.

Formatos soportados:
- `.pdf`
- `.txt`
- `.md`
- `.docx`

Notas:
- La funcionalidad **Generar recomendación IA** usa recuperación semántica sobre un índice **Chroma** (embeddings via Ollama). Tras agregar o cambiar PDFs, ejecuta la ingesta: `docker compose exec backend python -m scripts.actas_rag.ingest` (ver `scripts/actas_rag/README.md`).
- Si aún no hay índice, el backend puede usar como respaldo el texto completo de los archivos de esta carpeta (menos preciso).
- No es necesario adjuntar documentos por cada solicitud.
- Evita incluir archivos duplicados o no relacionados al marco legal aplicable.
- Los datos del vector store persisten en `storage/legal-rag-chroma/` (no en esta carpeta).
