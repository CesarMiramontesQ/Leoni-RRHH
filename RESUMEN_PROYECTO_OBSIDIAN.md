# Plataforma RH Leoni Cable

#leoni-rh #fastapi #typescript #postgresql #spa #recursos-humanos #on-premise

> Mapa técnico del repositorio para integración en [[Obsidian]] (navegación con `[[enlaces]]` y `#etiquetas`).

---

## 1. Resumen ejecutivo

**Qué es:** Sistema *on-premise* de Recursos Humanos orientado a operaciones de Leoni Cable: directorio de empleados, solicitudes con flujo de aprobación, incidencias, actas administrativas, comedor (menú, reservas, validación por huella), notificaciones, organigrama, exportación de reportes y trazabilidad vía auditoría.

**Propósito:** Centralizar procesos RH que antes podían estar dispersos (correo, hojas, sistemas legados), con API única ([[FastAPI]]), base [[PostgreSQL]] asíncrona y SPA ligera ([[Vite]] + TypeScript) servida por hash routing.

**Problema que resuelve:** Orquestar el ciclo de vida de solicitudes e incidencias, vincularlos a actas y PDFs, dar visibilidad operativa a líderes y RH (dashboards, [[Vista 360]]), integrar señales de sistemas externos ([[TRESS]], espejo IT previsto) y automatizar recordatorios por correo, con comedor asistido por hardware de huella donde aplique.

---

## 2. Arquitectura

### 2.1 Visión general

```text
[SPA Vite :5173] ──proxy /api──► [FastAPI :8000] ──SQLAlchemy async──► [PostgreSQL]
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              [SMTP / correo]  [Ollama LLM]    [TRESS ODBC / cola GUI]
              [IT Mirror URL]  (opcional)     (Windows / entorno real)
```

- **Frontend:** aplicación sin framework reactivo pesado; montaje manual por página (`mount*`), rutas por `location.hash` ([[shellRouter]]).
- **Backend:** capas clásicas `api` → `services` → `repositories` → `models`, con `schemas` ([[Pydantic]]) para I/O.
- **Jobs:** [[APScheduler]] en el *lifespan* de la app: sincronización periódica de empleados desde TRESS y procesamiento de cola TRESS.

### 2.2 Estructura de carpetas (alto nivel)

| Ruta | Rol |
|------|-----|
| `app/main.py` | Instancia [[FastAPI]], CORS, manejadores de error, registro de routers, `lifespan` con scheduler |
| `app/core/` | `config` ([[pydantic-settings]]), `database`, `security` (JWT, hash), `dependencies` (usuario actual, roles), `exceptions` |
| `app/api/v1/*/` | Routers REST por dominio (`auth`, `usuarios`, `empleados`, `solicitudes`, `incidencias`, `actas`, `comedor`, `reportes`, `notificaciones`, `auditoria`, `organigrama`) |
| `app/services/` | Reglas de negocio por dominio |
| `app/repositories/` | Acceso a datos SQLAlchemy async |
| `app/models/` | ORM: empleados, solicitudes, incidencias, actas, comedor, notificaciones, auditoría, catálogos, TRESS, etc. |
| `app/schemas/` | DTOs de entrada/salida |
| `app/integrations/` | `it_mirror`, `tress` (sync, cola, robot GUI, SQL client), `email_sender`, `ollama_client` |
| `app/utils/` | Utilidades (`audit_logger`, `seed`) |
| `alembic/` | Migraciones de esquema |
| `tests/` | [[pytest]] + `httpx` / `aiosqlite` |
| `frontend/src/` | `pages/`, `components/`, `api/` (cliente HTTP), `auth/`, `dashboard/` por rol, `shellRouter.ts` |
| `docs/superpowers/` | Especificaciones y planes históricos (no código ejecutable) |

Directorios ignorados en inventario detallado: `node_modules`, `venv`, `.venv`, `dist`, `build`, `__pycache__`.

---

## 3. Tecnologías utilizadas

### Backend

- **Lenguaje:** Python 3 (implícito en dependencias).
- **API:** [[FastAPI]] 0.115, [[Uvicorn]].
- **ORM / BD:** [[SQLAlchemy]] 2 async, [[asyncpg]], [[Alembic]]; URL por defecto PostgreSQL (`postgresql+asyncpg://…`).
- **Validación / config:** [[Pydantic]] v2, pydantic-settings.
- **Auth:** `python-jose`, `passlib[bcrypt]`, OAuth2 password flow + refresh + blacklist de JTI.
- **HTTP cliente:** `httpx` (health Ollama, llamadas salientes).
- **Correo:** `aiosmtplib`.
- **Jobs:** `apscheduler` (AsyncIOScheduler).
- **Exportación:** `openpyxl`, `reportlab`.
- **Tests:** pytest, pytest-asyncio, aiosqlite.
- **Integraciones opcionales:** `psycopg2-binary` (scripts/sync), comentarios en `requirements.txt` para `pyodbc` / `pywinauto` / `pywin32` (TRESS en Windows).

### Frontend

- **Lenguaje:** TypeScript (~5.9).
- **Build / dev:** [[Vite]] 8, plugin [[Tailwind]] 4 (`@tailwindcss/vite`).
- **UI:** `@tailwindplus/elements` (componentes web).
- **Tests:** Vitest.

### Infra / herramientas

- **Proxy dev:** Vite → `http://localhost:8000` para rutas `/api`.
- **Documentación API:** `/docs` (Swagger), `/redoc`.

---

## 4. Flujo de datos

1. **Autenticación:** el cliente envía credenciales a `POST /api/v1/auth/login`; recibe *access* + *refresh*. Las peticiones posteriores llevan `Authorization: Bearer`. `get_current_user` valida JWT, blacklist y estado activo del empleado.
2. **Autorización por rol:** dependencias tipo `role_checker(["rh"])` restringen endpoints sensibles (ej. sync IT, partes del directorio).
3. **Dominio RH:** routers delegan en *services*; estos orquestan repositorios, generan notificaciones, escriben auditoría y, en algunos flujos, encolan operaciones TRESS o envían correo.
4. **Sincronización de maestro de personas:** job periódico ejecuta `TressSyncService.sincronizar_empleados` (fuente TRESS cuando ODBC está configurado). El módulo `it_mirror` define `ITMirrorClient` y `run_it_mirror_sync` para espejo IT; el endpoint `POST /api/v1/auth/sync-it` está reservado (respuesta *pending* en código actual).
5. **Frontend:** módulos en `frontend/src/api/*.ts` encapsulan `fetch` al proxy `/api`; las páginas montan DOM y reaccionan al hash (`#/empleados`, `#/solicitudes`, etc.).

---

## 5. Diccionario de funciones y componentes

### 5.1 API REST — prefijos base

Todos bajo el origen del backend (en dev, vía proxy, `/api/v1/...`).

#### [[Auth API]] — `app/api/v1/auth/router.py`

| Elemento | Utilidad |
|----------|----------|
| `POST /login` | Autenticación por formulario OAuth2 (usuario/contraseña) |
| `POST /refresh` | Nuevo access token desde refresh |
| `POST /logout` | Revoca JTI actual (blacklist) |
| `GET /me` | Perfil del empleado autenticado |
| `POST /sync-it` | *Stub* RH: disparo manual de sync IT (implementación futura) |

#### [[Usuarios API]] — `app/api/v1/usuarios/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /roles` | Catálogo breve de roles |
| `GET /{id}` | Detalle usuario/empleado administrable |
| `PATCH /{id}` | Asignación de líder y rol |

#### [[Empleados API]] — `app/api/v1/empleados/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /resumen` | Métricas agregadas del directorio |
| `GET /catalogo-filtros` | Valores para filtros de listado |
| `GET /` | Listado paginado con filtros |
| `GET /{id}/vista360` | Vista consolidada del empleado |
| `GET /{id}/metricas` | Indicadores numéricos asociados |

#### [[Solicitudes API]] — `app/api/v1/solicitudes/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Lista paginada |
| `POST /` | Alta de solicitud |
| `GET /{id}` | Detalle |
| `GET /{id}/aprobaciones` | Historial de aprobaciones |
| `PUT /approve`, `/reject`, `/request-changes` | Decisiones de flujo |
| `PATCH /revision` | Ajustes en revisión |
| `PUT /override`, `/cancel` | Acciones administrativas / cancelación |

#### [[Incidencias API]] — `app/api/v1/incidencias/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Listado |
| `POST /` | Creación |
| `GET /{id}` | Detalle |
| `PUT /{id}/estado` | Cambio de estado |
| `POST /{id}/evidencias` | Carga de evidencia |
| `GET /{id}/evidencias/{eid}` | Descarga de archivo |

#### [[Actas API]] — `app/api/v1/actas/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Listado |
| `POST /generar/{incidencia_id}` | Generación desde incidencia |
| `GET /{id}` | Detalle |
| `PUT /{id}/editar` | Edición de contenido |
| `PUT /{id}/firmar` | Cierre / firma |
| `GET /{id}/pdf` | Descarga PDF |

#### [[Comedor API]] — `app/api/v1/comedor/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /comedores` | Puntos de servicio |
| `GET/POST /menu` | Consulta y publicación de menú semanal |
| `POST /registro` | Registro de selección/comida |
| `POST /huella/validar` | Validación lector huella (IP whitelist configurable) |
| `GET /estadisticas`, `/proyecciones` | Analítica operativa |

#### [[Reportes API]] — `app/api/v1/reportes/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /dashboard/kpis` | KPIs para paneles |
| `GET /{modulo}/pdf`, `/excel` | Exportación por módulo |

#### [[Notificaciones API]] — `app/api/v1/notificaciones/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Bandeja paginada |
| `GET /recientes` | Últimas entradas |
| `GET /no-leidas/count` (alias `unread-count`) | Contador |
| `PUT /{id}/leer` (alias `read`) | Marcar una |
| `PUT /leer-todas` (alias `read-all`) | Marcar todas |

#### [[Auditoría API]] — `app/api/v1/auditoria/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /logs` | Listado paginado de eventos |
| `GET /logs/{log_id}` | Detalle de evento |

#### [[Organigrama API]] — `app/api/v1/organigrama/router.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Árbol / estructura organizacional |

#### Raíz — `app/main.py`

| Elemento | Utilidad |
|----------|----------|
| `GET /` | Metadatos de app y enlaces a docs |
| `GET /health` | *Liveness* simple |

### 5.2 Servicios backend (`app/services/`)

| Archivo | Responsabilidad principal |
|---------|---------------------------|
| `auth_service.py` | Credenciales, emisión/revocación de tokens |
| `usuario_service.py` | Gestión de usuarios empleados, asignaciones, listados RH |
| `solicitud_service.py` | Ciclo de vida de solicitudes y aprobaciones |
| `incidencia_service.py` | Incidencias y evidencias |
| `acta_service.py` | Actas administrativas y PDF |
| `comedor_service.py` | Menú, registros, huella, estadísticas |
| `notificacion_service.py` | Bandeja y estados de lectura |
| `auditoria_service.py` | Consulta de bitácora |
| `reporte_service.py` | KPIs y exportaciones |
| `organigrama_service.py` | Construcción del organigrama |

### 5.3 Integraciones (`app/integrations/`)

| Componente | Utilidad |
|------------|----------|
| `tress/tress_sync_service.py` | Sincronización empleados desde TRESS hacia BD local |
| `tress/tress_scheduler.py` | Procesamiento de cola de operaciones TRESS |
| `tress/tress_sql_client.py` | Acceso lectura SQL Server |
| `tress/tress_gui_robot.py` | Automatización GUI donde aplica |
| `tress/queue.py` | Modelo de cola |
| `it_mirror.py` | Cliente de sync desde BD espejo IT (reglas de no pisar rol/líder/password) |
| `email_sender.py` | Envío SMTP |
| `ollama_client.py` | Cliente LLM local (complemento analítico / futuro) |

### 5.4 Frontend — enrutado y páginas

| Archivo / área | Utilidad |
|----------------|----------|
| `frontend/src/main.ts` | Entrada: sesión → *shell* o login |
| `frontend/src/shellRouter.ts` | Router hash: dashboard, empleados, vista 360, solicitudes, incidencias, actas, comedor, notificaciones, organigrama; políticas por rol |
| `frontend/src/pages/*.ts` | Montaje de cada pantalla (`login`, `empleados`, `solicitudes`, etc.) |
| `frontend/src/api/*.ts` | Clientes REST alineados con el backend (`http.ts` base) |
| `frontend/src/auth/` | JWT en sesión, decodificación de rol |
| `frontend/src/components/` | UI por dominio (tablas, modales, dashboards) |
| `frontend/src/dashboard/` | Datos y widgets por rol (empleado, líder, RH) |

### 5.5 Utilidades transversales

| Ubicación | Utilidad |
|-----------|----------|
| `app/core/dependencies.py` | `get_current_user`, `role_checker`, cliente DB inyectado |
| `app/utils/audit_logger.py` | Registro estructurado de auditoría |
| `tests/conftest.py` | Fixtures pytest para API y BD de prueba |

---

## 6. Setup rápido (inferido del repo)

No hay `README.md` en la raíz; los pasos habituales serían:

1. **PostgreSQL:** crear BD acorde a `DATABASE_URL` en `.env` (ver `app/core/config.py`).
2. **Backend:** entorno virtual, `pip install -r requirements.txt`, variables en `.env`, ejecutar migraciones `alembic upgrade head`, levantar `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
3. **Frontend:** `cd frontend && npm install && npm run dev` (puerto 5173; proxy a API en 8000).
4. **Opcional:** Ollama en `OLLAMA_URL`; SMTP para notificaciones; `TRESS_ODBC_CONN` / `IT_MIRROR_DB_URL` en entornos integrados.

Documentación interactiva: `http://localhost:8000/docs` tras arrancar el backend.

---

## 7. Referencias cruzadas sugeridas en Obsidian

- Enlaces a notas propias: `[[PostgreSQL]]`, `[[JWT]]`, `[[SQLAlchemy 2]]`, `[[Tailwind CSS 4]]`.
- Este mapa puede enlazarse desde una nota índice del workspace, por ejemplo `[[Leoni RRHH - índice técnico]]`.

---

*Generado como inventario estático del árbol del proyecto; tras cambios grandes en rutas o dominios, conviene regenerar o diff contra git.*
