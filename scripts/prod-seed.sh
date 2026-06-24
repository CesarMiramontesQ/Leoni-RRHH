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

echo "=== Seed (roles + admin) ==="
backend_run_fresh python -m app.utils.seed
