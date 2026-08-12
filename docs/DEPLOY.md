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

`prod-migrate.sh` termina asegurando las columnas que este proyecto agregó a
`importadas_historico` (`estado`, `semana_incidencia`). Son de una tabla de Bono, así que
no viajan en una migración Alembic, pero el INSERT del módulo de faltas y retardos las
escribe: si faltan se cae el sync **y** el registro manual de RH. El paso es idempotente y
solo aditivo. Para comprobarlas sin alterar nada:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.ensure_columnas_bono --check
```

### Página de logs del scheduler

El release que introduce `levelup_scheduler_job_log` (revisión `s1c2h3e4d5j6`) crea la tabla
**vacía**: hasta que corra el primer job, `#/ajustes/scheduler-logs` se ve sin filas, y es
correcto. No hay carga inicial que hacer — el historial no existía antes.

Es una página **oculta**: no aparece en el sidebar ni en el menú de usuario. Se entra
escribiendo la URL y solo con un usuario admin (`puede_administrar_permisos_rh`); el resto
recibe 403.

Necesita `prod-migrate.sh` (crea la tabla) **y** `prod-build-frontend.sh` (la página es
frontend nuevo).

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
./scripts/prod-sync-incidencias-backfill.sh              # dry-run: no escribe
./scripts/prod-sync-incidencias-backfill.sh --execute    # carga real, por tramos anuales
```

Como sus hermanos, el script verifica antes que la migración esté en la imagen, que la
tabla exista y que datos-analisis responda; además recorre los tramos anuales, avisa si lo
lanzas en la franja del job semanal y termina imprimiendo el estado de la tabla. Si un
tramo falla, los años previos ya quedaron cargados y lo dice: se reanuda con
`--desde-anio <año que falló> --execute`.

A mano, si prefieres controlar cada paso:

```bash
# 1. Dry-run: valida conexión a datos-analisis y reporta conteos sin escribir.
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_incidencias_tress

# 2. Carga real, por tramos anuales (recomendado, ver abajo).
for anio in $(seq 1999 $(date +%Y)); do
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

Las dos pasadas del paso 3 tampoco son atómicas entre sí: si la segunda revienta, la
primera ya quedó comiteada. Basta con relanzar la ventana viva —no el histórico completo—
con `--desde <lunes de hace 8 semanas> --hasta <hoy + 1 año>`, o repetir el paso 3 entero,
que por idempotencia solo confirmará lo ya cargado.

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
estaba en recarga; basta con volver a lanzar la corrida más tarde.

Si las bajas resultan legítimas y realmente masivas, la vía es relanzar el sync sobre un
rango **más amplio** —más semanas o el año completo—, para que las bajas queden por debajo
de la mitad del total del rango y la reconciliación proceda. **Acotar el rango es
contraproducente**: sube la fracción de bajas sobre el total y garantiza que la guarda
vuelva a dispararse. Y si las bajas no son legítimas, el freno hizo exactamente su trabajo:
revisar el estado de la réplica de nómina antes de insistir. No hay flag de forzado a
propósito.

**Si un chequeo previo falla.** `require_alembic_revision` distingue dos casos que antes se
reportaban igual: que `alembic history` **no arranque** (cada llamada crea un contenedor
nuevo, así que cualquier tropiezo lo tumba) y que la imagen **no traiga** la revisión. Si
el mensaje dice *"no se pudo ejecutar 'alembic history'"*, la imagen puede estar bien —
mira la salida que imprime debajo y revisa contenedores huérfanos (`docker ps -a | grep
backend`, luego `docker container prune`), porque estos helpers corren sin `--rm`.

### Sync automático de faltas y retardos (FI/RE → `importadas_historico`)

El mirror `dbo.AUSENCIA` + `dbo.PERMISO` (goce) → `importadas_historico` **ya no se dispara
desde la UI**. Hasta el release que introduce el job `sync_ausencias_fi_re` dependía del
botón «Sincronizar» de la página Incidencias; ese botón y su endpoint se retiraron. Ahora
corre en el scheduler del backend:

```
sync_ausencias_fi_re — miércoles 08:30, America/Mexico_City
```

No hay migración ni tabla nueva: **basta con reconstruir y reiniciar el backend** para que
quede registrado. Como el cambio también toca el frontend (el botón desaparece), el release
necesita los dos builds:

```bash
./scripts/prod-migrate.sh          # reconstruye el backend
./scripts/prod-build-frontend.sh   # si lo omites, el botón sigue apareciendo en el navegador
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

**Verificar que quedó registrado** — el conteo de jobs sube en uno (10 → 11):

```bash
docker compose -f docker-compose.prod.yml --env-file .env logs backend --tail=50 \
  | grep "APScheduler iniciado"
```

**Verificar que la hora es de CDMX y no la del servidor.** El scheduler se construye con
`ZoneInfo(APP_TIMEZONE)`, así que el cron es en hora de Ciudad de México y los cambios de
regla los resuelve tzdata; no hay offset hardcodeado. Para comprobarlo sobre el contenedor
real:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend python -c "
from datetime import datetime
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.main import registrar_jobs_programados
tz = ZoneInfo(settings.APP_TIMEZONE)
s = AsyncIOScheduler(timezone=tz); registrar_jobs_programados(s)
j = next(x for x in s.get_jobs() if x.id == 'sync_ausencias_fi_re')
print(settings.APP_TIMEZONE, j.trigger)
print('próxima:', j.trigger.get_next_fire_time(None, datetime.now(tz)))
"
```

Esperado: `America/Mexico_City cron[day_of_week='wed', hour='8', minute='30']` y una fecha
en miércoles con offset `-06:00`. Los `Adding job tentatively` que imprime son del scheduler
en memoria que crea el propio comando, no del que está corriendo.

**Tras la primera corrida**, cada ejecución deja una línea con inicio, fin, rango, semana,
`resultado=ok|error` y los conteos de leídos/insertados/actualizados/eliminados:

```bash
docker compose -f docker-compose.prod.yml --env-file .env logs backend \
  | grep "Sync ausencias FI/RE job"
```

El historial persistente sigue yendo a `levelup_bono_historico_import_log`, ahora con
`origen_ejecucion='scheduler'` (antes `manual`).

**Cerrar el hueco del release.** El job hace mirror **solo de la semana anterior**. Si la
última vez que alguien presionó el botón fue hace más de una semana, esas semanas no las
recupera solo: hay que lanzarlas una vez con el backfill, que es idempotente.

```bash
FECHA_INICIO=<lunes de la primera semana pendiente> ./scripts/prod-sync-ausencias-backfill.sh            # dry-run
FECHA_INICIO=<lunes de la primera semana pendiente> ./scripts/prod-sync-ausencias-backfill.sh --execute
```

O la corrida equivalente al job, sin rango:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_ausencias --execute
```

**No lanzar el backfill un miércoles entre las 08:30 y las 10:00.** Vale el mismo
razonamiento que para el backfill de incidencias: el `asyncio.Lock` es intra-proceso y el
CLI corre en un proceso aparte (`exec`), así que no comparte candado con el backend que
dispara los jobs. En esa franja corren `sync_ausencias_fi_re` (08:30) y
`sync_incidencias_tress` (10:00). El choque no corrompe nada —el mirror va en una sola
transacción y la corrida perdedora hace rollback—, pero es ruido evitable.

Los dos jobs comparten día y leen las mismas tablas de TRESS, pero **no dependen uno del
otro**: escriben destinos distintos (`importadas_historico` y `levelup_incidencias_tress`).
Van escalonados solo para no golpear DATOS_ANALISIS a la vez.

### Carga inicial de turnos, turno por empleado y fecha de ingreso (una sola vez)

El release que mueve los descansos y la fecha de ingreso de la Vista 360 a caché en Bono
crea `levelup_empleados_tress` **vacía** y, más importante, cambia lo que pasa cuando
`levelup_turnos_empleados` / `levelup_turnos` / `levelup_horarios` no tienen cobertura:
antes esas tablas eran solo para Ajustes Comedor y una caché pobre degradaba a una
pantalla lenta; ahora `/descansos` las usa para calcular el conteo de días de cualquier
solicitud, y un empleado sin turno utilizable recibe un **503 duro en el modal de nueva
solicitud**, no una respuesta lenta. Antes de dar el release por terminado, con el túnel a
datos-analisis arriba y **en este orden** (el catálogo alimenta a los otros dos y a la
proyección):

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_turnos_catalogo --execute
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_turnos_empleados --execute
docker compose -f docker-compose.prod.yml --env-file .env exec backend \
  python -m app.scripts.sync_empleados_tress --execute
```

**Verificar la cobertura — bloqueante.** Contar los empleados activos de Bono sin turno
utilizable:

```sql
-- Activos sin turno utilizable: si esto no es ~0, el modal de nueva solicitud dará 503.
SELECT count(*) AS activos,
       count(te.tu_codigo)                            AS con_tu_codigo,
       count(t.tu_codigo)                             AS con_turno_en_catalogo
FROM empleados e
LEFT JOIN levelup_turnos_empleados te
       ON te.no_empleado IN (e.no_empleado::text, e.no_empleado::text || '.0')
      AND te.activo
LEFT JOIN levelup_turnos t
       ON rtrim(t.tu_codigo) = te.tu_codigo
WHERE e.estado_id = 1;
```

Criterio de salida: `con_turno_en_catalogo` debe ser prácticamente igual a `activos`. Si no
lo es, **no se despliega**: se corrige el sync primero. (Ver el plan en
`docs/superpowers/plans/2026-08-11-descansos-y-fecha-ingreso-desde-bono.md`, Task 8 Step 4,
para el contexto completo de esta consulta.)

Ojo: `TurnosRepository.get_tu_codigo_de_empleado` **no** filtra por `activo`, mientras que
la consulta de arriba sí — así que el resultado es una cota inferior de la cobertura real,
no un conteo exacto.

Chequeo adicional, en la misma pasada:

```sql
SELECT max(tu_rit_ini) FROM levelup_turnos WHERE tu_rit_pat <> '';
```

Si nómina llegara a reanclar un turno rotativo a una fecha reciente, cualquier consulta con
fecha anterior a ese nuevo `tu_rit_ini` empieza a devolver 503 para toda la población de
ese turno de golpe — es la vía realista de que el fallo "fecha anterior al inicio de ciclo"
se dispare en masa, así que vale la pena vigilarla junto con la cobertura.

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
