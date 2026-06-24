#!/usr/bin/env bash
# Seed inicial en producción (roles + admin). Idempotente.
#
# Uso:
#   ./scripts/prod-seed.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

echo "=== Seed (roles + admin) ==="
backend_run python -m app.utils.seed
