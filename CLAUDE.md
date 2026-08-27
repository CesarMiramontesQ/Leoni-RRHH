# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

On-premise HR platform for Leoni Cable (Mexico). FastAPI async backend + Vite/TypeScript frontend. Manages employee requests (vacaciones, permisos), incidents, administrative acts, cafeteria/biometric access, org chart, and TRESS payroll integration.

## Language

Respond always in Spanish. Keep answers short and actionable.

## Commands

Everything runs in Docker — no Python or Node installed locally.

### Development (levantar todo)
```bash
docker-compose up -d              # backend + frontend (BD = Bono externo, sin Postgres local)
docker-compose logs -f backend    # ver logs del backend
```
> BD única = Bono (PostgreSQL externo). **No hay BD local ni valores de conexión por
> defecto**: copia `.env.example` → `.env` y define `BONO_DB_HOST/PORT/NAME/USER/PASSWORD`
> reales. Sin esas variables el backend falla al arrancar con un mensaje claro. El
> backend arma `DATABASE_URL` desde `BONO_DB_*`; `DATABASE_URL` explícita es override
> opcional (password con caracteres especiales).
- Backend: http://localhost:8000 (con reload automático)
- Frontend: http://localhost:5173 (Vite con HMR)
- API docs: http://localhost:8000/docs

### Tests
```bash
docker-compose run --rm test                          # correr toda la suite (~7 min)
docker-compose run --rm test pytest tests/test_auth.py -q               # un archivo
docker-compose run --rm test pytest tests/test_auth.py -k "test_login"  # un solo test
```
> **No correr la suite con `docker-compose exec backend pytest`.** Parece más rápido
> (ahorra ~1 s de arranque) pero usa la imagen con la que se levantó el contenedor, que
> puede llevar días sin reconstruirse: da **fallos falsos**. Ejemplo real: un `backend`
> con SQLite 3.40 tumbaba 3 tests de comedor por `no such function: concat` (existe desde
> 3.44), mientras el servicio `test`, con la imagen actual, los pasaba. `run` siempre usa
> la imagen del target `test` recién construida. Es la misma trampa que
> `scripts/lib/docker-prod-backend.sh` ya evita para las migraciones.
>
> Lo que sí ahorra tiempo: iterar con los archivos afectados (segundos) y dejar la suite
> completa para una sola pasada antes del commit.

### Database / Migraciones
```bash
docker-compose exec backend alembic upgrade head
docker-compose exec backend alembic revision --autogenerate -m "description"
docker-compose exec backend python -m app.utils.seed  # crear roles + admin inicial

# Simulación accesos comedor (solo empleados activos existentes; no crea empleados)
docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo
docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo --cleanup --execute  # borrar demo previo

# Datos demo de la suite de Talento (perfiles, competencias, asignaciones, evaluaciones,
# cursos, PDI, metas, 360, ciclos y actas). Reutiliza empleados/áreas reales; no los crea.
docker-compose exec backend python -m app.utils.seed_talento_demo
docker-compose exec backend python -m app.utils.seed_talento_demo --cleanup            # dry-run
docker-compose exec backend python -m app.utils.seed_talento_demo --cleanup --execute  # borrar

# Demos puntuales de evaluación individual y PDI (empleados 553 / 1)
docker-compose exec backend python -m app.utils.seed_evaluacion_demo --cleanup --execute
docker-compose exec backend python -m app.utils.seed_pdi_demo --cleanup --execute

# Saldos de vacaciones: DATOS_ANALISIS → levelup_vacaciones_disponibles (Bono).
# Mismo servicio que el job de las 06:00; necesario para el backfill inicial.
docker-compose exec backend python -m app.scripts.sync_vacaciones_disponibles            # dry-run
docker-compose exec backend python -m app.scripts.sync_vacaciones_disponibles --execute
docker-compose exec backend python -m app.scripts.sync_vacaciones_disponibles --no-empleado 553 --execute
# En el servidor, la carga inicial va con el wrapper (valida migración, tabla y túnel):
./scripts/prod-sync-vacaciones-backfill.sh --execute

# Home office tomado: DATOS_ANALISIS → levelup_homeoffice_tomados (Bono).
# Mismo servicio que el job de las 06:00; necesario para el backfill inicial.
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados            # dry-run
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --execute
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --no-empleado 553 --execute

# Turnos en uso: DATOS_ANALISIS → levelup_turnos_uso (Bono).
# Mismo servicio que el job de las 04:00; necesario para la carga inicial (sin él,
# Ajustes Comedor cae de vuelta al catálogo completo de 76 turnos).
docker-compose exec backend python -m app.scripts.sync_turnos_uso            # dry-run
docker-compose exec backend python -m app.scripts.sync_turnos_uso --execute

# Catálogos de turnos y jornadas: DATOS_ANALISIS → levelup_turnos + levelup_horarios.
# Mismo servicio que el job de las 03:40. Es de donde sale el patrón de rotación
# (tu_rit_pat) y la hora de entrada/salida de cada jornada, así que sin él Ajustes
# Comedor no puede calcular a qué hora come nadie. Corre ANTES que los otros dos.
docker-compose exec backend python -m app.scripts.sync_turnos_catalogo            # dry-run
docker-compose exec backend python -m app.scripts.sync_turnos_catalogo --execute

# Turno por empleado: dbo.COLABORA → levelup_turnos_empleados (Bono).
# Mismo servicio que el job de las 04:20; necesario para la carga inicial.
docker-compose exec backend python -m app.scripts.sync_turnos_empleados            # dry-run
docker-compose exec backend python -m app.scripts.sync_turnos_empleados --execute
docker-compose exec backend python -m app.scripts.sync_turnos_empleados --no-empleado 406

# Datos generales del colaborador: dbo.COLABORA → levelup_empleados_tress (Bono).
# Mismo servicio que el job de las 04:10; necesario para la carga inicial (sin él, la
# Vista 360 muestra la fecha de ingreso vacía y la página Contratos sale en 0).
docker-compose exec backend python -m app.scripts.sync_empleados_tress            # dry-run
docker-compose exec backend python -m app.scripts.sync_empleados_tress --execute
docker-compose exec backend python -m app.scripts.sync_empleados_tress --no-empleado 553 --execute
# El mismo sync trae el contrato actual (CB_CONTRAT/CB_FEC_CON + dbo.CONTRATO) para la
# página Contratos; no hay script ni job aparte.

# Incidencias de TRESS: DATOS_ANALISIS → levelup_incidencias_tress (Bono).
# Mismo servicio que el job semanal de los miércoles 10:00; necesario para la carga inicial.
# Sin --desde/--hasta va en dos pasadas: el histórico (excluye la semana en curso) y
# después la ventana viva, que llega un año al futuro. En prod, hacerlo por tramos anuales.
docker-compose exec backend python -m app.scripts.sync_incidencias_tress            # dry-run
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --execute
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --desde 2026-01-01 --hasta 2026-06-30 --execute
```
> Todos los `--cleanup` son **dry-run** salvo que se pase `--execute`. Borran solo lo
> marcado como demo; el residuo de catálogo (grupos, tipos, competencias, grados que los
> seeds crean con nombres reales) se retira únicamente si ya nadie lo referencia —
> `app/utils/demo_residuo.py` centraliza ese criterio. `levelup_grados_puesto` y
> `levelup_metodos_calificacion_competencia` se conservan siempre: son catálogo base y
> sin ellos `competencia_service.validar_nivel_requerido` y los perfiles dejan de operar.

### Frontend (build, lint)
```bash
docker-compose exec frontend npm run build
docker-compose exec frontend npm run test
```

## Architecture

### Backend (app/)
Layered architecture: **router → service → repository → models/schemas**

- `app/api/v1/` — Versioned routers grouped by domain (auth, usuarios, solicitudes, incidencias, actas, empleados, comedor, reportes, notificaciones, organigrama)
- `app/services/` — Business logic; routers must not contain domain logic
- `app/repositories/` — Data access layer using SQLAlchemy async sessions
- `app/schemas/` — Pydantic models for request/response validation
- `app/models/` — SQLAlchemy ORM models (PostgreSQL with JSONB, enums)
- `app/core/` — Config (pydantic-settings from .env), database engine, security (JWT), exceptions
- `app/integrations/` — External systems: TRESS payroll via **direct SQL to DATOS_ANALISIS** (no RPA / no `tress_robot_queue`), IT Mirror sync, Ollama LLM, email SMTP

### TRESS / DATOS_ANALISIS (sin RPA)
- Integración con nómina: **solo escritura/lectura directa** a la BD TRESS (`DATOS_ANALISIS_DB_*`).
- **Prohibido** usar cola RPA (`encolar_tress`, `levelup_tress_robot_queue`, robot GUI) en features nuevas.
- Código de cola/scheduler/robot en `app/integrations/tress/` está **deprecado** (sin consumidor; cleanup pendiente).
- Patrones vigentes: INSERT síncrono a `dbo.PERMISO` / `dbo.VACACION` (suspensión, home office, goce FJ, vacaciones).
- **Sin DELETE**: no borrar filas en DATOS_ANALISIS desde este sistema sin autorización previa explícita del dueño de la BD.
- **Saldo de vacaciones = caché en Bono.** Ninguna carga de página consulta el saldo en
  DATOS_ANALISIS: la fuente única de lectura es `levelup_vacaciones_disponibles`, que
  escribe `sync_vacaciones_disponibles_service` (job 06:00, aprobación de vacaciones y
  `python -m app.scripts.sync_vacaciones_disponibles`). La única lectura a
  `dbo.GET_SALDOS_VACACION` es `DatosAnalisisVacacionesRepository.get_kpis_ciclo`, y solo
  la hace ese sync. Empleado sin fila ⇒ dashboards degradan a «—» y crear vacaciones se
  bloquea con 503.
- **Regla de home office = por área, configurable por RH.** Ya no hay «un HO por mes»
  hardcodeado: `levelup_homeoffice_reglas_area` guarda «N días cada M semanas» por
  `area_id` y RH la edita en `#/laborales/configuracion` (módulo `laborales-configuracion`,
  API `/api/v1/laborales-config`, fuera de `/api/v1/solicitudes` porque ese prefijo es
  self-service y el middleware no lo bloquearía). Elegible = clasificación Administrativo
  **y** área con regla activa; sin cualquiera de las dos, el modal ni ofrece el tipo y el
  backend rechaza. El cupo se cuenta en bloques **fijos** de semanas ISO
  (`app/utils/homeoffice_periodo.bloque_semanas`, lunes–domingo, `(semana-1)//M`), no en
  ventana móvil ni por mes. Siguen hardcodeados «un día por solicitud» y «solo L–V». La
  regla del área **no se muestra** al empleado (mensajes genéricos); un cambio de regla
  aplica solo a solicitudes nuevas. Las filas no se borran: se apagan con `activo`.
- **Home office tomado = caché en Bono.** Ninguna carga de página cuenta días de home
  office en DATOS_ANALISIS: la fuente única de lectura es `levelup_homeoffice_tomados`
  (una fila por empleado y año calendario), que escribe
  `sync_homeoffice_tomados_service` (job 06:00, aprobación de home office y
  `python -m app.scripts.sync_homeoffice_tomados`). La consulta a `dbo.PERMISO`
  (`PM_TIPO = 'HO'`) es una sola, agregada por `CB_CODIGO`, y solo la hace ese sync.
  Empleado sin fila ⇒ el dashboard muestra 0.
- **Horario de comida = por jornada, no por turno.** Un turno rotativo no tiene una sola
  jornada: G9 recorre un ciclo de 56 días que pasa por 7. La ventana de comida se captura
  en `levelup_comedor_horarios_jornada`, con una fila por código de `dbo.HORARIO`; 24
  filas cubren los 24 turnos con personal. La cadena
  `empleado + fecha → turno → posición del ciclo → jornada → ventana` la resuelve
  `comedor_ventana_comida_service`, **leyendo solo de Bono**.
  - **La rotación no se reimplementa.** `app/utils/turno_calendario.py` ya replica
    `dbo.FN_GeneraRitmo` (validado día a día contra `dbo.AUSENCIA.HO_CODIGO`) y
    `app/utils/turno_ciclo.py` lo envuelve para agrupar el ciclo en bloques. En el patrón,
    un token `N:HORARIO` son N días y el token `0` aporta **cero días**: solo avanza la
    fase hábil→descanso. **No ampliar** el regex de tokens: descansos y goce dependen de
    esa misma expansión.
  - Fijo vs. rotativo se decide por dato, no por nombre: `tu_rit_pat` no vacío ⇒ rotativo.
  - `tu_rit_ini = 1899-12-30` es el «vacío» de TRESS. Un rotativo anclado ahí devolvería
    una posición de ciclo creíble y equivocada, así que se detecta y se degrada.
  - Un día de descanso **nunca** recibe ventana de comida.
  - La ventana **puede cruzar medianoche** (la jornada 011 es 18:00-06:00): `fin <= inicio`
    significa que termina al día siguiente. No exigir `inicio < fin`.
  - **Turno por empleado = caché en Bono.** `levelup_turnos_empleados.tu_codigo` lo escribe
    `sync_turnos_empleados_service` (job 04:20) desde `dbo.COLABORA`. Es una foto del turno
    **vigente**, no un histórico: la respuesta expone `sincronizado_en`. El sync **nunca**
    escribe la columna `comedor`, que es dato propio de la app.
  - Endpoints nuevos bajo `/api/v1/comedor/…` deben registrarse en `api_prefixes` del
    módulo `comedor-ajustes`: `role_checker` resuelve el módulo por prefijo más largo y sin
    eso da 403 a quien sí tiene el permiso.
  - **El reporte de comedor trae la ventana ya resuelta.** `/accesos/rh/registros-reporte`
    completa cada fila con `tu_codigo`, `ho_codigo` y las horas de comida usando
    `resolver_ventanas`, que carga el contexto **una vez** y resuelve en memoria
    (~52 000/s, contra ~890/s fila por fila). El cliente no puede deducir esa ventana: sale
    de recorrer el ciclo del turno. De ahí sale el plan de producción de planeación
    (`comedor/reportes/planeacionPlatillos.ts`), que cuenta **solo `PENDIENTE` y
    `ACCEDIDO`** —un cancelado no se cocina y `REPETIDO` es una segunda entrada, no otro
    platillo— y agrupa las comidas sin ventana aparte en vez de descartarlas, para que los
    totales cuadren con el detalle.
- **Turnos en uso = caché en Bono.** La pestaña «Horarios de comida» de Ajustes Comedor no
  cuenta personal en DATOS_ANALISIS: la fuente única de lectura es `levelup_turnos_uso`
  (una fila por turno con su personal activo), que escribe `sync_turnos_uso_service`
  (job diario 04:00 y `python -m app.scripts.sync_turnos_uso`). El origen es una sola
  consulta agregada a `dbo.COLABORA` (`CB_TURNO` con `CB_ACTIVO = 'S'`). Caché vacía ⇒ la
  pantalla **no filtra** y muestra el catálogo completo, en vez de quedarse sin turnos. Un
  turno que se queda sin personal conserva su fila en 0, no se borra. Si TRESS devuelve 0
  turnos el sync aborta sin escribir: es señal de consulta rota, no de planta vacía.
- **Incidencias (página "Incidencias", módulo `faltas-retardos`) = caché en Bono.** Ninguna
  carga de página consulta `dbo.AUSENCIA` ni `dbo.PERMISO`: la fuente única de lectura es
  `levelup_incidencias_tress`, que escribe `sync_incidencias_tress_service` (job semanal
  de los miércoles 10:00 y `python -m app.scripts.sync_incidencias_tress`). El SQL
  `app/repositories/sql/datos_analisis_faltas_retardos_base.sql` ya solo lo usa ese sync.
  La caché es **solo lectura de TRESS**: el sync nunca escribe en DATOS_ANALISIS. Lo que
  RH registra **no aparece** en la tabla hasta la siguiente corrida semanal — es
  intencional, no un bug. Los eventos que RH capturó y que también llegaron a TRESS se
  siguen viendo con origen "Manual" y con el nombre de quien los registró; lo único que
  cambia es la fecha de registro, que pasa a ser la de captura en nómina. Caché vacía ⇒
  la página muestra 0 resultados, no 503. El rango del sync **llega un año al futuro**
  (`hasta_efectivo`): los permisos con goce se capturan por adelantado y deben entrar a la
  caché antes de su fecha de inicio. La reconciliación de bajas **no borra** si TRESS
  devolvió 0 filas o si desaparecería más de la mitad del rango: cuenta el hecho como
  error y lo registra con `borrado omitido`.
  - **Empleado que no existe en Bono ⇒ no se muestra.** TRESS tiene `CB_CODIGO` que nunca
    se dieron de alta aquí; el sync los guarda con `empleado_id` NULL y las seis lecturas
    de la caché los descartan, porque el predicado vive en el helper compartido
    `IncidenciasTressCacheRepository._filtros`. Es lo que mantiene cuadrados entre sí el
    `total` de la paginación, la tabla y los agregados de estadísticas y dashboard;
    filtrar en un solo método los descuadra. El sync **no** los borra ni los filtra
    (`map_existentes` no pasa por `_filtros`): si el empleado se da de alta después, la
    siguiente corrida le estampa el `empleado_id` y sus incidencias reaparecen solas —
    para un tramo histórico ya fuera de la ventana viva hay que resincronizar con
    `--desde/--hasta`. Las **bajas sí se ven**: existen en Bono.
  - **El horario del retardo viaja en la caché, ya resuelto.** `hora_programada`
    (`dbo.HORARIO.HO_INTIME` del horario del día), `hora_entrada` (la checada de entrada
    de la jornada) y `minutos_retardo` los llena el mismo sync, y **solo** para
    `tipo = retardo`: el `OUTER APPLY` a `dbo.CHECADAS` lleva el predicado `AU_TIPO = 'RE'`
    adentro para no rozar esa tabla (millones de filas) en los demás tipos. La entrada de
    la jornada es `CH_TIPO = 1 AND CH_POSICIO = 1`; sin la posición se cuela el regreso de
    comer, que en TRESS también es una checada de entrada. Las horas se guardan como texto
    `"HH:MM"` y **no** como `Time` porque TRESS expresa «al día siguiente» con horas ≥ 24
    (`"25:00"` es la 01:00 del turno que entró a las 18:00); `formatHoraRetardo` en el
    frontend es quien traduce eso a `01:00 (+1 d)`. `minutos_retardo` es la resta de las
    dos horas, **no** `AU_TARDES`: ese campo es lo que nómina descontó después de aplicar
    la tolerancia del horario y difiere en ~11% de los casos, así que en pantalla
    contradiría a las dos horas visibles. Sale NULL cuando la checada es anterior a la
    hora programada (~0.2% de los retardos reales).
  - **La tarjeta «Retardos» del dashboard personal sale de esta misma caché.**
    `dashboard_kpis_service` cuenta con `IncidenciasTressCacheRepository.count`
    (`tipo="retardo"`, del 1 de enero a hoy, `cb_codigos=[no_empleado]`) en vez de un
    `select` propio: así hereda `_filtros` y el número coincide con el que RH ve en la
    página Incidencias. Hereda también la latencia semanal del sync, que es aceptable
    justo porque las dos superficies se mueven juntas.
- **Fecha de ingreso = caché en Bono.** La Vista 360 no consulta `dbo.COLABORA`: la fuente
  única de lectura es `levelup_empleados_tress`, que escribe `sync_empleados_tress_service`
  (job 04:10 y `python -m app.scripts.sync_empleados_tress`). El sync lee **toda**
  `dbo.COLABORA`, sin filtrar `CB_ACTIVO` —la Vista 360 se abre también sobre bajas— y
  **nunca borra**. Empleado sin fila ⇒ el campo viaja como `null`, igual que degradaba
  antes ante un fallo de la BD externa.
- **Contrato actual = caché en Bono, en la misma tabla.** La página Contratos
  (`#/contratos`, módulo RH `contratos`, API `/api/v1/contratos`) y la fila «Contrato» de la
  Vista 360 leen `levelup_empleados_tress.contrato_*`, que llena el **mismo** sync de las
  04:10 con `dbo.COLABORA.CB_CONTRAT/CB_FEC_CON` + `LEFT JOIN dbo.CONTRATO` (`TB_ELEMENT`,
  `TB_DIAS`). No hay tabla `levelup_contratos` ni job aparte: es la misma foto por empleado.
  - Se guarda el vencimiento **ya calculado** (`fecha_contrato + contrato_dias`) pero **no**
    el estatus: `vigente / por_vencer / vencido / indefinido / sin_dato` depende de «hoy» y de
    la ventana que RH elige en pantalla (15/30/60/90, default 30), así que lo calculan
    `contratos_service.calcular_estatus` (Python, por fila) y `estatus_contrato_expr` (SQL,
    para filtrar y para los KPIs) con la **misma regla**; si cambias una, cambia la otra.
    Los cinco estatus son excluyentes y suman el total.
  - `TB_DIAS = 0` ⇒ indefinido (no vence). `TB_DIAS NULL` (código sin fila en el catálogo)
    o `CB_FEC_CON` vacío (NULL o el «vacío» **1899-12-30** de TRESS) ⇒ vencimiento NULL y
    estatus `sin_dato`; el sync los cuenta en `contratos_sin_catalogo` /
    `contratos_dato_incompleto` y los reporta como advertencia.
  - El listado muestra **solo activos** (`ESTADOS_ACTIVOS_IDS`) aunque la caché guarde
    también las bajas (la Vista 360 sí las abre). Supervisor = `lider_id` directo, sin
    recorrer la jerarquía (hay ciclos reales). El CSV es UTF-8 con BOM y días restantes
    negativos cuando ya venció.
  - El KPI «Contratos por vencer» de la página Empleados (tarjeta-filtro en RH y en
    supervisor/gerente, parámetro `solo_contratos_por_vencer`) lee **esta misma caché** vía
    `UsuarioRepository._contrato_por_vencer_condition` (hoy ≤ vencimiento ≤ hoy+30).
    `levelup_empleados_config.fecha_fin_contrato` (captura manual) ya **no** alimenta ningún
    KPI; la columna sigue existiendo solo por compatibilidad.
  - Histórico («qué contrato tenía en la fecha X», `SP_KARDEX_CB_CONTRAT`) queda fuera a
    propósito; para eso haría falta una tabla aparte con varias filas por empleado.
- **Descansos = proyección desde Bono, no lectura de TRESS.** Ninguna ruta que dispare un
  usuario consulta el kardex (`SP_KARDEX_CB_TURNO`) ni `dbo.AUSENCIA`.
  `obtener_descansos_bono` resuelve `empleado → turno vigente (levelup_turnos_empleados) →
  catálogo (levelup_turnos) → jornadas (levelup_horarios) → proyección` con el motor de
  `app/utils/turno_calendario.py`. Consecuencias que conviene no revertir:
  - **Se proyecta con el turno vigente.** Para fechas anteriores a un cambio de turno la
    proyección puede diferir de lo que nómina aplicó. Es una decisión, no un bug: el uso
    real es hacia el futuro (pedir vacaciones, otorgar goce).
  - **El override de `dbo.AUSENCIA` se descartó.** El motor ya fue validado día a día
    contra `AUSENCIA.HO_CODIGO`, así que la proyección coincide con lo que TRESS computó
    **para el turno vigente** — no para fechas de un turno anterior, ver el punto de arriba.
  - **Falla cerrado con 503**, nunca con lista vacía: de esa lista sale el conteo de días
    de una solicitud de vacaciones y un falso «no descansa» contaría días de más. Los cinco
    casos son sin fila en la caché de turnos o `tu_codigo` vacío (una sola ruta: el
    repositorio devuelve `None` en ambos), turno ausente del catálogo, rotativo sin ancla
    válida, patrón no interpretable, y **fecha anterior al inicio de ciclo del turno
    rotativo**: el ancla puede ser válida y aun así la fecha consultada caer antes de que
    el ciclo empiece, y ahí el motor no puede ubicar la posición.
  - **Los siete consumidores usan la misma función.** El endpoint y las seis validaciones de
    `solicitud_service` / `faltas_retardos_service` comparten fuente: si el modal contara
    con una y el servidor validara con otra, el usuario vería rechazada una solicitud por un
    cálculo que la UI nunca le mostró.
- `app/middleware/` — Custom middleware (supervisor route restrictions)
- **Alcance del listado de solicitudes del gerente = preferencia propia, solo visualización.**
  `levelup_empleados_config.profundidad_equipo` (NULL = todo el subárbol, 1..3 = niveles
  bajo el gerente) la edita el propio gerente con el select «Mostrar» de la sección
  «Solicitudes del Equipo» (`GET/PUT /api/v1/solicitudes/me/alcance-equipo`, bajo
  `/solicitudes` porque es self-service). Solo la aplica `list_solicitudes` (y por
  tanto el conteo de pendientes del dashboard de líder, que sale del mismo GET); el
  detalle, la aprobación y las notificaciones siguen con el subárbol completo, así que
  una solicitud fuera del alcance se sigue abriendo desde su deep-link. Solo scope
  efectivo `gerente`: un gerente con módulo RH de solicitudes se eleva a global y no ve
  el select; supervisor sigue en reportes directos y no tiene la opción. El recorrido
  del gerente pasa `atravesar_inactivos=True` (un líder de baja no esconde a su gente,
  igual que Horas Extra).

### Frontend (frontend/src/)
- `pages/` — Page-level modules (one .ts per page: login, dashboard, solicitudes, etc.)
- `api/` — Centralized HTTP client (`http.ts` base) and per-domain API modules
- `dashboard/` — Dashboard components with co-located types
- `auth/`, `comedor/`, `solicitudes/`, `incidencias/`, `actas/`, `notificaciones/` — Feature modules
- `components/`, `ui/`, `layouts/` — Shared UI
- `shellRouter.ts` — Client-side routing

### Key Patterns
- Async everywhere: asyncpg driver, async sessions, async test fixtures
- Tests use SQLite in-memory with JSONB→JSON patch (see `tests/conftest.py`); no Docker required
- APScheduler runs periodic jobs (**sync de catálogos de turnos y jornadas a las 03:40**
  (`sync_turnos_catalogo`) y **de turno por empleado a las 04:20** (`sync_turnos_empleados`),
  ambos alrededor del de turnos en uso de las 04:00; recordatorios Eval360/Encuestas/Metas a las 08:00,
  **sync de saldos de vacaciones y de home office tomado a las 06:00** en dos jobs
  independientes (`sync_vacaciones_disponibles` y `sync_homeoffice_tomados`), y **sync de
  incidencias de TRESS los miércoles a las 10:00** (`sync_incidencias_tress`), **sync de
  turnos en uso a las 04:00** (`sync_turnos_uso`), y **sync de datos generales del
  colaborador a las 04:10** (`sync_empleados_tress`)); se
  registran en `registrar_jobs_programados` (`app/main.py`). El **mirror FI/RE de
  DATOS_ANALISIS → `importadas_historico` es automático**: job `sync_ausencias_fi_re`, los
  miércoles a las 08:30, escalonado frente al de incidencias de las 10:00 (leen las mismas
  tablas de TRESS y escriben destinos distintos; ninguno depende del otro).
  Ya **no** hay botón «Sincronizar» ni endpoint: para soporte queda la CLI
  `python -m app.scripts.sync_ausencias --execute`. IT Mirror and nightly bono imports (`calidad_historico`, `seguridad_historico`, `importadas_historico`, `evaluacion_historica_gral`) are CLI/manual, not cron. **No** hay job de cola TRESS/RPA.
  Cada corrida de los 11 jobs queda en `levelup_scheduler_job_log` (inicio, fin, duración,
  resultado y las líneas que ese job emitió), y se consulta en la página **oculta**
  `#/ajustes/scheduler-logs`, solo-admin y sin entrada en ningún menú. El resultado se
  deduce del **nivel máximo de log** (`ok` / `advertencia` / `error`), no de una excepción:
  los wrappers de los jobs atrapan la suya, así que un listener de APScheduler los vería
  siempre como correctos. Una fila que se queda en `en_curso` significa que el proceso
  murió a media corrida; no hay barrendero que las cierre. Los **8 jobs de sync
  reintentan solos** tras una corrida con resultado `error` (mismo criterio del nivel de
  log, no excepción): hasta 3 reintentos con backoff 15/30/60 min, cada uno con su
  propia fila (`intento` 2..4). Los 3 de recordatorios **no** reintentan — envían emails
  y un reintento a media corrida duplicaría avisos. Los reintentos son tareas asyncio,
  no jobs de APScheduler: un reinicio del proceso los pierde (igual que un misfire), y
  un reintento tardío del catálogo de turnos **no** re-dispara a sus dependientes.
- Roles: empleado, supervisor, rh, director, gerente — enforced via middleware and dependencies
- **Admin RH**: usuario admin = `is_admin_user()` (flag BD `puede_administrar_permisos_rh` en `levelup_empleados_permisos`), NO por rol. Guard unificado `require_admin_user`. La **BD es la fuente** y el flag se gestiona desde la UI de Permisos RH con el toggle "Hacer/Quitar admin" (`PUT /api/v1/rh-permisos/usuarios/{id}/admin`, body `{conceder}`; auditado `RH_PERMISOS_ADMIN_GRANTED/REVOKED`; candados: no cambiar el propio flag, no revocar al último admin). `SEED_RH_PERMISOS_ADMIN_EMPLEADO_IDS` (.env) es **solo bootstrap/recuperación** cuando no hay admins (`ensure_bootstrap_rh_admins` en lifespan o `python -m app.utils.seed`).
- `conftest.py` provides `make_empleado()`, `make_solicitud()`, `make_incidencia()` factories and `auth_headers()` helper

## Git Workflow

### NUNCA hacer push directo a main
- `main` es la rama protegida. Todo cambio llega vía Pull Request.
- Si el usuario intenta commitear en main, advertir y sugerir crear una rama.

### Ramas
- Crear una rama por feature o fix. Naming: `tipo/iniciales/descripcion-corta`
- Las iniciales se derivan del `git config user.name` actual (e.g. "Alberto Flores" → `af`, "Cesar Miramontes" → `cm`). No usar iniciales hardcodeadas del ejemplo.
  - `feat/<iniciales>/descripcion-corta` — nueva funcionalidad
  - `fix/<iniciales>/descripcion-corta` — corrección de bug
  - `refactor/<iniciales>/descripcion-corta` — refactor sin cambio funcional
  - `docs/<iniciales>/descripcion-corta` — documentación
  - `chore/<iniciales>/descripcion-corta` — mantenimiento, deps, configs

### Commits
- Usar Conventional Commits: `tipo(scope): descripción`
  - Ejemplos: `feat(comedor): agregar reservas por equipo`, `fix(auth): corregir expiración de JWT`
- NO incluir iniciales en el mensaje del commit ni en títulos de PR.
- Commits pequeños y atómicos; un commit por cambio lógico.

### Pull Requests
- Siempre crear PR para mergear a main.
- El PR debe describir qué se hizo y cómo probarlo.
- No mergear sin revisión (o al menos sin que el otro colaborador vea el PR).

### Mantener ramas actualizadas
- Antes de empezar a trabajar: `git pull origin main` para tener main al día.
- Si tu rama se quedó atrás de main, hacer rebase:
  ```bash
  git checkout tu-rama
  git fetch origin
  git rebase origin/main
  ```
- Resolver conflictos durante el rebase, no dejarlos para el PR.

### Flujo resumido
```
1. git checkout main && git pull origin main
2. git checkout -b feat/<iniciales>/mi-feature
3. ... hacer cambios, commits con convención ...
4. git push -u origin feat/<iniciales>/mi-feature
5. Crear Pull Request → revisión → merge
6. git checkout main && git pull origin main (repetir)
```

## Development Rules

- Keep types in `frontend/src/dashboard/*/types.ts` synced with backend response schemas
- Centralize HTTP calls in `frontend/src/api/`; don't duplicate types or constants
- When changing an API endpoint, update: schema → service → frontend API module → frontend types
- Minimal, targeted changes; avoid unrequested refactors
- If functional ambiguity exists, ask before proceeding

### Database — external DB + `levelup_` prefix (mandatory)
- **External DB (Bono):** never create, alter, or drop tables/columns/indexes belonging to the external schema (any table without the `levelup_` prefix). Read and FKs only.
- **External DB (DATOS_ANALISIS / SQL Server):** never create, alter, or drop tables, views, columns, or indexes. Entire schema is external; business DML (SELECT/INSERT) does not authorize DDL. **Never DELETE/TRUNCATE rows** in DATOS_ANALISIS from this system without **prior explicit authorization** from the DB/payroll owners; if a feature seems to need deletes (void/correct/reverse), stop and ask. Payroll integration is **direct SQL only** — do not use `encolar_tress` / RPA / robot GUI for new features.
- Every **new** table owned by this project must be named `levelup_<name>` (`__tablename__` in SQLAlchemy models).
- **Do not** create, alter, or drop tables without the `levelup_` prefix in models, repositories, or Alembic migrations.
- Legacy Bono tables (`empleados`, `areas`, `puestos`, etc.) are **read-only** from this project: query and FK-reference only; no schema migrations or DDL on them.
- In raw SQL, always derive the table name from the model (`Model.__tablename__`); never hardcode unprefixed table names.
- New Alembic revisions may only `create_table` / `alter_column` / `drop_table` on `levelup_*` tables. If a change requires touching an unprefixed table, stop and ask for clarification.
- **Única excepción, ya autorizada:** las columnas que este proyecto agregó a
  `importadas_historico` (`estado`, `semana_incidencia`) no pueden viajar en una
  migración —la tabla es de Bono— pero el INSERT del módulo las escribe, así que si
  faltan se cae el sync **y** el registro manual. Las asegura
  `python -m app.scripts.ensure_columnas_bono`, que corre dentro de `prod-migrate.sh`:
  idempotente, solo aditivo, sobre una lista cerrada. Agregar una columna a esa lista
  exige la misma autorización que cualquier cambio al esquema de Bono; un test
  (`tests/test_ensure_columnas_bono.py`) falla si el INSERT escribe una columna que la
  lista no declara.
- **BD Bono nueva:** el esquema propio se crea con la migración baseline `v1l2u3p0base` (genera solo tablas `levelup_*`). **No** corras `alembic upgrade head` desde cero contra Bono: la cadena vieja (`c06e332f3cce` … `p2q3r4s5t6u7`) crea tablas sin prefijo y tocaría catálogos de Bono. Usa `scripts/bono-first-migrate.sh` (stamp `p2q3r4s5t6u7` → upgrade `v1l2u3p0base` → stamp head); `scripts/prod-migrate.sh` lo invoca solo si `alembic_version` está vacía. El merge `37a743fada1c` dejó un único head (ver `docs/DEPLOY.md`).

### OpenAPI spec (`openapi.yaml`)
- When adding, removing, or modifying any backend endpoint (routers, schemas, models), update `openapi.yaml` at the project root to reflect the change.
- This includes: new paths, changed request/response schemas, new query/path parameters, modified enums, and security requirements.
- Keep component schemas in sync with `app/schemas/*.py` Pydantic models.

### Design System (`design.md`)
- **Read `design.md` before any frontend work.** It is the single source of truth for colors, typography, spacing, components, and layout patterns.
- When creating or modifying frontend components, use the tokens and patterns defined in `design.md` — never invent new colors, spacing values, or component variants.
- UI tokens live in `frontend/src/ui/uiTokens.ts`. Use existing constants (BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, badge functions, FIELD_FOCUS, SELECT_CHEVRON, FILTER_FIELD_WRAP) instead of writing inline classes.
- When adding a new component or pattern not covered in `design.md`, first implement it following the system's principles (4px grid, Inter font, semantic color tokens, tonal layering for depth), then update `design.md` to document the new pattern.
- Colors: use `--color-primary` (#0A1628), `--color-accent` (#2563EB) for interactive elements, semantic status colors for badges. Never hardcode hex values in component code.
- Border radius: default 4px for buttons/inputs, 8px for cards/modals, pill for badges/avatars.
- Shadows: only on floating elements (dropdowns, modals, tooltips). Cards and containers use 1px borders + tonal layering.
- The design system originates from Google Stitch project `1746412759455982581` ("Industrial Precision"). Use the Stitch MCP tools to reference or update screens when needed.

### Stitch MCP (Google Stitch Design Tool)
Available MCP tools for the design system:
- `mcp__stitch__get_project` — Get project details. Use `name: "projects/1746412759455982581"`.
- `mcp__stitch__list_screens` — List all screens. Use `projectId: "1746412759455982581"`.
- `mcp__stitch__get_screen` — Get a specific screen's HTML and screenshot by screen ID.
- `mcp__stitch__list_design_systems` — List design systems for the project.
- `mcp__stitch__generate_screen_from_text` — Generate new screens from text descriptions.
- `mcp__stitch__edit_screens` — Edit existing screens.
- `mcp__stitch__generate_variants` — Generate variants of existing screens.
- `mcp__stitch__create_design_system` / `mcp__stitch__update_design_system` — Manage the design system.

Use these tools to:
1. Reference screen designs when implementing new pages (get the screen HTML/screenshot first).
2. Generate new screen mockups before implementing complex UI.
3. Keep the design system in Stitch synchronized with `design.md` changes.
