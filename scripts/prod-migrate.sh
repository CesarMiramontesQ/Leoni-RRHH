#!/usr/bin/env bash
# Tras git pull (branch prod-v2.0): reconstruye backend e aplica migraciones Alembic.
#
# Uso en el servidor:
#   cd /levelup/Leoni-RRHH
#   git pull origin prod-v2.0
#   ./scripts/prod-migrate.sh
#   docker compose -f docker-compose.prod.yml --env-file .env up -d
#
# Primera carga sobre BD Bono (sin alembic_version): usar bono-first-migrate.sh
#   ./scripts/bono-first-migrate.sh
#
# Si falla "Can't locate revision" u otros conflictos de cadena:
#   ./scripts/prod-alembic-recover.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

echo "=== Build backend (obligatorio tras pull con migraciones nuevas) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Validar un solo head de Alembic ==="
python3 scripts/check_alembic_heads.py

echo "=== Alembic heads ==="
alembic_run heads

echo "=== Revisión actual en BD ==="
CURRENT_OUT="$(alembic_run current 2>&1 || true)"
echo "$CURRENT_OUT"

# BD Bono sin historial Alembic: no usar upgrade head (intentaría crear empleados).
if ! echo "$CURRENT_OUT" | grep -qE '[a-f0-9]{12}'; then
  echo ""
  echo "=== BD sin revisión Alembic: delegando a bono-first-migrate.sh ==="
  exec "$(dirname "$0")/bono-first-migrate.sh"
fi

# Prod v1.0 dejó alembic_version en n3; prod-v2.0 continúa desde f36fc (merge vacío equivalente).
if echo "$CURRENT_OUT" | grep -qE '(^|[^a-z0-9])n3o4p5q6r7s8([^a-z0-9]|$)'; then
  echo "=== Prod v1.0 detectado (n3): stamp a f36fc5feb45e antes de upgrade ==="
  alembic_run stamp f36fc5feb45e
fi

echo "=== Aplicar migraciones ==="
alembic_run upgrade head

echo "=== Alinear alembic_version con head del repo (merge prod v1 + v2) ==="
alembic_run stamp head

echo "=== Listo. Levanta o reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
