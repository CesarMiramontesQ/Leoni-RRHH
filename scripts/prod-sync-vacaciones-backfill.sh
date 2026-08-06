#!/usr/bin/env bash
# Carga inicial en producción: saldo de vacaciones desde datos-analisis (TRESS) →
# levelup_vacaciones_disponibles (Bono).
#
# Necesario UNA VEZ tras desplegar: la tabla nace vacía y hasta que se llene los
# dashboards pintan «—» y crear vacaciones responde 503. Después el job de las 06:00
# y la aprobación de solicitudes la mantienen al día.
#
# Antes de sincronizar comprueba que la migración esté aplicada y que datos-analisis
# responda, para no descubrirlo a mitad del backfill.
#
# Uso (en el servidor de prod, con imagen/código ya desplegado):
#   ./scripts/prod-sync-vacaciones-backfill.sh              # dry-run (no escribe)
#   ./scripts/prod-sync-vacaciones-backfill.sh --execute    # carga inicial real
#   ./scripts/prod-sync-vacaciones-backfill.sh --no-empleado 553 --execute
#
# Variables opcionales:
#   COMPOSE_FILE=docker-compose.prod.yml
#   ENV_FILE=.env
#
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

# Revisión que crea levelup_vacaciones_disponibles.
MIGRACION_TABLA="w1c2a3c4h5e6"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

EXECUTE_FLAG=()
NO_EMPLEADO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute|-e)
      EXECUTE_FLAG=(--execute)
      shift
      ;;
    --no-empleado)
      NO_EMPLEADO="${2:-}"
      if [[ -z "$NO_EMPLEADO" ]]; then
        echo "ERROR: --no-empleado requiere un número" >&2
        exit 2
      fi
      shift 2
      ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: argumento no reconocido: $1" >&2
      echo "Uso: $0 [--execute] [--no-empleado N]" >&2
      exit 2
      ;;
  esac
done

MODO="DRY-RUN"
if [[ ${#EXECUTE_FLAG[@]} -gt 0 ]]; then
  MODO="EXECUTE"
fi
ALCANCE="empleados activos"
CLI_ARGS=()
if [[ -n "$NO_EMPLEADO" ]]; then
  ALCANCE="empleado $NO_EMPLEADO"
  CLI_ARGS=(--no-empleado "$NO_EMPLEADO")
fi

echo "========================================"
echo " Carga inicial de saldos de vacaciones"
echo "========================================"
echo " Compose:      $COMPOSE_FILE"
echo " Env:          $ENV_FILE"
echo " Alcance:      $ALCANCE"
echo " Modo:         $MODO"
echo "========================================"
echo

# 1. La imagen debe traer la migración que crea la tabla.
require_alembic_revision "$MIGRACION_TABLA"

# 2. La tabla debe existir ya en la BD (si no, falta `./scripts/prod-migrate.sh`).
# El backend puede tener el echo de SQLAlchemy activado: se filtra por el marcador `>>>`.
echo "=== Verificando que la tabla exista en Bono ==="
if ! backend_run python -c "
import asyncio, sys
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        existe = (await db.execute(
            text(\"SELECT to_regclass('public.levelup_vacaciones_disponibles')\")
        )).scalar()
    if existe is None:
        print('>>> FALTA: la tabla levelup_vacaciones_disponibles no existe.')
        sys.exit(1)
    print('>>> OK: la tabla existe.')

asyncio.run(main())
" 2>&1 | grep '^>>>' | sed 's/^>>> //'; then
  echo "" >&2
  echo "ERROR: falta la tabla o no se pudo consultar Bono." >&2
  echo "  Aplica primero las migraciones: ./scripts/prod-migrate.sh" >&2
  exit 1
fi
echo

# 3. datos-analisis debe responder: sin ella no hay nada que sincronizar.
echo "=== Verificando conexión a datos-analisis (TRESS) ==="
if ! backend_run python -m app.scripts.check_datos_analisis_connection; then
  echo "" >&2
  echo "ERROR: datos-analisis no responde. Revisa el túnel/VPN y DATOS_ANALISIS_DB_* en $ENV_FILE." >&2
  exit 1
fi
echo

# 4. Sincronización (mismo servicio que el job de las 06:00).
# `${a[@]+"${a[@]}"}`: con `set -u`, expandir un array vacío como "${a[@]}" aborta en
# Bash 3.2 (el de macOS). Esta forma es portable entre Bash 3 y 5.
backend_run python -m app.scripts.sync_vacaciones_disponibles \
  ${CLI_ARGS[@]+"${CLI_ARGS[@]}"} \
  ${EXECUTE_FLAG[@]+"${EXECUTE_FLAG[@]}"}

# 5. Estado final de la tabla, para confirmar la carga de un vistazo.
echo
echo "=== Estado de levelup_vacaciones_disponibles ==="
backend_run python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        fila = (await db.execute(text('''
            SELECT COUNT(*) AS filas,
                   COUNT(*) FILTER (WHERE dias_disponibles > 0) AS con_saldo,
                   MAX(actualizado_en) AS ultima_sync
            FROM levelup_vacaciones_disponibles
        '''))).mappings().first()
    print(f\">>> Empleados en la tabla: {fila['filas']}\")
    print(f\">>> Con saldo mayor que 0: {fila['con_saldo']}\")
    print(f\">>> Última sincronización: {fila['ultima_sync']}\")

asyncio.run(main())
" 2>&1 | grep '^>>>' | sed 's/^>>> //'

echo
if [[ "$MODO" == "DRY-RUN" ]]; then
  echo "DRY-RUN: no se escribió nada. Repite con --execute para la carga real."
else
  echo "Listo. El job de las 06:00 y la aprobación de vacaciones la mantienen al día."
fi
