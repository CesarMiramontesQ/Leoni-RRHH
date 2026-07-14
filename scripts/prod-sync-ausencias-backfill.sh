#!/usr/bin/env bash
# Backfill producción: FI + RE desde dbo.AUSENCIA → importadas_historico.
#
# Por defecto: 2026-06-22 → hoy (APP_TIMEZONE), tipo ALL, DRY-RUN.
# Para persistir: pasar --execute.
#
# Uso (en el servidor de prod, con imagen/código ya desplegado):
#   ./scripts/prod-sync-ausencias-backfill.sh              # dry-run
#   ./scripts/prod-sync-ausencias-backfill.sh --execute     # inserta
#
# Variables opcionales:
#   FECHA_INICIO=2026-06-22
#   FECHA_FIN=2026-07-14          # default: hoy
#   TIPO=ALL|FI|RE
#   COMPOSE_FILE=docker-compose.prod.yml
#   ENV_FILE=.env
#
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

FECHA_INICIO="${FECHA_INICIO:-2026-06-22}"
FECHA_FIN="${FECHA_FIN:-}"
TIPO="${TIPO:-ALL}"
EXECUTE_FLAG=()

for arg in "$@"; do
  case "$arg" in
    --execute|-e)
      EXECUTE_FLAG=(--execute)
      ;;
    --help|-h)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: argumento no reconocido: $arg" >&2
      echo "Uso: $0 [--execute]" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$FECHA_FIN" ]]; then
  # Hoy en el contenedor (respeta APP_TIMEZONE del .env del backend)
  FECHA_FIN="$(backend_run python -c "
from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.config import settings
print(datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date().isoformat())
" 2>/dev/null | tail -n1)"
fi

if [[ -z "$FECHA_FIN" ]]; then
  echo "ERROR: no se pudo resolver FECHA_FIN" >&2
  exit 1
fi

MODO="DRY-RUN"
if [[ ${#EXECUTE_FLAG[@]} -gt 0 ]]; then
  MODO="EXECUTE"
fi

echo "========================================"
echo " Backfill ausencias FI/RE → Bono"
echo "========================================"
echo " Compose:      $COMPOSE_FILE"
echo " Env:          $ENV_FILE"
echo " Rango:        $FECHA_INICIO .. $FECHA_FIN"
echo " Tipo:         $TIPO"
echo " Modo:         $MODO"
echo "========================================"
echo

backend_run python -m app.scripts.sync_ausencias \
  --tipo "$TIPO" \
  --fecha-inicio "$FECHA_INICIO" \
  --fecha-fin "$FECHA_FIN" \
  "${EXECUTE_FLAG[@]}"

echo
echo "Listo. Revisa el RESUMEN TOTAL arriba (insertados / duplicados / errores)."
