#!/usr/bin/env bash
# Recuperación Alembic en producción tras pull con cambios en la cadena de migraciones.
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

DB_PORT="${DB_PORT:-5432}"

echo "=== Build backend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Limpiar revisiones fantasma en alembic_version ==="
export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM alembic_version
WHERE version_num IN (
  '943c7b427a37',
  'f1e2d3c4b5a6',
  '6e1c0bf591c7'
);
SELECT version_num FROM alembic_version ORDER BY 1;
SQL

echo "=== Si la BD está en prod v1.0 (n3), re-stamp a f36fc5feb45e ==="
CURRENT_N3="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM alembic_version WHERE version_num = 'n3o4p5q6r7s8' LIMIT 1" || true)"
if [[ "${CURRENT_N3:-}" == "1" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic stamp f36fc5feb45e
fi

echo "=== Validar un solo head de Alembic ==="
python3 scripts/check_alembic_heads.py

echo "=== Alembic heads ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic heads

echo "=== Aplicar migraciones ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic upgrade head

echo "=== Alinear alembic_version con head del repo ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps backend alembic stamp head

echo "=== Listo. Reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
