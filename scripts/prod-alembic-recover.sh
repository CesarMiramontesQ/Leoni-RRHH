#!/usr/bin/env bash
# Recuperación Alembic en producción tras quitar el merge duplicado 943c7b427a37.
#
# Uso en el servidor (tras git pull):
#   cd /levelup/Leoni-RRHH
#   ./scripts/prod-alembic-recover.sh
#
# Quita de alembic_version revisiones que ya no existen en el código y aplica upgrade head.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for var in DB_HOST DB_USER DB_PASSWORD DB_NAME; do
  if [[ -z "${!var:-}" ]]; then
    echo "Falta $var en $ENV_FILE"
    exit 1
  fi
done

echo "=== Build backend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Limpiar revisiones fantasma en alembic_version ==="
export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM alembic_version
WHERE version_num IN (
  '943c7b427a37',
  'f1e2d3c4b5a6'
);
SELECT version_num FROM alembic_version ORDER BY 1;
SQL

echo "=== Alembic heads (debe ser un solo head: e9f0a1b2c3d4) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic heads

echo "=== Aplicar migraciones ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic upgrade head

echo "=== Listo. Reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
