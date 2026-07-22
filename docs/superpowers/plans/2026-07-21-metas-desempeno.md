# Módulo Metas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Construir el subsistema de Metas (OKR ligero) para empleados y equipos: ciclos, metas con resultados clave medibles, seguimiento con check-ins, y cierre con calificación y cumplimiento ponderado.

**Architecture:** Backend en capas router → service → repository → models/schemas (FastAPI async + SQLAlchemy), tablas nuevas `levelup_meta_*`. Frontend TS vanilla + Vite bajo `#/talento/...` con el design system. Reutiliza notificaciones, APScheduler, export Excel, scoping por equipo y los tokens compartidos ya existentes.

**Tech Stack:** FastAPI async, SQLAlchemy async (asyncpg/SQLite tests), Alembic, Pydantic, reportlab/openpyxl, TypeScript+Vite+Tailwind.

**Spec fuente:** `docs/superpowers/specs/2026-07-21-metas-desempeno-design.md`.

## Global Constraints

- Tablas nuevas SIEMPRE con prefijo `levelup_`; **prohibido** DDL sobre tablas sin prefijo (Bono/DATOS_ANALISIS). Nunca correr `alembic upgrade/downgrade` contra la BD real; los tests usan SQLite in-memory.
- Migraciones en `alembic/versions/`; `down_revision` = head único actual, determinado con `docker-compose exec backend alembic heads` (NO adivinar; NO autogenerate).
- Capas: routers sin lógica de dominio (todo en el service); service usa repository; async en todo (AsyncSession). Precargar relaciones con `selectinload` para evitar `MissingGreenlet`.
- Errores con excepciones del repo (`app/core/exceptions.py`): estado inválido → `ConflictError` (409), input inválido → `DomainValidationError` (422), no encontrado → `NotFoundError` (404).
- Self-service usa SIEMPRE el `empleado_id` del token JWT, nunca del cliente.
- `openapi.yaml` sincronizado con cada endpoint nuevo. Frontend solo con tokens de `frontend/src/ui/uiTokens.ts` (incluye `pageHeading`, `renderTabNav`, `skeletonBlock`, `errorState`, `alertInfo/alertWarning`, `FORM_LABEL`, `FORM_SELECT`, badges) y patrones de `design.md`; nada de hex/fuentes nuevas.
- Commits atómicos, Conventional Commits en español (`feat(metas): …`), sin iniciales, terminando cada uno con:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Rama de trabajo: `feat/cm/metas-desempeno` (ya creada, con el spec commiteado). PR a main; sin push directo a main.
- Tests en SQLite in-memory con `tests/conftest.py`: `make_empleado(..., lider_id=<empleado_id del líder>)`, `make_clasificacion_administrativo`, `auth_headers(...)`. Patch JSONB→JSON ya aplicado.

---

## Estructura de archivos

**Backend (crear):** `app/models/metas.py`, `app/schemas/metas.py`, `app/repositories/metas_repository.py`, `app/services/metas_service.py`, `app/api/v1/metas/__init__.py`, `app/api/v1/metas/router.py`, `alembic/versions/<rev>_metas_fase1.py`.
**Backend (modificar):** `app/models/__init__.py`, `app/main.py` (include_router + job), `app/core/rh_module_registry.py` (RH_MODULES + self-service prefix), `openapi.yaml`.
**Frontend (crear):** `frontend/src/api/metas.ts`, `frontend/src/pages/metas.ts`, `frontend/src/pages/misMetas.ts`, `frontend/src/metas/shared.ts` (helpers de dominio: badge de estado, avance→barra, cálculo de avance en cliente para preview).
**Frontend (modificar):** `frontend/src/shellRouter.ts`, `frontend/src/navigation/talentoNav.ts`, `frontend/src/navigation/shellNavPolicy.ts`, `frontend/src/navigation/empleadoNav.ts`, `frontend/src/navigation/supervisorNav.ts`.
**Tests:** `tests/test_metas_models.py`, `tests/test_metas_service.py`, `tests/test_metas_api.py`, `tests/test_metas_resultados.py`, `tests/test_metas_recordatorios.py`.

---

### Task 1: Capa de datos (modelos + migración)

**Files:**
- Create: `app/models/metas.py`, `alembic/versions/<rev>_metas_fase1.py`, `tests/test_metas_models.py`
- Modify: `app/models/__init__.py`

**Interfaces (Produces):** clases `MetaCiclo`, `Meta`, `MetaResultadoClave`, `MetaCheckin` (tablas `levelup_meta_ciclo`, `levelup_meta`, `levelup_meta_resultado_clave`, `levelup_meta_checkin`) con los campos y relaciones del spec §"Modelo de datos". Constantes de dominio: `META_CICLO_ESTADOS=("borrador","activo","cerrado")`, `META_ESTADOS=("asignada","en_progreso","cerrada")`, `META_NIVELES=("individual","equipo")`, `RC_TIPOS_METRICA=("numero","porcentaje","booleano","moneda")`, `RC_DIRECCIONES=("subir","bajar")`.

- [ ] **Step 1: Estudiar patrones.** Leer `app/models/encuestas_rh.py` (estilo de modelos `levelup_*`, timestamps, JSONB, relaciones/cascades) y 2 migraciones recientes en `alembic/versions/` para el formato. Determinar el head: `docker-compose exec backend alembic heads`.
- [ ] **Step 2: Test de modelos (falla).** En `tests/test_metas_models.py`: crear un `MetaCiclo` activo, una `Meta` individual con 2 `MetaResultadoClave` y un `MetaCheckin`; leer relaciones (orden de RC), verificar `meta_padre_id` acepta enlazar a una meta nivel "equipo", y cascade (borrar ciclo borra metas→RC→checkins). Verificar `id` autoincrement y defaults de estado.
  ```python
  async def test_ciclo_meta_rc_checkin_y_cascade(db):
      ciclo = MetaCiclo(nombre="2026 Q1", fecha_inicio=date(2026,1,1), fecha_fin=date(2026,3,31), estado="activo")
      db.add(ciclo); await db.flush()
      meta = Meta(ciclo_id=ciclo.id, nivel="individual", empleado_id=1, titulo="Calidad L3", peso=Decimal("40"), estado="asignada", asignada_por_id=2)
      meta.resultados_clave = [
          MetaResultadoClave(orden=1, titulo="Scrap", tipo_metrica="porcentaje", direccion="bajar",
                             valor_inicial=Decimal("5"), valor_objetivo=Decimal("2"), valor_actual=Decimal("5")),
          MetaResultadoClave(orden=2, titulo="OPLs", tipo_metrica="numero", direccion="subir",
                             valor_inicial=Decimal("0"), valor_objetivo=Decimal("8"), valor_actual=Decimal("0")),
      ]
      db.add(meta); await db.flush()
      # ... check-in, refresh, asserts de relaciones y cascade (borrar ciclo → 0 metas/RC/checkins)
  ```
- [ ] **Step 3: Correr test (falla).** `docker-compose run --rm test pytest tests/test_metas_models.py -v` → FAIL (modelos inexistentes).
- [ ] **Step 4: Implementar `app/models/metas.py`** con las 4 clases, campos del spec, constantes de dominio, relaciones (`MetaCiclo.metas`, `Meta.resultados_clave` order_by orden cascade delete-orphan, `MetaResultadoClave.checkins`, `Meta.meta_padre`/`submetas`), índices `(ciclo_id, empleado_id)`, `(ciclo_id, nivel)`, `(meta_padre_id)`, `(resultado_clave_id)` en checkin. Registrar en `app/models/__init__.py`.
- [ ] **Step 5: Migración Alembic** manual `alembic/versions/<rev>_metas_fase1.py`: `create_table`/índices de las 4 tablas `levelup_meta_*`; `down_revision` = head del Step 1; `downgrade` en orden inverso de FK. NO ejecutar upgrade contra la BD real.
- [ ] **Step 6: Correr test (pasa).** `docker-compose run --rm test pytest tests/test_metas_models.py -v` → PASS.
- [ ] **Step 7: Commit.** `feat(metas): modelos y migración del dominio de metas`

---

### Task 2: Backend núcleo (schemas, repository, service)

**Files:**
- Create: `app/schemas/metas.py`, `app/repositories/metas_repository.py`, `app/services/metas_service.py`, `tests/test_metas_service.py`

**Interfaces (Consumes):** modelos y constantes de Task 1. **(Produces):** `MetasService(db)` con, al menos:
`crear_ciclo`, `activar_ciclo`, `cerrar_ciclo`, `list_ciclos`; `crear_meta`, `actualizar_meta`, `eliminar_meta`, `cerrar_meta(meta_id, calificacion, comentario, actor_id)`, `get_meta`, `list_metas(filtros)`; `agregar_rc`, `actualizar_rc`, `eliminar_rc`; `registrar_checkin(rc_id, autor_id, valor, nota, es_ajuste_jefe)`; `avance_rc(rc)->float`, `avance_meta(meta)->float`, `cumplimiento_empleado(ciclo_id, empleado_id)->float`; `list_mis_metas(empleado_id, ciclo_id)`, `get_mi_meta(id, empleado_id)`. Funciones puras de cálculo exportables para test directo.

- [ ] **Step 1: Estudiar** `app/services/encuestas_rh_service.py` y su repository (estilo, excepciones, selectinload), `app/schemas/encuestas_rh.py`, `app/core/exceptions.py`, `app/services/notificacion_service.py` (firma `enviar`).
- [ ] **Step 2: Tests de cálculo (fallan).** En `tests/test_metas_service.py`, tabla de casos para `avance_rc`:
  ```python
  @pytest.mark.parametrize("tipo,direccion,ini,obj,act,esp", [
      ("porcentaje","bajar", 5, 2, 3.5, 50),   # (5-3.5)/(5-2)=0.5
      ("numero","subir", 0, 8, 5, 63),          # 5/8=0.625→63 (redondeo documentado)
      ("numero","subir", 0, 8, 10, 100),        # clamp
      ("numero","bajar", 5, 2, 6, 0),           # clamp inferior
      ("booleano","subir", 0, 1, 1, 100),
      ("booleano","subir", 0, 1, 0, 0),
      ("numero","subir", 4, 4, 4, 100),         # denom 0 y cumple → 100 (borde documentado)
  ])
  def test_avance_rc(tipo,direccion,ini,obj,act,esp): ...
  ```
  Y `cumplimiento_empleado` ponderado: 2 metas cerradas peso 40/60 con calificación 80/50 → `(40*80+60*50)/100 = 62`.
- [ ] **Step 3: Correr (falla).** `docker-compose run --rm test pytest tests/test_metas_service.py -v` → FAIL.
- [ ] **Step 4: Implementar schemas + repository + service.** Fórmulas del spec §"Fórmula de avance y cumplimiento" (clamp 0–100, bordes documentados en docstring). Ciclo de vida: `activar_ciclo` (borrador→activo), `cerrar_ciclo` (activo→cerrado: setea metas a "cerrada" y congela; exige calificación previa o permite calificar al cerrar — decidir y documentar); `crear_meta` valida `nivel` (individual→`empleado_id` requerido; equipo→`area_id`/`lider_id`), `meta_padre_id` solo apunta a meta nivel equipo del mismo ciclo; `registrar_checkin` actualiza `rc.valor_actual` y pasa la meta a "en_progreso" en el primer check-in; editar meta/RC de ciclo cerrado → `ConflictError`. `avance_meta` = promedio de `avance_rc`; roll-up de meta equipo = si tiene RC propios usa RC, si no promedio de submetas. Repository con `selectinload` de `resultados_clave`/`checkins`.
- [ ] **Step 5: Tests de ciclo de vida y validación (agregar y hacer pasar):** primer check-in → en_progreso; editar meta de ciclo cerrado → 409; `meta_padre_id` a meta individual → 422; calificación fuera de 0–100 → 422; cerrar ciclo calcula cumplimiento.
- [ ] **Step 6: Correr (pasa).** `docker-compose run --rm test pytest tests/test_metas_service.py -v` → PASS.
- [ ] **Step 7: Commit.** `feat(metas): schemas, repository y service (ciclo de vida, avance, cumplimiento)`

---

### Task 3: API + registro de módulo + scoping de equipo

**Files:**
- Create: `app/api/v1/metas/__init__.py`, `app/api/v1/metas/router.py`, `tests/test_metas_api.py`
- Modify: `app/main.py`, `app/core/rh_module_registry.py`, `openapi.yaml`

**Interfaces (Consumes):** `MetasService`. **(Produces):** endpoints del spec §"API" bajo `/api/v1/metas`.

- [ ] **Step 1: Estudiar** `app/api/v1/encuestas_rh/router.py` (estructura, get_db/get_current_user, errores), `app/core/dependencies.py` (`role_checker`, `require_rh_module`, **`gestor_team_role_checker`** y el modo líder — para scoping por equipo), `app/middleware/rh_module_permission.py`, y cómo tests de API montan usuarios con módulo/rol (buscar tests de rh-permisos y `gestor`).
- [ ] **Step 2: Test de API (falla).** Flujo feliz: RH crea ciclo → activar → jefe (líder del empleado) crea meta con 2 RC para un miembro de su equipo → aparece en `/mis-metas` del empleado → empleado hace check-in (avance sube) → jefe cierra ciclo con calificación → `/empleados/{id}/cumplimiento` refleja el ponderado. Permisos: un jefe de OTRO equipo recibe 403/scope vacío al gestionar esa meta; empleado sin módulo puede usar `/mis-metas` (self-service) pero recibe 403 en gestión de ciclos; `/mis-metas/resultados/{rc}/checkin` ignora cualquier empleado_id del body (usa token). Recuerda: en SQLite no corre la migración; crea datos con modelos/servicio.
- [ ] **Step 3: Correr (falla).** `docker-compose run --rm test pytest tests/test_metas_api.py -v` → FAIL.
- [ ] **Step 4: Implementar router + registro.** Gestión con `role_checker(["operativo"])` para RH y `gestor_team_role_checker([...])` donde aplique scoping de equipo (replicar el patrón real que uses de `dependencies.py`; el service filtra por `lider_id` del jefe). Self-service (solo auth) para `/mis-metas*`. Registrar: `include_router` en `app/main.py`; entrada en `RH_MODULES` (`app/core/rh_module_registry.py`): `key="metas", label="Metas", group="Talento", nav_item_ids=("metas",), hash_prefixes=("#/talento/metas",), api_prefixes=("/api/v1/metas",)`; agregar `"/api/v1/metas/mis-metas"` a `RH_SELF_SERVICE_API_PREFIXES`. Actualizar `openapi.yaml`.
- [ ] **Step 5: Correr (pasa).** `docker-compose run --rm test pytest tests/test_metas_api.py -v` → PASS. Correr también `tests/test_metas_service.py tests/test_metas_models.py` para no regresionar.
- [ ] **Step 6: Commit.** `feat(metas): API REST, registro de módulo y scoping por equipo`

---

### Task 4: Tablero de equipo, cumplimiento y export Excel

**Files:**
- Modify: `app/services/metas_service.py`, `app/repositories/metas_repository.py`, `app/api/v1/metas/router.py`, `app/schemas/metas.py`, `openapi.yaml`
- Create: `tests/test_metas_resultados.py`

- [ ] **Step 1: Test (falla).** `GET /equipo/avance?ciclo_id=` devuelve, por miembro del equipo del jefe: metas, avance por meta (derivado) y avance global; `GET /empleados/{id}/cumplimiento?ciclo_id=` devuelve el cumplimiento ponderado (solo tras cierre); roll-up de meta de equipo (avance = promedio de submetas o RC propios). Export `GET /ciclos/{id}/export/excel` → 200 + content-type, workbook con hoja de metas/avance/cumplimiento (abrir con openpyxl en el test). Scoping: jefe solo ve su equipo.
- [ ] **Step 2: Correr (falla).**
- [ ] **Step 3: Implementar** agregaciones (avance/cumplimiento) en repository/service; endpoints; export con openpyxl (patrón `evaluacion360_service` export). Schemas de respuesta (`EquipoAvance`, `CumplimientoEmpleado`).
- [ ] **Step 4: Correr (pasa).** `docker-compose run --rm test pytest tests/test_metas_resultados.py -v` → PASS.
- [ ] **Step 5: Commit.** `feat(metas): tablero de avance de equipo, cumplimiento y export Excel`

---

### Task 5: Recordatorios (APScheduler + endpoint manual)

**Files:**
- Modify: `app/services/metas_service.py`, `app/api/v1/metas/router.py`, `app/main.py`, `openapi.yaml`
- Create: `tests/test_metas_recordatorios.py`

- [ ] **Step 1: Estudiar** `_eval360_recordatorios_job` en `app/main.py` (sesión, errores, cron 08:00, cómo NO corre en tests) y cómo encuestas-rh implementó `procesar_recordatorios`.
- [ ] **Step 2: Test (falla).** `procesar_recordatorios()` notifica a empleados con metas de ciclo activo próximo a cerrar (dentro de N días de `fecha_fin`) y/o RC sin check-in hace ≥ M días; devuelve resumen `{notificados, ciclos_por_cerrar}`; respondidas/cerradas no notifican. Endpoint manual `POST /ciclos/{id}/recordatorios` fuerza a los pendientes del ciclo. NotificacionService mockeado; sin sleeps (manipular fechas).
- [ ] **Step 3: Correr (falla).**
- [ ] **Step 4: Implementar** `procesar_recordatorios` en el service; `_metas_recordatorios_job` en `app/main.py` (registrado en el scheduler, cron diario) siguiendo el patrón eval360; endpoint manual. `NotificacionService.enviar(..., target_url="#/talento/mis-metas")`.
- [ ] **Step 5: Correr (pasa).** Luego todos los tests `tests/test_metas_*.py` + suite completa sin regresiones.
- [ ] **Step 6: Commit.** `feat(metas): recordatorios automáticos de cierre de ciclo y endpoint manual`

---

### Task 6: Frontend (API client + páginas + navegación)

**Files:**
- Create: `frontend/src/api/metas.ts`, `frontend/src/pages/metas.ts`, `frontend/src/pages/misMetas.ts`, `frontend/src/metas/shared.ts`
- Modify: `frontend/src/shellRouter.ts`, `frontend/src/navigation/talentoNav.ts`, `frontend/src/navigation/shellNavPolicy.ts`, `frontend/src/navigation/empleadoNav.ts`, `frontend/src/navigation/supervisorNav.ts`

- [ ] **Step 1: Leer** `design.md` y `frontend/src/ui/uiTokens.ts`; estudiar `frontend/src/pages/encuestasRh.ts` + `frontend/src/encuestasRh/shared.ts` (patrón de página del design system ya aplicado: `pageHeading`, `renderTabNav` con `data-tab`, `skeletonBlock`, `errorState`, `renderEmptyState`, badges, per-mount AbortController, event delegation), `frontend/src/pages/misEncuestasRh.ts` (página de empleado, radiogroup accesible) y `frontend/src/api/encuestasRh.ts` (cliente HTTP + descarga binaria del export).
- [ ] **Step 2: API client `metas.ts`** con types sincronizados con `app/schemas/metas.py` (léelos) y funciones para todos los endpoints (gestión, self-service, equipo/cumplimiento, export binario).
- [ ] **Step 3: `frontend/src/metas/shared.ts`** — `estadoMetaBadge`, `estadoCicloBadge`, `avanceBar(pct)` (barra con `tabular-nums`, % del total como en resultados de encuestas), y `avanceRcCliente(rc)` (misma fórmula que backend, para preview en vivo al capturar valor actual).
- [ ] **Step 4: Página gestión `metas.ts`** (`#/talento/metas`): ciclos (crear/activar/cerrar); asignar meta a un miembro del equipo con sus RC; tablero de avance del equipo (barras); cerrar ciclo y calificar metas. Header `pageHeading`, tabs `renderTabNav`, estados con `skeletonBlock`/`errorState`/`renderEmptyState`.
- [ ] **Step 5: Página empleado `misMetas.ts`** (`#/talento/mis-metas`): metas asignadas por ciclo; formulario para actualizar `valor_actual` de cada RC con nota de check-in (avance recalculado en vivo con `avanceRcCliente`); historial de check-ins; calificación al cierre. Accesibilidad de formularios (labels/fieldset).
- [ ] **Step 6: Integración shell.** `shellRouter.ts`: ramas `#/talento/metas` y `#/talento/mis-metas` con import dinámico, ANTES de ramas más genéricas y sin colisión (verificar como en encuestas). `talentoNav.ts`: ítem "Metas" (id `metas`) gated por módulo. `shellNavPolicy.ts`: `"metas"` y `"mis-metas"` al union de nav ids; `"mis-metas"` visible a empleado/supervisor; guard de hash para `#/talento/mis-metas`. `empleadoNav.ts`/`supervisorNav.ts`: ítem "Mis metas" → `#/talento/mis-metas`.
- [ ] **Step 7: Verificar.** `docker-compose exec frontend npm run build` limpio (sin errores TS nuevos) y `npm run test` verde. Auto-revisar: solo tokens del sistema, cero inline; hashes sin colisión.
- [ ] **Step 8: Commit(s).** `feat(metas): cliente API`, `feat(metas): páginas de gestión y de empleado`, `feat(metas): navegación y router del módulo`.

---

### Task 7: Cierre de huecos de cobertura

**Files:** Modify los `tests/test_metas_*.py` según huecos señalados en revisiones.

- [ ] **Step 1:** Agregar los tests que las revisiones por tarea marquen como faltantes (p. ej. roll-up de meta de equipo con RC propios vs submetas; borde denominador 0; peso total ≠ 100 advertido; scoping negativo adicional). Un solo commit `test(metas): cerrar huecos de cobertura señalados en revisión`.
- [ ] **Step 2:** Correr todos los `tests/test_metas_*.py` y la suite completa; reportar totales.

---

## Verificación end-to-end

- `docker-compose run --rm test pytest tests/test_metas_*.py -q` (todos verdes) y suite completa `docker-compose run --rm test` sin regresiones.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual (`docker-compose up -d`, migrar `alembic upgrade head` en dev): RH crea ciclo "2026 Q1" y lo activa → jefe asigna una meta con 2 RC a un empleado de su equipo → empleado actualiza avance (check-ins, ve el % recalcularse) → jefe cierra el ciclo y califica cada meta → verificar cumplimiento ponderado y tablero de equipo → export Excel. Revisar responsive y navegación por teclado.

## Self-review (cobertura del spec)

- Modelo de datos §spec → Task 1. Fórmulas avance/cumplimiento → Task 2 (+ tests parametrizados). Ciclo de vida/validaciones → Task 2/3. API completa (gestión + self-service) → Task 3. Permisos/scoping equipo → Task 3. Tablero equipo + cumplimiento + export → Task 4. Recordatorios → Task 5. Frontend (2 páginas + nav) → Task 6. Testing (todos los ejes del spec §Testing) → distribuido + Task 7.
- Fuera de alcance (orquestador de ciclo, cruce historial, vista360, feed 9-box) NO tiene tareas — correcto, son sub-proyectos posteriores; el cumplimiento se **expone** vía `GET /empleados/{id}/cumplimiento` (Task 4) para consumo futuro.
