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
  `python -m app.scripts.sync_vacaciones_disponibles`). `obtener_saldo_gozo_tress` /
  `GET_SALDOS_VACACION` solo los usa ese sync. Empleado sin fila ⇒ dashboards degradan
  a «—» y crear vacaciones se bloquea con 503.
- **Home office tomado = caché en Bono.** Ninguna carga de página cuenta días de home
  office en DATOS_ANALISIS: la fuente única de lectura es `levelup_homeoffice_tomados`
  (una fila por empleado y año calendario), que escribe
  `sync_homeoffice_tomados_service` (job 06:00, aprobación de home office y
  `python -m app.scripts.sync_homeoffice_tomados`). La consulta a `dbo.PERMISO`
  (`PM_TIPO = 'HO'`) es una sola, agregada por `CB_CODIGO`, y solo la hace ese sync.
  Empleado sin fila ⇒ el dashboard muestra 0.
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
- `app/middleware/` — Custom middleware (supervisor route restrictions)

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
- APScheduler runs periodic jobs (recordatorios Eval360/Encuestas/Metas a las 08:00,
  **sync de saldos de vacaciones y de home office tomado a las 06:00** en dos jobs
  independientes (`sync_vacaciones_disponibles` y `sync_homeoffice_tomados`), y **sync de
  incidencias de TRESS los miércoles a las 10:00** (`sync_incidencias_tress`)); se
  registran en `registrar_jobs_programados` (`app/main.py`). FI/RE sync from DATOS_ANALISIS → `importadas_historico` is **manual** (button on Faltas y retardos / CLI). IT Mirror and nightly bono imports (`calidad_historico`, `seguridad_historico`, `importadas_historico`, `evaluacion_historica_gral`) are CLI/manual, not cron. **No** hay job de cola TRESS/RPA.
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
