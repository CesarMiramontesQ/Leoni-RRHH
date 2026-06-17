#!/usr/bin/env bash
# Tras git pull (branch prod-v2.0): reconstruye backend e aplica migraciones Alembic.
#
# Uso en el servidor:
#   cd /levelup/Leoni-RRHH
#   git pull origin prod-v2.0
#   ./scripts/prod-migrate.sh
#   docker compose -f docker-compose.prod.yml --env-file .env up -d
#
# Si falla "Can't locate revision" o overlap de merges obsoletos (tras pull):
#   ./scripts/prod-alembic-recover.sh
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

echo "=== Build backend (obligatorio tras pull con migraciones nuevas) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Validar un solo head de Alembic ==="
python3 scripts/check_alembic_heads.py

echo "=== Alembic heads ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic heads

echo "=== Aplicar migraciones ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic upgrade head

echo "=== Listo. Levanta o reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
