# Documentos legales de referencia

Coloca en esta carpeta los archivos legales que la IA debe usar como contexto al generar recomendaciones en actas.

Formatos soportados:
- `.pdf`
- `.txt`
- `.md`
- `.docx`

Notas:
- La funcionalidad **Generar recomendación IA** usa recuperación semántica sobre un índice **Chroma** (embeddings via Ollama). Tras agregar o cambiar PDFs, ejecuta la ingesta: `docker compose exec backend python -m scripts.actas_rag.ingest` (ver `scripts/actas_rag/README.md`). Para comprobar que el índice tiene volumen y devuelve fragmentos útiles: `docker compose exec backend python -m scripts.actas_rag.verify_rag`.
- Documentos esperados: `1044_Ley_Federal_del_Trabajo.pdf` y `HR_Reglamento Interior de Trabajo.pdf` (Reglamento Interior de Trabajo de LEONI CABLE). El texto se indexa íntegro, fragmentado por artículos cuando el PDF tiene texto seleccionable.
- Si aún no hay índice, el backend puede usar como respaldo el texto completo de los archivos de esta carpeta (menos preciso).
- No es necesario adjuntar documentos por cada solicitud.
- Evita incluir archivos duplicados o no relacionados al marco legal aplicable.
- Los datos del vector store persisten en `storage/legal-rag-chroma/` (no en esta carpeta).
