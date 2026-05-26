#!/usr/bin/env bash
# Baja solo prod (leoni-rh-prod), sin afectar dev.
set -e
cd "$(dirname "$0")/.."

ENV_FILE="${1:-.env.prod.test}"

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.prod.mac.yml \
  --env-file "$ENV_FILE" \
  down
