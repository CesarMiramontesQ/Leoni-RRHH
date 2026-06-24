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

echo "=== Build backend ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend

echo "=== Validar un solo head de Alembic ==="
python3 scripts/check_alembic_heads.py

CURRENT_OUT="$(alembic_run current 2>&1 || true)"
echo "=== Revisión actual en BD ==="
echo "$CURRENT_OUT"

if echo "$CURRENT_OUT" | grep -qE '[a-f0-9]{12}'; then
  echo ""
  echo "ERROR: La BD ya tiene una revisión Alembic registrada." >&2
  echo "  bono-first-migrate.sh es solo para la primera carga sobre Bono." >&2
  echo "  Si vienes de prod v1.0, usa: ./scripts/prod-migrate.sh" >&2
  echo "  Si quedó a medias tras un fallo, revisa alembic_version y tablas huérfanas." >&2
  exit 1
fi

echo ""
echo "=== Bono first: stamp cadena legacy (sin DDL) → $STAMP_SKIP_LEGACY ==="
alembic_run stamp "$STAMP_SKIP_LEGACY"

echo "=== Bono first: crear tablas levelup_* → upgrade $BASELINE_REV ==="
alembic_run upgrade "$BASELINE_REV"

echo "=== Bono first: alinear head ==="
alembic_run stamp head

echo ""
echo "=== Migración Bono completada ==="
alembic_run current
echo ""
echo "Siguiente:"
echo "  ./scripts/prod-seed.sh"
echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
