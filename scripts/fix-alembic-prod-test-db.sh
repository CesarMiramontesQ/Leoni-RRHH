#!/usr/bin/env bash
# Alinea alembic_version en Postgres de dev cuando se probó prod con una BD
# migrada desde main (revisión 6e1c0bf591c7 u otros heads huérfanos).
#
# Uso (Postgres dev en leoni_rh_db o leoni_rh_db_dev):
#   ./scripts/fix-alembic-prod-test-db.sh
# Luego:
#   ./scripts/up-prod-mac.sh
set -e
cd "$(dirname "$0")/.."

PG_CONTAINER="${PG_CONTAINER:-}"
for c in leoni_rh_db leoni_rh_db_dev; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    PG_CONTAINER="$c"
    break
  fi
done

if [[ -z "$PG_CONTAINER" ]]; then
  echo "No hay contenedor leoni_rh_db ni leoni_rh_db_dev en ejecución."
  exit 1
fi

echo "Usando contenedor Postgres: $PG_CONTAINER"

docker exec "$PG_CONTAINER" psql -U leoni -d leoni_rh -v ON_ERROR_STOP=1 <<'SQL'
-- Quitar revisión de main que no existe en release/cm/produccion-v1.0
DELETE FROM alembic_version WHERE version_num = '6e1c0bf591c7';

-- Marcar ramas cuyo esquema ya está aplicado en BD de dev
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES
  ('034fd01d2eae'),
  ('92b8f9f2627c'),
  ('g8b9c0d1e2f3'),
  ('d0e1f2a3b4c5')
ON CONFLICT DO NOTHING;

SELECT version_num FROM alembic_version ORDER BY 1;
SQL

echo ""
echo "Listo. Ejecuta migraciones pendientes (bono log + merge head):"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.prod.mac.yml \\"
echo "    --env-file .env.prod.test run --rm --no-deps backend alembic upgrade head"
echo ""
echo "Luego reinicia prod: ./scripts/up-prod-mac.sh"
