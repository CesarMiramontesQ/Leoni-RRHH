# Caché de incidencias de TRESS en Bono (`levelup_incidencias_tress`)

Fecha: 2026-08-06

## Problema

La página **Incidencias** (módulo `faltas-retardos`, `FR_COPY.tituloPagina = "Incidencias"`)
consulta DATOS_ANALISIS (SQL Server / TRESS) en cada carga: listado, conteo total y los
cinco agregados de estadísticas. Cada request abre un motor efímero contra una BD externa
y la página queda a merced de su latencia y de su disponibilidad — hoy responde 503
cuando nómina no contesta.

Vacaciones y home office ya resolvieron esto con una caché en Bono
(`levelup_vacaciones_disponibles`, `levelup_homeoffice_tomados`). Este spec aplica la
misma estrategia a incidencias.

## Alcance

- Nueva tabla `levelup_incidencias_tress` en Bono, poblada desde DATOS_ANALISIS.
- Servicio de sincronización reutilizable, idempotente y con reconciliación de bajas.
- Carga inicial del histórico completo, excluyendo la semana en curso.
- Job semanal: miércoles 10:00, `America/Mexico_City`.
- La página lee **exclusivamente** la caché.

Fuera de alcance: botones, permisos, validaciones, endpoints, frontend, el módulo
`incidencias` (calidad/seguridad) y su tabla `levelup_incidencias`.

## Restricción sobre DATOS_ANALISIS

**Solo lectura.** Este trabajo no inserta, actualiza ni borra nada en TRESS. Se usa
`DatosAnalisisReadClient.create_read_engine()` (nunca `create_write_engine`). Las
escrituras a nómina que ya existen en el módulo (alta de suspensión y de permisos con
goce) quedan intactas y fuera de este spec.

## Fuente de datos (verificada en la BD real, 2026-08-06)

| Origen | Filtro | Filas | Rango |
|---|---|---|---|
| `dbo.AUSENCIA` | `AU_TIPO IN ('FI','RE','FJ','SUS','INC','IN1','IAC','ITR')` | 180,816 | 1999-09-27 → 2026-07-05 |
| `dbo.PERMISO` | `PM_TIPO='FJ' AND PM_CLASIFI=0 AND PM_FEC_FIN > PM_FEC_INI` | 6,946 | 2001-08-16 → 2026-07-13 |

Hechos de esquema confirmados:

- `AUSENCIA.LLAVE` y `PERMISO.LLAVE` son `int IDENTITY` → llave estable para upsert.
- El PK de `AUSENCIA` es `(AU_FECHA, CB_CODIGO)`: una fila por empleado y día.
- El empleado es `CB_CODIGO` (int), que empata con `empleados.no_empleado` en Bono.

La consulta es la que **ya usa la página**:
`app/repositories/sql/datos_analisis_faltas_retardos_base.sql`. No se reescribe ni se
amplía. Encapsula las reglas del negocio vigentes:

- emite directamente los tipos de la API, no los códigos de TRESS;
- los días `FJ` cubiertos por un permiso con goce salen solo de la rama B, como un renglón
  con rango, para no duplicarse;
- `PM_FEC_FIN` es exclusiva en TRESS: el fin que se muestra es `PM_FEC_FIN - 1 día`;
- el tipo de permiso (matrimonio / defunción / paternidad) solo vive en `PM_COMENTA`, texto
  libre, y se clasifica por palabra clave con `COLLATE Latin1_General_CI_AI`;
- `AU_STATUS` **no** se filtra a propósito: el valor 2 (descanso) solo aparece en
  incapacidades, que sí cubren días de descanso.

`incapacidad_interna` no existe en TRESS (el código `II` de `dbo.INCIDEN` tiene cero uso):
solo vive en `levelup_faltas_retardos`.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Tabla destino | `levelup_incidencias_tress` (nueva) | `levelup_incidencias` es del módulo calidad/seguridad, tiene FK desde `levelup_actas.incidencia_id` y cuatro importadores CLI que escriben ahí. Aislar evita mezclar dominios. |
| Fuente de lectura de la página | Solo la caché | Requisito explícito. Obliga a que los eventos locales también se reflejen en ella. |
| Alta manual visible al instante | No | Se acepta que lo registrado aparezca en la tabla tras la corrida del miércoles. Evita tocar la lógica de registro. |
| Ventana del sync semanal | 8 semanas móviles | Captura capturas y correcciones retroactivas sin releer 27 años cada semana. Configurable. |

## Modelo de datos

`app/models/incidencias_tress.py` → `levelup_incidencias_tress`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | PK autoincrement | |
| `origen` | `varchar(16)` | `ausencia` \| `permiso` \| `manual` |
| `origen_id` | `int` | `LLAVE` de TRESS, o `levelup_faltas_retardos.id` para `manual` |
| `no_empleado` | `int` | `CB_CODIGO` |
| `empleado_id` | `int NULL` | Resuelto contra `empleados`. NULL = existe en TRESS y no en Bono |
| `tipo` | `varchar(32)` | CHECK contra `FALTA_RETARDO_TIPOS` |
| `fecha_evento` | `date` | |
| `fecha_fin` | `date NULL` | Solo tipos de rango |
| `observaciones` | `text NULL` | |
| `fecha_registro` | `date NULL` | `PM_CAPTURA`; alimenta `created_at` de la respuesta |
| `registrado_por_id` | `int NULL` | Estampado desde `levelup_faltas_retardos` |
| `synced_at` | `timestamptz` | Última corrida que tocó la fila |
| `created_at` | `timestamptz` | |

- `UNIQUE (origen, origen_id)` — llave de idempotencia del upsert.
- Índices: `fecha_evento`, `no_empleado`, `tipo`.
- Sin FK a `empleados`: patrón Bono ya usado en `levelup_homeoffice_tomados`.
- `varchar(32) + CHECK` en vez del enum `falta_retardo_tipo_enum` que ya existe: compartir
  un tipo PG entre dos tablas hace que la migración intente recrearlo.

Migración Alembic sobre `levelup_*` únicamente, encadenada al head actual.

## Servicio de sincronización

`app/services/sync_incidencias_tress_service.py`

```python
async def sincronizar_incidencias_tress(
    db: AsyncSession,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncIncidenciasTressStats
```

`desde` y `hasta` acotan `fecha_evento` y son **inclusivos**; `None` significa sin límite
por ese lado. Todo el flujo —upsert, borrado y reflejo de locales— opera únicamente sobre
las filas cuya `fecha_evento` cae en ese rango.

Flujo:

1. Lee DATOS_ANALISIS con el SQL base, por lotes, sin filtro de empleado
   (`cb_codigos_csv = NULL`). Motor de solo lectura, `dispose()` en `finally`.
2. Resuelve `empleado_id` con `EmpleadoRepository.map_por_no_empleados` (una consulta).
3. **Upsert por `(origen, origen_id)`**: carga las llaves existentes del rango, inserta lo
   nuevo, actualiza lo que cambió, deja igual lo idéntico y refresca `synced_at` en todos
   los casos. Mismo patrón que `sync_homeoffice_tomados_service._aplicar`.
4. **Reconcilia bajas**: dentro del rango, borra las filas `ausencia` / `permiso` cuya
   `(origen, origen_id)` ya no aparece en TRESS. Sin esto, una falta cancelada en nómina
   viviría para siempre en la caché. Las filas `manual` nunca se borran por este criterio.
5. **Refleja los eventos locales** de `levelup_faltas_retardos` dentro del rango:
   - `incapacidad_interna` siempre (TRESS no la tiene);
   - el resto solo si no empata con un permiso con goce de TRESS — el mismo criterio que
     hoy aplica `FaltasRetardosService._extras_levelup`, movido a una función compartida;
   - además, para los que **sí** empatan, estampa `registrado_por_id` y `observaciones`
     sobre la fila de TRESS correspondiente, empatando por
     `(empleado_id, fecha_evento, tipo)`. Es lo que preserva la columna "registrado por"
     leyendo una sola tabla.
6. Todo en una transacción: `commit` si `execute`, `rollback` si no o si algo falla.
7. `asyncio.Lock` de módulo para que no se solapen el job y el CLI.

`SyncIncidenciasTressStats` (dataclass): `inicio`, `fin`, `duracion_segundos`,
`empleados`, `leidos`, `insertados`, `actualizados`, `omitidos`, `eliminados`, `errores`,
`mensajes_error` (acotado). Se registran en un log de inicio y otro de fin, con conteos e
IDs numéricos — nunca nombres ni observaciones.

Errores: si DATOS_ANALISIS no está configurada o no responde, levanta `ConnectionError` y
**no escribe nada**, igual que el sync de home office.

## Carga inicial

`app/scripts/sync_incidencias_tress.py`

```bash
docker-compose exec backend python -m app.scripts.sync_incidencias_tress            # dry-run
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --execute
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --desde 2025-01-01 --execute
```

- Dry-run por defecto; `--execute` escribe. Flags `--desde` / `--hasta` opcionales.
- Sin flags: **todo el histórico** hasta el **domingo anterior**, es decir excluye la
  semana en curso (lunes–domingo, `America/Mexico_City`).
- Usa el mismo servicio; no duplica lógica.
- Idempotente: reejecutarla no genera filas repetidas. Si se corta a la mitad, volver a
  lanzarla continúa sin efectos colaterales.
- Imprime el resumen de stats al terminar.

## Job semanal

En `registrar_jobs_programados` (`app/main.py`), junto a los jobs existentes:

```python
sched.add_job(
    _sync_incidencias_tress_job,
    "cron",
    day_of_week="wed",
    hour=10,
    minute=0,
    id="sync_incidencias_tress",
)
```

- El scheduler ya corre con `timezone=ZoneInfo(settings.APP_TIMEZONE)` =
  `America/Mexico_City`.
- Rango: las últimas `SYNC_INCIDENCIAS_TRESS_SEMANAS` semanas (default 8), desde el lunes
  de esa semana hasta hoy.
- El wrapper del job atrapa toda excepción, la registra y no la propaga: un fallo de
  nómina no debe tumbar el scheduler.
- Sin ejecuciones simultáneas: el `asyncio.Lock` del servicio.

## Lectura de la página

Nuevo `app/repositories/incidencias_tress_cache_repository.py`, sobre la sesión normal de
Bono, con la **misma interfaz** que hoy expone `DatosAnalisisFaltasRetardosRepository`:
`count`, `list_offset`, `aggregate_por_tipo`, `aggregate_por_mes`,
`aggregate_empleados_top`, `aggregate_por_periodo_y_tipo`.

En `FaltasRetardosService`, `_with_datos_analisis_repo()` se sustituye por el repo de
caché. Como todo vive en una sola tabla, desaparece la mezcla en memoria (`_extras_levelup`
en el camino de lectura, `_MAX_PREFETCH_TRESS`) y la paginación vuelve a resolverse
íntegramente en SQL.

Se conservan sin cambios:

- filtros: tipo, empleado, búsqueda por nombre/número, rango de fechas, área, y el
  mecanismo `_cb_codigos_filtrados`;
- la ventana por defecto de 12 meses (`VENTANA_DEFAULT_MESES`) — quitarla cambiaría lo que
  se ve al entrar a la página;
- orden `fecha_evento DESC`, `page_size` máximo de 100, y la forma de
  `FaltaRetardoResponse` (incluido el `id` sintético por origen).

Consecuencia deseada: la página deja de responder 503 por nómina caída. Si la caché aún no
tiene datos para el rango, muestra 0 resultados.

**Sin cambios**: frontend, endpoints, permisos, validaciones, `openapi.yaml`, el botón
"Sincronizar" (`POST /faltas-retardos/sincronizar-ausencias`, que sigue siendo el mirror
FI/RE → `importadas_historico`) y el alta manual con su escritura directa a TRESS.

## Pruebas

`tests/test_sync_incidencias_tress.py` (nuevo):

- inserta filas nuevas;
- actualiza una fila corregida en TRESS;
- reejecutar no duplica (idempotencia) y no cuenta cambios;
- borra de la caché lo que desapareció de TRESS dentro del rango;
- no borra filas `manual`;
- refleja `incapacidad_interna` desde `levelup_faltas_retardos`;
- estampa `registrado_por_id` / `observaciones` en la fila de TRESS que empata;
- la carga inicial excluye la semana en curso;
- las stats cuadran con lo escrito.

`tests/test_faltas_retardos_datos_analisis.py`: se reorienta a sembrar la caché en SQLite y
verificar listado, filtros, paginación y estadísticas contra ella.

Test de aislamiento: parchea `DatosAnalisisReadClient.create_read_engine` para que **lance**
y comprueba que `GET /faltas-retardos` y `GET /faltas-retardos/estadisticas` responden 200.

Los tests que cubren los botones — `test_faltas_retardos_goce`,
`test_faltas_retardos_suspension_tress`, `test_sync_ausencias_fi` — deben seguir pasando
**sin editarse**. Ése es el criterio de "no cambié comportamiento".

Test del job: `registrar_jobs_programados` deja un job con id `sync_incidencias_tress`,
trigger cron, miércoles a las 10:00.

## Etapas

1. Modelo + migración Alembic (solo `levelup_*`).
2. Servicio de sync + CLI de carga inicial, con sus tests.
3. Job semanal + test de registro.
4. Repo de lectura + switch en `FaltasRetardosService` + tests de listado y aislamiento.
5. Documentación: `CLAUDE.md` (comandos y la regla "incidencias = caché en Bono"),
   `docs/DEPLOY.md` (carga inicial en el servidor), `.env.example`
   (`SYNC_INCIDENCIAS_TRESS_SEMANAS`).

Cada etapa se verifica con `docker-compose run --rm test` antes de pasar a la siguiente.

## Riesgos

- **Volumen de la carga inicial**: ~187k filas leídas por lotes. Se corre una vez, fuera de
  horario, y es reanudable.
- **`registrado_por` diferido**: la atribución de quién registró aparece tras la corrida
  semanal. Aceptado explícitamente.
- **Alta manual diferida**: lo registrado hoy se ve en la tabla el miércoles. Aceptado
  explícitamente.
- **Empleados sin match en Bono**: se guardan con `empleado_id NULL` y la respuesta los
  expone como `0`, igual que hoy, para que el total de la página cuadre con lo que se ve.
