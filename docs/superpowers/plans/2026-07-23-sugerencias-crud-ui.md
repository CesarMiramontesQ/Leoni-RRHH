# Crear/editar manual de Sugerencias (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cablear el crear/editar/eliminar manual de Sugerencias en la UI, ampliando el `Update` del backend para que RH pueda completar los borradores sembrados.

**Architecture:** Ampliar `SugerenciaCapacitacionUpdate` (schema, sin migración; el service ya es genérico con `exclude_unset`) y construir un modal de crear/editar + eliminar en `levelUp.ts`, reusando los endpoints y el patrón de modal de `cicloDesempeno.ts`.

**Tech Stack:** FastAPI async, Pydantic v2, pytest (SQLite in-memory), Vite/TypeScript.

## Global Constraints

- Responder siempre en español; código y comentarios en español sin acentos en identificadores.
- NUNCA push directo a `main`; rama `feat/cm/sugerencias-crud-ui`, PR a main.
- **Sin migración** (solo cambia el contrato del `Update`: schema Pydantic + tipo TS). No tocar el modelo ni la BD.
- No cambiar el service (`actualizar` ya usa `exclude_unset`+`setattr`) ni el router.
- Estados válidos: `activa`/`aprobada`/`pospuesta`/`descartada`. `titulo` `min_length=2`. Porcentajes 0-100; `personas_alcanzables`/`inversion_estimada` `ge=0`; prioridad 1-5.
- Frontend: solo tokens de `frontend/src/ui/uiTokens.ts`; sin hex/fuentes nuevas. XSS: todo string del servidor/usuario interpolado en HTML con `escapeHtml`.
- Mantener `openapi.yaml` sincronizado (schema `SugerenciaCapacitacionUpdate`).
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

- `app/schemas/level_up.py` — 8 campos manuales en `SugerenciaCapacitacionUpdate` (Task 1).
- `openapi.yaml` (Task 1).
- `frontend/src/api/sugerencias.ts` — `SugerenciaUpdatePayload` ampliado (Task 2).
- `frontend/src/pages/levelUp.ts` — modal crear/editar + eliminar + handlers + focus-trap (Task 2).
- Tests: `tests/test_sugerencias_capacitacion.py` (Task 1).

---

### Task 1: Backend — ampliar `SugerenciaCapacitacionUpdate`

**Files:**
- Modify: `app/schemas/level_up.py` (`SugerenciaCapacitacionUpdate`)
- Modify: `openapi.yaml`
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Produces: `SugerenciaCapacitacionUpdate` acepta `brecha_pct`, `adopcion_sector_pct`, `capacidades_afectadas`, `areas_afectadas`, `personas_alcanzables`, `duracion_sugerida`, `inversion_estimada`, `proveedor_sugerido` (además de los actuales).

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_sugerencias_capacitacion.py`:

```python
@pytest.mark.asyncio
async def test_actualizar_setea_campos_manuales(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="Borrador sembrado"))
    upd = await svc.actualizar(
        s.id,
        SugerenciaCapacitacionUpdate(
            inversion_estimada=15000.0,
            proveedor_sugerido="Proveedor X",
            duracion_sugerida="16 horas",
            brecha_pct=42.5,
            personas_alcanzables=12,
            capacidades_afectadas=["Soldadura"],
            areas_afectadas=["Produccion"],
            adopcion_sector_pct=70.0,
        ),
    )
    assert upd.inversion_estimada == 15000.0
    assert upd.proveedor_sugerido == "Proveedor X"
    assert upd.duracion_sugerida == "16 horas"
    assert upd.brecha_pct == 42.5
    assert upd.personas_alcanzables == 12
    assert upd.capacidades_afectadas == ["Soldadura"]
    assert upd.areas_afectadas == ["Produccion"]
    assert upd.adopcion_sector_pct == 70.0


def test_update_rechaza_brecha_fuera_de_rango():
    import pytest as _pytest
    import pydantic
    with _pytest.raises(pydantic.ValidationError):
        SugerenciaCapacitacionUpdate(brecha_pct=150)


def test_update_rechaza_inversion_negativa():
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        SugerenciaCapacitacionUpdate(inversion_estimada=-5)
```

(Verifica que `SugerenciaCapacitacionCreate`/`Update`/`SugerenciaCapacitacionService` ya estén importados en el archivo — lo están de tareas previas.)

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k "campos_manuales or fuera_de_rango or inversion_negativa" -v`
Expected: FAIL (`TypeError`/campos no aceptados; el rango no valida porque el campo no existe).

- [ ] **Step 3: Ampliar el schema Update**

En `app/schemas/level_up.py`, en `SugerenciaCapacitacionUpdate`, después de `estado`, añade los 8 campos (mismas validaciones que el Create):

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

(`Field`, `Optional` ya están importados.)

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k "campos_manuales or fuera_de_rango or inversion_negativa" -v`
Expected: PASS

- [ ] **Step 5: Actualizar `openapi.yaml`**

En el schema `SugerenciaCapacitacionUpdate` de `openapi.yaml`, añade los 8 campos nuevos (tipos/nullable/rangos como en el Create). Sigue el estilo del `SugerenciaCapacitacionUpdate` existente.

- [ ] **Step 6: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/schemas/level_up.py openapi.yaml tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): permitir editar todos los campos en el update

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — modal crear/editar + eliminar

**Files:**
- Modify: `frontend/src/api/sugerencias.ts` (`SugerenciaUpdatePayload`)
- Modify: `frontend/src/pages/levelUp.ts` (bloque Sugerencias)
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: `crearSugerencia`/`actualizarSugerencia`/`eliminarSugerencia` (ya en `api/sugerencias.ts`); `getCursos` (`api/cursos.ts`); tokens de modal/formulario de `uiTokens.ts`; patrón de modal + focus-trap de `frontend/src/pages/cicloDesempeno.ts`.
- Produces: modal de crear/editar y flujo de eliminar en `mountSugerencias`.

- [ ] **Step 1: Leer patrones**

Lee `design.md`. Estudia en `frontend/src/pages/cicloDesempeno.ts` el patrón de modal: `renderNuevoCicloModal`/`renderEditCicloModal` (overlay `MODAL_OVERLAY`, panel `MODAL_PANEL`, `role="dialog"`, header con botón cerrar, footer Cancelar/Guardar), `handleKeydown` (Escape cierra; Tab con focus-trap sobre `FOCUSABLE_SELECTOR`), y `focusTopModal()` en `requestAnimationFrame`. En `frontend/src/pages/levelUp.ts` localiza el bloque de Sugerencias (`SugerenciasView`, `mountSugerencias`, `renderSugerenciasPage`, `renderSugCard`, `mapSugerencia`, el `onClick`/`onChange` de event delegation, ~L3460-3896). En `frontend/src/api/sugerencias.ts` los tipos y funciones; en `frontend/src/api/cursos.ts` la firma de `getCursos`.

- [ ] **Step 2: Ampliar el tipo TS del Update**

En `frontend/src/api/sugerencias.ts`, amplía `SugerenciaUpdatePayload` con los 8 campos (espejo del schema):

```typescript
export interface SugerenciaUpdatePayload {
  titulo?: string;
  justificacion?: string | null;
  curso_id?: number | null;
  prioridad?: number;
  estado?: SugerenciaEstado;
  brecha_pct?: number | null;
  adopcion_sector_pct?: number | null;
  capacidades_afectadas?: string[] | null;
  areas_afectadas?: string[] | null;
  personas_alcanzables?: number | null;
  duracion_sugerida?: string | null;
  inversion_estimada?: number | null;
  proveedor_sugerido?: string | null;
}
```

- [ ] **Step 3: Estado de modal + carga de cursos**

En `levelUp.ts`, importa `crearSugerencia`, `eliminarSugerencia` (junto a los ya importados) y `getCursos` (si no está). Amplía `SugerenciasView` con:

```typescript
  modalOpen: boolean;
  modalMode: "crear" | "editar";
  editId: number | null;
  saving: boolean;
  modalError: string | null;
  cursos: { id: number; nombre: string }[];
  form: {
    titulo: string; justificacion: string; prioridad: string; estado: string;
    cursoId: string; brechaPct: string; adopcionPct: string; personas: string;
    duracion: string; inversion: string; proveedor: string;
    capacidades: string; areas: string;
  };
```

Inicializa el `form` vacío en un helper `emptyForm()`. En `loadAll`, carga cursos:
`const cursosResp = await getCursos({ page_size: 500 });` y mapea
`view.cursos = cursosResp.items.map(c => ({ id: c.id, nombre: c.nombre }))`.

- [ ] **Step 4: Botones y modal en el render**

- Header (`renderSugerenciasPage`): botón "Nueva sugerencia" con `data-action="sug-nueva"` (usa `BTN_PRIMARY`).
- `renderSugCard`: en la columna de acciones, añade "Editar" (`data-action="sug-editar" data-id="${sug.sugId}"`, `BTN_SECONDARY`) y "Eliminar" (`data-action="sug-eliminar" data-id="${sug.sugId}"`, `BTN_DANGER`), deshabilitados si `sugActionsBusy`.
- Nueva función `renderSugerenciaModal(v)` que devuelve `""` si `!v.modalOpen`, o el overlay+panel siguiendo `cicloDesempeno.ts`: header con título ("Nueva sugerencia" / "Editar sugerencia") + botón cerrar (`data-action="sug-modal-cerrar"`); cuerpo con `alertError(v.modalError)` si hay, y los campos (usar `FORM_LABEL`, `FIELD_INPUT`, `FIELD_TEXTAREA`, `FORM_SELECT`+`SELECT_CHEVRON`), con `value`/`escapeHtml` desde `v.form`; el `<select>` de curso con opción "— sin curso —" y las opciones de `v.cursos`; el `<select>` de estado solo si `modalMode === "editar"`; footer con Cancelar (`data-action="sug-modal-cerrar"`, `BTN_SECONDARY`) y Guardar (`data-action="sug-modal-guardar"`, `BTN_PRIMARY`, disabled si `v.saving`). Inputs con `data-form="<campo>"`. Concatena `renderSugerenciaModal(view)` dentro del `mainHtml` de `renderSugerenciasPage`.

- [ ] **Step 5: Handlers**

En `mountSugerencias`, añade:
- `abrirModalCrear()`: `view.modalMode="crear"`, `view.editId=null`, `view.form=emptyForm()`, `view.modalError=null`, `view.modalOpen=true`, `render()`, luego `focusTopModal()`.
- `abrirModalEditar(id)`: busca el `SugerenciaResponse` en `view.items`, pre-llena `view.form` (numéricos → string; `capacidades_afectadas`/`areas_afectadas` → join `", "`), `modalMode="editar"`, `editId=id`, abre y enfoca.
- `guardarModal()`: guard `saving`; construye el payload desde `view.form` (parsea números con un helper que devuelve `null`/`undefined` si vacío; CSV→array con `split(",").map(trim).filter(Boolean)`); si crear → `crearSugerencia(payload)`, si editar → `actualizarSugerencia(editId, payload)`; en éxito cierra el modal, `await refreshList()`, `render()`; en error setea `view.modalError = detail(e)` y `render()`. Respeta `signal?.aborted`.
- `eliminarSug(id)`: `if (!confirm("¿Eliminar esta sugerencia?")) return;` guard `sugActionsBusy`; `await eliminarSugerencia(id)`; `await refreshList()`; render.
- Event delegation: en `onClick`, añade ramas `sug-nueva`→`abrirModalCrear`, `sug-editar`→`abrirModalEditar(Number(id))`, `sug-eliminar`→`eliminarSug(Number(id))`, `sug-modal-cerrar`→cerrar modal + render, `sug-modal-guardar`→`guardarModal`. En `onChange`, sincroniza los `data-form="<campo>"` a `view.form[campo]` (sin re-render por tecla; el modal se re-renderiza solo al abrir/guardar/error — para inputs de texto, lee los valores del DOM al guardar en vez de en cada keystroke, o usa `onInput` que actualice `view.form` sin `render()`).
- **Focus-trap + Escape**: copia `FOCUSABLE_SELECTOR` de `cicloDesempeno.ts` (local) y registra `container.addEventListener("keydown", handleKeydown, listenerOpts)` que en `Escape` cierra el modal (si abierto) + render, y en `Tab` hace wrap sobre los focusables del `[role="dialog"]`. Añade `focusTopModal()` (rAF → primer focusable del dialog).

- [ ] **Step 6: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build`
Expected: limpio (sin errores TS nuevos).

Run: `docker-compose exec -T frontend npm run test`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/sugerencias.ts frontend/src/pages/levelUp.ts
git commit -m "feat(sugerencias): modal de crear/editar y eliminar en la UI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -q` verde.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual: como RH abrir `#/sugerencias`; "Nueva sugerencia" → crear con varios campos; "Generar desde brechas" → "Editar" un borrador y completar inversión/proveedor/duración → guardar (persisten); "Eliminar" con confirmación; Escape cierra el modal.
- Cierra el follow-up del Motor de Sugerencias (crear/editar manual + asignación de curso).
