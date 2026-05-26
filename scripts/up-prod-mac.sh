#!/usr/bin/env bash
# Producción V1.0 en Mac: solo backend + frontend (sin Postgres en Docker).
# Puertos 8001 (API) y 8080 (web) para no chocar con dev (8000 / 5173).
set -e
cd "$(dirname "$0")/.."

ENV_FILE="${1:-.env.prod.test}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE — copia: cp .env.prod.example .env.prod.test"
  exit 1
fi

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.prod.mac.yml \
  --env-file "$ENV_FILE" \
  up -d --build

echo ""
echo "Prod (leoni-rh-prod):"
echo "  Frontend: http://localhost:8080"
echo "  API docs: http://localhost:8001/docs"
echo "  Contenedores: leoni_rh_backend_prod, leoni_rh_frontend_prod"
echo ""
echo "Parar solo prod:"
echo "  ./scripts/down-prod-mac.sh"
