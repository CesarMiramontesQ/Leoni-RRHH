# Dashboard de Talento — Diseño

**Fecha:** 2026-07-24
**Sub-proyecto de:** Suite de talento de Leoni-RRHH (**último módulo**; cierra la visión).
**Rama:** `feat/cm/dashboard-talento` → PR a `main`

## Contexto

La suite de talento ya entregó todos sus módulos: Metas, Ciclo de Desempeño (con
calibración y 9-box), Evaluación 360, Matriz de multihabilidades, Operaciones
(cobertura y polivalencia), Cursos/PDI, Evidencias, OPLs, Sugerencias e Historial
Objetivo. Cada uno resuelve su dominio y tiene su propia pantalla.

Lo que **no** existe es la vista que responde *"¿cómo está el talento de la planta, y
qué área necesita atención?"* sin abrir siete módulos y comparar a mano.

### Lo que ya existe y NO se reconstruye

- **Ficha por empleado:** `frontend/src/pages/empleadoVista360.ts` (capacidades vs.
  perfil, PDI, competencias, historial objetivo). El dashboard **enlaza** a ella.
- **9-box y distribución de bandas:** `segmento_9box` en
  `levelup_ciclo_desempeno_resultado`, más `CicloDesempenoService.construir_9box` y
  `distribucion_ciclo`. El dashboard los **muestra agregados**, no los recalcula.
- **Cobertura y polivalencia por área:** `OperacionesService.listar_areas`.
- **Resumen operativo (Level Up)** y **Métricas** (grupo Laborales): son otras vistas,
  con otro propósito; no se tocan.

### Decisiones aprobadas por el usuario

1. **Propósito:** vista **ejecutiva agregada por área/organización**. No es panel de
   pendientes ni ficha por persona.
2. **Bloques de señal:** desempeño, polivalencia/cobertura, capacitación, PDI e
   **historial objetivo** (este último con **carga diferida**, por depender de la BD
   externa DATOS_ANALISIS).
3. **Estructura:** banda de KPIs de la organización (dentro del scope del usuario) +
   tabla comparativa de áreas con semáforos + drill-down al detalle de un área.
4. **Drill-down:** agregados del área + lista corta de **empleados en foco** (los que
   acumulan varias señales malas), cada uno con enlace a su ficha 360.
5. **Arquitectura:** **un endpoint por bloque**, pedidos en paralelo desde el front, para
   que un bloque lento o caído degrade solo su columna.
6. **Scope:** resuelto **una sola vez** por el service de Talento (ver abajo).
7. **Export XLSX** incluido en el alcance inicial.

## Arquitectura

**Agregador de solo lectura. Sin tabla nueva, sin migración, sin modelos nuevos** —
mismo principio que Operaciones e Historial Objetivo.

**Principio de reuso:** el service **no re-deriva de tablas crudas**. Consume los
building blocks que ya alimentan cada módulo, de modo que los números del dashboard
**cuadran por construcción** con la pantalla de origen. Si un número no cuadra, el bug
está en el building block, no en dos implementaciones divergentes.

### Registro del módulo

| campo | valor |
|---|---|
| `key` | `dashboard-talento` |
| `label` | `Dashboard de Talento` |
| `group` | `Talento` |
| `nav_item_ids` | `("dashboard-talento",)` |
| `hash_prefixes` | `("#/talento/dashboard",)` |
| `api_prefixes` | `("/api/v1/talento",)` |

Registrado en `RH_MODULES` (`app/core/rh_module_registry.py`). **No** se agrega a
`RH_SELF_SERVICE_API_PREFIXES`: no es una vista self-service.

> **Nota (`role_checker` resuelve el módulo por la ruta):** todo endpoint del dashboard
> vive bajo `/api/v1/talento`, así que exige el módulo `dashboard-talento` — no el de
> los módulos cuyos datos consume. Por eso el service llama a los building blocks
> **directamente** (capa de servicio), nunca vía HTTP a los otros routers.

### Scope de datos — decisión central

Hoy cada fuente resuelve su scope de forma distinta:

| fuente | mecanismo actual |
|---|---|
| Operaciones | `empleado_ids_scope_por_modulo(..., "operaciones")` |
| Historial Objetivo | `empleado_ids_scope_por_modulo(..., "historial-objetivo")` |
| PDI | `_resolve_area_scope(current_user)` (por área, no por empleado) |
| Cursos (dashboard Level Up) | **sin scope** (global) |
| Ciclo de Desempeño | acepta `empleado_ids_scope` explícito |

Si cada bloque resolviera el suyo, dos columnas de la misma fila saldrían calculadas
sobre poblaciones distintas y los números no cuadrarían entre sí.

**Decisión:** `TalentoService` resuelve el scope **una sola vez** con
`empleado_ids_scope_por_modulo(empleado_repo, current_user, "dashboard-talento",
rh_ui_mode) -> list[int] | None` (`None` = universo) y lo **pasa explícito** a cada
bloque. Para lograrlo se extrae, en cada building block que hoy resuelve scope solo,
una variante interna que recibe `scope: list[int] | None`:

- `OperacionesService.listar_areas(current_user, rh_ui_mode)` →
  delega en `listar_areas_con_scope(scope)`. Firma pública **sin cambios**. Se agrega
  además `polivalencia_empleados_area(area_id, scope)`, que expone el índice de
  polivalencia **por empleado** (ya lo calcula `indice_polivalencia_empleado`, pero hoy
  solo se usa promediado); lo necesita la señal `polivalencia_baja` de empleados en foco.
- `HistorialObjetivoService.indice_equipo(...)` → delega en una variante con scope
  explícito. Firma pública **sin cambios**.
- `PDIRepository.equipo_pdi_aggregates(area_ids, area_id)` → se le agregan el parámetro
  opcional `empleado_ids` y un conteo de `cancelados` (aditivo, sin tocar las columnas
  existentes). Se usa **el repositorio, no `PDIService.equipo_resumen`**:
  el repo ya devuelve exactamente lo que el dashboard necesita por empleado (`total`,
  `completadas`, `en_proceso`, `pendientes`, `vencidas`), mientras que `equipo_resumen`
  además carga competencias, requisitos y evaluaciones que aquí no se usan.
- `LevelUpCursosDashboardService` → método público **nuevo**
  `resumen_por_area(empleado_ids_scope)`, construido sobre `_build_pares()` y el
  `_estado_par()` existente (no duplica la lógica de estado de curso).

Ninguna de estas extracciones cambia el comportamiento de los módulos que ya las usan:
la firma pública actual se conserva y simplemente delega.

**Consecuencia de acceso, aceptada explícitamente:** quien tenga otorgado
`dashboard-talento` verá agregados de PDI y capacitación **aunque no tenga otorgados**
`pdi-gestion` ni `cursos-seguimiento` — siempre restringido a su scope de personas y
**solo en forma agregada**; el detalle nominal sigue viviendo en cada módulo. Se
prefiere esto a ocultar columnas por módulo, porque en ese caso cada usuario vería un
dashboard distinto y los totales de la banda superior dejarían de ser comparables entre
usuarios.

### Fuentes de datos

Todas en la BD Bono principal (tablas `levelup_*` propias + catálogos legacy
read-only), **salvo** el bloque objetivo, que consulta DATOS_ANALISIS (SQL Server,
engine aparte) a través de `HistorialObjetivoService`. Ninguna DDL, ningún DELETE,
ninguna escritura de ningún tipo: el módulo entero es de lectura.

El mapa empleado → área sale de `Empleado.area_id` (tabla legacy `empleados`,
read-only), que es el mismo criterio que ya usan PDI y el dashboard de cursos.

## Métricas (definiciones exactas)

Sea un **área A** = empleados en scope con `Empleado.area_id = A`. El universo de áreas
de la tabla lo define el bloque de **polivalencia** (`listar_areas`, que ya omite áreas
sin personal en scope); las áreas sin datos en otros bloques muestran `n/d` en esa
columna, no cero.

### 1. Desempeño (`/talento/desempeno`)

Sobre el ciclo seleccionado, usando `resultados_ciclo(ciclo_id, scope)` (que ya devuelve
snapshot si el ciclo está `cerrado` y cálculo en vivo si está `activo`/`borrador`):

- `calificacion_promedio` = promedio de `calificacion_desempeno` de los empleados del
  área con resultado. Si ninguno tiene → `null` (celda `n/d`), **no** 0.
- `con_resultado_pct` = empleados con `calificacion_desempeno` no nula / empleados del
  área en scope × 100.
- `distribucion` = conteo y % por banda **efectiva** (`banda_desempeno_efectiva`, que ya
  aplica el ajuste de calibración). Se reusa `distribucion_ciclo` para el nivel `org`.
- `cumplimiento_metas_pct` = promedio de `cumplimiento_metas`, campo que **ya viene en
  `CicloDesempenoResultadoResponse`**. No se llama a `MetasService.cumplimiento_empleado`
  directamente: su `ciclo_id` es el del **ciclo de metas**, que no es el mismo id que el
  del ciclo de desempeño, y el ciclo ya resolvió esa correspondencia internamente.
- `nine_box` = conteo por `segmento_9box`, **solo en el nivel `org`** (en la tabla por
  área no cabe y no aporta).
- **Semáforo:** hereda `umbral_medio` / `umbral_alto` **del propio ciclo** vía la función
  `banda()` existente — el dashboard no inventa umbrales de desempeño.

**Selección de ciclo:** por defecto el ciclo en estado `activo`; si no hay ninguno, el
último `cerrado` por fecha; si tampoco hay, el bloque responde `200` con
`disponible: false` y `motivo: "sin_ciclo"`. El front expone un selector para cambiarlo
(`?ciclo_id=`).

### 2. Polivalencia (`/talento/polivalencia`)

Directo de `listar_areas_con_scope(scope)` — `pol_area_pct`, `resiliencia_pct`,
`n_criticas`, `n_empleados`, ya calculados y ya ordenados por criticidad. El nivel `org`
es el promedio de `pol_area_pct` **ponderado por `n_empleados`** y la suma de
`n_criticas`. Semáforo: los umbrales de Operaciones (verde ≥ 80, ámbar ≥ 50, rojo < 50),
importados de `app/services/operaciones/constants.py`, no redefinidos.

### 3. Capacitación (`/talento/capacitacion`)

De `resumen_por_area(scope)`, sobre los pares (empleado, curso) activos:

- `cumplimiento_pct` = pares en estado `completado` / pares totales × 100.
- `n_obligatorio_pendiente` = empleados del área con ≥1 curso `obligatorio` en estado
  distinto de `completado`.
- Semáforo sobre `cumplimiento_pct`: verde ≥ 80, ámbar ≥ 50, rojo < 50.

### 4. PDI (`/talento/pdi`)

De `equipo_pdi_aggregates` con `empleado_ids` del scope, agrupando por `Empleado.area_id`:

**Los PDI cancelados no existen para el dashboard:** no cuentan como activos ni entran en
el denominador del cumplimiento. Cancelar un plan no es incumplirlo, y `cancelado` es un
estado alcanzable por el flujo normal (`pendiente→cancelado`, `en_proceso→cancelado`).

- `cumplimiento_pct` = PDIs `completado` / (PDIs totales − `cancelado`) × 100.
- `n_vencidos` = PDIs con fecha de fin anterior a hoy y estado ∉ {`completado`, `cancelado`}.
- `n_activos` = `en_proceso` + `pendiente` − vencidos. **No** se calcula como
  `total − completados − vencidos`: `total` incluye los cancelados y `vencidos` ya los
  excluye, así que esa resta reporta cada plan cancelado como activo.
- Semáforo sobre `cumplimiento_pct`: verde ≥ 80, ámbar ≥ 50, rojo < 50.

Un área sin ningún PDI registrado devuelve `cumplimiento_pct: null` (`n/d`), no 0 % —
"no hay planes" y "los planes van mal" son cosas distintas. Lo mismo si todos sus planes
están cancelados: el denominador queda en 0 y el valor es `null`.

### 5. Historial objetivo (`/talento/objetivo`) — diferido

De la variante con scope de `indice_equipo(fecha_inicio, fecha_fin)`, promediando el
índice por área. Rango por defecto: **últimos 12 meses** (lo aplica la API, nunca el
service, que sigue exigiendo rango explícito para no agregar el universo sin acotar).
Escala **0–100** (`ResultadoIndiceObjetivo.indice`, 2 decimales), la misma que usa su
módulo. Acepta `?area_id=` para el detalle de un área.

**No confundir con `indice_historial`** del resultado del ciclo: ese es el índice que el
ciclo ya pondera dentro de la calificación de desempeño, calculado sobre el rango del
ciclo. El bloque objetivo del dashboard es un índice **independiente**, sobre su propio
rango de fechas y sin ponderar. Son dos números distintos a propósito y la UI los
etiqueta de forma que no se lean como el mismo.

Si DATOS_ANALISIS no responde, el endpoint propaga el error y el front pinta la columna
como `n/d`; **el resto del dashboard no se ve afectado**, que es exactamente la razón de
haberlo separado.

### 6. Empleados en foco (detalle de área)

Señales de riesgo por empleado, todas dentro del área y del scope:

| señal | condición |
|---|---|
| `desempeno_bajo` | banda de desempeño efectiva = `bajo` |
| `polivalencia_baja` | `indice_polivalencia_empleado` < 50 % (umbral rojo de Operaciones) |
| `capacitacion_pendiente` | ≥1 curso obligatorio no completado |
| `pdi_vencido` | ≥1 PDI con fecha de fin pasada y estado ≠ `completado` |

**En foco** = acumula **≥ `MIN_SENALES_FOCO` (2)** señales. Se devuelven hasta
`MAX_EMPLEADOS_FOCO` (10), ordenados por número de señales descendente y desempate por
nombre. Cada item lleva `empleado_id`, `no_empleado`, `nombre`, `puesto_nombre` y la
lista de señales activas, para que la UI las muestre como badges y enlace a la ficha 360.

Una señal que no se pudo evaluar (p. ej. no hay ciclo) **no cuenta** como señal mala:
se ignora, y el conteo se hace sobre las señales evaluables. Esto evita que la ausencia
de datos se lea como riesgo.

### Constantes

En `app/services/talento/constants.py`, todas documentadas: umbrales de semáforo de
capacitación y PDI, `MIN_SENALES_FOCO`, `MAX_EMPLEADOS_FOCO`, meses del rango default
del bloque objetivo. Los umbrales de polivalencia se **importan** de Operaciones y los
de desempeño salen del ciclo — no se duplican aquí.

## Backend

### Estructura de archivos

```
app/services/talento/
    __init__.py
    constants.py      # umbrales y topes documentados
    types.py          # dataclasses internas (no Pydantic)
    calculo.py        # funciones PURAS: semáforo, agregación por área,
                      # promedio ponderado, señales de riesgo, empleados en foco
app/services/talento_service.py   # TalentoService: orquesta building blocks + scope
app/api/v1/talento/
    __init__.py
    router.py
app/schemas/talento.py            # respuestas Pydantic
```

`calculo.py` no toca la BD ni recibe sesión: entra data ya cargada, sale data agregada.
Es donde vive el grueso de los tests.

### Endpoints

Todos `GET`, todos bajo `/api/v1/talento`, todos solo lectura.

| endpoint | query params | respuesta |
|---|---|---|
| `/talento/desempeno` | `ciclo_id?` | `{disponible, motivo?, ciclo, org, areas[]}` |
| `/talento/polivalencia` | — | `{disponible, org, areas[]}` |
| `/talento/capacitacion` | — | `{disponible, org, areas[]}` |
| `/talento/pdi` | — | `{disponible, org, areas[]}` |
| `/talento/objetivo` | `desde?`, `hasta?`, `area_id?` | `{disponible, rango, org, areas[]}` |
| `/talento/areas/{area_id}` | `ciclo_id?` | `{area, desempeno, polivalencia, capacitacion, pdi, empleados_foco[]}` |
| `/talento/export` | `ciclo_id?` | `xlsx` (ver abajo) |

Cada `areas[]` incluye siempre `area_id`, `area_nombre` y `n_empleados`, además de las
métricas del bloque, para que el front pueda unir por `area_id` sin depender del orden.

`GET /talento/areas/{area_id}` reusa exactamente los mismos agregadores, filtrados a un
área; no hay una segunda implementación del cálculo. Si el área no existe o no tiene
personal en scope: `404` si es invisible por inexistente, `403` si existe pero está
fuera de scope — mismo criterio que `cobertura_area` en Operaciones.

### Export XLSX

`GET /talento/export`, patrón de `exportar_area_excel` (openpyxl, `BytesIO`):

- Hoja **Resumen por área**: una fila por área con las cinco métricas y su semáforo en
  texto.
- Hoja **Empleados en foco**: todas las áreas del scope, una fila por empleado en foco,
  con sus señales.

El bloque objetivo se incluye en el export **solo si** DATOS_ANALISIS respondió; si no,
la columna queda vacía con la nota "no disponible" en la hoja. El export nunca falla por
culpa del bloque externo.

### Manejo de errores

- **Sin ciclo de desempeño:** `200` con `disponible: false`, `motivo: "sin_ciclo"`.
- **Área sin datos de un bloque:** métrica `null` → la UI pinta `n/d`, nunca `0 %`.
- **DATOS_ANALISIS caído:** el endpoint `/objetivo` falla; los otros cinco no.
- **Usuario sin el módulo:** `403` del `role_checker`, sin caso especial.

## Frontend

### Archivos

```
frontend/src/pages/dashboardTalento.ts
frontend/src/api/talento.ts
frontend/src/dashboard/talento/types.ts   # sincronizados con app/schemas/talento.py
```

Nav: replicar lo que hace `ciclo-desempeno` en las uniones de nav-id, la constante del
grupo Talento y `HASH_RULES` de `frontend/src/auth/rhModuleRegistry.ts`, más la ruta en
`shellRouter.ts`.

### Carga y degradación

Al montar, se piden los cinco bloques **en paralelo**. La tabla se dibuja con las áreas
que devuelve **polivalencia** (define el universo de áreas) y cada columna entra por su
cuenta con un skeleton propio. Si un bloque falla:

- su columna muestra `n/d` con el motivo en tooltip,
- su tile de la banda superior muestra el estado de error,
- **el resto de la página sigue funcionando**.

Este comportamiento es el motivo de la arquitectura de cinco endpoints y debe estar
cubierto por test.

### UI

Tokens de `design.md` / `frontend/src/ui/uiTokens.ts` exclusivamente — ningún hex ni
clase inventada. Composición:

- **Banda superior:** cinco tiles (desempeño, polivalencia, capacitación, PDI,
  objetivo) con el valor del scope completo y una micro-visualización (distribución de
  bandas en el de desempeño).
- **Selector de ciclo** y botón **Exportar** en la cabecera.
- **Tabla de áreas:** ordenable por cualquier columna; orden inicial "peor primero",
  coherente con `listar_areas`, que ya ordena por `-n_criticas`.
- **Detalle de área:** al hacer clic en una fila, con los cinco bloques desglosados,
  enlaces a Operaciones / Ciclo / Cursos / PDI filtrados por esa área, y la lista de
  empleados en foco con badges por señal y enlace a la ficha 360.

## Testing

**Puros (`app/services/talento/calculo.py`)** — el grueso de la cobertura, sin BD:

- semáforos en los límites exactos (80, 79.9, 50, 49.9)
- promedio ponderado por `n_empleados` vs. promedio simple
- agregación por área con empleados sin área asignada
- señales de riesgo: 0, 1, 2, 3 y 4 señales → dentro/fuera de foco
- señal no evaluable no cuenta como señal mala
- topes y orden de `empleados_foco` (más señales primero, desempate por nombre)
- bordes: área sin personal, listas vacías, división por cero, métricas `null` que no
  deben convertirse en 0

**API (integración, SQLite):**

- supervisor ve solo su equipo; RH ve el universo
- `403` sin el módulo otorgado
- sin ciclo → `200` con `disponible: false`
- `/talento/areas/{id}` fuera de scope → `403`; inexistente → `404`
- el bloque objetivo **mockeado**: los tests no tocan DATOS_ANALISIS (mismo patrón con
  el que incidencias mockea `_with_bono_repo`)
- una prueba de coherencia: el `pol_area_pct` que reporta el dashboard es idéntico al que
  reporta `/api/v1/operaciones` para la misma área y usuario

**Frontend (`npm run test`):** render de la tabla, orden por columna, y el caso de un
bloque en error que no tumba la página.

**Se aprovechan** los factories de `conftest.py` (`make_empleado`, `auth_headers`) y el
teardown por truncate ya existente.

## Fuera de alcance

- Cualquier tabla nueva, migración o snapshot materializado.
- Panel de pendientes accionables de RH (fue descartado como propósito).
- Tabla completa de empleados por área (descartada: solapa con los listados de cada
  módulo).
- Recalcular desempeño, 9-box, cobertura o cumplimiento: todo se consume de los building
  blocks existentes.
- Escrituras de cualquier tipo, incluidas las de DATOS_ANALISIS.

## Actualizaciones obligatorias al cerrar

- `openapi.yaml`: los 7 paths y los schemas de `app/schemas/talento.py`.
- `app/core/rh_module_registry.py` y `frontend/src/auth/rhModuleRegistry.ts`.
- `design.md` solo si aparece un patrón de UI no documentado (p. ej. el tile con
  micro-distribución).
