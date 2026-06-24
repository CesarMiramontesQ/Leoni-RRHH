#!/usr/bin/env bash
# Primera migración sobre BD Bono existente (empleados + catálogos, sin tablas levelup_*).
#
# NO ejecuta la cadena histórica (c06 → …) que intentaría crear empleados y tablas
# sin prefijo levelup_. Solo:
#   1. stamp p2q3r4s5t6u7  — salta historial legacy
#   2. upgrade v1l2u3p0base — crea tablas levelup_* + vista levelup_vw_empleados
#   3. stamp head           — alinea alembic_version al head actual
#
# Uso en el servidor:
#   cd /levelup/Leoni-RRHH
#   ./scripts/bono-first-migrate.sh
#   ./scripts/prod-seed.sh   # o backend_run manual para seed
#   docker compose -f docker-compose.prod.yml --env-file .env up -d
#
# Requisito: alembic_version vacía o inexistente (nunca migrado con este proyecto).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

STAMP_SKIP_LEGACY="p2q3r4s5t6u7"
BASELINE_REV="v1l2u3p0base"

echo "=== Build backend (sin caché: asegura migraciones nuevas en la imagen) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend --no-cache

echo "=== Verificar migración baseline en la imagen Docker ==="
require_alembic_revision "$BASELINE_REV"
python3 scripts/check_alembic_heads.py

CURRENT_OUT="$(alembic_run current 2>&1 || true)"
echo "=== Revisión actual en BD ==="
echo "$CURRENT_OUT"

if echo "$CURRENT_OUT" | grep -qE 'v1l2u3p0base|37a743fada1c'; then
  echo "=== Ya en baseline/head. Nada que migrar. ==="
  exit 0
fi

if echo "$CURRENT_OUT" | grep -q 'p2q3r4s5t6u7'; then
  echo "=== Reanudando desde p2q3r4s5t6u7 (stamp previo) ==="
elif echo "$CURRENT_OUT" | grep -qE '[a-f0-9]{12}'; then
  echo ""
  echo "ERROR: Revisión Alembic inesperada (no es primera carga Bono)." >&2
  echo "$CURRENT_OUT" >&2
  exit 1
else
  echo ""
  echo "=== Bono first: stamp cadena legacy (sin DDL) → $STAMP_SKIP_LEGACY ==="
  alembic_run stamp "$STAMP_SKIP_LEGACY"
fi

echo "=== Bono first: crear tablas levelup_* → upgrade $BASELINE_REV ==="
alembic_run upgrade "$BASELINE_REV"

echo "=== Bono first: alinear head ==="
alembic_run stamp head

echo ""
echo "=== Migración Bono completada ==="
alembic_run current
echo ""
echo "=== Recrear backend con imagen nueva ==="
recreate_backend
echo ""
echo "Siguiente:"
echo "  ./scripts/prod-seed.sh"
