#!/usr/bin/env bash
# Tras git pull: reconstruye el backend y aplica migraciones Alembic.
#
# Reconstruye SOLO el backend. Si el release toca el frontend, ejecuta ademas
# ./scripts/prod-build-frontend.sh o el navegador seguira sirviendo el bundle viejo.
#
# Uso en el servidor:
#   cd /levelup/Leoni-RRHH
#   git pull origin main
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
CURRENT_REV="$(alembic_current_revision || true)"
if [[ -z "$CURRENT_REV" ]]; then
  echo "(vacía)"
else
  echo "$CURRENT_REV"
fi

# BD Bono sin historial Alembic: no usar upgrade head (intentaría crear empleados).
if [[ -z "$CURRENT_REV" ]]; then
  echo ""
  echo "=== BD sin revisión Alembic: delegando a bono-first-migrate.sh ==="
  exec "$(dirname "$0")/bono-first-migrate.sh"
fi

# Prod v1.0 dejó alembic_version en n3; la cadena actual continúa desde f36fc (merge vacío equivalente).
if [[ "$CURRENT_REV" == "n3o4p5q6r7s8" ]]; then
  echo "=== Prod v1.0 detectado (n3): stamp a f36fc5feb45e antes de upgrade ==="
  alembic_run stamp f36fc5feb45e
fi

echo "=== Aplicar migraciones ==="
alembic_run upgrade head

echo "=== Alinear alembic_version con head del repo (merge prod v1 + v2) ==="
alembic_run stamp head

echo "=== Listo. Levanta o reinicia: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d ==="
