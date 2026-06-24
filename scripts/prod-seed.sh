#!/usr/bin/env bash
# Seed inicial en producción (roles + admin). Idempotente.
#
# Requiere en .env:
#   SEED_ADMIN_EMPLEADO_ID=<empleado_id real de Bono.empleados>
#
# Uso:
#   ./scripts/prod-seed.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a
if [[ -z "${SEED_ADMIN_EMPLEADO_ID:-}" ]]; then
  echo "ERROR: SEED_ADMIN_EMPLEADO_ID no está definido en $ENV_FILE" >&2
  echo "  Ejemplo: SEED_ADMIN_EMPLEADO_ID=12345  (empleado_id real en Bono.empleados)" >&2
  exit 1
fi

echo "=== Seed (roles + admin) — empleado_id=$SEED_ADMIN_EMPLEADO_ID ==="
backend_run_fresh python -m app.utils.seed
