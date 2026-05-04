# Spec de Implementacion Frontend — Modulo de Talento Fase 1: Perfiles de Puesto y Competencias

---

## 1. Estructura de Archivos

```
frontend/src/
├── pages/
│   ├── puestos.ts                          # Page mount: Definicion de Perfiles de Puesto
│   └── competencias.ts                     # Page mount: Matriz de Competencias
├── api/
│   ├── puestos.ts                          # API client: perfiles de puesto
│   └── competencias.ts                     # API client: matriz de competencias
├── puestos/
│   └── types.ts                            # Tipos del dominio de perfiles de puesto
├── competencias/
│   └── types.ts                            # Tipos del dominio de competencias
├── components/
│   ├── puestos/
│   │   ├── perfilFormHeader.ts             # Breadcrumb + header + profile selector
│   │   ├── perfilCompetenciasTecnicas.ts   # Seccion: competencias tecnicas
│   │   ├── perfilHabilidadesBlandas.ts     # Seccion: habilidades blandas
│   │   ├── perfilMaquinasHerramientas.ts   # Seccion: maquinas y herramientas
│   │   ├── perfilIaRecomendaciones.ts      # Panel de recomendaciones IA
│   │   └── perfilFooter.ts                 # Footer con version + ultima actualizacion
│   └── competencias/
│       ├── matrizTable.ts                  # Tabla editable de la matriz
│       ├── matrizFilters.ts                # Filtros: area, linea, sector
│       ├── matrizSummaryCard.ts            # Card resumen (compliance, empleados, req)
│       ├── matrizGapsPanel.ts              # Panel de gaps criticos
│       ├── matrizAuditAlert.ts             # Alerta de auditoria (Screen 3)
│       └── matrizLegend.ts                 # Leyenda de niveles 0-4
```

---

## 2. Tipos de Dominio

### 2.1 `frontend/src/puestos/types.ts`

```typescript
// ── Nivel de competencia ──────────────────────────────────────────────
export type NivelCompetencia = 1 | 2 | 3 | 4;

// ── Competencia tecnica ───────────────────────────────────────────────
export type CompetenciaTecnica = {
  id: string;
  nombre: string;
  descripcion: string;
  nivel_requerido: NivelCompetencia;
};

// ── Habilidad blanda ──────────────────────────────────────────────────
export type HabilidadBlanda = {
  id: string;
  nombre: string;
  nivel_requerido: NivelCompetencia;
};

// ── Maquina / Herramienta ─────────────────────────────────────────────
export type MaquinaHerramienta = {
  id: string;
  nombre: string;
  requiere_certificacion: boolean;
};

// ── Recomendacion IA ──────────────────────────────────────────────────
export type IaRecomendacion = {
  id: string;
  tipo: "competencia_tecnica" | "habilidad_blanda" | "emergente";
  nombre: string;
  descripcion: string;
  confianza: number; // 0-100
  aceptada: boolean;
};

// ── Perfil de puesto completo ─────────────────────────────────────────
export type PerfilPuesto = {
  id: number;
  codigo: string;             // e.g. "PRF-2024-082"
  nombre_puesto: string;
  area: string;
  competencias_tecnicas: CompetenciaTecnica[];
  habilidades_blandas: HabilidadBlanda[];
  maquinas_herramientas: MaquinaHerramienta[];
  recomendaciones_ia: IaRecomendacion[];
  version: string;            // e.g. "3.2"
  ultima_actualizacion: string; // ISO datetime
};

// ── Selector de perfil (dropdown header) ──────────────────────────────
export type PerfilResumen = {
  id: number;
  codigo: string;
  nombre_puesto: string;
};

// ── Estado de la pagina ───────────────────────────────────────────────
export type PuestosPageStatus = "loading" | "ready" | "saving" | "error";

export type PuestosPageState = {
  status: PuestosPageStatus;
  perfiles: PerfilResumen[];
  perfilSeleccionadoId: number | null;
  perfil: PerfilPuesto | null;
  dirty: boolean;             // cambios sin guardar
  errorMessage: string | null;
};
```

### 2.2 `frontend/src/competencias/types.ts`

```typescript
// ── Nivel de celda en la matriz ───────────────────────────────────────
export type NivelMatriz = 0 | 1 | 2 | 3 | 4;

// ── Puesto (columna) ─────────────────────────────────────────────────
export type PuestoColumna = {
  id: string;
  nombre: string;         // e.g. "Operador N1"
  abreviacion?: string;   // e.g. "Op N1"
};

// ── Competencia (fila) ────────────────────────────────────────────────
export type CompetenciaFila = {
  id: string;
  nombre: string;
  grupo: "tecnica" | "habilidad_blanda";
};

// ── Celda editable ────────────────────────────────────────────────────
export type CeldaMatriz = {
  competencia_id: string;
  puesto_id: string;
  nivel: NivelMatriz;
};

// ── Gap critico ───────────────────────────────────────────────────────
export type GapCritico = {
  competencia_nombre: string;
  puesto_nombre: string;
  nivel_actual_promedio: number;
  nivel_requerido: NivelMatriz;
  porcentaje_brecha: number;    // 0-100
  empleados_afectados: number;
};

// ── Resumen de la matriz ──────────────────────────────────────────────
export type MatrizResumen = {
  porcentaje_cumplimiento: number;   // e.g. 75
  total_empleados: number;
  total_requisitos: number;
};

// ── Auditoria (Screen 3) ─────────────────────────────────────────────
export type AuditoriaInfo = {
  nombre: string;          // e.g. "ISO 9001:2015"
  dias_restantes: number;
  meta_trimestral: number; // e.g. 85
  tendencia_vs_mes_anterior: number; // e.g. +2
};

// ── Filtros ───────────────────────────────────────────────────────────
export type CompetenciasFilterState = {
  area_id: string;
  linea_id: string;
  sector_id: string;
};

export type CompetenciasFilterOptions = {
  areas: ReadonlyArray<{ id: string; label: string }>;
  lineas: ReadonlyArray<{ id: string; label: string }>;
  sectores: ReadonlyArray<{ id: string; label: string }>;
};

// ── Estado de pagina ──────────────────────────────────────────────────
export type CompetenciasPageStatus = "loading" | "ready" | "saving" | "error";

export type CompetenciasPageState = {
  status: CompetenciasPageStatus;
  filters: CompetenciasFilterState;
  filterOptions: CompetenciasFilterOptions;
  puestos: PuestoColumna[];
  competencias: CompetenciaFila[];
  celdas: CeldaMatriz[];
  celdasModificadas: Map<string, NivelMatriz>; // key = "comp_id:puesto_id"
  resumen: MatrizResumen | null;
  gaps: GapCritico[];
  auditoria: AuditoriaInfo | null;
  errorMessage: string | null;
};
```

---

## 3. Modulos API

### 3.1 `frontend/src/api/puestos.ts`

```typescript
import { fetchWithAuth } from "./http.ts";
import type {
  PerfilPuesto,
  PerfilResumen,
  CompetenciaTecnica,
  HabilidadBlanda,
  MaquinaHerramienta,
  IaRecomendacion,
} from "../puestos/types.ts";

// ── Error type ────────────────────────────────────────────────────────
export type PuestosFetchError = {
  status: number;
  detail: string;
};

// ── Request types ─────────────────────────────────────────────────────
export type PerfilUpdatePayload = {
  competencias_tecnicas: CompetenciaTecnica[];
  habilidades_blandas: HabilidadBlanda[];
  maquinas_herramientas: MaquinaHerramienta[];
};

export type AceptarRecomendacionPayload = {
  recomendacion_id: string;
};

// ── API functions ─────────────────────────────────────────────────────

/** GET /api/v1/puestos/perfiles — listado resumido para selector */
export async function getPerfilesResumen(): Promise<PerfilResumen[]>;

/** GET /api/v1/puestos/perfiles/:id — perfil completo */
export async function getPerfilById(id: number): Promise<PerfilPuesto>;

/** PUT /api/v1/puestos/perfiles/:id — guardar cambios */
export async function updatePerfil(id: number, payload: PerfilUpdatePayload): Promise<PerfilPuesto>;

/** POST /api/v1/puestos/perfiles/:id/recomendaciones/:recId/aceptar */
export async function aceptarRecomendacion(perfilId: number, recId: string): Promise<PerfilPuesto>;

/** POST /api/v1/puestos/perfiles/:id/recomendaciones/refresh — pedir nuevas de IA */
export async function refreshRecomendaciones(perfilId: number): Promise<IaRecomendacion[]>;
```

**Error handling pattern** (identico a `api/solicitudes.ts`):

```typescript
async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const d = (parsed as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
  } catch { /* noop */ }
  return raw.trim() || res.statusText || "Error";
}
```

Cada funcion lanza `PuestosFetchError` si `!res.ok`.

### 3.2 `frontend/src/api/competencias.ts`

```typescript
import { fetchWithAuth } from "./http.ts";
import type {
  CeldaMatriz,
  CompetenciaFila,
  CompetenciasFilterOptions,
  GapCritico,
  MatrizResumen,
  NivelMatriz,
  PuestoColumna,
  AuditoriaInfo,
} from "../competencias/types.ts";

// ── Error type ────────────────────────────────────────────────────────
export type CompetenciasFetchError = {
  status: number;
  detail: string;
};

// ── Response types ────────────────────────────────────────────────────
export type MatrizDataResponse = {
  puestos: PuestoColumna[];
  competencias: CompetenciaFila[];
  celdas: CeldaMatriz[];
  resumen: MatrizResumen;
  gaps: GapCritico[];
  auditoria: AuditoriaInfo | null;
};

// ── Request types ─────────────────────────────────────────────────────
export type MatrizBulkUpdatePayload = {
  cambios: Array<{
    competencia_id: string;
    puesto_id: string;
    nivel: NivelMatriz;
  }>;
};

// ── API functions ─────────────────────────────────────────────────────

/** GET /api/v1/competencias/filter-options */
export async function getCompetenciasFilterOptions(): Promise<CompetenciasFilterOptions>;

/** GET /api/v1/competencias/matriz?area_id=&linea_id=&sector_id= */
export async function getMatrizData(params: {
  area_id: string;
  linea_id: string;
  sector_id: string;
}): Promise<MatrizDataResponse>;

/** PUT /api/v1/competencias/matriz — guardado masivo de celdas editadas */
export async function updateMatrizBulk(payload: MatrizBulkUpdatePayload): Promise<MatrizDataResponse>;

/** GET /api/v1/competencias/gaps?area_id= */
export async function getGapsDetalle(area_id: string): Promise<GapCritico[]>;
```

---

## 4. Pagina: Perfiles de Puesto (`pages/puestos.ts`)

### 4.1 Firma y ciclo de vida

```typescript
export function mountPuestos(container: HTMLElement, signal: AbortSignal): void;
```

**Lifecycle:**
1. Llama `mountAppShell(container, { pageTitle: "Perfiles de Puesto", activeNav: "puestos", ... })`
2. Renderiza loading skeleton
3. `getPerfilesResumen()` → pobla dropdown
4. Si `state.perfilSeleccionadoId` (primer perfil por defecto), llama `getPerfilById(id)`
5. `paint()` con datos completos

### 4.2 State shape

```typescript
const state: PuestosPageState = {
  status: "loading",
  perfiles: [],
  perfilSeleccionadoId: null,
  perfil: null,
  dirty: false,
  errorMessage: null,
};
```

### 4.3 HTML Structure (template literal pseudo-code)

```typescript
function renderPuestosPage(state: PuestosPageState): string {
  return `
  <div id="puestos-page-root" class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">

    ${renderPerfilFormHeader(state)}

    ${state.status === "loading" ? renderPuestosLoadingSkeleton() : ""}
    ${state.status === "error" ? renderPuestosError(state.errorMessage) : ""}
    ${state.status === "ready" || state.status === "saving" ? `
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <!-- Left column: form sections (2/3 width) -->
        <div class="flex flex-col gap-4 xl:col-span-2">
          ${renderPerfilCompetenciasTecnicas(state.perfil!.competencias_tecnicas)}
          ${renderPerfilHabilidadesBlandas(state.perfil!.habilidades_blandas)}
          ${renderPerfilMaquinasHerramientas(state.perfil!.maquinas_herramientas)}
        </div>
        <!-- Right column: AI recommendations (1/3) -->
        <div class="flex flex-col gap-4 xl:col-span-1">
          ${renderPerfilIaRecomendaciones(state.perfil!.recomendaciones_ia)}
        </div>
      </div>
      ${renderPerfilFooter(state.perfil!)}
    ` : ""}

  </div>`;
}
```

### 4.4 Event handlers

| `data-*` attribute | Element | Action |
|---|---|---|
| `data-puesto-selector` | `<select>` | `change` → `getPerfilById(value)` → `paint()` |
| `data-puesto-preview` | `<button>` | `click` → abre modal preview (futuro) |
| `data-puesto-save` | `<button>` | `click` → `updatePerfil()` → toast exito → `dirty=false` |
| `data-puesto-add-competencia` | `<button>` | `click` → agrega fila vacia a `competencias_tecnicas` → `paint()` |
| `data-puesto-add-habilidad` | `<button>` | `click` → agrega fila vacia a `habilidades_blandas` → `paint()` |
| `data-puesto-add-maquina` | `<button>` | `click` → agrega fila vacia a `maquinas_herramientas` → `paint()` |
| `data-puesto-remove-item` | `<button>` | `click` → elimina item por `data-item-id` → `dirty=true` → `paint()` |
| `data-puesto-field` | `<input>/<select>` | `input/change` → actualiza campo en state → `dirty=true` (NO repaint, solo marca dirty) |
| `data-puesto-nivel` | `<select>` | `change` → actualiza nivel en item por `data-item-id` → `dirty=true` |
| `data-puesto-cert-toggle` | `<input type="checkbox">` | `change` → toggle `requiere_certificacion` → `dirty=true` |
| `data-puesto-ia-aceptar` | `<button>` | `click` → `aceptarRecomendacion()` → reload perfil |

**Event delegation** registrado con un solo listener en `#puestos-page-root` para `click`, `change`, `input`.

### 4.5 API calls sequence

| Momento | Llamada |
|---|---|
| Mount | `getPerfilesResumen()` |
| Mount (tras obtener lista) | `getPerfilById(perfiles[0].id)` |
| Cambio de selector | `getPerfilById(newId)` |
| Click "Guardar Cambios" | `updatePerfil(id, payload)` |
| Click "Aceptar" en recomendacion | `aceptarRecomendacion(perfilId, recId)` |

### 4.6 Loading / Error / Empty states

**Loading:**
```html
<div class="flex flex-col gap-4">
  <div class="h-12 w-64 animate-pulse rounded-lg bg-slate-200"></div>
  <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
  <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
</div>
```

**Error:**
```html
<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
  <p class="font-semibold">Error al cargar perfil</p>
  <p class="mt-1">{errorMessage}</p>
  <button data-puesto-retry class="${BTN_SECONDARY} mt-3">Reintentar</button>
</div>
```

**Empty (sin perfiles):**
```html
<div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
  <p class="text-sm font-semibold text-text-primary">Sin perfiles configurados</p>
  <p class="mt-1.5 text-xs text-text-muted">Crea un perfil de puesto para comenzar.</p>
</div>
```

---

## 5. Pagina: Matriz de Competencias (`pages/competencias.ts`)

### 5.1 Firma y ciclo de vida

```typescript
export function mountCompetencias(container: HTMLElement, signal: AbortSignal): void;
```

**Lifecycle:**
1. `mountAppShell(container, { pageTitle: "Matriz de Competencias", activeNav: "competencias", ... })`
2. Renderiza loading skeleton
3. `getCompetenciasFilterOptions()` + `getMatrizData({ area_id: "", linea_id: "", sector_id: "" })` en paralelo
4. `paint()`

### 5.2 State shape

```typescript
const state: CompetenciasPageState = {
  status: "loading",
  filters: { area_id: "", linea_id: "", sector_id: "" },
  filterOptions: { areas: [], lineas: [], sectores: [] },
  puestos: [],
  competencias: [],
  celdas: [],
  celdasModificadas: new Map(),
  resumen: null,
  gaps: [],
  auditoria: null,
  errorMessage: null,
};
```

### 5.3 HTML Structure

```typescript
function renderCompetenciasPage(state: CompetenciasPageState): string {
  return `
  <div id="competencias-page-root" class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">

    <!-- Breadcrumb -->
    <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1">
        <li><a href="#/" class="hover:text-accent">Gestion Organizacional</a></li>
        <li><span class="mx-1">/</span></li>
        <li class="font-semibold text-text-primary">Competencias</li>
      </ol>
    </nav>

    <!-- Header + Edit Requirements button -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          Matriz de Competencias — Configuracion por Area
        </h1>
      </div>
      <div class="flex items-center gap-2">
        ${state.celdasModificadas.size > 0 ? `
          <span class="text-xs font-semibold text-amber-700">
            ${state.celdasModificadas.size} cambio${state.celdasModificadas.size > 1 ? "s" : ""} sin guardar
          </span>
        ` : ""}
        <button data-comp-save type="button" class="${BTN_PRIMARY}"
          ${state.celdasModificadas.size === 0 ? "disabled" : ""}>
          Guardar Cambios
        </button>
      </div>
    </div>

    <!-- Audit Alert (Screen 3 only, shown if auditoria != null) -->
    ${state.auditoria ? renderMatrizAuditAlert(state.auditoria) : ""}

    <!-- Filters -->
    ${renderMatrizFilters(state.filters, state.filterOptions)}

    <!-- Legend -->
    ${renderMatrizLegend()}

    <!-- Matrix + Sidebar -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <div class="xl:col-span-3 overflow-x-auto">
        ${renderMatrizTable(state)}
      </div>
      <div class="flex flex-col gap-4 xl:col-span-1">
        ${renderMatrizSummaryCard(state.resumen)}
        ${renderMatrizGapsPanel(state.gaps)}
      </div>
    </div>

  </div>`;
}
```

### 5.4 Event handlers

| `data-*` attribute | Element | Action |
|---|---|---|
| `data-comp-filter="area"` | `<select>` | `change` → update `filters.area_id` → `getMatrizData(filters)` → `paint()` |
| `data-comp-filter="linea"` | `<select>` | `change` → update `filters.linea_id` → `getMatrizData(filters)` → `paint()` |
| `data-comp-filter="sector"` | `<select>` | `change` → update `filters.sector_id` → `getMatrizData(filters)` → `paint()` |
| `data-comp-cell` | `<td>` | `click` → transform td content to `<input type="number" min="0" max="4">` |
| `data-comp-cell-input` | `<input>` | `blur` / `keydown(Enter)` → validate 0-4 → update `celdasModificadas` → revert td to display |
| `data-comp-save` | `<button>` | `click` → `updateMatrizBulk(cambios)` → clear `celdasModificadas` → toast → `paint()` |
| `data-comp-gap-analizar` | `<a>` | `click` → navegacion a detalle de gaps (futuro) |

### 5.5 API calls sequence

| Momento | Llamadas |
|---|---|
| Mount | `getCompetenciasFilterOptions()` + `getMatrizData({...})` (paralelo) |
| Filter change | `getMatrizData(filters)` — debounce no necesario (selects) |
| Click "Guardar Cambios" | `updateMatrizBulk({ cambios: [...celdasModificadas] })` |

### 5.6 Loading / Error / Empty

**Loading:** Skeleton con tabla ficticia de 5 cols x 6 rows con `animate-pulse bg-slate-100` en cada celda.

**Error:**
```html
<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
  <p class="font-semibold">Error al cargar la matriz</p>
  <p class="mt-1">{errorMessage}</p>
</div>
```

**Empty (sin datos para el filtro actual):**
```html
<div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
  <p class="text-sm font-semibold text-text-primary">Sin competencias configuradas</p>
  <p class="mt-1.5 text-xs text-text-muted">Selecciona un area o configura requisitos para esta combinacion.</p>
</div>
```

---

## 6. Componentes — Perfiles de Puesto

### 6.1 `perfilFormHeader.ts`

```typescript
import type { PuestosPageState, PerfilResumen } from "../../puestos/types.ts";
import { BTN_PRIMARY, BTN_SECONDARY, SELECT_CHEVRON, FIELD_FOCUS } from "../../ui/uiTokens.ts";

export function renderPerfilFormHeader(state: PuestosPageState): string {
  return `
  <div class="flex flex-col gap-3">
    <!-- Breadcrumb -->
    <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1">
        <li><a href="#/puestos" class="hover:text-accent">Perfiles</a></li>
        <li><span class="mx-1">/</span></li>
        <li class="font-semibold text-text-primary">Configuracion de Perfil</li>
      </ol>
    </nav>

    <!-- Title + selector row -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          Definicion de Perfil de Puesto
        </h1>
        <!-- Profile selector -->
        <div class="relative grid grid-cols-1">
          <select data-puesto-selector
            class="col-start-1 row-start-1 appearance-none rounded-lg border border-border bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-text-primary ${FIELD_FOCUS}">
            ${state.perfiles.map((p) => `
              <option value="${p.id}" ${p.id === state.perfilSeleccionadoId ? "selected" : ""}>
                ${escapeHtml(p.codigo)} — ${escapeHtml(p.nombre_puesto)}
              </option>
            `).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <!-- Action buttons -->
      <div class="flex items-center gap-2">
        ${state.dirty ? `<span class="text-xs font-semibold text-amber-700">Cambios sin guardar</span>` : ""}
        <button data-puesto-preview type="button" class="${BTN_SECONDARY}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Vista previa
        </button>
        <button data-puesto-save type="button" class="${BTN_PRIMARY}"
          ${!state.dirty || state.status === "saving" ? "disabled" : ""}>
          ${state.status === "saving" ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  </div>`;
}
```

### 6.2 `perfilCompetenciasTecnicas.ts`

```typescript
import type { CompetenciaTecnica } from "../../puestos/types.ts";
import { BTN_GHOST, FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderPerfilCompetenciasTecnicas(items: CompetenciaTecnica[]): string {
  return `
  <section class="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-text-primary">Competencias Tecnicas</h2>
      <button data-puesto-add-competencia type="button" class="${BTN_GHOST}">
        <span aria-hidden="true">+</span> Agregar
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-3">
      ${items.length === 0 ? `
        <p class="py-4 text-center text-sm text-text-muted">Sin competencias tecnicas. Agrega una para comenzar.</p>
      ` : items.map((item) => `
        <div class="group flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
             data-item-id="${escapeHtml(item.id)}">
          <div class="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <!-- Nombre -->
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre</label>
              <input type="text" value="${escapeHtml(item.nombre)}"
                data-puesto-field="nombre" data-item-id="${escapeHtml(item.id)}"
                class="block w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}" />
            </div>
            <!-- Descripcion -->
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Descripcion</label>
              <input type="text" value="${escapeHtml(item.descripcion)}"
                data-puesto-field="descripcion" data-item-id="${escapeHtml(item.id)}"
                class="block w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}" />
            </div>
            <!-- Nivel requerido -->
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nivel</label>
              <select data-puesto-nivel data-item-id="${escapeHtml(item.id)}"
                class="block w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}">
                <option value="1" ${item.nivel_requerido === 1 ? "selected" : ""}>1 — Basico</option>
                <option value="2" ${item.nivel_requerido === 2 ? "selected" : ""}>2 — Intermedio</option>
                <option value="3" ${item.nivel_requerido === 3 ? "selected" : ""}>3 — Avanzado</option>
                <option value="4" ${item.nivel_requerido === 4 ? "selected" : ""}>4 — Experto</option>
              </select>
            </div>
          </div>
          <!-- Remove button -->
          <button data-puesto-remove-item data-item-id="${escapeHtml(item.id)}" type="button"
            class="mt-5 rounded p-1 text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
            aria-label="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      `).join("")}
    </div>
  </section>`;
}
```

### 6.3 `perfilHabilidadesBlandas.ts`

```typescript
import type { HabilidadBlanda } from "../../puestos/types.ts";
import { BTN_GHOST, FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderPerfilHabilidadesBlandas(items: HabilidadBlanda[]): string {
  return `
  <section class="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-text-primary">Habilidades Blandas</h2>
      <button data-puesto-add-habilidad type="button" class="${BTN_GHOST}">
        <span aria-hidden="true">+</span> Agregar
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-2">
      ${items.length === 0 ? `
        <p class="py-4 text-center text-sm text-text-muted">Sin habilidades blandas configuradas.</p>
      ` : items.map((item) => `
        <div class="group flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
             data-item-id="${escapeHtml(item.id)}">
          <input type="text" value="${escapeHtml(item.nombre)}"
            data-puesto-field="nombre" data-item-id="${escapeHtml(item.id)}"
            class="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}" />
          <select data-puesto-nivel data-item-id="${escapeHtml(item.id)}"
            class="w-36 rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}">
            <option value="1" ${item.nivel_requerido === 1 ? "selected" : ""}>1 — Basico</option>
            <option value="2" ${item.nivel_requerido === 2 ? "selected" : ""}>2 — Intermedio</option>
            <option value="3" ${item.nivel_requerido === 3 ? "selected" : ""}>3 — Avanzado</option>
            <option value="4" ${item.nivel_requerido === 4 ? "selected" : ""}>4 — Experto</option>
          </select>
          <button data-puesto-remove-item data-item-id="${escapeHtml(item.id)}" type="button"
            class="rounded p-1 text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
            aria-label="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `).join("")}
    </div>
  </section>`;
}
```

### 6.4 `perfilMaquinasHerramientas.ts`

```typescript
import type { MaquinaHerramienta } from "../../puestos/types.ts";
import { BTN_GHOST, FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderPerfilMaquinasHerramientas(items: MaquinaHerramienta[]): string {
  return `
  <section class="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-text-primary">Maquinas y Herramientas</h2>
      <button data-puesto-add-maquina type="button" class="${BTN_GHOST}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        Vincular equipo
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-2">
      ${items.length === 0 ? `
        <p class="py-4 text-center text-sm text-text-muted">Sin equipos vinculados.</p>
      ` : items.map((item) => `
        <div class="group flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
             data-item-id="${escapeHtml(item.id)}">
          <span class="text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" data-puesto-cert-toggle data-item-id="${escapeHtml(item.id)}"
                ${item.requiere_certificacion ? "checked" : ""}
                class="size-4 appearance-none rounded-sm border border-border checked:border-accent checked:bg-accent" />
              Requiere certificacion
            </label>
            <button data-puesto-remove-item data-item-id="${escapeHtml(item.id)}" type="button"
              class="rounded p-1 text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
              aria-label="Desvincular">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  </section>`;
}
```

### 6.5 `perfilIaRecomendaciones.ts`

```typescript
import type { IaRecomendacion } from "../../puestos/types.ts";
import { BTN_PRIMARY } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderPerfilIaRecomendaciones(items: IaRecomendacion[]): string {
  const pendientes = items.filter((r) => !r.aceptada);
  const emergentes = pendientes.filter((r) => r.tipo === "emergente");
  const sugerencias = pendientes.filter((r) => r.tipo !== "emergente");

  return `
  <aside class="rounded-xl border border-blue-100 bg-blue-50/30 p-4 shadow-sm sm:p-5">
    <div class="flex items-center gap-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-accent" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
      <h2 class="text-base font-semibold text-text-primary">Recomendaciones IA</h2>
    </div>
    <p class="mt-1 text-xs text-text-muted">Sugerencias basadas en el analisis del perfil y tendencias del sector.</p>

    ${sugerencias.length === 0 && emergentes.length === 0 ? `
      <p class="mt-4 text-center text-sm text-text-muted">Sin recomendaciones pendientes.</p>
    ` : ""}

    ${sugerencias.length > 0 ? `
      <div class="mt-4 flex flex-col gap-3">
        ${sugerencias.map((rec) => `
          <div class="rounded-lg border border-blue-200 bg-white p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium text-text-primary">${escapeHtml(rec.nombre)}</p>
                <p class="mt-0.5 text-xs text-text-secondary">${escapeHtml(rec.descripcion)}</p>
              </div>
              <span class="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                ${rec.confianza}%
              </span>
            </div>
            <button data-puesto-ia-aceptar data-rec-id="${escapeHtml(rec.id)}" type="button"
              class="mt-2 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover">
              Aceptar
            </button>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${emergentes.length > 0 ? `
      <div class="mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Competencias Emergentes</h3>
        <div class="mt-2 flex flex-col gap-2">
          ${emergentes.map((rec) => `
            <div class="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p class="text-sm font-medium text-text-primary">${escapeHtml(rec.nombre)}</p>
              <p class="mt-0.5 text-xs text-text-secondary">${escapeHtml(rec.descripcion)}</p>
              <button data-puesto-ia-aceptar data-rec-id="${escapeHtml(rec.id)}" type="button"
                class="mt-2 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover">
                Aceptar
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  </aside>`;
}
```

### 6.6 `perfilFooter.ts`

```typescript
import type { PerfilPuesto } from "../../puestos/types.ts";
import { escapeHtml, fmtFechaCorta } from "../../ui/uiUtils.ts";

export function renderPerfilFooter(perfil: PerfilPuesto): string {
  const fecha = perfil.ultima_actualizacion.slice(0, 10);
  return `
  <footer class="mt-2 flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
    <span>Version ${escapeHtml(perfil.version)}</span>
    <span>Ultima actualizacion: ${fmtFechaCorta(fecha)}</span>
  </footer>`;
}
```

---

## 7. Componentes — Matriz de Competencias

### 7.1 `matrizFilters.ts`

```typescript
import type { CompetenciasFilterState, CompetenciasFilterOptions } from "../../competencias/types.ts";
import { SELECT_CHEVRON, FIELD_FOCUS, FILTER_FIELD_WRAP, BTN_SECONDARY } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderMatrizFilters(
  filters: CompetenciasFilterState,
  options: CompetenciasFilterOptions,
): string {
  return `
  <section class="rounded-xl border border-border bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4">
    <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap">

      <!-- Area -->
      <div class="${FILTER_FIELD_WRAP}">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Area</label>
        <div class="relative grid grid-cols-1">
          <select data-comp-filter="area"
            class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm ${FIELD_FOCUS}">
            <option value="">Todas las areas</option>
            ${options.areas.map((a) => `
              <option value="${escapeHtml(a.id)}" ${filters.area_id === a.id ? "selected" : ""}>
                ${escapeHtml(a.label)}
              </option>
            `).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

      <!-- Linea -->
      <div class="${FILTER_FIELD_WRAP}">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Linea</label>
        <div class="relative grid grid-cols-1">
          <select data-comp-filter="linea"
            class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm ${FIELD_FOCUS}">
            <option value="">Todas las lineas</option>
            ${options.lineas.map((l) => `
              <option value="${escapeHtml(l.id)}" ${filters.linea_id === l.id ? "selected" : ""}>
                ${escapeHtml(l.label)}
              </option>
            `).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

      <!-- Sector -->
      <div class="${FILTER_FIELD_WRAP}">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Sector</label>
        <div class="relative grid grid-cols-1">
          <select data-comp-filter="sector"
            class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm ${FIELD_FOCUS}">
            <option value="">Todos los sectores</option>
            ${options.sectores.map((s) => `
              <option value="${escapeHtml(s.id)}" ${filters.sector_id === s.id ? "selected" : ""}>
                ${escapeHtml(s.label)}
              </option>
            `).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

      <!-- Edit Requirements button -->
      <div class="flex items-end">
        <button data-comp-edit-req type="button" class="${BTN_SECONDARY}">
          Editar Requisitos
        </button>
      </div>

    </div>
  </section>`;
}
```

### 7.2 `matrizLegend.ts`

```typescript
export function renderMatrizLegend(): string {
  const levels = [
    { n: 0, label: "N/A", cls: "bg-slate-100 text-slate-500" },
    { n: 1, label: "Basico", cls: "bg-blue-50 text-blue-700" },
    { n: 2, label: "Intermedio", cls: "bg-sky-50 text-sky-700" },
    { n: 3, label: "Avanzado", cls: "bg-emerald-50 text-emerald-700" },
    { n: 4, label: "Experto", cls: "bg-violet-50 text-violet-700" },
  ];

  return `
  <div class="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
    <span class="font-semibold text-text-muted">Niveles:</span>
    ${levels.map((l) => `
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-flex size-5 items-center justify-center rounded ${l.cls} text-xs font-bold">${l.n}</span>
        ${l.label}
      </span>
    `).join("")}
  </div>`;
}
```

### 7.3 `matrizTable.ts`

```typescript
import type { CompetenciasPageState, NivelMatriz } from "../../competencias/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const NIVEL_CELL_COLORS: Record<NivelMatriz, string> = {
  0: "bg-slate-50 text-slate-400",
  1: "bg-blue-50 text-blue-700",
  2: "bg-sky-50 text-sky-700",
  3: "bg-emerald-50 text-emerald-700",
  4: "bg-violet-50 text-violet-700",
};

function cellKey(comp_id: string, puesto_id: string): string {
  return `${comp_id}:${puesto_id}`;
}

export function renderMatrizTable(state: CompetenciasPageState): string {
  if (state.status === "loading") {
    return renderMatrizTableSkeleton();
  }
  if (state.competencias.length === 0 || state.puestos.length === 0) {
    return `<div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
      <p class="text-sm font-semibold text-text-primary">Sin datos de matriz</p>
      <p class="mt-1.5 text-xs text-text-muted">Selecciona un area con competencias configuradas.</p>
    </div>`;
  }

  const tecnicas = state.competencias.filter((c) => c.grupo === "tecnica");
  const blandas = state.competencias.filter((c) => c.grupo === "habilidad_blanda");

  function getNivel(comp_id: string, puesto_id: string): NivelMatriz {
    const key = cellKey(comp_id, puesto_id);
    if (state.celdasModificadas.has(key)) return state.celdasModificadas.get(key)!;
    const celda = state.celdas.find((c) => c.competencia_id === comp_id && c.puesto_id === puesto_id);
    return celda?.nivel ?? 0;
  }

  function isModified(comp_id: string, puesto_id: string): boolean {
    return state.celdasModificadas.has(cellKey(comp_id, puesto_id));
  }

  function renderCell(comp_id: string, puesto_id: string): string {
    const nivel = getNivel(comp_id, puesto_id);
    const modified = isModified(comp_id, puesto_id);
    const colorCls = NIVEL_CELL_COLORS[nivel];
    const modifiedRing = modified ? "ring-2 ring-amber-400 ring-inset" : "";
    return `
      <td class="px-2 py-1.5 text-center align-middle">
        <button data-comp-cell data-comp-id="${escapeHtml(comp_id)}" data-puesto-id="${escapeHtml(puesto_id)}"
          type="button"
          class="inline-flex size-8 items-center justify-center rounded text-sm font-bold transition hover:ring-2 hover:ring-accent/50 ${colorCls} ${modifiedRing}"
          title="Click para editar">
          ${nivel}
        </button>
      </td>`;
  }

  function renderGroupRows(label: string, items: typeof tecnicas): string {
    if (items.length === 0) return "";
    return `
      <tr>
        <td colspan="${state.puestos.length + 1}" class="bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          ${escapeHtml(label)}
        </td>
      </tr>
      ${items.map((comp) => `
        <tr class="border-b border-slate-100/80">
          <td class="whitespace-nowrap px-3 py-2 text-sm text-text-primary">${escapeHtml(comp.nombre)}</td>
          ${state.puestos.map((p) => renderCell(comp.id, p.id)).join("")}
        </tr>
      `).join("")}`;
  }

  return `
  <section class="rounded-xl border border-border bg-white shadow-sm ring-1 ring-slate-900/5">
    <div class="overflow-x-auto">
      <table class="min-w-[700px] w-full text-left">
        <thead class="border-b border-primary-light shadow-sm">
          <tr class="text-white">
            <th class="sticky top-0 z-20 bg-primary px-3 py-2 text-left text-xs font-semibold uppercase">
              Competencia
            </th>
            ${state.puestos.map((p) => `
              <th class="sticky top-0 z-20 bg-primary px-2 py-2 text-center text-xs font-semibold uppercase">
                ${escapeHtml(p.abreviacion ?? p.nombre)}
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${renderGroupRows("Tecnicas", tecnicas)}
          ${renderGroupRows("Habilidades Blandas", blandas)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderMatrizTableSkeleton(): string {
  const cols = 6;
  const rows = 6;
  return `
  <section class="rounded-xl border border-border bg-white p-4 shadow-sm">
    <div class="flex flex-col gap-2">
      <div class="h-8 w-full animate-pulse rounded bg-slate-200"></div>
      ${Array.from({ length: rows }, () => `
        <div class="flex gap-2">
          <div class="h-7 w-32 animate-pulse rounded bg-slate-100"></div>
          ${Array.from({ length: cols }, () => `<div class="h-7 w-12 animate-pulse rounded bg-slate-100"></div>`).join("")}
        </div>
      `).join("")}
    </div>
  </section>`;
}
```

### 7.4 `matrizSummaryCard.ts`

```typescript
import type { MatrizResumen } from "../../competencias/types.ts";

export function renderMatrizSummaryCard(resumen: MatrizResumen | null): string {
  if (!resumen) {
    return `<div class="h-32 animate-pulse rounded-xl border border-border bg-slate-100"></div>`;
  }

  // Progress bar color based on percentage
  const pct = resumen.porcentaje_cumplimiento;
  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-red-700";

  return `
  <article class="rounded-xl border border-border bg-white p-4 shadow-sm">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Resumen</h3>

    <div class="mt-3 flex items-baseline gap-1">
      <span class="text-3xl font-bold tabular-nums ${textColor}">${pct}%</span>
      <span class="text-sm text-text-muted">Cumplimiento</span>
    </div>

    <!-- Progress bar -->
    <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar"
         aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full rounded-full ${barColor} transition-all" style="width:${pct}%"></div>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3">
      <div>
        <dt class="text-xs text-text-muted">Empleados</dt>
        <dd class="text-lg font-bold tabular-nums text-text-primary">${resumen.total_empleados}</dd>
      </div>
      <div>
        <dt class="text-xs text-text-muted">Requisitos</dt>
        <dd class="text-lg font-bold tabular-nums text-text-primary">${resumen.total_requisitos}</dd>
      </div>
    </dl>
  </article>`;
}
```

### 7.5 `matrizGapsPanel.ts`

```typescript
import type { GapCritico } from "../../competencias/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderMatrizGapsPanel(gaps: GapCritico[]): string {
  if (gaps.length === 0) {
    return `
    <article class="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Gaps Criticos</h3>
      <p class="mt-3 text-sm text-text-muted">Sin gaps criticos detectados.</p>
    </article>`;
  }

  const topGaps = gaps.slice(0, 5);

  return `
  <article class="rounded-xl border border-border bg-white p-4 shadow-sm">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Gaps Criticos</h3>

    <div class="mt-3 flex flex-col gap-2.5">
      ${topGaps.map((g) => `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(g.competencia_nombre)}</p>
            <p class="text-xs text-text-muted">${escapeHtml(g.puesto_nombre)}</p>
          </div>
          <span class="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
            ${g.porcentaje_brecha}%
          </span>
        </div>
      `).join("")}
    </div>

    ${gaps.length > 5 ? `
      <a href="#/competencias/gaps" data-comp-gap-analizar
        class="mt-3 block text-center text-xs font-semibold text-accent hover:underline">
        Analizar todos los gaps (${gaps.length})
      </a>
    ` : ""}
  </article>`;
}
```

### 7.6 `matrizAuditAlert.ts`

```typescript
import type { AuditoriaInfo } from "../../competencias/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export function renderMatrizAuditAlert(info: AuditoriaInfo): string {
  const urgente = info.dias_restantes <= 14;
  const borderCls = urgente ? "border-amber-300" : "border-blue-200";
  const bgCls = urgente ? "bg-amber-50" : "bg-blue-50";
  const textCls = urgente ? "text-amber-900" : "text-blue-800";
  const iconCls = urgente ? "text-amber-600" : "text-blue-600";

  const tendenciaIcon = info.tendencia_vs_mes_anterior >= 0
    ? `<span class="text-emerald-600">+${info.tendencia_vs_mes_anterior}%</span>`
    : `<span class="text-red-600">${info.tendencia_vs_mes_anterior}%</span>`;

  return `
  <div class="rounded-xl border ${borderCls} ${bgCls} p-4">
    <div class="flex items-start gap-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0 ${iconCls}" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <div class="flex-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold ${textCls}">
            Proxima Auditoria en ${info.dias_restantes} dias — ${escapeHtml(info.nombre)}
          </p>
          <div class="flex items-center gap-3 text-xs">
            <span class="font-medium text-text-secondary">Meta trimestral: <strong>${info.meta_trimestral}%</strong></span>
            <span class="font-medium text-text-secondary">Tendencia: ${tendenciaIcon} vs mes anterior</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
```

---

## 8. Interaccion de la Tabla Matricial

### 8.1 Flujo click-to-edit

1. **Click en celda** (`data-comp-cell`): 
   - El handler extrae `data-comp-id` y `data-puesto-id` del boton.
   - Reemplaza el innerHTML del `<td>` padre por un `<input>`:
   ```html
   <input data-comp-cell-input data-comp-id="{cid}" data-puesto-id="{pid}"
     type="number" min="0" max="4" step="1"
     value="{nivelActual}"
     class="size-8 rounded border border-accent bg-white text-center text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
     autofocus />
   ```
   - Auto-selecciona el contenido del input.

2. **Blur o Enter** (`data-comp-cell-input`):
   - Lee el valor, clampa a 0-4 (`Math.max(0, Math.min(4, parseInt(val)))`).
   - Si difiere del valor original en `state.celdas`, agrega a `state.celdasModificadas`.
   - Si es igual al valor original, remueve de `celdasModificadas`.
   - Llama `paint()` que regenera toda la tabla con las celdas actualizadas.

3. **Escape** (en input): cancela sin cambio, `paint()`.

### 8.2 Guardado masivo (bulk save)

```typescript
async function handleSaveMatriz(): Promise<void> {
  if (state.celdasModificadas.size === 0) return;
  state.status = "saving";
  paint();

  const cambios = [...state.celdasModificadas.entries()].map(([key, nivel]) => {
    const [competencia_id, puesto_id] = key.split(":");
    return { competencia_id, puesto_id, nivel };
  });

  try {
    const response = await updateMatrizBulk({ cambios });
    state.celdas = response.celdas;
    state.resumen = response.resumen;
    state.gaps = response.gaps;
    state.celdasModificadas.clear();
    state.status = "ready";
    paint();
    showToast("Cambios guardados correctamente", "success");
  } catch (err) {
    state.status = "ready";
    state.errorMessage = (err as CompetenciasFetchError).detail;
    paint();
    showToast("Error al guardar cambios", "error");
  }
}
```

### 8.3 Feedback visual de cambios sin guardar

- **Celdas modificadas**: `ring-2 ring-amber-400 ring-inset` en el boton de la celda.
- **Counter en header**: `"3 cambios sin guardar"` en texto amber junto al boton Guardar.
- **Boton Guardar**: `disabled` cuando `celdasModificadas.size === 0`.
- **Navegacion protegida**: Si `celdasModificadas.size > 0` y el usuario intenta cambiar de ruta, mostrar `confirm("Tienes cambios sin guardar. Salir sin guardar?")`.

---

## 9. Integracion con Router

### 9.1 Rutas a agregar en `shellRouter.ts`

```typescript
// Agregar imports:
import { mountPuestos } from "./pages/puestos.ts";
import { mountCompetencias } from "./pages/competencias.ts";

// Agregar en funcion go(), ANTES del bloque de `empleados`:
if (h.startsWith("#/puestos")) {
  mountPuestos(container, signal);
  return;
}
if (h.startsWith("#/competencias")) {
  mountCompetencias(container, signal);
  return;
}
```

### 9.2 Actualizacion de `shellNavPolicy.ts`

```typescript
// Agregar al type AppShellNavItemId:
export type AppShellNavItemId =
  | "dashboard"
  | "organigrama"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "empleados"
  | "reportes"
  | "notificaciones"
  | "ajustes"
  | "puestos"          // NUEVO
  | "competencias";    // NUEVO

// Agregar al set de RH_ONLY_NAV_IDS (solo RH puede configurar):
const RH_ONLY_NAV_IDS: ReadonlySet<AppShellNavItemId> = new Set([
  "organigrama",
  "puestos",
  "competencias",
]);
```

### 9.3 Actualizacion de `pageTitles.ts`

Agregar reglas:
```typescript
{ match: (h) => h.startsWith("#/puestos"), titulo: "Perfiles de Puesto" },
{ match: (h) => h.startsWith("#/competencias"), titulo: "Matriz de Competencias" },
```

### 9.4 Items de navegacion en `appShell.ts`

Agregar dos entradas al array `NAV_PRIMARY` (o un nuevo grupo `NAV_TALENT`):

```typescript
{
  id: "puestos",
  key: "puestos",
  hrefFor: () => "#/puestos",
  label: "Perfiles de Puesto",
  svgPaths: `<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />`,
},
{
  id: "competencias",
  key: "competencias",
  hrefFor: () => "#/competencias",
  label: "Competencias",
  svgPaths: `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />`,
},
```

### 9.5 Control de acceso por rol

| Rol | `#/puestos` | `#/competencias` |
|---|---|---|
| `empleado` | Denegado (redirect `#/`) | Denegado |
| `supervisor` | Denegado | Solo lectura (celdas no-editables) |
| `gerente` | Denegado | Solo lectura |
| `rh` | Acceso completo | Acceso completo + edicion |
| `director` | Solo lectura | Solo lectura |

Implementar via:
- `shellNavPolicy.ts`: Ya cubierto con `RH_ONLY_NAV_IDS` para ocultar del nav.
- `empleadoMayAccessHash()`: agregar rechazo para `#/puestos` y `#/competencias`.
- `supervisorMayAccessHash()`: para competencias en solo-lectura, permitir acceso hash pero pasar flag `readonly` al mount.
- Dentro de `mountCompetencias`: detectar rol y pasar `editable: rol === "rh"` a los componentes.

---

## 10. Resumen de Tokens de Clase Clave (design.md)

| Uso | Clase |
|---|---|
| Card container | `rounded-xl border border-border bg-white p-4 shadow-sm` |
| Section title | `text-base font-semibold text-text-primary` |
| Form label | `mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted` |
| Text input | `block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}` |
| Table header | `sticky top-0 z-20 bg-primary px-3 py-2 text-left text-xs font-semibold uppercase text-white` |
| Table row | `border-b border-slate-100/80` (no hover en matrix, hover en listas) |
| Breadcrumb | `text-xs text-text-muted` + links con `hover:text-accent` |
| Unsaved indicator | `text-xs font-semibold text-amber-700` |
| Page title (H1) | `text-xl font-semibold tracking-tight text-text-primary sm:text-2xl` |
| Loading skeleton | `animate-pulse rounded-lg bg-slate-100` / `bg-slate-200` |
| Error banner | `rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800` |
| Empty state | `rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center` |

---

Este spec cubre los archivos exactos, tipos, firmas, estructura HTML con clases Tailwind, atributos de delegacion de eventos, secuencias de API, estados de carga/error/vacio, interaccion de la tabla matricial, y la integracion completa con el router y sistema de navegacion. Un desarrollador puede implementar directamente desde este documento sin ambiguedades funcionales.