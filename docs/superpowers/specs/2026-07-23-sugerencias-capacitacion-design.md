# Motor de Sugerencias de Capacitación — Diseño

**Fecha:** 2026-07-23
**Sub-proyecto de:** Suite de Talento (activar placeholder de Aprendizaje)
**Rama:** `feat/cm/sugerencias-capacitacion` → PR a `main`

## Contexto

El modelo `SugerenciaCapacitacion` (tabla `levelup_sugerencias_capacitacion`) y
sus schemas Pydantic (`SugerenciaCapacitacionCreate/Update/Response`) **ya
existen y están migrados**, pero el modelo está **huérfano**: no hay service,
router ni cliente frontend. La página `frontend/src/pages/levelUp.ts`
(`mountSugerencias`) está maquetada con datos falsos (`FAKE_SUGERENCIAS`). El
módulo RH `sugerencias` está registrado con `api_prefixes=()` (sin backend). Este
proyecto activa el placeholder: construye el backend, lo conecta a la página
existente, y agrega la generación de sugerencias desde brechas reales.

### Estado verificado en código

- `app/models/level_up.py` L664-692: `SugerenciaCapacitacion`. Campos: `titulo`
  (String255 NOT NULL), `justificacion` (Text), `brecha_pct` (Float),
  `adopcion_sector_pct` (Float), `capacidades_afectadas` (JSONB list),
  `areas_afectadas` (JSONB list), `personas_alcanzables` (Integer),
  `duracion_sugerida` (String100), `inversion_estimada` (Float),
  `proveedor_sugerido` (String255), `prioridad` (Integer default 3,
  CheckConstraint 1-5), `estado` (Enum `EstadoSugerencia` default `activa`),
  `created_at`/`updated_at`. **No tiene FK a curso.**
- Enum `EstadoSugerencia` (L91-95): `activa`, `aprobada`, `pospuesta`,
  `descartada`.
- `app/schemas/level_up.py` L405-447: `SugerenciaCapacitacionCreate` (todos los
  campos de captura + validaciones; sin `estado`), `SugerenciaCapacitacionUpdate`
  (`titulo`, `justificacion`, `prioridad`, `estado` Literal de los 4 valores),
  `SugerenciaCapacitacionResponse` (`from_attributes`, todos los campos +
  timestamps).
- `app/core/rh_module_registry.py` L330-337: `RhModuleDef` `sugerencias`, label
  "Motor de Sugerencias", group **"Cumplimiento"**, `nav_item_ids=("sugerencias",)`,
  `hash_prefixes=("#/sugerencias",)`, `api_prefixes=()`.
- Fuente de brechas: `CompetenciaService.obtener_brechas(area_id) -> BrechasResponse`
  (`app/services/competencia_service.py` L530), endpoint `GET /api/v1/competencias/brechas?area_id=`.
  `BrechasResponse`: `area_id`, `area_nombre`, `brechas: list[BrechaItem]`.
  `BrechaItem` (`app/schemas/talento.py` L169-181): `competencia_id`,
  `competencia_nombre`, `categoria`, `nivel_requerido_promedio`, `gap_porcentaje`
  (proporción de empleados del área bajo el nivel requerido), `empleados_afectados`.
- Catálogo de cursos: `Curso` (`levelup_cursos`, L272).
- Head Alembic vigente: `h1s2t3s4e5n6`.
- `AccionRecomendada` (`levelup_acciones_recomendadas`) mapea rangos de brecha a
  etiqueta/color; seed en `app/utils/seed_acciones_recomendadas.py`
  (0 / 1-30 / 31-50 / 51-100). Se usa como referencia para derivar prioridad; NO
  se expone endpoint nuevo para él.
- `adopcion_sector_pct`: NO hay fuente de datos en el repo (ni tabla, ni seed, ni
  integración) → captura manual.

## Decisiones aprobadas por el usuario

1. **Placeholder a activar: Sugerencias de capacitación.**
2. **Generación híbrida**: CRUD manual (RH crea/edita/prioriza/aprueba, conecta la
   página maquetada al backend real) **+** un generador "sembrar desde brechas"
   que crea borradores pre-llenados desde `/competencias/brechas`; RH completa los
   campos no derivables y aprueba.
3. **Incluir `curso_id` en v1**: FK opcional a `levelup_cursos` para enlazar una
   sugerencia al curso del catálogo que la resolvería (cierra el loop
   brecha → sugerencia → curso). Requiere una migración `add_column`.

## Arquitectura

Módulo nuevo de backend sobre un modelo ya existente. Una migración `levelup_`
(add `curso_id`), un service con CRUD + generador, un router bajo el prefijo
`level-up`, y la conexión de la página frontend ya maquetada. El generador reusa
el motor de brechas existente (`obtener_brechas`) sin recalcular nada. RH-gated
(módulo `sugerencias`).

## Modelo de datos (migración Alembic sobre tabla `levelup_`)

Agregar a `levelup_sugerencias_capacitacion`:
- `curso_id` Integer nullable, FK → `levelup_cursos.id` (ondelete SET NULL): curso
  del catálogo que resolvería la sugerencia. `NULL` = sin curso asignado.

Migración: `op.add_column` + `op.create_foreign_key` sobre la tabla `levelup_*`
(permitido). `down_revision="h1s2t3s4e5n6"` (verificar `alembic heads` al
implementar). Añadir `curso_id: Mapped[Optional[int]]` + relación opcional al
modelo `SugerenciaCapacitacion`.

## Backend

### Funciones puras

```python
def prioridad_desde_brecha(gap_porcentaje: float) -> int:
    """Deriva prioridad 1-5 desde el % de brecha, alineado a los rangos de
    AccionRecomendada: <=0 -> 1; <=30 -> 3; <=50 -> 4; >50 -> 5."""
```

### Service `app/services/sugerencia_capacitacion_service.py`

```python
class SugerenciaCapacitacionService:
    def __init__(self, db: AsyncSession): ...

    async def listar(self, estado: str | None = None, prioridad: int | None = None
                     ) -> list[SugerenciaCapacitacionResponse]: ...

    async def crear(self, data: SugerenciaCapacitacionCreate
                    ) -> SugerenciaCapacitacionResponse:
        """Valida curso_id (si viene, debe existir en levelup_cursos -> 404 si no)."""

    async def actualizar(self, sugerencia_id: int, data: SugerenciaCapacitacionUpdate
                         ) -> SugerenciaCapacitacionResponse:
        """404 si no existe. Cambia titulo/justificacion/prioridad/estado (workflow
        activa->aprobada/pospuesta/descartada). Valida curso_id si el Update lo trae."""

    async def eliminar(self, sugerencia_id: int) -> None: ...

    async def generar_desde_brechas(
        self, area_id: int, umbral_brecha: float, current_user_id: int | None = None
    ) -> list[SugerenciaCapacitacionResponse]:
        """Reusa CompetenciaService.obtener_brechas(area_id). Por cada BrechaItem
        con gap_porcentaje >= umbral_brecha, crea una sugerencia BORRADOR (estado
        activa) si no existe ya una activa con el mismo titulo determinista.
        Pre-llena:
          - titulo = f"Capacitacion: {competencia_nombre}"
          - justificacion = texto auto (brecha X% en area Y, N personas afectadas)
          - brecha_pct = gap_porcentaje
          - capacidades_afectadas = [competencia_nombre]
          - areas_afectadas = [area_nombre]
          - personas_alcanzables = empleados_afectados
          - prioridad = prioridad_desde_brecha(gap_porcentaje)
        Deja en None los campos no derivables (duracion_sugerida, inversion_estimada,
        proveedor_sugerido, adopcion_sector_pct, curso_id) para captura manual de RH.
        Devuelve solo las sugerencias efectivamente creadas (las duplicadas se
        omiten). No inventa datos manuales."""
```

`Update` se amplía para permitir `curso_id: Optional[int]` (asignar el curso que
resuelve). El `Update` existente ya cubre titulo/justificacion/prioridad/estado.

**Deduplicación**: `generar_desde_brechas` no crea si ya existe una sugerencia
en estado `activa` con el mismo `titulo` determinista (`Capacitacion:
{competencia}`) — evita duplicar en corridas repetidas. (Es deliberadamente
simple; RH puede editar el título después sin romper una futura resiembra porque
la comparación es solo contra activas del título canónico.)

### Schemas (`app/schemas/level_up.py`)

- `SugerenciaCapacitacionCreate`: añadir `curso_id: Optional[int] = None`.
- `SugerenciaCapacitacionUpdate`: añadir `curso_id: Optional[int] = None`.
- `SugerenciaCapacitacionResponse`: añadir `curso_id: Optional[int] = None` y
  `curso_nombre: Optional[str] = None` (derivado, para la UI).
- Nuevo `GenerarDesdeBrechasRequest`: `area_id: int`, `umbral_brecha: float =
  Field(default=0, ge=0, le=100)`.

## API

Router nuevo `app/api/v1/sugerencias/router.py`, prefijo
`/api/v1/level-up/sugerencias` (coherente con que el modelo y la página viven en
`level_up`):

| Método | Ruta | Guard | Handler |
|---|---|---|---|
| GET | `` (query `estado?`, `prioridad?`) | `role_checker(["operativo"])` | `listar` |
| POST | `` | `role_checker(["operativo"])` | `crear` |
| PUT | `/{sugerencia_id}` | `role_checker(["operativo"])` | `actualizar` |
| DELETE | `/{sugerencia_id}` | `role_checker(["operativo"])` | `eliminar` |
| POST | `/generar-desde-brechas` (body `GenerarDesdeBrechasRequest`) | `role_checker(["operativo"])` | `generar_desde_brechas` |

- Registro: `include_router` en `app/main.py`; poblar `api_prefixes` del
  `RhModuleDef["sugerencias"]` existente a `("/api/v1/level-up/sugerencias",)`.
- `openapi.yaml`: nuevos paths + schemas (`GenerarDesdeBrechasRequest`, campos
  nuevos del Create/Update/Response).
- Gating: RH con el módulo `sugerencias` (patrón `role_checker(["operativo"])`);
  no es self-service (es herramienta de RH). No se agrega a
  `RH_SELF_SERVICE_API_PREFIXES`.

## Frontend (design system — solo tokens de `uiTokens.ts`)

- Nuevo cliente `frontend/src/api/sugerencias.ts` (tipos espejo de los schemas):
  `listarSugerencias(filtros)`, `crearSugerencia`, `actualizarSugerencia`,
  `eliminarSugerencia`, `generarSugerenciasDesdeBrechas({area_id, umbral_brecha})`.
- `frontend/src/pages/levelUp.ts` (`mountSugerencias`/`renderSugerenciasPage`/
  `renderSugCard`): reemplazar `FAKE_SUGERENCIAS` por `listarSugerencias`; mapear
  el shape del modelo a las tarjetas existentes (el mock ya tiene los campos
  equivalentes — `brechaPct`→`brecha_pct`, `capCubre`→`capacidades_afectadas`,
  etc.). Acciones de tarjeta (aprobar/posponer/descartar) → `actualizarSugerencia`
  con `estado`. Formulario de crear/editar (los campos del Create, incluido el
  selector de curso desde el catálogo). Botón **"Generar desde brechas"** (selecciona
  área + umbral → `generarSugerenciasDesdeBrechas` → recarga la lista). Estados
  cargando/vacío/error con tokens. Reusa el `AbortController` por mount de la página.
- No cambia nav ni policy (el módulo `sugerencias` ya está registrado con su hash
  y su ítem de nav; solo se le pobló el `api_prefixes` en backend).

## Testing

- **Puro**: `prioridad_desde_brecha` (umbrales 0/30/50/>50).
- **Service**: CRUD (crear/listar con filtros/actualizar/eliminar); `crear`/
  `actualizar` con `curso_id` inexistente → 404; `cambiar estado` vía Update;
  `generar_desde_brechas` (crea N borradores desde brechas mockeadas por encima del
  umbral, ignora las que están bajo el umbral, deduplica en segunda corrida, deriva
  prioridad, NO llena campos manuales ni curso_id); validaciones de rango.
- **API**: 200 RH-operativo; 403 sin módulo; generar-desde-brechas devuelve las
  creadas; listar con `estado`/`prioridad`.
- **Regresión**: suite completa sin fallos.
- Frontend: `npm run build` limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Deduplicación por título canónico**: simple y suficiente para evitar duplicados
  en resiembras; si RH renombra, una resiembra podría recrear (aceptable en v1,
  documentado).
- **`capacidades_afectadas`/`areas_afectadas` JSONB libres**: se guardan nombres
  legibles (no IDs) para la UI; no hay FK. Consistente con el diseño del modelo.
- **`adopcion_sector_pct`**: sin fuente → siempre captura manual; el generador lo
  deja `None`.
- **`curso_id`**: única migración; add_column + FK sobre tabla `levelup_` (permitido).
- **Brechas dependen de evaluaciones de competencia cargadas**: si un área no tiene
  evaluaciones/requisitos, `obtener_brechas` devuelve pocas/ninguna brecha y el
  generador crea 0 sugerencias (no es error).

## Decomposición en tareas (para el plan)

1. Migración `curso_id` + campo/relación en el modelo. Schemas (`curso_id` en
   Create/Update/Response + `curso_nombre`; `GenerarDesdeBrechasRequest`).
2. Función pura `prioridad_desde_brecha` + tests.
3. Service CRUD (`listar`/`crear`/`actualizar`/`eliminar`, validación de `curso_id`).
   Tests de service.
4. Service `generar_desde_brechas` (reusa `obtener_brechas`, dedup, deriva prioridad).
   Tests de service.
5. Router + registro (`api_prefixes`) + `openapi.yaml`. Tests de API (200/403/generar).
6. Frontend: api client + conectar `mountSugerencias` (lista real, acciones,
   crear/editar, generar desde brechas).
7. Cierre de huecos de cobertura.
