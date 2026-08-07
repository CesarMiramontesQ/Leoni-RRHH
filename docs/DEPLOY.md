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

### Carga inicial de saldos de vacaciones (una sola vez)

El release que introduce `levelup_vacaciones_disponibles` (revisión `w1c2a3c4h5e6`) crea la
tabla **vacía**. Hasta llenarla, los dashboards pintan «—» en vacaciones y crear una
solicitud responde 503. Después del `prod-migrate.sh`, con el túnel a datos-analisis arriba:

```bash
./scripts/prod-sync-vacaciones-backfill.sh              # dry-run: no escribe
./scripts/prod-sync-vacaciones-backfill.sh --execute    # carga real (~800 empleados)
```

El script verifica antes que la migración esté en la imagen, que la tabla exista y que
datos-analisis responda; al terminar imprime cuántos empleados quedaron cargados. A partir
de ahí la mantienen al día el job de las **06:00** y la aprobación de solicitudes de
vacaciones, así que no hay que repetirlo (`--no-empleado N` refresca a uno suelto).

### Carga inicial de días de home office tomados (una sola vez)

El release que introduce `levelup_homeoffice_tomados` (revisión `x1h2o3f4f5i6`) crea la
tabla **vacía**. Hasta llenarla, el dashboard pinta 0 días de home office —un dato
plausible pero falso, no un «—»— para todos los empleados. Después del `prod-migrate.sh`,
con el túnel a datos-analisis arriba:

```bash
./scripts/prod-sync-homeoffice-backfill.sh              # dry-run: no escribe
./scripts/prod-sync-homeoffice-backfill.sh --execute    # carga real (~800 empleados)
```

El script verifica antes que la migración esté en la imagen, que la tabla exista y que
datos-analisis responda; al terminar imprime cuántos empleados quedaron cargados. A partir
de ahí la mantienen al día el job de las **06:00** y la aprobación de solicitudes de home
office, así que no hay que repetirlo (`--no-empleado N` refresca a uno suelto).

### Carga inicial de incidencias (levelup_incidencias_tress)

El release que introduce `levelup_incidencias_tress` (revisión `y1i2n3c4t5r6`) crea la
tabla **vacía**. Hasta llenarla, la página Incidencias muestra 0 resultados para cualquier
filtro. La carga inicial trae todo el histórico excluyendo la semana en curso: medido
contra DATOS_ANALISIS el 2026-08-06, eran 180,816 filas en `dbo.AUSENCIA` de los tipos
relevantes (`FI, RE, FJ, SUS, INC, IN1, IAC, ITR`, desde 1999-09-27) más 6,946 permisos en
`dbo.PERMISO` con `PM_TIPO='FJ' AND PM_CLASIFI=0` (desde 2001-08-16). Es una referencia de
orden de magnitud, no un conteo exacto a esperar: crece con el tiempo, y el total que
termina sincronizado es **algo menor** que la suma, porque el SQL descarta los días `FJ`
que ya están cubiertos por un permiso con goce (para no duplicarlos). Después del
`prod-migrate.sh`, con el túnel a datos-analisis arriba:

```bash
# 1. Dry-run: valida conexión a datos-analisis y reporta conteos sin escribir.
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_incidencias_tress

# 2. Carga real, por tramos anuales (recomendado, ver abajo).
for anio in $(seq 1999 2026); do
  docker compose -f docker-compose.prod.yml --env-file .env exec backend \
    python -m app.scripts.sync_incidencias_tress \
      --desde ${anio}-01-01 --hasta ${anio}-12-31 --execute
done

# 3. Cerrar con la corrida sin flags: histórico hasta el domingo anterior y, en una
#    segunda pasada, la ventana viva —que llega un año al futuro y trae los permisos
#    ya capturados por adelantado (matrimonio, paternidad)—.
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_incidencias_tress --execute
```

**Correr el backfill por tramos anuales.** De un solo golpe el proceso acumula las ~187k
filas en memoria y resuelve un `IN` con todos los números de empleado distintos del
histórico, que puede acercarse al límite de 32 767 parámetros de asyncpg. Por tramos
(`--desde 1999-01-01 --hasta 1999-12-31`, y así año por año) desaparecen los dos riesgos:
cada corrida trae unos miles de filas y unos cientos de empleados.

Es idempotente: reejecutarla no duplica filas. **No es reanudable**: cada corrida va en una
transacción única, así que si se corta a la mitad no continúa donde iba — vuelve a empezar
ese tramo desde cero. Lo que sí es cierto es que no deja efectos colaterales: la
transacción hace rollback y la tabla queda como estaba antes del tramo.

**No lanzar el backfill un miércoles a las 10:00.** El `asyncio.Lock` del servicio es
intra-proceso, y el CLI corre en un proceso aparte (`exec`): no comparte lock con el
backend que dispara el job semanal, así que nada impide que coincidan. El choque sería
ruidoso —violaciones del `UNIQUE (origen, origen_id)` que abortan la transacción— pero no
corrompe nada: la corrida perdedora hace rollback. Aun así, elegir otra franja.

**Verificar que quedó bien:**

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text('SELECT count(*), max(synced_at) FROM levelup_incidencias_tress'))
        print(r.first())

asyncio.run(main())
"
```

A partir de ahí el job semanal (miércoles 10:00, `America/Mexico_City`) mantiene al día
las últimas `SYNC_INCIDENCIAS_TRESS_SEMANAS` semanas (default 8) y hasta un año hacia
adelante, así que no hay que repetir la carga inicial. Para comprobar que el job quedó
registrado, buscar `APScheduler iniciado con N jobs` en los logs del backend al arrancar, y
`Sync incidencias job |` tras cada corrida.

**Reparar un hueco si el job no corrió.** La ventana es móvil, no acumulativa: si el
backend estuvo caído más de 8 semanas seguidas (o el job falló todas esas veces), el
periodo perdido queda fuera de la ventana y **no se recupera solo**. Hay que lanzar el CLI
sobre ese periodo:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_incidencias_tress \
    --desde 2026-01-01 --hasta 2026-03-31 --execute
```

Buscar en los logs `Sync incidencias | fin |` para saber cuándo fue la última corrida
buena, y cubrir desde ahí. Si el rango es largo, partirlo por años como en el backfill.

**Si el log dice `borrado omitido`**, la corrida escribió altas y cambios pero **no** borró:
el sync frena la reconciliación cuando TRESS devuelve cero filas, o cuando desaparecería
más de la mitad de lo que había en el rango. Casi siempre significa que datos-analisis
estaba en recarga; basta con volver a lanzar la corrida más tarde. Si las bajas son reales,
relanzar acotando el rango a lo que sí cambió.

No hay wrapper como `prod-sync-vacaciones-backfill.sh`: la carga inicial se corre a mano
con el CLI de arriba.

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
