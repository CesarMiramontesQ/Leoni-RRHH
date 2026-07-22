# Gestión de Metas para jefes/supervisores — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Exponer la gestión de metas al jefe/supervisor (flujo "el jefe asigna") con la misma página `metas.ts` adaptada al rol, aflojando solo la lectura de ciclos y haciendo descubrible el ítem "Metas".

**Architecture:** Cambio mínimo de permisos en el backend (dos endpoints de lectura de ciclos pasan a la dependencia de equipo ya existente) + página frontend role-adaptive + ajuste de la política de navegación. El backend de metas/tablero ya scopea por equipo; no se toca.

**Tech Stack:** FastAPI async, SQLAlchemy async (SQLite en tests), TypeScript+Vite+Tailwind, design system.

**Spec fuente:** `docs/superpowers/specs/2026-07-21-metas-gestion-jefe-design.md`.

## Global Constraints

- NO ampliar permisos más allá de lo especificado: solo `GET /ciclos` y `GET /ciclos/{id}` cambian de guard; `POST /ciclos`, `/activar`, `/cerrar`, `PUT /ciclos/{id}`, `/recordatorios` permanecen en `role_checker(["operativo"])`. Metas/RC/tablero NO se tocan (ya scopean).
- No tocar `app/core/rh_module_registry.py` ni el middleware: `_gestion_or_equipo()` y el patrón self-service ya cubren a supervisores nativos.
- Frontend: solo tokens del design system; detectar rol con el criterio YA usado en `frontend/src/pages/dashboard.ts` (`isRhOperativoUiMode()` / `getRolFromAccessToken()` / helpers de `frontend/src/auth/`), sin inventar una tercera forma.
- Async en backend; errores con las excepciones del repo; tests en SQLite in-memory (`tests/conftest.py`, `make_empleado(..., lider_id=<empleado_id del líder>)`, `auth_headers`).
- Commits atómicos en español, Conventional Commits (`feat(metas): …` / `fix(metas): …`), sin iniciales, terminando cada uno con:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Rama `feat/cm/metas-gestion-jefe` (ya creada, con el spec commiteado). PR a main; sin push directo.
- `openapi.yaml`: los dos endpoints de lectura ya existen documentados; solo actualizar si su `security`/descripción de auth cambia de forma observable (revisar y sincronizar si aplica).

---

## Estructura de archivos

**Backend (modificar):** `app/api/v1/metas/router.py` (dependencia de `list_ciclos` y `get_ciclo`), `tests/test_metas_api.py`.
**Frontend (modificar):** `frontend/src/pages/metas.ts` (render role-adaptive), `frontend/src/navigation/shellNavPolicy.ts` (visibilidad del ítem "metas" para supervisor/gerente), y `frontend/src/navigation/talentoNav.ts` solo si hace falta para la visibilidad. Tests de nav si el repo los tiene (`frontend/src/navigation/*.test.ts`).

---

### Task 1: Backend — aflojar lectura de ciclos a jefes

**Files:**
- Modify: `app/api/v1/metas/router.py`
- Test: `tests/test_metas_api.py`

**Interfaces:**
- Consumes: `_gestion_or_equipo()` (dependency ya existente en `app/api/v1/metas/router.py`, usada por las rutas de metas; concede a RH global o a jefe con scope de equipo).
- Produces: `GET /api/v1/metas/ciclos` y `GET /api/v1/metas/ciclos/{ciclo_id}` accesibles para supervisor/gerente (lectura); el resto de `/ciclos` sin cambios.

- [ ] **Step 1: Estudiar** `app/api/v1/metas/router.py`: localizar `list_ciclos` (GET /ciclos) y `get_ciclo` (GET /ciclos/{id}) y su dependencia actual `role_checker(["operativo"])`; confirmar la firma exacta de `_gestion_or_equipo()` y cómo la usan las rutas de metas (para replicar el mismo `Depends`). Ver cómo los tests existentes montan un supervisor líder de un empleado (buscar en `tests/test_metas_api.py` los tests de scoping de T3/T7 que usan `make_empleado(lider_id=...)` + `gestor_team_role_checker`).

- [ ] **Step 2: Escribir tests (fallan)** en `tests/test_metas_api.py`:
  ```python
  async def test_supervisor_puede_listar_y_ver_ciclos(client, db):
      # jefe = supervisor; empleado con lider_id = jefe.empleado_id (mismo patrón que los tests de scoping existentes)
      # RH crea y activa un ciclo (vía service o endpoint con usuario RH)
      # GET /api/v1/metas/ciclos con auth del supervisor → 200 y el ciclo aparece
      # GET /api/v1/metas/ciclos/{id} con auth del supervisor → 200
      ...

  async def test_supervisor_no_puede_administrar_ciclos(client, db):
      # mismo supervisor:
      # POST /api/v1/metas/ciclos → 403
      # POST /api/v1/metas/ciclos/{id}/activar → 403
      # POST /api/v1/metas/ciclos/{id}/cerrar → 403
      # PUT  /api/v1/metas/ciclos/{id} → 403
      ...
  ```
  (Reutiliza los helpers/fixtures de creación de ciclo y de auth de supervisor ya presentes en el archivo; NO dupliques factories.)

- [ ] **Step 3: Correr (falla).** `docker-compose run --rm test pytest tests/test_metas_api.py -k "ciclos" -v` → los dos GET dan 403 (aún con guard `operativo`).

- [ ] **Step 4: Implementar.** Cambiar la dependencia SOLO de `list_ciclos` y `get_ciclo` de `role_checker(["operativo"])` a `_gestion_or_equipo()` (idéntico `Depends(...)` que usan las rutas de metas). No tocar `create_ciclo`, `activar_ciclo`, `cerrar_ciclo`, `update_ciclo`, `forzar_recordatorios`. Revisar si `openapi.yaml` describe un `security`/auth para esos dos GET que deba sincronizarse; si el estilo es genérico (como el resto del bloque `metas`), no requiere cambio.

- [ ] **Step 5: Correr (pasa).** `docker-compose run --rm test pytest tests/test_metas_api.py -q` verde; luego `docker-compose run --rm test pytest tests/test_metas_*.py -q` sin regresiones.

- [ ] **Step 6: Commit.** `feat(metas): permitir a jefes leer ciclos (GET) manteniendo administración en RH`

---

### Task 2: Frontend — página de metas adaptada al rol

**Files:**
- Modify: `frontend/src/pages/metas.ts`

**Interfaces:**
- Consumes: helper de detección de rol RH-operativo del repo (el mismo que usa `frontend/src/pages/dashboard.ts` para elegir `mountRhOperationalDashboard` vs `mountLiderTeamDashboardShell` — típicamente `isRhOperativoUiMode()` de `frontend/src/auth/rhUiMode.ts` combinado con `getRolFromAccessToken()` de `frontend/src/auth/jwt.ts`; verifica el criterio real ahí y reúsalo).
- Produces: `mountMetas` renderiza sin pestaña/acciones de ciclos para no-RH.

- [ ] **Step 1: Estudiar** `frontend/src/pages/dashboard.ts` (`mountDashboardPlaceholder`, ~L556-569: cómo decide el rol) y `frontend/src/pages/metas.ts` completo: la lista de pestañas (`ciclos`/`metas`/`tablero`, ~L90), el render del tab "ciclos" y sus acciones (`data-action="ciclo-nuevo"/"ciclo-activar"/"ciclo-cerrar"/"ciclo-editar"` y recordatorios), `loadCiclos()`/`listCiclos()` (~L311-323), y dónde se arma la barra de pestañas (`renderTabNav`).

- [ ] **Step 2: Implementar `esGestionRh`.** Al inicio de `mountMetas`, calcular una vez `const esGestionRh = <criterio de dashboard.ts>` (RH operativo). Guardar en el estado del módulo.

- [ ] **Step 3: Render adaptativo.**
  - Barra de pestañas: incluir "Ciclos" solo si `esGestionRh`; para jefe, solo "Metas" y "Tablero" (más el selector de ciclo, que NO es una pestaña sino un control compartido — mantenerlo visible para ambos).
  - Si `!esGestionRh` y la subvista actual resuelta fuese "ciclos" (p. ej. por default), redirigir la subvista inicial a "metas".
  - No renderizar los botones de administración de ciclo (`ciclo-nuevo/activar/cerrar/editar`, recordatorios) cuando `!esGestionRh`. (Defensa en profundidad: aunque el backend los 403ea, no deben mostrarse.)
  - Encabezado: `pageHeading` con eyebrow adaptado — RH: "Talento" / jefe: "Talento · Mi equipo" (o "Metas de mi equipo" como título) para dejar claro el alcance.
  - Estados vacíos (usar `renderEmptyState`/`errorState`/`alertInfo` ya disponibles): sin ciclos → "Aún no hay ciclos de metas. Pídele a RH que cree uno."; ciclo activo sin metas del equipo → empty con CTA "Asignar meta".

- [ ] **Step 4: Verificar build.** `docker-compose exec -T frontend npm run build` limpio (sin errores TS nuevos vs baseline — compara con `git stash` si dudas). `docker-compose exec -T frontend npm run test` verde. (No hay infra jsdom para páginas `src/pages/`; la verificación de esta página es build + manual.)

- [ ] **Step 5: Commit.** `feat(metas): página de metas adaptada al rol para jefes (sin administración de ciclos)`

---

### Task 3: Frontend — hacer descubrible "Metas" para supervisor/gerente

**Files:**
- Modify: `frontend/src/navigation/shellNavPolicy.ts` (y `frontend/src/navigation/talentoNav.ts` solo si la visibilidad lo requiere)
- Test: `frontend/src/navigation/*.test.ts` si el repo tiene tests de política de nav (buscar; encuestas-rh agregó tests de nav)

**Interfaces:**
- Consumes: el ítem `metas` (`id:"metas"`, `href:"#/talento/metas"`) ya definido en `frontend/src/navigation/talentoNav.ts`.
- Produces: el ítem "Metas" visible en el sidebar de supervisor/gerente; `#/talento/metas` navegable por esos roles (ya lo es vía `supervisorMayAccessHash`).

- [ ] **Step 1: Estudiar** `frontend/src/navigation/shellNavPolicy.ts`: `SUPERVISOR_VISIBLE_NAV_IDS` (~L209-221), `TALENTO_NAV_IDS` (~L253-256), `roleOnlyNavVisible` (~L290-292, que hoy limita los `TALENTO_NAV_IDS` a `operativo|director|gerente`), `supervisorMayAccessHash` (~L375-387, confirmar que `#/talento/metas` cae en el `return true` final), y cómo se resuelve la visibilidad final del ítem (`isShellNavItemVisibleForRol` en `talentoNav.ts`). Ver cómo encuestas-rh dejó visible "mis-encuestas" a supervisor como patrón de referencia.

- [ ] **Step 2: Test (si hay infra de nav tests) — falla.** Agregar en el archivo de tests de nav existente un caso: para rol supervisor, el ítem `metas` es visible / `#/talento/metas` es accesible. Si NO existe infra de tests de nav para este policy, saltar el test y declararlo en el reporte (la verificación será build + manual), sin inventar framework.

- [ ] **Step 3: Implementar visibilidad.** Hacer que `metas` sea visible para supervisor y gerente: agregar `"metas"` a `SUPERVISOR_VISIBLE_NAV_IDS` y/o ajustar `roleOnlyNavVisible` para que el ítem `metas` de `TALENTO_NAV_IDS` no quede restringido a solo RH-operativo. Mantener "metas" también visible para RH (no romper el caso actual). Confirmar que `supervisorMayAccessHash("#/talento/metas")` sigue devolviendo `true` y que `resolveRoutedHashForRol` no lo redirige para supervisor/gerente. Etiqueta del ítem: mantener "Metas" (sin segundo ítem).

- [ ] **Step 4: Verificar.** `docker-compose exec -T frontend npm run build` limpio + `npm run test` verde.

- [ ] **Step 5: Commit.** `feat(metas): mostrar el ítem Metas a supervisores y gerentes`

---

## Verificación end-to-end

- Backend: `docker-compose run --rm test pytest tests/test_metas_*.py -q` (verde) + suite completa `docker-compose run --rm test` sin regresiones.
- Frontend: `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual (`docker-compose up -d`): login como **supervisor** con ≥1 reporte directo → aparece el ítem "Metas" en el menú → `#/talento/metas` carga sin 403, sin pestaña "Ciclos" ni acciones de ciclo → seleccionar el ciclo activo (creado por RH) → asignar una meta con resultados clave a un reporte directo → verla en el tablero de equipo → cerrarla y calificarla → confirmar que NO ve metas de otro equipo. Login como **RH** → la página conserva todas las pestañas y acciones de ciclo.

## Self-review (cobertura del spec)

- §Backend (aflojar GET /ciclos y GET /ciclos/{id}; resto solo-RH) → Task 1 (+ tests de 200 lectura / 403 administración).
- §Frontend página role-adaptive (ocultar administración de ciclos, empty states, encabezado por rol) → Task 2.
- §Frontend navegación (ítem descubrible para supervisor/gerente) → Task 3.
- §Fuera de alcance (metas/tablero backend, crear/activar/cerrar ciclos, subárbol de gerente, follow-ups de UX del PR #113) → sin tareas, correcto.
