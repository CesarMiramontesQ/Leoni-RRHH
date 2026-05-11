# RAG legal offline (Chroma + Ollama)

Indexación y borrador de actas administrativas laborales usando documentos en `reference/legal-documents/` y modelos **100% locales** vía Ollama.

## Requisitos en el host

1. Instalar [Ollama](https://ollama.com) y dejar el servicio en marcha (`ollama serve` o el daemon del sistema).

2. Descargar los modelos usados por el backend:

```bash
ollama pull nomic-embed-text
ollama pull llama3.1:8b
```

En máquina con GPU y más RAM puedes usar un modelo mayor, p. ej. `llama3.3:70b`, y configurar `OLLAMA_MODEL` en el entorno del contenedor backend.

3. Coloca los PDF (y opcionalmente `.txt`, `.md`, `.docx`) en `reference/legal-documents/` (por ejemplo Ley Federal del Trabajo y Reglamento Interior).

## Variables de entorno (Docker)

El `docker-compose.yml` ya pasa `OLLAMA_URL` apuntando a `host.docker.internal:11434` en macOS/Windows. Asegúrate de que Ollama escuche en el puerto por defecto **11434**.

Puedes sobreescribir modelo y temperatura:

```bash
export OLLAMA_MODEL=llama3.1:8b
export OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 1) Ingesta (crear / actualizar el vector store)

Crea el índice en `storage/legal-rag-chroma/` (persistente; ignorado por git).

```bash
docker compose exec backend python -m scripts.actas_rag.ingest
```

Para borrar el índice y reindexar desde cero:

```bash
docker compose exec backend python -m scripts.actas_rag.ingest --force
```

Si ves un error de conexión a Ollama, verifica que el daemon esté arriba y que desde el contenedor se alcance la URL (`OLLAMA_URL`).

Durante la ingesta, comprueba en consola que el PDF de la LFT genere **cientos o miles de fragmentos** (p. ej. `→ 842 fragmentos`). Si ves `→ 0 fragmentos` o **Sin texto extraíble**, el PDF es imagen escaneada: necesitas versión con texto seleccionable u OCR antes de indexar.

## 1b) Verificar el índice (recomendado tras ingesta)

```bash
docker compose exec backend python -m scripts.actas_rag.verify_rag
```

Muestra el número de chunks, ejecuta búsquedas de prueba y el tamaño aproximado del contexto legal que llegaría al modelo. Consultas extra:

```bash
docker compose exec backend python -m scripts.actas_rag.verify_rag -q "incumplimiento obligaciones"
```

## 2) Generar borrador de acta (CLI)

Requiere haber ejecutado la ingesta antes.

```bash
docker compose exec backend python -m scripts.actas_rag.generar_acta
```

Opcional: guardar salida en archivo:

```bash
docker compose exec backend python -m scripts.actas_rag.generar_acta -o /tmp/acta_borrador.txt
```

## 3) Actas en la aplicación web

El endpoint **POST** `/api/v1/actas/{id}/mejorar-ia` (rol con permiso) genera el texto con el mismo RAG + prompt formal, lo persiste en `ia_recomendacion` y el detalle de acta lo muestra en el modal.

## Solución de problemas

| Síntoma | Acción |
|--------|--------|
| `No se pudo conectar con Ollama` | Arranca Ollama; comprueba firewall/puerto 11434. |
| `falló el modelo de embeddings` | `ollama pull nomic-embed-text`. |
| Índice vacío / sin fragmentos | PDF escaneado sin OCR: no hay texto; añade PDF con texto seleccionable u OCR. |
| Pocos chunks (menos de 100) para la LFT completa | Misma causa (poco texto extraíble) o PDF corrupto; ejecuta `verify_rag` y reingesta con `--force`. |
| La IA dice “sin cobertura RAG” pero el índice existe | Reingesta tras cambiar el PDF; sube `LEGAL_RAG_TOP_K` / `LEGAL_REFERENCE_PROMPT_MAX_CHARS` en `.env` si hace falta más contexto (ver `app/core/config.py`). |
| Backend no ve Ollama | En Linux Docker, `host.docker.internal` puede no existir: usa la IP del host o `--network host` según tu entorno. |

El índice JSON legado `.rag_index.json` ya no se usa; la fuente de verdad es la carpeta Chroma bajo `storage/legal-rag-chroma/`.
