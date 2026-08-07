# Helpers Docker prod — sin --rm ni --no-deps (servidores con Compose legacy).
#
# Uso (desde otro script en scripts/):
#   source "$(dirname "$0")/lib/docker-prod-backend.sh"
#   alembic_run current
#   backend_run python -m app.utils.seed
#
# Alembic SIEMPRE usa `run` (contenedor nuevo con la imagen recién buildeada).
# NO usar `exec` para migraciones: el backend en `up -d` puede ser una imagen vieja.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

_backend_container_running() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q backend 2>/dev/null | grep -q .
}

# Contenedor efímero con la imagen actual (alembic, diagnósticos).
backend_run_fresh() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run backend "$@"
}

backend_run() {
  if _backend_container_running; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec backend "$@"
  else
    backend_run_fresh "$@"
  fi
}

alembic_run() {
  backend_run_fresh alembic "$@"
}

# Revisión en alembic_version (vacío si la BD nunca fue migrada).
# Alembic escribe la revisión en stdout; logs INFO van a stderr.
alembic_current_revision() {
  alembic_run current 2>/dev/null | awk 'NF { print $1; exit }'
}

# Falla con mensaje claro si la imagen no incluye una revisión Alembic.
#
# Distingue los dos fallos, que antes se reportaban igual: que `alembic history` no
# arranque (contenedor nuevo por invocación: cualquier tropiezo lo tumba) NO es lo mismo
# que la imagen no traiga la revisión. Silenciar stderr hacía que un contenedor caído se
# leyera como "falta la migración" y mandaba a reconstruir una imagen que estaba bien.
require_alembic_revision() {
  local rev="$1"
  # `rc`, no `status`: esta lib se hace `source` y en zsh `status` es de solo lectura.
  local salida rc=0
  salida="$(alembic_run history 2>&1)" || rc=$?

  if [[ $rc -ne 0 ]]; then
    echo "ERROR: no se pudo ejecutar 'alembic history' (status ${rc})." >&2
    echo "  Esto NO significa que falte la migración: el comando ni siquiera corrió." >&2
    echo "  Salida:" >&2
    echo "$salida" | sed 's/^/    /' >&2
    echo "  Revisa contenedores huérfanos (este helper corre sin --rm):" >&2
    echo "    docker ps -a | grep backend   →   docker container prune" >&2
    exit 1
  fi

  if ! grep -q "$rev" <<<"$salida"; then
    echo "ERROR: Alembic no encuentra la revisión '${rev}' en la imagen Docker." >&2
    echo "  Host:  ls alembic/versions/*${rev}*" >&2
    echo "  Build: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE build backend --no-cache" >&2
    echo "  Test:  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE run backend alembic history | grep ${rev}" >&2
    exit 1
  fi
}

recreate_backend() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate backend
}
