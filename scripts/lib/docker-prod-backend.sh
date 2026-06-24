# Helpers Docker prod — sin --rm ni --no-deps (servidores con Compose legacy).
#
# Uso (desde otro script en scripts/):
#   source "$(dirname "$0")/lib/docker-prod-backend.sh"
#   alembic_run current
#   backend_run python -m app.utils.seed

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

_backend_container_running() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q backend 2>/dev/null | grep -q .
}

backend_run() {
  if _backend_container_running; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec backend "$@"
  else
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run backend "$@"
  fi
}

alembic_run() {
  backend_run alembic "$@"
}
