#!/bin/bash
set -e

DUMP_FILE="/dump/leoni_rh.sql"

echo "Exportando base de datos..."
pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists > "$DUMP_FILE"
echo "Dump guardado en db/leoni_rh.sql ($(du -h "$DUMP_FILE" | cut -f1))"
