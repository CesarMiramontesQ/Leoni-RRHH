# Página de logs del scheduler — diseño

**Fecha:** 2026-08-11
**Estado:** aprobado, pendiente de plan de implementación

## Problema

El backend corre 11 jobs en APScheduler. Saber si uno corrió, cuánto tardó o por qué falló
exige entrar por SSH al servidor y leer `docker logs`. Peor: los jobs más críticos son
semanales, así que para cuando alguien sospecha, la línea ya se perdió entre miles.

Hoy **nada persiste** salvo `levelup_bono_historico_import_log`, que cubre las importaciones
de bono y el mirror FI/RE. Los otros nueve jobs solo escriben a stdout.

Se necesita una página que muestre el historial de corridas de todos los jobs, **oculta**:
sin entrada en el sidebar, sin entrada en ningún menú, sin botón en ninguna pantalla.
Accesible solo escribiendo la URL, y solo para usuarios admin.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Qué se muestra | Historial de corridas por job | Filtrable y ordenable; el texto crudo no responde «¿corrió el miércoles?» |
| Dónde se guarda | Tabla nueva `levelup_scheduler_job_log` | Los jobs críticos son semanales: con memoria volátil, un reinicio deja la página vacía justo cuando se necesita |
| Cómo se captura | Envoltorio + captura de las líneas del propio job | Cero cambios dentro de los 11 jobs; el resumen es la línea con conteos que ya escriben |
| Alcance | Solo lectura | Lo pedido; relanzar sigue siendo por CLI |
| URL | `#/ajustes/scheduler-logs` | Mismo prefijo que las otras dos pantallas solo-admin |

### Por qué no un listener de APScheduler

Es la opción obvia y **no sirve**. Los 11 wrappers atrapan su excepción para no tumbar el
scheduler y registran el fallo con `logger.error(...)` sin propagar nada. Un listener sobre
`EVENT_JOB_EXECUTED` / `EVENT_JOB_ERROR` vería «ejecutado correctamente» en un sync que
falló, y no tendría acceso a ningún conteo (los wrappers devuelven `None`). Registraría que
corrió, no cómo le fue.

## Arquitectura

```
registrar_jobs_programados
   └─ envoltorio(job_id, fn)          app/integrations/scheduler_job_log.py
        ├─ INSERT fila 'en_curso'
        ├─ fija el ContextVar de la corrida
        ├─ await fn()                 ← los 11 jobs, sin tocar
        │    └─ logger.info/error     → capturados por el handler
        └─ UPDATE fin_at, duración, resultado, líneas
```

### Captura de líneas

Un `logging.Handler` instalado al arrancar consulta un `ContextVar` que el envoltorio fija
antes de invocar al job. Sin corrida activa, el handler ignora el record. Los contextvars se
copian al crear cada tarea asíncrona, así que **dos jobs solapados** —los dos de las 06:00—
escriben cada uno en su propio buffer. El handler solo copia los records: los logs siguen
saliendo a stdout exactamente igual que hoy.

### El resultado se deduce del nivel máximo

| Nivel máximo emitido | `resultado` |
|---|---|
| solo INFO | `ok` |
| algún WARNING | `advertencia` |
| algún ERROR, o excepción que escapó | `error` |

Una sola regla, sin conocimiento por job. `advertencia` no es decorativo: es el caso real de
`sync_ausencias_fi_re`, que emite WARNING y no hace nada cuando el lock está tomado — ni
fallo ni corrida buena.

### Dos escrituras, a propósito

Fila al empezar con `resultado='en_curso'`, `UPDATE` al terminar. Cuesta una escritura extra
(irrelevante con ~3,000 corridas al año) y a cambio una corrida que se colgó o murió con el
contenedor **se ve** como `en_curso` en vez de desaparecer — que es justo lo que uno va a
buscar a esa página.

### El registro nunca rompe un job

Toda la escritura va en su propio `try/except` que loguea un warning y sigue. La página es
diagnóstico: no puede convertirse en un punto de falla nuevo para nómina. La excepción del
job, en cambio, **se re-lanza** tras registrarla: el envoltorio no cambia la semántica de
error de nadie. Hoy ninguno propaga, así que en la práctica no cambia nada.

## Modelo de datos

Tabla `levelup_scheduler_job_log` (migración Alembic, solo `create_table` sobre `levelup_*`).
Los enums siguen el estilo de `BonoHistoricoImportLog`: tipo Postgres con nombre explícito.

| columna | tipo | notas |
|---|---|---|
| `id` | PK autoincrement | |
| `job_id` | `String(64)` NOT NULL | `sync_ausencias_fi_re`, `sync_turnos_uso`, … |
| `inicio_at` | `timestamptz` NOT NULL | |
| `fin_at` | `timestamptz` NULL | nulo mientras corre |
| `duracion_ms` | `Integer` NULL | detecta el job que se degrada |
| `resultado` | enum `scheduler_job_resultado_enum` | `en_curso` \| `ok` \| `advertencia` \| `error` |
| `lineas` | `JSONB` NOT NULL default `[]` | `[{ts, nivel, mensaje}]`, máx. 200 |
| `lineas_descartadas` | `Integer` NOT NULL default 0 | cuántas se recortaron |
| `resumen` | `Text` NULL | la línea que muestra el listado (ver abajo) |
| `error` | `Text` NULL | primer ERROR, o `Tipo: mensaje` de la excepción |
| `created_at` | `timestamptz` NOT NULL default now | |

Índice compuesto `(job_id, inicio_at DESC)` — es el único patrón de acceso de la página.

Sin purga ni retención: 11 jobs generan ~3,000 filas al año.

`lineas` es `JSONB`, así que en los tests depende del parche JSONB→JSON de `tests/conftest.py`
—el mismo del que ya vive `BonoHistoricoImportLog`—. No es opcional: sin él, la tabla no se
crea en SQLite.

**La «línea de resumen»** que muestra el listado es la **última línea INFO** de la corrida —por
convención de estos jobs, la que trae los conteos—; si no hubo ninguna INFO, la primera línea
de cualquier nivel. Se calcula al escribir y se guarda en su propia columna `resumen`
(`Text` NULL), para no tener que traer `lineas` en el listado.

## API

Router nuevo, prefijo `/api/v1/scheduler-logs`. Los tres endpoints con `require_admin_user`
(flag `puede_administrar_permisos_rh`, la definición de admin del proyecto — nunca por rol).

| endpoint | qué devuelve |
|---|---|
| `GET /api/v1/scheduler-logs` | paginado (`page` desde 1, `page_size` default 20, máx. 100), orden `inicio_at DESC`; filtros `job_id`, `resultado`, `desde`, `hasta`. **Sin `lineas`** —solo `resumen`—, para que la lista sea liviana |
| `GET /api/v1/scheduler-logs/{id}` | el detalle, ya con las líneas |
| `GET /api/v1/scheduler-logs/jobs` | los ids registrados en el scheduler, solo para poblar el filtro |

Ambos middlewares (`RhModulePermissionMiddleware`, `VistaRolPermissionMiddleware`) dejan
pasar un prefijo desconocido: `resolve_*_from_api_path` devuelve `None` y llaman a
`call_next`. La única puerta es la dependencia del endpoint. Además el prefijo se agrega a
`VISTA_ROL_EXEMPT_API_PREFIXES`, como `vistas-rol`: que nadie pueda apagar por accidente la
única pantalla de diagnóstico.

## Frontend

Página en `frontend/src/pages/schedulerLogs.ts`, hash `#/ajustes/scheduler-logs`,
`activeNav: "dashboard"` (no hay ítem que resaltar). Tabla con job, inicio, duración,
resultado como badge y la línea de resumen; al hacer clic, el detalle con todas las líneas.
Filtros por job, resultado y rango de fechas. Solo tokens existentes (`RH_LISTADO_*`, badges
de estado); nada de colores nuevos.

Puntos de contacto — el molde es `#/ajustes/vistas-rol`, y **el que define la feature es el
que no se toca**:

| archivo | qué se hace |
|---|---|
| `shellRouter.ts` | ruta + import perezoso |
| `navigation/shellNavPolicy.ts` | el hash se trata igual que `#/ajustes/vistas-rol`: bloqueado para roles base y en modos simulados |
| `navigation/pageTitles.ts` | título; sin esto el shell lo muestra vacío |
| `api/schedulerLogs.ts` | cliente HTTP |
| `pages/schedulerLogs.ts` | valida `canAccessRhPermisosAdmin()`; si no, `htmlAccessDenied` |
| `openapi.yaml` | los tres endpoints |
| **`layouts/appShell.ts`** | **nada. Aquí es donde `vistas-rol` pone su enlace en el menú de usuario; el nuestro no aparece** |

Sin sidebar, sin menú, sin botón: se llega escribiendo la URL. Quien no sea admin, aunque la
conozca, recibe acceso denegado en el cliente y 403 en el servidor.

## Pruebas

**Backend** (pytest, SQLite):

1. Corrida normal → fila `ok` con `fin_at` y `duracion_ms`.
2. **Job que loguea ERROR sin propagar → `error`.** Es la prueba que justifica el enfoque: es
   lo que hacen hoy los 11 wrappers y lo que un listener reportaría como «ok».
3. Job que loguea WARNING → `advertencia`.
4. Job que lanza excepción → registrada y re-lanzada.
5. Dos jobs solapados no mezclan sus líneas.
6. La fila existe como `en_curso` antes de que el job termine.
7. Si la escritura del log revienta, el job se ejecuta igual y no propaga.
8. Corte a 200 líneas con `lineas_descartadas` correcto.
9. API: 403 para no-admin en los tres endpoints, 200 para admin, filtros, y que el listado no
   trae `lineas`.
10. Los 11 jobs siguen registrados con su id y su cron tras reescribir los `add_job` — esa
    reescritura es mecánica y necesita red debajo.

**Frontend** (vitest):

11. La política de hash bloquea `#/ajustes/scheduler-logs` para roles base y modos simulados.
12. **El HTML del menú de usuario no contiene el enlace.** Es la prueba que mantiene la página
    oculta dentro de seis meses, cuando alguien «acomode» el menú.

## Fuera de alcance

- Botón de ejecutar o relanzar un job.
- Próxima corrida programada / estado vivo del scheduler.
- Purga o retención.
- Registrar las corridas por CLI (`python -m app.scripts.*`): la tabla es del scheduler. Lo
  manual de FI/RE ya queda en `levelup_bono_historico_import_log`.
- Tocar el log de importaciones existente, sus consumidores o el logging a stdout.

## Riesgos aceptados

- Si el contenedor muere a mitad de corrida, la fila queda `en_curso` para siempre. No habrá
  barrendero: esa fila colgada **es** la señal.
- La tabla vive en Bono. Si Bono está caído, el job corre pero no deja registro, y el warning
  solo se ve en stdout. La página es diagnóstico, no fuente de verdad de nómina.
- Un WARNING benigno aparecerá como `advertencia`. Preferible a esconderlo tras una lista de
  excepciones por job.
- El despliegue necesita migración (`prod-migrate.sh`) y build de frontend. Hasta la primera
  corrida de cada job, la página se ve vacía: es correcto, no un fallo de carga.
