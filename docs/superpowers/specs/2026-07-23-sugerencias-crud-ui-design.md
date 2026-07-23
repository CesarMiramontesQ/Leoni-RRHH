# Crear/editar manual de Sugerencias (UI) — Diseño

**Fecha:** 2026-07-23
**Sub-proyecto de:** Motor de Sugerencias de Capacitación (follow-up)
**Rama:** `feat/cm/sugerencias-crud-ui` → PR a `main`

## Contexto

El Motor de Sugerencias (PR #120) ya tiene backend completo (CRUD + generador) y
una página conectada a datos reales (`levelUp.ts → mountSugerencias`), pero la UI
solo permite **listar**, **cambiar de estado** (aprobar/posponer/descartar) y
**generar desde brechas**. El `crearSugerencia`/`eliminarSugerencia` del api
client existen pero **no están cableados**, y no hay formulario de crear/editar.
El flujo híbrido diseñado era: el generador siembra borradores con los campos
manuales en blanco (`inversion_estimada`, `proveedor_sugerido`, `duracion_sugerida`,
`brecha_pct`, etc.) y **RH los completa** — hoy imposible desde la UI.

### Restricción encontrada (define el alcance)

`SugerenciaCapacitacionUpdate` (`app/schemas/level_up.py`) solo acepta 5 campos:
`titulo`, `justificacion`, `curso_id`, `prioridad`, `estado`. NO acepta los 8
campos manuales que sí tiene `SugerenciaCapacitacionCreate` (`brecha_pct`,
`adopcion_sector_pct`, `capacidades_afectadas`, `areas_afectadas`,
`personas_alcanzables`, `duracion_sugerida`, `inversion_estimada`,
`proveedor_sugerido`). Por eso un "editar" limitado no permitiría completar un
borrador sembrado. El service (`SugerenciaCapacitacionService.actualizar`) ya usa
`model_dump(exclude_unset=True)` + `setattr`, así que soporta cualquier campo del
Update automáticamente — solo hay que ampliar el schema.

### Estado verificado

- `app/schemas/level_up.py`: `SugerenciaCapacitacionCreate` con los 8 campos manuales
  + `curso_id` + `prioridad` (validaciones `ge/le`); `SugerenciaCapacitacionUpdate`
  con solo `titulo`/`justificacion`/`curso_id`/`prioridad`/`estado`.
- `app/services/sugerencia_capacitacion_service.py`: `actualizar(id, data)` con
  `exclude_unset` + validación de `curso_id` (404) — soporta campos nuevos sin cambio.
- `frontend/src/api/sugerencias.ts`: `crearSugerencia`/`actualizarSugerencia`/
  `eliminarSugerencia` exportadas; `SugerenciaUpdatePayload` TS con solo 5 campos.
  `mountSugerencias` usa solo `listar`/`actualizar(estado)`/`generar`.
- `frontend/src/pages/levelUp.ts` (~L3460-3896): `SugerenciasView`, `renderSugCard`
  (3 botones de estado), `mapSugerencia`, event delegation + AbortController; sin
  modal ni `keydown`.
- Patrón de modal hand-rolled reutilizable: `frontend/src/pages/cicloDesempeno.ts`
  (overlay/panel/header/footer con `MODAL_OVERLAY`/`MODAL_PANEL`, `role="dialog"`,
  focus-trap + Escape en `handleKeydown`, `FOCUSABLE_SELECTOR` local).
- Selector de curso: `getCursos(params)` (`frontend/src/api/cursos.ts`) → `{items,total}`
  con `Curso.id`/`Curso.nombre`. Ya importado en `levelUp.ts`.
- Tokens: `MODAL_OVERLAY`, `MODAL_PANEL`, `FIELD_INPUT`, `FIELD_TEXTAREA`, `FORM_LABEL`,
  `FORM_SELECT`, `SELECT_CHEVRON`, `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`,
  `alertError` (`frontend/src/ui/uiTokens.ts`).

## Decisión aprobada por el usuario

**Editar completo**: ampliar `SugerenciaCapacitacionUpdate` (backend, sin migración)
para aceptar todos los campos editables, de modo que RH pueda completar los
borradores sembrados. Modal de crear/editar completo en la UI.

## Alcance

Solo schema + frontend. Sin migración, sin cambios de service ni de router (el
service ya es genérico). No es self-service (sigue RH-gated por el router existente).

## Backend

`app/schemas/level_up.py`, `SugerenciaCapacitacionUpdate`: añadir los 8 campos
manuales como opcionales con las mismas validaciones que el Create:

```python
    brecha_pct: Optional[float] = Field(None, ge=0, le=100)
    adopcion_sector_pct: Optional[float] = Field(None, ge=0, le=100)
    capacidades_afectadas: Optional[list] = None
    areas_afectadas: Optional[list] = None
    personas_alcanzables: Optional[int] = Field(None, ge=0)
    duracion_sugerida: Optional[str] = None
    inversion_estimada: Optional[float] = Field(None, ge=0)
    proveedor_sugerido: Optional[str] = None
```

`actualizar` no cambia (`exclude_unset` + `setattr`). `openapi.yaml`:
`SugerenciaCapacitacionUpdate` con los campos nuevos. Tests: `actualizar` setea
los campos manuales en un borrador (p. ej. `inversion_estimada`), y respeta las
validaciones (rango inválido → 422 vía el endpoint).

## Frontend

- `frontend/src/api/sugerencias.ts`: ampliar `SugerenciaUpdatePayload` con los 8
  campos (espejo del schema). Sin cambiar las funciones.
- `frontend/src/pages/levelUp.ts` (bloque Sugerencias):
  - Estado de modal en `SugerenciasView`: `modalOpen`, `modalMode: "crear"|"editar"`,
    `editId: number|null`, `form: {campos...}`, `saving: boolean`, `modalError: string|null`;
    y `cursos: {id, nombre}[]` (cargados con `getCursos`).
  - Header: botón **"Nueva sugerencia"** (`data-action="sug-nueva"`).
  - `renderSugCard`: botones **"Editar"** (`data-action="sug-editar" data-id`) y
    **"Eliminar"** (`data-action="sug-eliminar" data-id`, con confirmación).
  - `renderSugerenciaModal(v)`: patrón de `cicloDesempeno.ts` (overlay/panel/header/
    footer, `role="dialog"`, `aria-modal`, botón cerrar, Cancelar/Guardar). Campos:
    `titulo` (req), `justificacion` (textarea), `prioridad` (select 1-5), `curso_id`
    (select desde `cursos`, opción "— sin curso —"), `estado` (select, solo en
    edición), y los manuales: `brecha_pct`, `adopcion_sector_pct`,
    `personas_alcanzables`, `duracion_sugerida`, `inversion_estimada`,
    `proveedor_sugerido`, `capacidades_afectadas`/`areas_afectadas` (inputs de texto
    separados por comas → array). Banner `modalError` con `alertError`. Todo string
    interpolado con `escapeHtml`.
  - Handlers async: `abrirModalCrear()`, `abrirModalEditar(id)` (pre-llena `form`
    desde el item), `guardarModal()` (crea o edita: arma el payload, parsea números
    y CSV→array, `crearSugerencia`/`actualizarSugerencia`, cierra, `refreshList`+`render`),
    `eliminarSug(id)` (confirmación → `eliminarSugerencia` → refresh). Respetan
    `signal?.aborted`.
  - Registrar `keydown` en el container (Escape cierra el modal; Tab con focus-trap
    usando un `FOCUSABLE_SELECTOR` copiado), con `{ signal }`. Cargar `getCursos`
    en `loadAll` (mapear `items → {id, nombre}`, `page_size` alto).
  - Solo tokens del design system; sin hex/fuentes nuevas.

## Testing

- Backend: `actualizar` con los campos manuales (setear `inversion_estimada`/
  `proveedor_sugerido` en un borrador y verificar en el Response); validación de
  rango vía endpoint (`brecha_pct` fuera de 0-100 → 422).
- Frontend: `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual: como RH, "Nueva sugerencia" → crear; sembrar desde brechas → "Editar" un
  borrador y completar inversión/proveedor/duración → guardar; "Eliminar" con
  confirmación.

## Riesgos / trade-offs

- **`capacidades_afectadas`/`areas_afectadas` como CSV de texto**: simple; se guardan
  como lista de strings (nombres), consistente con el diseño JSONB del modelo.
- **Sin migración**: solo cambia el contrato del Update (schema + TS).
- **Modal hand-rolled**: no hay componente compartido; se copia el patrón probado
  de `cicloDesempeno.ts` (focus-trap + Escape).

## Decomposición en tareas (para el plan)

1. Backend: ampliar `SugerenciaCapacitacionUpdate` + `openapi.yaml` + tests.
2. Frontend: tipo TS + modal crear/editar/eliminar + handlers + focus-trap + build.
