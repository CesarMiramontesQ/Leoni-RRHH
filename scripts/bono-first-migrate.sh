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
#   ./scripts/prod-seed.sh
#
# Requisito: alembic_version vacía, o solo p2q3r4s5t6u7 si se interrumpió antes.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

STAMP_SKIP_LEGACY="p2q3r4s5t6u7"
BASELINE_REV="v1l2u3p0base"
HEAD_REV="37a743fada1c"

echo "=== Build backend (sin caché: asegura migraciones nuevas en la imagen) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend --no-cache

echo "=== Verificar migración baseline en la imagen Docker ==="
require_alembic_revision "$BASELINE_REV"
python3 scripts/check_alembic_heads.py

CURRENT_REV="$(alembic_current_revision || true)"
echo "=== Revisión actual en BD ==="
if [[ -z "$CURRENT_REV" ]]; then
  echo "(vacía — primera carga Bono)"
else
  echo "$CURRENT_REV"
fi

case "$CURRENT_REV" in
  ""|" ")
    echo ""
    echo "=== Bono first: stamp cadena legacy (sin DDL) → $STAMP_SKIP_LEGACY ==="
    alembic_run stamp "$STAMP_SKIP_LEGACY"
    ;;
  "$BASELINE_REV"|"$HEAD_REV")
    echo "=== Ya en baseline/head. Nada que migrar. ==="
    recreate_backend
    exit 0
    ;;
  "$STAMP_SKIP_LEGACY")
    echo "=== Reanudando desde $STAMP_SKIP_LEGACY (stamp previo) ==="
    ;;
  *)
    echo ""
    echo "ERROR: Revisión Alembic inesperada: '$CURRENT_REV'" >&2
    echo "  Esperado: vacío, $STAMP_SKIP_LEGACY, $BASELINE_REV o $HEAD_REV" >&2
    exit 1
    ;;
esac

echo "=== Bono first: crear tablas levelup_* → upgrade $BASELINE_REV ==="
alembic_run upgrade "$BASELINE_REV"

echo "=== Bono first: alinear head ==="
alembic_run stamp head

echo ""
echo "=== Migración Bono completada ==="
alembic_current_revision
echo ""
echo "=== Recrear backend con imagen nueva ==="
recreate_backend
echo ""
echo "Siguiente:"
echo "  ./scripts/prod-seed.sh"
