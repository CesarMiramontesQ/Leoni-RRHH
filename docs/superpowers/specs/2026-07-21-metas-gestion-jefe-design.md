# Spec de diseño — Gestión de Metas para jefes/supervisores

Fecha: 2026-07-21 · Rama: `feat/cm/metas-gestion-jefe` · Estado: aprobado para plan

## Contexto y motivación

El módulo Metas (PR #113, ya en `main`) implementó el flujo "el jefe asigna metas top-down" a nivel backend: **todos** los endpoints de metas / resultados clave / tablero usan `_gestion_or_equipo()` en `app/api/v1/metas/router.py`, que concede acceso a RH global O a un jefe con **scope de equipo** (reportes directos vía `lider_id`). Sin embargo, la página de gestión `#/talento/metas` solo es descubrible/usable por RH, porque:

1. **Todos los endpoints de ciclos** exigen `role_checker(["operativo"])` (solo RH), **incluido `GET /ciclos`**. La página `frontend/src/pages/metas.ts` llama `listCiclos()` (`GET /ciclos`) al montar, siempre, para poblar el selector de ciclo; para un supervisor eso responde 403 y la página no renderiza nada útil. Este es el único bloqueo real de backend.
2. El ítem de navegación "metas" no es visible para supervisor/gerente (`TALENTO_NAV_IDS` + `roleOnlyNavVisible` en `frontend/src/navigation/shellNavPolicy.ts` lo limitan a `operativo|director|gerente` como rol de UI RH). La ruta `#/talento/metas` sí pasa `supervisorMayAccessHash` (termina en `return true`), así que es navegable, pero no descubrible ni funcional.

Resultado: la capacidad "jefe asigna a su equipo" existe y es segura, pero es inalcanzable desde la UI del supervisor. Precedente directo en el repo: **Evaluaciones (`#/evaluaciones`) y PDI (`#/pdi-gestion`)** abren su página de gestión a supervisores con scope de equipo (guard laxo + scoping en el servicio), y `dashboard.ts` monta páginas distintas según rol (`mountRhOperationalDashboard` / `mountLiderTeamDashboardShell` / `mountEmpleadoPersonalDashboardShell`).

**Objetivo:** exponer la gestión de metas a jefes/supervisores (y gerentes) con la misma página adaptada al rol, activando el flujo "el jefe asigna" de punta a punta, sin romper el control de RH sobre los ciclos.

## Decisión aprobada por el usuario

**Enfoque A — página de gestión adaptada al rol** (reusar `metas.ts`), sobre el enfoque B (vista de equipo dedicada). Menos código, una sola superficie, consistente con el patrón `dashboard.ts` y con cómo PDI/Evaluaciones abren su gestión a supervisores.

## Alcance

**Dentro:**
- Backend: aflojar la **lectura** de ciclos (`GET /ciclos`, `GET /ciclos/{id}`) de `role_checker(["operativo"])` a `_gestion_or_equipo()`. Todo lo demás de ciclos queda solo-RH.
- Frontend: `metas.ts` role-adaptive (ocultar administración de ciclos para no-RH); hacer el ítem "Metas" descubrible para supervisor/gerente en el nav.

**Fuera (no se toca):**
- Metas/RC/tablero backend (ya soportan jefe con scope — sin cambios).
- Crear/activar/cerrar/editar ciclos y recordatorios manuales: siguen siendo solo-RH.
- Ampliar el scope del gerente a subárbol completo (hoy `_resolve_scope` usa reportes directos vía `get_subordinados`); es una decisión de producto aparte, explícitamente fuera de este spec.
- Los follow-ups de UX del PR #113 (nombre/fechas de ciclo en mis-metas, historial de check-ins persistente, etc.).

## Diseño — Backend

Archivo: `app/api/v1/metas/router.py`.

- `GET /ciclos` (`list_ciclos`) y `GET /ciclos/{id}` (`get_ciclo`): cambiar la dependencia de `role_checker(["operativo"])` a `_gestion_or_equipo()` — la misma que ya usan las rutas de metas. Racional: un ciclo es una "cubeta de tiempo" global creada por RH; no contiene datos de un empleado/equipo específico, así que exponer su **lectura** a un jefe (para que seleccione un ciclo y asigne metas dentro) no filtra información sensible de otro equipo. No se filtra la lista por scope (los ciclos son globales); el scoping real ocurre en las rutas de metas.
- **Sin cambios** en: `POST /ciclos`, `POST /ciclos/{id}/activar`, `POST /ciclos/{id}/cerrar`, `PUT /ciclos/{id}`, `POST /ciclos/{id}/recordatorios` → permanecen en `role_checker(["operativo"])`.
- `_gestion_or_equipo()` ya acepta a supervisor/gerente nativos y a admin/RH-legacy en Modo líder/gerente; el middleware `RhModulePermissionMiddleware` no bloquea a supervisores nativos (el guard de módulo solo aplica a usuarios RH inscritos/admin). No se requiere tocar el registry ni el middleware.

**Tests** (`tests/test_metas_api.py`):
- Un supervisor (líder de un empleado) hace `GET /ciclos` → 200 y ve la lista; `GET /ciclos/{id}` → 200.
- El mismo supervisor: `POST /ciclos` / `POST /ciclos/{id}/activar` / `POST /ciclos/{id}/cerrar` / `PUT /ciclos/{id}` → 403 (siguen solo-RH).
- Regresión: RH sigue con acceso completo a ciclos.

## Diseño — Frontend

### Página role-adaptive (`frontend/src/pages/metas.ts`)
- Detectar si el usuario es RH-operativo con el patrón del repo (`isRhOperativoUiMode()` de `frontend/src/auth/rhUiMode.ts` y/o `getRolFromAccessToken()` de `frontend/src/auth/jwt.ts`; mismo criterio que separa `mountRhOperationalDashboard` de `mountLiderTeamDashboardShell` en `dashboard.ts`). Definir un booleano `esGestionRh` una vez al montar.
- Cuando `!esGestionRh` (jefe):
  - Ocultar la **pestaña "Ciclos"** y todas sus acciones (`ciclo-nuevo`, `ciclo-activar`, `ciclo-cerrar`, `ciclo-editar`, recordatorios).
  - Mostrar el **selector de ciclo** (poblado por `listCiclos()`, ahora accesible) + las pestañas **"Metas"** (asignar a su equipo, editar, cerrar y calificar) y **"Tablero"** (avance del equipo, cumplimiento) — todas ya restringidas por el backend al equipo del jefe.
  - Encabezado/eyebrow adaptado (p. ej. "Metas de mi equipo") para dejar claro el alcance.
  - **Estados vacíos**: si no hay ciclos (RH aún no creó/activó ninguno) → mensaje claro ("Aún no hay ciclos de metas. Pídele a RH que cree uno."); si el ciclo activo no tiene metas de su equipo → empty state con CTA para asignar.
- Cuando `esGestionRh`: comportamiento actual sin cambios (todas las pestañas y acciones).
- No duplicar render: es la misma función de montaje con ramas condicionales sobre `esGestionRh` (no una segunda página).

### Navegación (`frontend/src/navigation/`)
- Hacer descubrible "Metas" para supervisor/gerente: agregar `"metas"` a `SUPERVISOR_VISIBLE_NAV_IDS` (y a la lista de gerente si aplica) y ajustar `roleOnlyNavVisible`/`TALENTO_NAV_IDS` en `frontend/src/navigation/shellNavPolicy.ts` para que el ítem de `talentoNav.ts` (`id:"metas"`, `#/talento/metas`) se muestre a esos roles. Confirmar que `supervisorMayAccessHash("#/talento/metas")` sigue devolviendo `true` (hoy lo hace) y que `resolveRoutedHashForRol` no lo redirige.
- Etiqueta del ítem: mantener "Metas" (el contexto de la página ya aclara el alcance por rol). No crear un segundo ítem.

## Testing / verificación

- Backend: `docker-compose run --rm test pytest tests/test_metas_api.py -q` con los tests nuevos del guard; suite completa sin regresiones.
- Frontend: `docker-compose exec frontend npm run build` limpio (sin errores TS nuevos) + `npm run test` verde. Si el repo tiene tests de nav/policy (los hay para encuestas), agregar uno que verifique que "metas" es visible para supervisor y que `#/talento/metas` es accesible.
- Manual: login como supervisor con un reporte directo → el ítem "Metas" aparece en el menú → `#/talento/metas` carga (sin 403), sin pestaña "Ciclos" ni acciones de ciclo → seleccionar el ciclo activo → asignar una meta con resultados clave a un reporte directo → verla en el tablero de equipo → cerrarla/calificarla → confirmar que NO puede ver ni tocar metas de otro equipo. Login como RH → la página conserva todas las pestañas/acciones.

## Riesgos / decisiones abiertas

- **Ciclos visibles a todos los jefes**: la lista de ciclos es global (no por equipo). Es aceptable porque un ciclo no contiene datos sensibles de equipo; si en el futuro se quisiera restringir qué ciclos ve un jefe, sería un cambio aparte.
- **Gerente = reportes directos, no subárbol**: fuera de alcance (ver §Alcance).
- **Detección de rol en frontend**: usar exactamente el criterio ya establecido en `dashboard.ts` para no introducir una tercera forma de decidir "es RH operativo"; si ese criterio vive en un helper (`canAccessRhOperationalDashboard`/`isRhOperativoUiMode`), reutilizarlo.
