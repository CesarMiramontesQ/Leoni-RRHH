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
docker-compose up -d              # postgres + backend + frontend
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
- APScheduler runs periodic jobs (TRESS queue processing, IT Mirror sync)
- Roles: empleado, supervisor, rh, director, gerente — enforced via middleware and dependencies
- `conftest.py` provides `make_empleado()`, `make_solicitud()`, `make_incidencia()` factories and `auth_headers()` helper

## Git Workflow

### NUNCA hacer push directo a main
- `main` es la rama protegida. Todo cambio llega vía Pull Request.
- Si el usuario intenta commitear en main, advertir y sugerir crear una rama.

### Ramas
- Crear una rama por feature o fix. Naming: `tipo/iniciales/descripcion-corta`
  - `feat/af/descripcion-corta` — nueva funcionalidad
  - `fix/af/descripcion-corta` — corrección de bug
  - `refactor/af/descripcion-corta` — refactor sin cambio funcional
  - `docs/af/descripcion-corta` — documentación
  - `chore/af/descripcion-corta` — mantenimiento, deps, configs

### Commits
- Usar Conventional Commits: `tipo(scope): descripción`
  - Ejemplos: `feat(comedor): agregar reservas por equipo`, `fix(auth): corregir expiración de JWT`
- Incluir iniciales del autor al final: `feat(comedor): agregar reservas [AF]`
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
2. git checkout -b feat/af/mi-feature
3. ... hacer cambios, commits con convención ...
4. git push -u origin feat/af/mi-feature
5. Crear Pull Request → revisión → merge
6. git checkout main && git pull origin main (repetir)
```

## Development Rules

- Keep types in `frontend/src/dashboard/*/types.ts` synced with backend response schemas
- Centralize HTTP calls in `frontend/src/api/`; don't duplicate types or constants
- When changing an API endpoint, update: schema → service → frontend API module → frontend types
- Minimal, targeted changes; avoid unrequested refactors
- If functional ambiguity exists, ask before proceeding
