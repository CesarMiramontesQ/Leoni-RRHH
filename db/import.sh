#!/bin/bash
set -e

DUMP_FILE="/dump/leoni_rh.sql"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: No existe db/leoni_rh.sql — pide el archivo a tu equipo o ejecuta el seed."
  exit 1
fi

echo "Importando base de datos..."
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE"
echo "Importación completada."
