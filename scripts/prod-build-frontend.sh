#!/usr/bin/env bash
# Build y despliegue del frontend en producción.
#
# Uso:
#   ./scripts/prod-build-frontend.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo "=== Build frontend (producción) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build frontend
echo "=== Recrear contenedor frontend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d frontend
echo "=== Listo ==="
