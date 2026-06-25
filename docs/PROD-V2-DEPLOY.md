# Despliegue — Producción V2.0 (`prod-v2.0`)

## Modelo

```
main  ──merge periódico──►  prod-v2.0  ──deploy──►  servidor
```

| Branch | Rol |
|--------|-----|
| `main` | Desarrollo e integración |
| `prod-v2.0` | Código de `main` + `docker-compose.prod.yml` y scripts de despliegue (heredados de prod v1.0) |

El servidor usa **PostgreSQL externo Bono** (`BONO_DB_*`) como BD única. No hay contenedor Postgres en Docker.

## `.env` en el servidor

Referencia: `.env.prod.example`. **BD única = Bono:** si vienes de prod v1.0, migra las variables `DB_*` a `BONO_DB_*` (la app ahora apunta su `DATABASE_URL` a la BD Bono).

Variables obligatorias: `BONO_DB_HOST`, `BONO_DB_NAME`, `BONO_DB_USER`, `BONO_DB_PASSWORD`, `JWT_SECRET`.

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

## BD Bono nueva (sin esquema `levelup_` previo)

Sobre una BD Bono **nueva** (ya tiene `empleados` y catálogos, pero ningún esquema
del proyecto), **no** ejecutes la cadena completa de Alembic desde cero: las
migraciones antiguas (`c06e332f3cce` … `p2q3r4s5t6u7`) crean tablas **sin** prefijo
`levelup_` e incluso tocarían catálogos de Bono. El esquema propio se crea con la
migración baseline `v1l2u3p0base`, que genera **solo** tablas `levelup_*`.

Procedimiento correcto (apuntar al baseline `v1l2u3p0base`, **no** a `head`):

```bash
# 1. Marcar la cadena vieja como aplicada SIN ejecutarla (stamp al PADRE del
#    baseline; no toca la BD ni crea tablas sin prefijo):
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  alembic stamp p2q3r4s5t6u7
# 2. Ejecutar SOLO el baseline → crea las tablas levelup_*:
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  alembic upgrade v1l2u3p0base
```

> Nota: el árbol de migraciones tiene actualmente 2 heads (`v1l2u3p0base` y
> `g7h8i9j0k1l2`); por eso se apunta a la revisión `v1l2u3p0base` explícita y no a
> `head`. Resolver los heads (vía `alembic merge`) es un trabajo aparte.

## Migrar desde prod v1.0 en el servidor

1. Backup de BD.
2. `git fetch && git checkout prod-v2.0 && git pull`
3. Verificar que `.env` tenga `BONO_DB_*` (BD única = Bono). Si vienes de v1.0, migra las antiguas `DB_*` a `BONO_DB_*`.
4. `./scripts/prod-migrate.sh` — si la BD está en `n3o4p5q6r7s8` (prod v1.0), el script hace stamp a `f36fc5feb45e` y luego aplica migraciones hasta head.
5. `docker compose -f docker-compose.prod.yml --env-file .env up -d`

Si falla *Can't locate revision identified by 'n3o4p5q6r7s8'*: asegúrate de tener el último `prod-v2.0` (incluye migraciones `a0b1`, `n3` y merge `p2q3`).
