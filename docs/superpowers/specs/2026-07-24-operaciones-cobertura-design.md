# Módulo "Operaciones" — Analítica de cobertura y polivalencia — Diseño

**Fecha:** 2026-07-24
**Sub-proyecto de:** Suite de talento de Leoni-RRHH (penúltimo módulo; queda el Dashboard de Talento).
**Rama:** `feat/cm/operaciones-cobertura` → PR a `main`

## Contexto

La visión de la suite de talento contemplaba un módulo de "Operaciones". Tras explorar
el repo se confirmó que **la captura empleado×habilidad ya existe**: el módulo
`capacidades` está registrado con el label literal **"Matriz de multihabilidades"**
(`app/core/rh_module_registry.py`, grupo `Level Up`, hash `#/capacidades`, api
`/api/v1/competencias/multihabilidades`). Esa matriz muestra empleados × competencias
por puesto en escala 0–4 (`0 N/A, 1 Planeado, 2 En entrenamiento, 3 Certificado,
4 Experto`), con heatmap y anillo rojo cuando `nivel_actual < nivel_requerido`.

Lo que **no existe** y es el valor propio de "Operaciones" en un contexto de
manufactura es la **analítica de cobertura**: índice de polivalencia por persona y por
área, cobertura por competencia, detección de competencias críticas (punto único de
falla) y sugerencia de cross-training. Este módulo agrega los datos ya capturados; **no
captura nada nuevo**.

### Decisiones aprobadas por el usuario

1. **Enfoque:** capa de **analítica de cobertura de solo lectura** sobre las
   evaluaciones de competencia ya capturadas. **Sin tabla nueva, sin migración.**
2. **Ámbito primario de agregación:** por **Área**, con drill-down a puesto.
3. **Umbral de "cubierto":** **cumple el requisito** (`nivel_actual ≥ nivel_requerido`
   de esa competencia en el puesto del empleado).
4. **Scope por rol:** convención del sistema — RH ve todas las áreas, jefe/supervisor
   solo su equipo, director su subárbol.
5. **Grupo del módulo:** `Level Up` (junto a multihabilidades y evaluación 360).

## Arquitectura

**Sin tabla nueva.** Agregador de solo lectura sobre la BD Bono principal (tablas
`levelup_*` propias + catálogos legacy read-only). **No usa DATOS_ANALISIS** (SQL
Server) — a diferencia del módulo Historial Objetivo, aquí todo vive en la BD
principal, así que no hay engine externo ni scope de costo.

**Reúso — principio central:** el service **no re-deriva de tablas crudas**. Consume
los building blocks que ya alimentan la Matriz de multihabilidades
(`app/services/competencia_service.py`): `listar_puestos_multihabilidades` (para
enumerar puestos y agruparlos por área) y `obtener_multihabilidades(puesto_perfil_id)`
(que ya devuelve, por puesto, la grilla empleado × competencia con `nivel_actual` y
`nivel_requerido` ya resueltos, incluyendo el manejo de grado). El agregador de
cobertura suma sobre esas grillas. **Consecuencia:** los conteos de Operaciones
**cuadran por construcción** con la matriz de multihabilidades, y el manejo de grado
(requisito por grado del empleado con fallback a grado NULL) se hereda del building
block en vez de reinventarse.

### Fuentes de datos (todas ya existentes, read-only para este módulo)

- `PuestoPerfil` (`levelup_puestos_perfil`): `id`, `nombre`, `area_id`, `tipo`.
- `PerfilFunciones` (`levelup_perfil_funciones`): join empleado↔puesto (`activo`).
- `CompetenciaRequisito` (`levelup_competencia_requisitos`): `nivel_requerido` por
  (competencia, puesto, grado).
- `EvaluacionCompetencia` / `PerfilFuncionesCompetencia`: `nivel_actual` por empleado
  (lo que ya lee `obtener_multihabilidades`).
- `Competencia` (`levelup_competencias`): `nombre`, `categoria`.
- `Empleado` (`empleados`, legacy read-only): `empleado_id`, `no_empleado`, `nombre`.
- `Area` (`areas`, legacy read-only): `area_id`, `descripcion`.

## Métricas (definiciones exactas)

Sea un **área A**. Sus puestos = `PuestoPerfil` con `area_id = A`. Su personal =
empleados con `PerfilFunciones.activo` en esos puestos, filtrado por el scope del rol.

Para cada empleado `e` y competencia `c` **requerida en el puesto de `e`**:
- `requerido(e, c)` = `nivel_requerido` de `c` en el puesto/grado de `e`.
- `actual(e, c)` = `nivel_actual` de `e` en `c` (0 si no hay evaluación).
- `cumple(e, c)` = `actual(e, c) ≥ requerido(e, c)` (con `requerido ≥ 1`; requisitos
  con `nivel_requerido = 0` / N/A se ignoran, no cuentan como requeridos).

Definiciones:

1. **Cobertura de la competencia `c` en A**
   - `requieren(c)` = nº empleados de A cuyo puesto requiere `c` (`requerido ≥ 1`).
   - `cubren(c)` = nº de esos empleados con `cumple(e, c)`.
   - `cobertura_pct(c)` = `cubren(c) / requieren(c) × 100` (si `requieren(c) = 0`, la
     competencia no aparece en el desglose del área).
   - **Semáforo de cobertura** (umbrales en constantes, configurables):
     verde ≥ 80 %, ámbar ≥ 50 %, rojo < 50 %.

2. **Competencia crítica** (requerida por ≥1 persona del área):
   - `cubren(c) = 0` → **hueco total** (severidad `hueco`, rojo).
   - `cubren(c) = 1` → **punto único de falla** (severidad `punto_unico`, ámbar).
   - `cubren(c) ≥ 2` → no crítica.

3. **Índice de polivalencia por empleado `e`**
   - `req(e)` = nº competencias requeridas de su puesto (`requerido ≥ 1`).
   - `pol_empleado(e)` = `cumple_count(e) / req(e) × 100` (si `req(e) = 0` → `null`, se
     excluye del promedio del área).

4. **Índice de polivalencia del área A**
   - `pol_area(A)` = promedio de `pol_empleado(e)` sobre el personal con `req(e) > 0`.
   - `resiliencia(A)` = `% de competencias requeridas del área sin punto único de
     falla` = `competencias con cubren ≥ 2 / competencias requeridas del área × 100`.

5. **Cross-training sugerido** (por competencia crítica `c`):
   - Candidatos = empleados de A cuyo puesto requiere `c` y **no** `cumple(e, c)`,
     ordenados por `actual(e, c)` descendente (los más cerca del requisito primero),
     desempate por nombre. Se devuelven hasta `MAX_CANDIDATOS_CROSSTRAIN` (default 5)
     con `nombre`, `no_empleado`, `nivel_actual`, `nivel_requerido`.

Constantes en `app/services/operaciones/constants.py` (umbrales de semáforo,
`MAX_CANDIDATOS_CROSSTRAIN`), documentadas.

## Backend

### Scope por rol

Reutilizar el helper central `empleado_ids_scope_por_modulo(empleado_repo, current_user,
module_key, rh_ui_mode) -> list[int] | None` de `app/core/data_scope.py` (el mismo que
usan incidencias/faltas/viajes), con `module_key="operaciones"`. Devuelve el conjunto de
`empleado_id` visibles, o `None` = universo. El agregador filtra el personal del área a
ese conjunto (o no filtra si `None`):
- `None` (RH / admin operativo elevado, director): sin filtro — todas las áreas y todo
  el personal.
- Supervisor/jefe: reportes directos + él mismo (`get_subordinados`).
- Gerente: subárbol completo + él mismo (`get_ids_subarbol`).
- Empleado base: no aplica — el módulo no es self-service y el guard de módulo lo
  bloquea antes.

Un área "en scope" = área que contiene ≥1 empleado del scope (o cualquier área con
personal, si el scope es `None`). `GET /areas` solo lista esas; pedir la cobertura de un
área sin personal en scope → 404/403.

### Service — `app/services/operaciones_service.py` (+ paquete `operaciones/`)

Paquete `app/services/operaciones/`:
- `constants.py` — umbrales de semáforo + `MAX_CANDIDATOS_CROSSTRAIN`.
- `types.py` — dataclasses/TypedDicts internos de agregación (opcional; los schemas
  Pydantic viven en `app/schemas/operaciones.py`).
- `calculo.py` — funciones **puras** de agregación (sin DB): reciben la grilla
  empleado×competencia (nivel_actual, nivel_requerido) y devuelven cobertura por
  competencia, índices y cross-training. **Aquí vive la lógica testeable de fórmula.**

`OperacionesService`:
- `listar_areas(current_user, rh_ui_mode) -> list[AreaResumen]`: resuelve scope; enumera
  puestos (via `competencia_service.listar_puestos_multihabilidades`), agrupa por área;
  para cada área en scope calcula `pol_area`, `resiliencia`, nº de críticas
  (`hueco` + `punto_unico`) y nº de empleados. Ordenado por nº de críticas desc.
- `cobertura_area(current_user, area_id, rh_ui_mode) -> CoberturaAreaResponse`: valida
  área en scope (→ 404 si no existe, 403/404 si fuera de scope); junta las grillas de
  los puestos del área (via `obtener_multihabilidades`), aplica el scope al personal, y
  produce: resumen del área, desglose por competencia (cobertura, semáforo, severidad),
  drill-down por puesto (misma métrica acotada a cada puesto), y cross-training por
  competencia crítica. La lógica de agregación delega en `calculo.py`.
- `export_area(current_user, area_id, rh_ui_mode) -> BytesIO`: arma el Excel (openpyxl)
  con las hojas Resumen / Cobertura por competencia / Cross-training, patrón de
  `MetasService` export.

Errores con las excepciones del proyecto (`NotFoundError`/`ForbiddenError`/`ValidationError`
según convención existente).

### API — `app/api/v1/operaciones/router.py` (+ `__init__.py`)

Prefix `/api/v1/operaciones`. Todos gestión RH/jefatura (guard de módulo, **no**
self-service):
- `GET /areas` → `list[AreaResumenSchema]`.
- `GET /areas/{area_id}/cobertura` → `CoberturaAreaResponse`.
- `GET /areas/{area_id}/export` → `StreamingResponse` (xlsx).

Schemas en `app/schemas/operaciones.py`:
- `AreaResumenSchema`: `area_id`, `area_nombre`, `pol_area_pct`, `resiliencia_pct`,
  `n_criticas`, `n_empleados`.
- `CompetenciaCoberturaSchema`: `competencia_id`, `competencia_nombre`, `categoria`,
  `requieren`, `cubren`, `en_entrenamiento`, `cobertura_pct`, `semaforo`
  (`verde|ambar|rojo`), `severidad` (`ok|punto_unico|hueco`).
- `PuestoCoberturaSchema`: `puesto_perfil_id`, `puesto_nombre`, lista de
  `CompetenciaCoberturaSchema` (drill-down).
- `CandidatoCrossTrainSchema`: `empleado_id`, `no_empleado`, `nombre`, `nivel_actual`,
  `nivel_requerido`.
- `CriticaSchema`: `competencia_id`, `competencia_nombre`, `severidad`, candidatos.
- `CoberturaAreaResponse`: resumen (`AreaResumenSchema`) + `competencias`
  (`list[CompetenciaCoberturaSchema]`) + `puestos` (`list[PuestoCoberturaSchema]`) +
  `criticas` (`list[CriticaSchema]`).

### Registro del módulo

En `app/core/rh_module_registry.py`, añadir a `RH_MODULES`:
```python
"operaciones": RhModuleDef(
    key="operaciones",
    label="Cobertura y polivalencia",
    group="Level Up",
    nav_item_ids=("operaciones",),
    hash_prefixes=("#/operaciones",),
    api_prefixes=("/api/v1/operaciones",),
),
```
No se añade nada a `RH_SELF_SERVICE_API_PREFIXES` (no es self-service).
`include_router(operaciones_router)` en `app/main.py`. Actualizar `openapi.yaml` con los
3 paths y los schemas nuevos.

## Frontend (design system)

- **Cliente** `frontend/src/api/operaciones.ts` (patrón `api/competencias.ts` /
  `api/metas.ts`): tipos espejo de los schemas + `getAreas()`,
  `getCoberturaArea(areaId)`, `exportCoberturaArea(areaId)`.
- **Página** `frontend/src/pages/operaciones.ts` (role-adaptive, patrón `pages/metas.ts`):
  - **Selector de área** (dropdown poblado con `getAreas`, orden por nº de críticas).
  - **Tarjetas de resumen** del área seleccionada: índice de polivalencia, resiliencia,
    nº de competencias críticas (huecos + puntos únicos), nº de empleados. Con
    `tabular-nums`.
  - **Tabla de cobertura competencia-céntrica**: fila = competencia requerida; columnas
    = requerido, nº cubiertos / nº que la requieren, nº en entrenamiento, barra/semáforo
    de cobertura. Chips de severidad (`hueco` rojo / `punto único` ámbar). Reutiliza
    labels/colores de niveles de `ui/metodosCalificacionCompetencia.ts` y tokens de
    `ui/uiTokens.ts`.
  - **Drill-down por puesto**: al expandir una competencia (o vía un toggle de vista),
    mostrar la misma métrica desglosada por puesto del área.
  - **Panel de operaciones críticas**: lista de críticas con sus candidatos de
    cross-training (nombre, no_empleado, nivel actual→requerido).
  - **Export**: botón que descarga el xlsx (`exportCoberturaArea`).
  - Estados `skeletonBlock` / `errorState`; todo string interpolado con `escapeHtml`.
- **Ruta y nav**: rama de hash `#/operaciones` en `frontend/src/shellRouter.ts`
  (import dinámico con `renderLazyPageImportError`, patrón de las páginas nuevas
  recientes); entrada de nav en el grupo Level Up (menús RH/gestión) y regla en
  `frontend/src/navigation/shellNavPolicy.ts` (visible según módulo, no a empleado
  base). Sin hex ni fuentes nuevas.

## Testing

- **Backend** `docker-compose run --rm test pytest tests/test_operaciones_*.py -q`:
  - Fórmulas puras (`calculo.py`): cobertura (0/parcial/total), severidad `hueco`
    (cubren=0) y `punto_unico` (cubren=1) y `ok` (cubren≥2); índice por empleado
    (incluye caso `req=0 → excluido`); índice de área y resiliencia; orden de
    candidatos de cross-training (por `nivel_actual` desc, desempate por nombre); que
    requisitos con `nivel_requerido=0` se ignoran.
  - Consistencia con el building block: para un puesto dado, los conteos de cobertura
    coinciden con lo que devuelve `obtener_multihabilidades` (test que arma datos y
    compara).
  - Scoping por rol: supervisor solo su equipo; RH todas las áreas; área fuera de scope
    → 404/403; área sin personal en scope no aparece en `GET /areas`.
  - Endpoints: `GET /areas`, `GET /areas/{id}/cobertura` (shape completo), export
    genera un xlsx no vacío. Guard de módulo: sin permiso `operaciones` → 403.
  - Suite completa sin regresiones.
- **Frontend**: `docker-compose exec frontend npm run build` limpio + `npm run test`
  verde.
- **Manual**: como RH abrir `#/operaciones` → elegir un área con competencias
  requeridas → ver índice, tabla de cobertura, críticas y cross-training → export;
  como jefe, ver solo su equipo y confirmar que no aparecen áreas ajenas.

## Riesgos / trade-offs

- **Dependencia de datos capturados:** si un área casi no tiene `EvaluacionCompetencia`,
  la cobertura será baja/artificial. Es fiel al dato real; se documenta en la UI
  (leyenda "según evaluaciones registradas"). No se inventan datos.
- **Costo de recorrer puestos del área:** `cobertura_area` llama
  `obtener_multihabilidades` una vez por puesto del área. Áreas con muchos puestos hacen
  varias consultas; aceptable para el volumen esperado. Si surge costo real, cachear a
  futuro (no en este entregable). No se toca DATOS_ANALISIS, así que no hay engine
  externo que gestionar.
- **Umbral fijo "cumple requisito":** se eligió respetar el `nivel_requerido` por
  competencia/puesto (no un umbral absoluto). Los umbrales de **semáforo** (80/50) sí
  son constantes configurables.
- **Grado:** el manejo de requisito por grado se hereda de `obtener_multihabilidades`;
  no se reimplementa aquí (evita divergencia con la matriz).
- **Sin captura:** el módulo no edita niveles; la captura sigue en la Matriz de
  multihabilidades / evaluación de competencias.

## Descomposición en tareas (para el plan)

1. **Constantes + fórmulas puras** (`operaciones/constants.py`, `calculo.py`): cobertura,
   severidad, índices, cross-training. Tests puros.
2. **Service** (`operaciones_service.py`): scope por rol + reúso de building blocks +
   `listar_areas`/`cobertura_area`. Tests con datos sembrados (incluye consistencia con
   `obtener_multihabilidades` y scoping por rol).
3. **Export Excel** (`export_area`) + test de xlsx no vacío.
4. **API** router + schemas + registro en `RH_MODULES` + `include_router` +
   `openapi.yaml`. Tests de endpoint (shape, 404/403, guard de módulo).
5. **Frontend** cliente `api/operaciones.ts` + página `pages/operaciones.ts` (resumen +
   tabla de cobertura + críticas + cross-training + export) + ruta + nav + policy.
6. **Cobertura** de huecos de revisión.

Rama: `feat/cm/operaciones-cobertura`; PR a `main`.
