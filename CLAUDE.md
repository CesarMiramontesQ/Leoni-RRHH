# Plataforma RH — Leoni Cable

Sistema enterprise On-Premise de Recursos Humanos. Gestiona solicitudes, incidencias, actas administrativas, comedor con lectores de huella, analítica de empleados e integración con TRESS (sistema de nómina legacy).

---

## Stack

| Componente | Versión |
|---|---|
| Python | 3.11+ |
| FastAPI | 0.115 |
| SQLAlchemy | 2.x async |
| Pydantic | v2 |
| PostgreSQL | 15 (Docker) |
| Alembic | 1.14 |
| APScheduler | 3.10 |

---

## Levantar el proyecto

```bash
# 1. Base de datos
docker-compose up -d

# 2. Migraciones
alembic upgrade head

# 3. Servidor
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

---

## Arquitectura — Monolito Modular DDD

Cuatro capas verticales. Las dependencias solo fluyen hacia abajo. **Nunca saltarse capas.**

```
HTTP Request
     │
     ▼
 Router          app/api/v1/{dominio}/router.py      ← HTTP, Depends, delegar
     │
     ▼
 Service         app/services/{dominio}_service.py   ← lógica de negocio
     │
  ┌──┴──┐
  ▼     ▼
 Repo  Integration   app/repositories/  app/integrations/   ← datos / externos
```

### Router
- Declara el endpoint, inyecta dependencias (`Depends`), llama al Service, retorna respuesta.
- **Nunca** importa `sqlalchemy`, construye queries, contiene lógica de negocio, ni llama Repos/Integrations directamente.
- No poner `try/except` — el handler global en `main.py` captura `LeoniException`.

### Service
- Contiene **toda** la lógica de negocio y orquesta las llamadas a Repos/Integrations.
- **Nunca** importa `HTTPException` — solo excepciones de dominio propias (`app/core/exceptions.py`).
- **Nunca** importa primitivas de SQLAlchemy directamente (eso es del Repo).
- Llama a `audit_background()` en cada mutación.

### Repository
- Solo queries contra la BD. Sin lógica de negocio.
- Hereda de `BaseRepository` (`app/repositories/base.py`) que provee: `get`, `create`, `update`, `soft_delete`, `hard_delete`, `count`, `list_paginated`.

### Integration
- Adaptadores para sistemas externos (TRESS, SMTP, Ollama, IT Mirror).
- Errores no críticos (ej. Ollama caído) → fallback silencioso.
- Errores que bloquean la operación → `ServiceUnavailableError`.

---

## Excepciones de dominio

`app/core/exceptions.py` — los Services lanzan estas, **nunca** `HTTPException`.

| Clase | HTTP |
|---|---|
| `NotFoundError(entidad, id)` | 404 |
| `ConflictError(detail)` | 409 |
| `ForbiddenError(detail)` | 403 |
| `DomainValidationError(detail, field)` | 422 |
| `ServiceUnavailableError(detail)` | 503 |

El handler global en `main.py` convierte `LeoniException` → `JSONResponse` con `{"code": ..., "detail": ...}`.

---

## Roles y permisos

Roles del sistema: `rh`, `director`, `gerente`, `supervisor`, `empleado`.

- **rh**: acceso total a plantilla, creación/modificación/desactivación de usuarios, audit logs.
- **director / gerente**: directorio de empleados activos, vista 360, métricas.
- **supervisor**: directorio + empleados subordinados + sí mismo.
- **empleado**: solo su propio perfil y sus propias solicitudes.

Los checks de rol van en el Service, no en el Router (excepto `role_checker` de FastAPI para validación básica).

---

## Módulos (routers en `/api/v1/`)

| Módulo | Prefix |
|---|---|
| auth | `/api/v1/auth` |
| usuarios | `/api/v1/usuarios` |
| solicitudes | `/api/v1/solicitudes` |
| incidencias | `/api/v1/incidencias` |
| actas | `/api/v1/actas` |
| empleados | `/api/v1/empleados` |
| comedor | `/api/v1/comedor` |
| reportes | `/api/v1/reportes` |
| notificaciones | `/api/v1/notificaciones` |
| auditoria | `/api/v1/auditoria` |

---

## Paginación

Usar cursor-based, nunca offset. `BaseRepository.list_paginated(cursor, limit)` retorna `(items, next_cursor)`.

Schema de respuesta: `PaginatedResponse[T]` con campos `items`, `next_cursor`.

---

## Audit log

Toda mutación debe registrarse con `audit_background()` de `app/utils/audit_logger.py`.

```python
audit_background(
    background_tasks=background_tasks,
    db=self.db,
    accion="ENTIDAD_ACTION",   # ej. USUARIO_CREATED
    modulo="dominio",
    usuario_id=current_user.id,
    entidad_id=entidad.id,
    datos_antes={...},         # None en creaciones
    datos_despues={...},
)
```

---

## Integración TRESS (fire-and-forget)

TRESS es el sistema de nómina legacy en Windows. La integración es **nunca bloqueante**:

- Las operaciones que requieren TRESS se encolan en la BD.
- `APScheduler` procesa la cola cada 5 minutos (`_tress_scheduler_job` en `main.py`).
- **Nunca** bloquear un request HTTP esperando respuesta de TRESS.
- Las dependencias de TRESS (`pyodbc`, `pywinauto`, `pywin32`) solo se instalan en el servidor Windows — están comentadas en `requirements.txt`.

---

## Soft-delete

Los `Empleado` nunca se borran. Desactivar = `activo=False`.  
Al desactivar un empleado, cancelar sus `Solicitud` en estado `pending` → `cancelled`.

---

## Notificaciones

`NotificacionService` → `email_sender.py` (aiosmtplib). Disparar desde el Service via `BackgroundTasks`. Nunca bloquear el request esperando confirmación de envío.

---

## Ollama (IA Local)

- URL: configurable via `OLLAMA_URL` (default `localhost:11434`), modelo `llama3`.
- Si Ollama no está disponible: **fallback silencioso**, nunca lanzar error al usuario.
- Solo se verifica disponibilidad en startup (warning en log, no falla el arranque).

---

## Variables de entorno

Copiar `.env.example` → `.env`. Settings cargados por `pydantic-settings` en `app/core/config.py`.

Claves principales:
- `DATABASE_URL` — PostgreSQL async URL
- `JWT_SECRET` — cambiar en producción
- `SMTP_HOST / SMTP_USER / SMTP_PASSWORD`
- `OLLAMA_URL / OLLAMA_MODEL`
- `HUELLA_WHITELIST_IPS` — IPs de lectores biométricos (vacío = permite todo en dev)
- `TRESS_ODBC_CONN` — cadena ODBC para SQL Server (solo Windows)
- `APP_ENV` — `development` | `production`

---

## Convenciones de nomenclatura

- Todo en **español** (nombres de dominio, variables, schemas, modelos).
- `snake_case` para todo (Python + campos de BD).
- Archivos: `{dominio}_service.py`, `{dominio}_repository.py`, `{dominio}_router.py`.
- Schemas: `{Entidad}Create`, `{Entidad}Update`, `{Entidad}Response`.
- Audit actions: `ENTIDAD_VERBO` en mayúsculas (ej. `USUARIO_DEACTIVATED`).

---

## Testing

```bash
pytest
```

Stack: `pytest` + `pytest-asyncio` + `httpx` + `aiosqlite` (BD en memoria para tests).

---

## Jobs en background (APScheduler)

Definidos en `app/main.py`, arrancan en el lifespan:

| Job | Intervalo | Descripción |
|---|---|---|
| `it_mirror_sync` | `IT_SYNC_INTERVAL_MINUTES` (default 30 min) | Sincroniza empleados desde IT Mirror DB |
| `tress_scheduler` | 5 min | Procesa cola de operaciones TRESS pendientes |

---

## Lo que NO hacer

- No usar `HTTPException` en Services — solo excepciones de `app/core/exceptions.py`.
- No importar SQLAlchemy en Services.
- No llamar Repos directamente desde Routers.
- No bloquear requests HTTP con operaciones TRESS o SMTP.
- No usar paginación por offset — siempre cursor-based.
- No borrar registros de `Empleado` — siempre soft delete (`activo=False`).
- No capturar `LeoniException` en el Router para relanzarla — dejar que suba al handler global.
