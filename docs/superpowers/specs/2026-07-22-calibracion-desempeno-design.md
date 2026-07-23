# Calibración de Desempeño — Diseño

**Fecha:** 2026-07-22
**Sub-proyecto de:** Suite de Talento (cierre del módulo Desempeño)
**Rama:** `feat/cm/calibracion-desempeno` → PR a `main`

## Contexto

El módulo **Ciclo de Desempeño** ya calcula, por empleado y ciclo, un score de
desempeño y una **banda** (`bajo` / `medio` / `alto`) a partir de cumplimiento de
metas + evaluación 360. Hoy ese score se recalcula **en vivo** mientras el ciclo
está `activo` y se congela (`snapshot_at`) al cerrar. No existe ningún mecanismo
para que RH revise y ajuste esas bandas antes de cerrar el ciclo, ni para
comparar la distribución de bandas entre equipos.

**Calibración** agrega exactamente eso: una sesión donde el **admin RH** revisa
las bandas de desempeño de toda la organización, las ajusta directamente (con
justificación obligatoria) para corregir sesgos entre jefes, y ve la
distribución real contra una distribución objetivo como guía. Al cerrar el
ciclo, la banda ajustada (si existe) es la oficial.

### Estado actual del Ciclo de Desempeño (verificado en código)

- `app/models/ciclo_desempeno.py`:
  - `CICLO_DESEMPENO_ESTADOS = ("borrador", "activo", "cerrado")` (tuplas String,
    no Enum nativo, por compat SQLite).
  - `CICLO_DESEMPENO_BANDAS = ("bajo", "medio", "alto")`.
  - `levelup_ciclo_desempeno` (`CicloDesempeno`): config global del ciclo,
    `estado`, `umbral_medio` (default 50), `umbral_alto` (default 75), `config`
    JSONB.
  - `levelup_ciclo_desempeno_resultado` (`CicloDesempenoResultado`): snapshot por
    empleado. Campos relevantes: `ciclo_id`, `empleado_id`, `calificacion_desempeno`
    (Numeric), `banda_desempeno` (String(10)), `banda_potencial` (String(10)),
    `segmento_9box` (String(20), formato `f"{banda_desempeno}_{banda_potencial}"`),
    `potencial` (captura manual), `snapshot_at` (solo al cerrar). Constraint único
    `("ciclo_id","empleado_id")`.
- `app/services/ciclo_desempeno_service.py`:
  - Funciones puras módulo-nivel: `combinar_score(...)`, `banda(valor, umbral_medio,
    umbral_alto) -> str` (`< umbral_medio → "bajo"`, `< umbral_alto → "medio"`,
    else `"alto"`), `_dec(...)`.
  - `cerrar_ciclo(ciclo_id, forzar=False)`: exige `estado=="activo"`, calcula en
    vivo cada resultado y persiste con `snapshot_at=ahora`, luego
    `ciclo.estado="cerrado"`.
  - `set_potencial(...)`: patrón de captura manual auditado (quién/cuándo) — molde
    para `ajustar_banda`.
  - `resultados_ciclo(ciclo_id, empleado_ids_scope)`, `construir_9box(...)`.
- `app/api/v1/ciclo_desempeno/router.py`: prefijo `/api/v1/ciclo-desempeno`.
  `_resolve_scope(current_user, rh_ui_mode, db)` → `None` = global (admin RH
  operativo / rol rh con módulo), o `set[int]` de subordinados directos.
  `_gestion_or_equipo()` = `role_checker(["operativo"])` con fallback a
  `gestor_team_role_checker(["supervisor","gerente"])`.
- `RH_MODULES["ciclo-desempeno"]` (group "Talento", api_prefixes
  `("/api/v1/ciclo-desempeno",)`). `NueveBoxResponse.resumen` existe como
  `Optional[dict]` pero **nunca se llena** (placeholder).
- Frontend: `frontend/src/pages/cicloDesempeno.ts` (hash `#/talento/ciclo-desempeno`),
  `frontend/src/api/cicloDesempeno.ts` (`const BASE="/api/v1/ciclo-desempeno"`).
- **No existe ninguna noción de calibración/ajuste** (grep `calibr`/`ajuste` →
  cero, salvo la captura de potencial).

## Decisiones aprobadas por el usuario

1. **Ajuste directo de banda** con justificación obligatoria. El score numérico
   calculado queda como referencia; la banda ajustada es la oficial al cerrar.
2. **Admin RH → toda la organización.** Solo el usuario admin RH (`is_admin_user`,
   flag `puede_administrar_permisos_rh`) en modo operativo calibra, con scope
   global (`None`). No hay calibración por jefe.
3. **Distribución objetivo = guía visual, no obligatoria.** Se muestra la
   distribución actual vs. una objetivo configurable (default 20% alto / 70% medio
   / 10% bajo), con desviación. RH puede cerrar el ciclo aunque no cuadre.
4. **Enfoque A — override persistente en el resultado.** El ajuste vive en columnas
   nuevas de `levelup_ciclo_desempeno_resultado`, auditado y reversible.
5. **Solo se calibra la banda de desempeño** en v1. El `potencial` ya es captura
   manual (no calculada), no requiere calibración. `banda_potencial` no cambia; el
   `segmento_9box` se recompone con la banda de desempeño efectiva.
6. **Calibración solo con ciclo `activo`.** No en `borrador` (aún no hay
   resultados materializados) ni en `cerrado` (snapshot inmutable).

## Arquitectura

Extensión del módulo Ciclo de Desempeño existente (mismo prefijo de API, mismo
registro `RH_MODULES`, misma página frontend). No es un módulo nuevo separado:
Calibración es una capacidad de RH **dentro** del ciclo. Una sola migración
`levelup_` (add columns), lógica pura testeable, y una sub-vista frontend
gated a RH global.

**Banda efectiva** = `banda_desempeno_ajustada or banda_desempeno`. Es la regla
central: se aplica al recomponer `segmento_9box`, al mostrar resultados, al 9box,
al export, y al congelar el snapshot en el cierre.

## Modelo de datos (migración Alembic sobre tabla `levelup_`)

Agregar a `levelup_ciclo_desempeno_resultado` (`CicloDesempenoResultado`):

| Columna | Tipo | Null | Descripción |
|---|---|---|---|
| `banda_desempeno_ajustada` | String(10) | sí | Override de banda (`bajo`/`medio`/`alto`); `NULL` = sin ajuste |
| `banda_ajuste_motivo` | Text | sí | Justificación (obligatoria cuando hay ajuste) |
| `banda_ajustada_por_id` | Integer FK→`empleados.empleado_id` | sí | Quién ajustó |
| `banda_ajustada_at` | DateTime(timezone=True) | sí | Cuándo se ajustó |

- Migración: `op.add_column(...)` × 4 sobre `levelup_ciclo_desempeno_resultado`.
  Nada de DDL sobre tablas sin prefijo `levelup_`.
- Nueva revisión Alembic encadenada al head actual del módulo (`c1d2e3s4e5f1` o el
  head vigente al implementar; verificar con `alembic heads` antes de escribir la
  revisión).

## Backend

### Funciones puras (en `app/services/ciclo_desempeno_service.py`, módulo-nivel)

```python
def banda_efectiva(banda_calculada: Optional[str], banda_ajustada: Optional[str]) -> Optional[str]:
    """Banda oficial: la ajustada si existe, si no la calculada."""
    return banda_ajustada or banda_calculada

def distribucion_bandas(bandas: list[Optional[str]]) -> dict:
    """Cuenta bajo/medio/alto (ignora None) y calcula porcentajes.
    Retorna {"bajo": n, "medio": n, "alto": n, "total": n,
             "pct": {"bajo": float, "medio": float, "alto": float}}.
    total = suma de bandas no-None; pct sobre total (0.0 si total==0)."""
```

Objetivo por default (configurable vía `ciclo.config["distribucion_objetivo"]`):
`{"alto": 20.0, "medio": 70.0, "bajo": 10.0}` (constante módulo-nivel
`DISTRIBUCION_OBJETIVO_DEFAULT`).

### Métodos de `CicloDesempenoService`

```python
async def ajustar_banda(
    self, ciclo_id: int, items: list[BandaAjusteItem], current_user_id: int,
) -> list[CicloDesempenoResultadoResponse]:
    """Aplica ajustes de banda. Valida ciclo estado=='activo' (else
    DomainValidationError 422). Por cada item:
      - banda_ajustada None → limpia override (reversión): pone las 4 columnas a None.
      - banda_ajustada in {"bajo","medio","alto"} → requiere motivo no vacío
        (else 422); setea banda_desempeno_ajustada, banda_ajuste_motivo,
        banda_ajustada_por_id=current_user_id, banda_ajustada_at=ahora.
      - banda_ajustada inválida → 422.
      - empleado sin resultado en el ciclo → 404.
    Recompone segmento_9box con banda efectiva. Persiste (upsert) y devuelve
    los resultados afectados."""

async def distribucion_ciclo(
    self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None,
) -> DistribucionResponse:
    """Distribución de bandas EFECTIVAS del ciclo (scope aplicado) vs. objetivo.
    Retorna actual (distribucion_bandas sobre banda_efectiva de cada resultado),
    objetivo (config o default), y desviacion por banda (actual.pct - objetivo)."""
```

### Cambio en `cerrar_ciclo`

Al congelar cada resultado, escribir en `banda_desempeno` la **banda efectiva**
(`banda_efectiva(calculada, ajustada)`) y recomponer `segmento_9box` con ella. Las
columnas de auditoría del ajuste se conservan (registro de qué se ajustó). El
`calificacion_desempeno` numérico **no se modifica**. Si no hubo ajuste, el
comportamiento es idéntico al actual.

### Schemas (`app/schemas/ciclo_desempeno.py`)

- `BandaAjusteItem`: `empleado_id: int`, `banda_ajustada: Optional[str]`
  (`bajo`/`medio`/`alto`/None), `motivo: Optional[str]`.
- `CalibracionRequest`: `items: list[BandaAjusteItem]` (min 1).
- Extender `CicloDesempenoResultadoResponse` con: `banda_desempeno_ajustada`,
  `banda_desempeno_efectiva` (derivada), `banda_ajuste_motivo`,
  `banda_ajustada_por_id`, `banda_ajustada_at`.
- `DistribucionBanda`: `bajo: int`, `medio: int`, `alto: int`, `total: int`,
  `pct: dict[str,float]`.
- `DistribucionResponse`: `ciclo_id: int`, `actual: DistribucionBanda`,
  `objetivo: dict[str,float]`, `desviacion: dict[str,float]`.

## API

Bajo el prefijo existente `/api/v1/ciclo-desempeno` (mismo módulo `RH_MODULES`):

| Método | Ruta | Guard | Handler |
|---|---|---|---|
| PUT | `/ciclos/{ciclo_id}/calibracion` | `role_checker(["operativo"])` + scope global admin RH | `ajustar_banda` |
| GET | `/ciclos/{ciclo_id}/distribucion` | `_gestion_or_equipo()` + `_resolve_scope` | `distribucion_ciclo` |

- **Calibración es global-only:** el handler exige que `_resolve_scope` devuelva
  `None` (admin RH operativo); si el scope es un `set` (jefe de equipo) →
  `AuthorizationError` 403. Ajustar bandas es potestad de RH corporativo.
- **Distribución** respeta el scope existente: RH global ve toda la org; un jefe ve
  la distribución de su equipo (solo lectura, sin poder ajustar).
- Actualizar `openapi.yaml`: nuevos paths, `CalibracionRequest`, `BandaAjusteItem`,
  `DistribucionResponse`, `DistribucionBanda`, y los campos nuevos de
  `CicloDesempenoResultadoResponse`.

## Frontend (design system — solo tokens de `uiTokens.ts`)

En `frontend/src/pages/cicloDesempeno.ts`, dentro de la pestaña "Resultados y
9-Box" de RH, agregar una sub-vista **Calibración** (o pestaña) visible **solo a
RH global** (mismo gating que ya distingue RH vs. jefe en la página):

- **Barra de distribución**: actual vs. objetivo por banda (alto/medio/bajo) con
  conteo, %, y desviación. Usa tokens de badge/estado existentes; sin colores
  nuevos. La banda `alto` mapea al tono positivo, `bajo` al negativo, `medio` al
  neutro, reusando las funciones de badge del sistema.
- **Tabla por empleado**: nombre, banda calculada, selector de banda ajustada
  (`SELECT_CHEVRON`), campo motivo, y estado del ajuste (quién/cuándo). Botón
  "Guardar calibración" que envía solo las filas modificadas.
- **Aviso "stale"**: si `banda_desempeno_ajustada` existe pero la banda calculada
  actual difiere de la que había al ajustar, mostrar `alertWarning` ("la banda
  calculada cambió desde el ajuste"). (Detección: comparar banda calculada viva vs.
  la ajustada; si son iguales no hay nada que avisar; el aviso es informativo.)
- **Reversión**: opción de limpiar el ajuste (enviar `banda_ajustada=null`).
- Estados vacío / cargando (`skeletonBlock`) / error (`errorState`).

Extender `frontend/src/api/cicloDesempeno.ts`:
- `calibrarCiclo(cicloId, items)` → `PUT .../calibracion`.
- `getDistribucionCiclo(cicloId)` → `GET .../distribucion`.
- Tipos TS espejo de los schemas nuevos.

No se requiere cambio de nav ni de `shellNavPolicy.ts` (vive dentro del módulo
`ciclo-desempeno` ya registrado).

## Testing

- **Puro** (`tests/test_ciclo_desempeno_*` o archivo nuevo de calibración):
  `banda_efectiva` (ajustada gana, None → calculada, ambas None → None);
  `distribucion_bandas` (todos en una banda, mezcla, lista vacía → total 0 y pct 0,
  ignora None).
- **Service:** ajustar sube/baja banda y recompone `segmento_9box`; reversión a
  `None` limpia las 4 columnas; ciclo `borrador`/`cerrado` → 422; motivo vacío con
  banda no-None → 422; banda inválida → 422; empleado fuera del ciclo → 404; cierre
  persiste banda efectiva en `banda_desempeno` (con y sin ajuste) y recompone
  segmento; `calificacion_desempeno` intacto.
- **Distribución:** conteo correcto sobre banda efectiva; scope de jefe ve solo su
  equipo; desviación = actual - objetivo.
- **API:** `PUT /calibracion` 200 admin RH; 403 jefe de equipo; 403 no-admin;
  `GET /distribucion` 200 con scope; self-service no expuesto.
- Suite completa sin regresiones; `docker-compose exec frontend npm run build`
  limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Override stale:** mientras el ciclo está `activo`, la banda calculada puede
  cambiar tras un ajuste. Mitigación: mostrar ambas y avisar visualmente; no se
  invalida el override automáticamente (RH decide).
- **Recomposición de segmento:** `segmento_9box` debe recomponerse con la banda
  efectiva en ajuste Y en cierre para no quedar inconsistente. Cubierto por tests.
- **Scope de calibración:** solo global (admin RH). Un jefe puede VER la
  distribución de su equipo pero no ajustar (403 explícito en el handler de
  calibración).
- **Migración:** solo add-column sobre tabla `levelup_`; encadenar al head vigente
  (verificar `alembic heads`).
- **Fase 2 (fuera de alcance):** consumir la firma-espejo
  `indice_historial_empleado` del historial objetivo como señal adicional del score
  — NO en este entregable.

## Decomposición en tareas (para el plan)

1. Migración Alembic + columnas en el modelo `CicloDesempenoResultado`.
2. Funciones puras `banda_efectiva` / `distribucion_bandas` + constante objetivo.
   Tests puros.
3. `CicloDesempenoService.ajustar_banda` + `distribucion_ciclo` + cambio en
   `cerrar_ciclo` (banda efectiva al snapshot). Tests de service.
4. Schemas + endpoints `PUT /calibracion` y `GET /distribucion` + registro/openapi.
   Tests de API.
5. Frontend: api client + sub-vista de calibración (distribución + tabla + guardar
   + reversión + aviso stale). Build.
6. Cierre de huecos de cobertura de revisión.
