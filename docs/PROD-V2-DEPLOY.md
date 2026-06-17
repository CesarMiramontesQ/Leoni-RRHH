# Despliegue — Producción V2.0 (`prod-v2.0`)

## Modelo

```
main  ──merge periódico──►  prod-v2.0  ──deploy──►  servidor
```

| Branch | Rol |
|--------|-----|
| `main` | Desarrollo e integración |
| `prod-v2.0` | Código de `main` + `docker-compose.prod.yml` y scripts de despliegue (heredados de prod v1.0) |

El servidor usa **PostgreSQL externo** (`DB_*` + `BONO_DB_*`). No hay contenedor Postgres en Docker.

## `.env` en el servidor

Tu `.env` actual de prod v1.0 **sigue siendo válido**. Referencia: `.env.prod.example`.

Variables obligatorias: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`.

## Despliegue inicial

```bash
git fetch origin
git checkout prod-v2.0
git pull origin prod-v2.0

docker compose -f docker-compose.prod.yml --env-file .env build
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Actualizar tras cambios (con migraciones)

```bash
git pull origin prod-v2.0
./scripts/prod-migrate.sh
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Validación

```bash
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env logs backend --tail=50
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.check_bono_productividad_connection
python3 scripts/check_alembic_heads.py
```

## Mantener prod-v2.0 al día con main

```bash
git checkout prod-v2.0
git pull origin prod-v2.0
git merge origin/main
# Resolver conflictos si los hay; NO sobrescribir docker-compose.prod.yml con el de main
python3 scripts/check_alembic_heads.py
git push origin prod-v2.0
```

## Migrar desde prod v1.0 en el servidor

1. Backup de BD.
2. `git fetch && git checkout prod-v2.0 && git pull`
3. Verificar que `.env` tenga `DB_*` y `BONO_DB_*` (sin cambios respecto a v1.0).
4. `./scripts/prod-migrate.sh`
5. `docker compose -f docker-compose.prod.yml --env-file .env up -d`
