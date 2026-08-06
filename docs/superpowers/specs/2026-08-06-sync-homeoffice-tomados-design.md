# Caché en Bono de los días de Home Office tomados

**Fecha:** 2026-08-06
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Los días de Home Office tomados por un empleado se leen hoy **en vivo** desde
`DATOS_ANALISIS` (SQL Server de TRESS) en cada carga del dashboard:
`dashboard_kpis_service._home_office_dias_anio` abre un motor, consulta `dbo.PERMISO` y
lo desecha. Es el último dato de nómina que bloquea una carga de página; el saldo de
vacaciones ya se resolvió con la caché `levelup_vacaciones_disponibles`.

Este spec replica ese patrón para Home Office: una tabla en Bono, un servicio de
sincronización central y tres disparadores contra la misma función.

## Hallazgos del repositorio (base del diseño)

Nada de lo que sigue es supuesto; sale de leer el código actual.

- **Fuente de datos:** `dbo.PERMISO` en `DATOS_ANALISIS`. Home Office = `RTRIM(PM_TIPO) = 'HO'`
  (catálogo `dbo.INCIDEN`, `TB_CODIGO = 'HO '`; `PM_TIPO` es `char(3)` con padding).
  Los días son `SUM(PM_DIAS)`.
- **Rango:** se filtra por `PM_FEC_INI`, **no** por `PM_FEC_FIN`, porque en TRESS la fecha
  fin es exclusiva (el insert guarda `DATEADD(day, 1, fecha_fin_real)`). El rango es
  semiabierto `[desde, hasta)`.
- **Periodo de negocio:** año calendario. `dashboard_kpis_service.rango_anio_en_curso`
  devuelve `[1-ene del año, 1-ene del siguiente)`. No hay ciclo de aniversario aquí (eso
  aplica solo a vacaciones).
- **Estados:** `dbo.PERMISO` no tiene columna de estado. El filtro de validez ocurre
  **antes**: la fila solo se inserta al aprobar, en
  `SolicitudService._aprobar_final_con_tress` → `registrar_home_office_en_tress`. Una
  solicitud pendiente o rechazada nunca llega a TRESS, así que no hay estados que excluir
  en la consulta.
- **Cancelación de una solicitud aprobada: no existe.** `SolicitudService.cancelar_solicitud`
  rechaza cualquier estado distinto de `pending`, y el proyecto tiene prohibido borrar filas
  en `DATOS_ANALISIS`. No hay, por tanto, un camino real que reduzca el total ya contado.
- **Granularidad de la solicitud:** `_validar_creacion_home_office` exige `fecha_fin == fecha_inicio`
  (un día) y máximo una solicitud activa por mes. El techo práctico es 12 días al año. Aun así
  el conteo se hace con `SUM(PM_DIAS)` para no depender de esa regla.
- **Consumidores de la lectura directa:** uno solo, `dashboard_kpis_service`, que alimenta
  `DashboardKpisResponse.home_office_dias_anio`. Ningún otro servicio, endpoint, reporte ni
  módulo de frontend lee Home Office de `DATOS_ANALISIS`.
- **Fuera de alcance:** `SolicitudRepository.count_home_office_activos_en_mes` cuenta
  solicitudes de la tabla local de Bono para la regla «un día por mes». No toca
  `DATOS_ANALISIS` y no se modifica.

## Diseño

### 1. Tabla `levelup_homeoffice_tomados`

| columna | tipo | notas |
| --- | --- | --- |
| `id` | Integer PK autoincrement | |
| `no_empleado` | Integer NOT NULL | mismo identificador que `levelup_vacaciones_disponibles`; sin FK declarativa (patrón Bono / `levelup_emails`) |
| `anio` | Integer NOT NULL | año calendario del conteo |
| `dias_tomados` | Numeric(6,2) NOT NULL default 0 | `PM_DIAS` es numérico en TRESS |
| `actualizado_en` | DateTime(timezone=True) NOT NULL | `server_default=func.now()`, `onupdate=func.now()` |

Restricción única `(no_empleado, anio)`: es lo que hace posible el upsert y descarta
duplicados a nivel de base de datos. El índice compuesto que genera cubre además el lookup
por `no_empleado`, así que no se añade un segundo índice.

Modelo `HomeOfficeTomados` en `app/models/homeoffice_tomados.py`, con `relationship`
`viewonly` a `Empleado` por `no_empleado`, igual que `VacacionesDisponibles`.

Migración Alembic nueva que solo hace `create_table` de una tabla `levelup_*`.

### 2. Lectura desde `DATOS_ANALISIS`: una sola consulta agregada

Nuevo `app/repositories/sql/datos_analisis_home_office_dias_por_empleado.sql`, con el mismo
`WHERE` que la consulta actual pero agregando por empleado:

```sql
SELECT CB_CODIGO AS no_empleado, ISNULL(SUM(PM_DIAS), 0) AS dias_home_office
FROM dbo.PERMISO
WHERE RTRIM(PM_TIPO) = 'HO'
  AND PM_FEC_INI >= :desde
  AND PM_FEC_INI < :hasta
GROUP BY CB_CODIGO;
```

`DatosAnalisisHomeOfficeReadRepository.get_dias_por_empleado(desde, hasta) -> dict[int, Decimal]`.

**Decisión: la consulta no filtra por empleado, ni siquiera en la sincronización individual.**
Son del orden de 800 grupos sobre unas 10.000 filas; filtrar en memoria evita un `IN` con 800
binds, evita `expanding bindparam` y —lo importante— deja **un solo camino de código** para la
corrida masiva y la individual, en vez de dos consultas que hay que mantener en paralelo. El
costo extra en la sincronización posterior a una aprobación es despreciable frente al `INSERT`
que esa misma aprobación ya hace contra TRESS.

`get_dias_en_rango`, su archivo SQL y sus pruebas quedan sin ningún consumidor tras el cambio
y se eliminan. Es el código que este cambio deja muerto, no una refactorización ajena.

### 3. Servicio central `app/services/sync_homeoffice_tomados_service.py`

Espeja `sync_vacaciones_disponibles_service`:

- `sincronizar_homeoffice_tomados(db, *, no_empleado=None, anio=None, origen="scheduler", execute=True) -> SyncHomeOfficeStats`
  - Sin `no_empleado`: todos los activos, vía `EmpleadoRepository.list_no_empleados_activos(settings.ESTADOS_ACTIVOS_IDS)`.
  - Con `no_empleado`: solo ese.
  - `anio` por defecto el año en curso.
  - `execute=False` hace rollback (dry-run del CLI).
- `sincronizar_homeoffice_empleado_background(no_empleado, solicitud_id=None)` — abre su propia
  sesión y **nunca levanta**: la aprobación ya está confirmada cuando esto corre, y una caché
  rancia se corrige en la corrida de las 06:00. Revertir una aprobación por un fallo de
  sincronización sería peor.
- `asyncio.Lock` a nivel de módulo, tomado **solo** por la corrida masiva —igual que en
  vacaciones—. La individual escribe una fila y es idempotente.
- Si `DatosAnalisisReadClient.create_read_engine()` devuelve `None` o falla, se levanta
  `ConnectionError` y no se escribe nada.

**Empleado activo sin filas de Home Office ⇒ se escribe `0`**, no se omite. Así el `0` que ve
el dashboard es un dato sincronizado y no la ausencia de uno.

`SyncHomeOfficeStats`: `consultados`, `insertados`, `actualizados`, `omitidos`, `errores`,
`mensajes_error`. `actualizado_en` se refresca en cada corrida exitosa cambien o no los días,
para poder distinguir «sin movimiento» de «caché rancia».

Repositorio `app/repositories/homeoffice_tomados_repository.py` con `get_by_no_empleado_anio`
y `map_existentes(anio, no_empleados)` — este último carga las filas de una vez para decidir
insert/update en memoria, en lugar de un SELECT por empleado.

### 4. Disparadores

Los tres llaman a la misma función; no hay lógica duplicada entre ellos.

1. **Job diario.** `_sync_homeoffice_tomados_job` registrado en `registrar_jobs_programados`
   (`app/main.py`) como `cron hour=6 minute=0`, id `sync_homeoffice_tomados`. Zona horaria: la
   del scheduler, `settings.APP_TIMEZONE`. Es un job **separado** del de vacaciones aunque
   compartan la hora: un fallo de uno no debe impedir el otro.
2. **Aprobación.** En `_aprobar_final_con_tress`, cuando `solicitud.tipo == "home_office"`,
   `background_tasks.add_task(sincronizar_homeoffice_empleado_background, no_empleado, solicitud_id)`.
   Va junto al de vacaciones que ya existe: Starlette ejecuta las BackgroundTasks **después** de
   la respuesta, es decir después del commit de `get_db`, de modo que nunca se sincroniza sobre
   una aprobación no confirmada.
3. **CLI.** `python -m app.scripts.sync_homeoffice_tomados`, dry-run por defecto, con
   `--execute` y `--no-empleado N`. Necesario para el backfill inicial, cuando la tabla está
   vacía hasta la primera corrida.

No hay disparador adicional para «creada directamente como aprobada» ni para cancelaciones:
toda aprobación de Home Office pasa por `_aprobar_final_con_tress`, y no existe forma de
cancelar una solicitud ya aprobada (ver hallazgos). Crear una solicitud pendiente y rechazar
una solicitud no disparan nada, porque en ninguno de los dos casos se escribe en `dbo.PERMISO`.

### 5. Cambio de la fuente de lectura

`dashboard_kpis_service` pasa a leer `HomeOfficeTomadosRepository.get_by_no_empleado_anio`.
Se elimina `_home_office_dias_anio` y el uso de `DatosAnalisisReadClient` en ese módulo. Sin
fila para el empleado ⇒ `0`.

El contrato de la API no cambia (`home_office_dias_anio: int | None`), así que el frontend y
ese campo de `openapi.yaml` quedan intactos. El frontend nunca consultó `DATOS_ANALISIS`
directamente y sigue sin hacerlo.

### 6. Registro de ejecución

Cada corrida registra en el log de la aplicación: inicio y fin, `origen`
(`scheduler` | `aprobacion` | `manual`), alcance (`empleado=N` o `activos=N`), `execute`,
y el desglose `consultados` / `insertados` / `actualizados` / `omitidos` / `errores`, más la
duración total. La sincronización individual incluye `no_empleado` y, cuando viene de una
aprobación, `solicitud_id`. No se registran credenciales ni cadenas de conexión.

Se consultan con `docker-compose logs -f backend | grep "Sync home office"`.

### 7. Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| `DATOS_ANALISIS` no configurada o motor no creable | `ConnectionError`; no se escribe nada |
| Error SQL durante la consulta agregada | el `SQLAlchemyError` se propaga tal cual al llamador; la transacción de Bono hace rollback y no queda nada a medias |
| Fallo dentro del job diario | capturado y registrado con `logger.error(..., exc_info=True)`; no tumba el scheduler |
| Fallo en la sincronización posterior a una aprobación | capturado, registrado, **la aprobación se conserva**; se corrige a las 06:00 |
| Empleado sin filas en `dbo.PERMISO` | se escribe `0` |

A diferencia del sync de vacaciones no hace falta el corte por fallos consecutivos: aquí hay
una sola consulta, no un round-trip por empleado.

## Pruebas

Sobre la suite existente (SQLite en memoria, `tests/conftest.py`):

- Upsert: inserta un empleado sin fila previa; actualiza uno con fila; segunda corrida
  idéntica no crea duplicados y cuenta como `omitidos`.
- `SUM` consolida varias filas del mismo empleado en el año.
- El año es el periodo: filas de otro año no entran en el conteo del año en curso.
- `no_empleado` acota la corrida a un solo empleado.
- `execute=False` no persiste.
- Sin motor de `DATOS_ANALISIS` ⇒ `ConnectionError` y tabla intacta.
- `sincronizar_homeoffice_empleado_background` no propaga la excepción cuando el sync falla.
- KPI del dashboard: lee de `levelup_homeoffice_tomados` sin abrir motor a `DATOS_ANALISIS`;
  sin fila devuelve `0`.
- Aprobación de Home Office encola la BackgroundTask; crear pendiente y rechazar no la encolan.
- El job `sync_homeoffice_tomados` queda registrado a las 06:00.
- El SQL nuevo parsea con `sqlalchemy.text` y contiene los binds esperados (mismo patrón que
  la prueba actual de `load_home_office_dias_sql`).

## Documentación a actualizar

- `CLAUDE.md`: la sección de TRESS/DATOS_ANALISIS y la de APScheduler, para dejar dicho que
  Home Office tomado también es caché en Bono y que hay un segundo job a las 06:00.
- Comando de backfill manual junto al de vacaciones.

## Variables de entorno

Ninguna nueva. Se reutilizan `DATOS_ANALISIS_DB_*` (lectura de TRESS) y `BONO_DB_*`
(escritura de la caché), más `APP_TIMEZONE` para la hora del job.
