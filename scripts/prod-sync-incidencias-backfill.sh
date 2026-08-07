#!/usr/bin/env bash
# Carga inicial en producción: incidencias desde datos-analisis (TRESS) →
# levelup_incidencias_tress (Bono).
#
# Necesario UNA VEZ tras desplegar: la tabla nace vacía y hasta que se llene la página
# Incidencias muestra 0 resultados para cualquier filtro. Después el job semanal
# (miércoles 10:00) mantiene al día las últimas semanas y hasta un año al futuro.
#
# Antes de sincronizar comprueba que la migración esté aplicada y que datos-analisis
# responda, para no descubrirlo a mitad del backfill.
#
# La carga va por tramos anuales: de un solo golpe acumula ~187k filas en memoria y arma
# un IN con todos los empleados del histórico, que se acerca al límite de 32 767
# parámetros de asyncpg. Cada tramo es una transacción propia — idempotente (reejecutar
# no duplica) pero NO reanudable: si se corta, ese año se repite desde cero y no deja
# nada a medias.
#
# Uso (en el servidor de prod, con imagen/código ya desplegado):
#   ./scripts/prod-sync-incidencias-backfill.sh              # dry-run (no escribe)
#   ./scripts/prod-sync-incidencias-backfill.sh --execute    # carga inicial real
#   ./scripts/prod-sync-incidencias-backfill.sh --desde-anio 2020 --execute
#
# Variables opcionales:
#   ANIO_INICIAL=1999             # primer año del backfill
#   COMPOSE_FILE=docker-compose.prod.yml
#   ENV_FILE=.env
#
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/docker-prod-backend.sh"

# Revisión que crea levelup_incidencias_tress.
MIGRACION_TABLA="y1i2n3c4t5r6"

# dbo.AUSENCIA arranca en 1999-09-27 y dbo.PERMISO en 2001-08-16 (medido 2026-08-06).
ANIO_INICIAL="${ANIO_INICIAL:-1999}"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

EXECUTE_FLAG=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute|-e)
      EXECUTE_FLAG=(--execute)
      shift
      ;;
    --desde-anio)
      ANIO_INICIAL="${2:-}"
      if [[ ! "$ANIO_INICIAL" =~ ^[0-9]{4}$ ]]; then
        echo "ERROR: --desde-anio requiere un año de 4 dígitos" >&2
        exit 2
      fi
      shift 2
      ;;
    --help|-h)
      sed -n '2,26p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: argumento no reconocido: $1" >&2
      echo "Uso: $0 [--execute] [--desde-anio AAAA]" >&2
      exit 2
      ;;
  esac
done

MODO="DRY-RUN"
if [[ ${#EXECUTE_FLAG[@]} -gt 0 ]]; then
  MODO="EXECUTE"
fi
ANIO_FINAL="$(date +%Y)"

echo "========================================"
echo " Carga inicial de incidencias (TRESS)"
echo "========================================"
echo " Compose:      $COMPOSE_FILE"
echo " Env:          $ENV_FILE"
echo " Tramos:       ${ANIO_INICIAL}..${ANIO_FINAL} (anuales)"
echo " Modo:         $MODO"
echo "========================================"
echo

# El asyncio.Lock del servicio es intra-proceso y el CLI corre en otro (`run`/`exec`): no
# comparte lock con el backend que dispara el job semanal, así que nada impide el choque.
# No corrompe —la corrida perdedora hace rollback por el UNIQUE (origen, origen_id)— pero
# es ruido evitable.
if [[ "$(date +%u)" == "3" && "$(date +%H)" -ge 9 && "$(date +%H)" -lt 12 ]]; then
  echo "AVISO: es miércoles entre 09:00 y 12:00, la franja del job semanal." >&2
  echo "  El CLI no comparte lock con el backend: pueden chocar." >&2
  read -r -p "  ¿Continuar de todos modos? [s/N] " respuesta
  if [[ ! "$respuesta" =~ ^[sS]$ ]]; then
    echo "Cancelado." >&2
    exit 1
  fi
  echo
fi

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
            text(\"SELECT to_regclass('public.levelup_incidencias_tress')\")
        )).scalar()
    if existe is None:
        print('>>> FALTA: la tabla levelup_incidencias_tress no existe.')
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

# 4. Dry-run: un solo vistazo a los conteos antes de comprometer la carga.
if [[ ${#EXECUTE_FLAG[@]} -eq 0 ]]; then
  echo "=== Dry-run (no escribe) ==="
  backend_run python -m app.scripts.sync_incidencias_tress
  echo
  echo "DRY-RUN: no se escribió nada. Repite con --execute para la carga real."
  exit 0
fi

# 5. Carga por tramos anuales. Cada año es una transacción independiente: si uno falla,
# los anteriores quedan comiteados y basta relanzar desde ese año con --desde-anio.
for anio in $(seq "$ANIO_INICIAL" "$ANIO_FINAL"); do
  echo "=== Tramo ${anio} ==="
  if ! backend_run python -m app.scripts.sync_incidencias_tress \
      --desde "${anio}-01-01" --hasta "${anio}-12-31" --execute; then
    echo "" >&2
    echo "ERROR: falló el tramo ${anio}. Los años previos ya quedaron cargados." >&2
    echo "  Reanuda con: $0 --desde-anio ${anio} --execute" >&2
    exit 1
  fi
  echo
done

# 6. Cierre: histórico hasta el domingo anterior y ventana viva (llega un año al futuro,
# para los permisos con goce capturados por adelantado). Las dos pasadas no son atómicas
# entre sí; por idempotencia, repetir este paso solo confirma lo ya cargado.
echo "=== Cierre: histórico + ventana viva ==="
backend_run python -m app.scripts.sync_incidencias_tress --execute
echo

# 7. Estado final de la tabla, para confirmar la carga de un vistazo.
echo "=== Estado de levelup_incidencias_tress ==="
backend_run python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        fila = (await db.execute(text('''
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE origen = 'manual') AS manuales,
                   MIN(fecha_evento) AS desde,
                   MAX(fecha_evento) AS hasta,
                   MAX(synced_at) AS ultima_sync
            FROM levelup_incidencias_tress
        '''))).mappings().first()
    print(f\">>> Filas totales: {fila['total']}\")
    print(f\">>> De captura manual: {fila['manuales']}\")
    print(f\">>> Rango cubierto: {fila['desde']} → {fila['hasta']}\")
    print(f\">>> Última sync: {fila['ultima_sync']}\")

asyncio.run(main())
" 2>&1 | grep '^>>>' | sed 's/^>>> //'

echo
echo "Listo. El job de los miércoles 10:00 mantiene al día las últimas semanas y hasta un año al futuro."
