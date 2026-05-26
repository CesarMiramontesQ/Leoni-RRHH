#!/bin/sh
set -e

echo "=== Leoni RRHH — arranque producción ==="

echo "Esperando PostgreSQL externo..."
python -m app.scripts.wait_for_db

echo "Aplicando migraciones Alembic..."
alembic upgrade head

echo "Iniciando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
