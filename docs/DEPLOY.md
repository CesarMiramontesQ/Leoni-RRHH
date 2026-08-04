# Despliegue a producción

## Modelo

```
main  ──deploy──►  servidor
```

Producción se despliega **desde `main`**, usando `docker-compose.prod.yml` y los scripts de
`scripts/`. No hay rama de producción paralela: la antigua `prod-v2.0` se consolidó en `main`
(PR #73) y se eliminó — si algún runbook viejo la menciona, está desactualizado.

Para poder identificar qué versión corre en el servidor, marca el commit desplegado con un
tag de release antes de subirlo:

```bash
git tag -a v2.2.0 -m "Release 2.2.0" && git push origin v2.2.0
```

Y en el servidor despliega ese tag (`git checkout v2.2.0`) o `main` a secas, según prefieras
fijar la versión o ir siempre al día.

El servidor usa **PostgreSQL externo Bono** (`BONO_DB_*`) como BD única. No hay contenedor
Postgres en Docker.

## `.env` en el servidor

Referencia: `.env.prod.example`.

Obligatorias: `BONO_DB_HOST`, `BONO_DB_NAME`, `BONO_DB_USER`, `BONO_DB_PASSWORD`, `JWT_SECRET`.

Necesarias para las funciones de nómina —saldo de vacaciones, días tomados, home office y
los KPIs del dashboard— `DATOS_ANALISIS_DB_HOST/PORT/NAME/USER/PASSWORD/DRIVER`. Si faltan,
la aplicación **arranca igual** pero esas pantallas muestran «—» en vez de datos. Verifícalas
antes de desplegar:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.check_datos_analisis_connection
```

## Despliegue inicial

```bash
git fetch origin
git checkout main
git pull origin main

docker compose -f docker-compose.prod.yml --env-file .env build
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Actualizar tras cambios

```bash
git pull origin main            # o: git checkout <tag-de-release>

./scripts/prod-migrate.sh          # reconstruye backend + aplica migraciones
./scripts/prod-build-frontend.sh   # solo si cambió el frontend

docker compose -f docker-compose.prod.yml --env-file .env up -d
```

> `prod-migrate.sh` reconstruye **solo el backend**. Si el release toca el frontend y omites
> `prod-build-frontend.sh`, el navegador seguirá sirviendo el bundle anterior y parecerá que
> el deploy no surtió efecto.

### Antes de un release con migraciones destructivas

Revisa las revisiones nuevas (`git log --oneline <tag-anterior>..HEAD -- alembic/versions/`).
Si alguna hace `drop_table` o `drop_column`, respalda esas tablas primero: el `downgrade` de
una migración de borrado recrea la estructura, **no los datos**.

```bash
pg_dump -h "$BONO_DB_HOST" -U "$BONO_DB_USER" -d "$BONO_DB_NAME" \
  -t <tabla> > ~/respaldo_<tabla>_$(date +%F).sql
```

## Validación

```bash
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env logs backend --tail=50
docker compose -f docker-compose.prod.yml --env-file .env exec backend alembic current
python3 scripts/check_alembic_heads.py
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.check_bono_productividad_connection
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.check_datos_analisis_connection
```

`alembic current` debe coincidir con el head del repo, y `check_alembic_heads.py` debe pasar.

## BD Bono nueva (sin esquema `levelup_` previo)

Sobre una BD Bono **nueva** (ya tiene `empleados` y catálogos, pero ningún esquema
del proyecto), **no** ejecutes la cadena completa de Alembic desde cero: las
migraciones antiguas (`c06e332f3cce` … `p2q3r4s5t6u7`) crean tablas **sin** prefijo
`levelup_` e incluso tocarían catálogos de Bono. El esquema propio se crea con la
migración baseline `v1l2u3p0base`, que genera **solo** tablas `levelup_*`.

Esto lo automatiza `scripts/bono-first-migrate.sh` (stamp `p2q3r4s5t6u7` →
`upgrade v1l2u3p0base` → `stamp head`); además `scripts/prod-migrate.sh` lo invoca
solo cuando detecta `alembic_version` vacía. Primera carga:

```bash
./scripts/bono-first-migrate.sh
./scripts/prod-seed.sh
```

> El merge `37a743fada1c` unificó la cadena de `main` (`g7h8i9j0k1l2`) con el baseline
> Bono (`v1l2u3p0base`), de modo que el árbol tiene **un solo head** (`check_alembic_heads.py`
> debe pasar). `bono-first-migrate.sh` termina con `stamp head` para alinear `alembic_version`.

## Migrar desde prod v1.0 en el servidor

1. Backup de BD.
2. `git fetch && git checkout main && git pull origin main`
3. Verificar que `.env` tenga `BONO_DB_*` (BD única = Bono). Si vienes de v1.0, migra las
   antiguas `DB_*` a `BONO_DB_*`.
4. `./scripts/prod-migrate.sh` — si la BD está en `n3o4p5q6r7s8` (prod v1.0), el script hace
   stamp a `f36fc5feb45e` y luego aplica migraciones hasta head.
5. `docker compose -f docker-compose.prod.yml --env-file .env up -d`

Si falla *Can't locate revision identified by 'n3o4p5q6r7s8'*: asegúrate de tener `main` al
día (incluye las migraciones `a0b1`, `n3` y el merge `p2q3`).

## Si Alembic queda inconsistente

`./scripts/prod-alembic-recover.sh` — para errores de cadena tipo *Can't locate revision* o
`alembic_version` apuntando a una revisión que ya no existe en el repo.
