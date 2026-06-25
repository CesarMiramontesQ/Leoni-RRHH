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
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# BD única = Bono: alembic_version vive en la BD Bono (BONO_DB_*).
for var in BONO_DB_HOST BONO_DB_USER BONO_DB_PASSWORD BONO_DB_NAME; do
  if [[ -z "${!var:-}" ]]; then
    echo "Falta $var en $ENV_FILE"
    exit 1
  fi
done

BONO_DB_PORT="${BONO_DB_PORT:-5432}"

echo "=== Build backend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Limpiar revisiones fantasma en alembic_version ==="
export PGPASSWORD="$BONO_DB_PASSWORD"
psql -h "$BONO_DB_HOST" -p "$BONO_DB_PORT" -U "$BONO_DB_USER" -d "$BONO_DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM alembic_version
WHERE version_num IN (
  '943c7b427a37',
  'f1e2d3c4b5a6',
  '6e1c0bf591c7'
);
SELECT version_num FROM alembic_version ORDER BY 1;
SQL

echo "=== Si la BD está en prod v1.0 (n3), re-stamp a f36fc5feb45e ==="
CURRENT_N3="$(psql -h "$BONO_DB_HOST" -p "$BONO_DB_PORT" -U "$BONO_DB_USER" -d "$BONO_DB_NAME" -tAc "SELECT 1 FROM alembic_version WHERE version_num = 'n3o4p5q6r7s8' LIMIT 1" || true)"
if [[ "${CURRENT_N3:-}" == "1" ]]; then
  alembic_run stamp f36fc5feb45e
fi

echo "=== Validar un solo head de Alembic ==="
python3 scripts/check_alembic_heads.py

echo "=== Alembic heads ==="
alembic_run heads

echo "=== Aplicar migraciones ==="
alembic_run upgrade head

echo "=== Alinear alembic_version con head del repo ==="
alembic_run stamp head

echo "=== Listo. Reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
