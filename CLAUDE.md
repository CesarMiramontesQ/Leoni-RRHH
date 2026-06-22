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
- Backend: http://localhost:8000 (con reload automático)
- Frontend: http://localhost:5173 (Vite con HMR)
- API docs: http://localhost:8000/docs

### Tests
```bash
docker-compose run --rm test                          # correr toda la suite
docker-compose run --rm test pytest tests/test_auth.py -k "test_login"  # un solo test
```

### Database / Migraciones
```bash
docker-compose exec backend alembic upgrade head
docker-compose exec backend alembic revision --autogenerate -m "description"
docker-compose exec backend python -m app.utils.seed  # crear roles + admin inicial

# Simulación accesos comedor (solo empleados activos existentes; no crea empleados)
docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo
docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo --cleanup --execute  # borrar demo previo
```

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
- `app/integrations/` — External systems: TRESS payroll (Windows ODBC), IT Mirror sync, Ollama LLM, email SMTP
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
- APScheduler runs periodic jobs (TRESS queue processing, IT Mirror sync, nightly bono imports: `calidad_historico`, `seguridad_historico`, `importadas_historico`, `evaluacion_historica_gral`)
- Roles: empleado, supervisor, rh, director, gerente — enforced via middleware and dependencies
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
