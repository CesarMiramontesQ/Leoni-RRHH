# Frontend Audit — Consistencia Visual y UX
**Fecha:** 2026-04-14  
**Stack:** Vanilla TypeScript + Tailwind CSS v4 + Vite  
**Alcance:** Todos los módulos del frontend (`src/`)

---

## Contexto

El frontend de Leoni RRHH genera HTML como template strings en TypeScript (sin framework de componentes). Los estilos usan Tailwind CSS v4 con design tokens propios definidos en `src/style.css`. El problema central es que cada módulo reimplementa sus propias versiones de funciones utilitarias, constantes de Tailwind y componentes de badge/botón, generando inconsistencias visuales graduales entre páginas.

---

## Objetivo

Unificar visualmente todo el frontend mediante un enfoque de capas (Enfoque B):

1. **Capa 0** — Crear infraestructura compartida (`uiTokens.ts`, `uiUtils.ts`)
2. **Capa 1** — Aplicar tokens a botones y badges en todos los módulos
3. **Capa 2** — Aplicar por módulo: solicitudes → incidencias → actas → empleados → comedor → dashboard
4. **Capa 3** — Ajustes de layout, espaciado y estados de interfaz

---

## Inconsistencias detectadas

### Duplicación técnica crítica

| Función/Constante | Archivos duplicados |
|---|---|
| `escapeHtml` | `rhSolicitudesAdminView.ts`, `actas.ts`, `empleados.ts`, `vista360/html.ts` |
| `paginationRange` | `empleados.ts`, `rhIncidenciasTable.ts` |
| `fmtFechaCorta` | `rhSolicitudesAdminView.ts`, `rhIncidenciasTable.ts` |
| `FIELD_FOCUS` / `INC_FIELD_FOCUS` | `rhSolicitudesAdminView.ts`, `rhIncidenciasUiUtils.ts` |
| `SELECT_CHEVRON` SVG | `rhSolicitudesAdminView.ts`, `rhIncidenciasFilters.ts` |
| `FILTER_FIELD_WRAP` variants | `rhSolicitudesAdminView.ts`, `rhIncidenciasFilters.ts` |

### Inconsistencias visuales por módulo

| Elemento | Incidencias | Solicitudes | Actas |
|---|---|---|---|
| Botón primario padding | `px-3 py-1.5 sm:px-4 sm:py-2` | `px-3 py-1.5 sm:px-4 sm:py-2` | variante ad-hoc |
| Badge "cerrado/rechazado" | uppercase + `ring-1` (distinto) | dot + píldora | dot + píldora |
| Badge "pendiente/abierto" | dot inline sin píldora | píldora amber con dot | — |
| KPI cards | `border-t-4` + icon implícito | `border-t-4` | `border-t-4` |
| Dashboard KPIs | icon accent cards (patrón distinto) | — | — |

---

## Diseño

### Capa 0 — Infraestructura compartida

#### `src/ui/uiUtils.ts`

Funciones de presentación puras que hoy están duplicadas:

```ts
/** Escapa caracteres HTML peligrosos. Reemplaza las 4+ copias locales. */
export function escapeHtml(s: string): string

/** Formatea fecha ISO 'YYYY-MM-DD' a string localizado en es-MX. */
export function fmtFechaCorta(iso: string): string

/** Genera array de páginas con ellipsis para paginación. */
export function paginationRange(totalPages: number, currentPage: number): (number | "ellipsis")[]
```

#### `src/ui/uiTokens.ts`

Constantes de Tailwind compartidas:

```ts
// Focus ring — inputs y selects
export const FIELD_FOCUS: string

// Chevron SVG para todos los <select>
export const SELECT_CHEVRON: string

// Botones
export const BTN_PRIMARY: string    // bg-leoni-blue, texto blanco
export const BTN_SECONDARY: string  // border slate, bg white, hover leoni-blue
export const BTN_GHOST: string      // sin border, hover bg-slate-100
export const BTN_DANGER: string     // bg-red-600, texto blanco

// Wrapper de campo de filtro (responsive)
export const FILTER_FIELD_WRAP: string

// Badges de estado — paleta unificada (patrón: píldora + dot)
export const BADGE: {
  pending: string        // amber
  approved: string       // emerald
  rejected: string       // red
  cancelled: string      // slate
  changes_requested: string  // sky
  en_investigacion: string   // amber
  abierto: string        // blue
  cerrado: string        // slate/emerald según contexto
  overridden: string     // emerald
}
```

---

### Capa 1 — Botones y Badges

#### Botones — estándar unificado

| Tipo | Uso | Token |
|---|---|---|
| Primario | Acción principal (Nueva solicitud, Nueva incidencia, Nueva acta) | `BTN_PRIMARY` |
| Secundario | Acción secundaria (Exportar, Cancelar) | `BTN_SECONDARY` |
| Ghost | Acciones terciarias (Limpiar filtros, nav interno) | `BTN_GHOST` |
| Peligro | Acciones destructivas (Rechazar, Eliminar) | `BTN_DANGER` |

Todos tienen `inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2` como base. El padding responsivo (`px-3 py-1.5 sm:px-4 sm:py-2`) se elimina — padding fijo en todos.

#### Badges de estado — patrón único

Patrón unificado para todos los módulos: **píldora con dot interior**.

```html
<span class="inline-flex items-center gap-1.5 rounded-full border border-{color}-200 bg-{color}-50 px-2 py-0.5 text-xs font-semibold text-{color}-900">
  <span class="size-1.5 shrink-0 rounded-full bg-{color}-400" aria-hidden="true"></span>
  {label}
</span>
```

| Estado | Color |
|---|---|
| `pending` / `abierto` | Blue (abierto) / Amber (pendiente) |
| `approved` / `firmado` / `cerrado` positivo | Emerald |
| `rejected` | Red |
| `cancelled` | Slate |
| `changes_requested` | Sky |
| `en_investigacion` | Amber |
| `overridden` | Emerald |

Se elimina la excepción de `cerrado` uppercase con `ring-1` en incidencias.

---

### Capa 2 — Módulos (orden de aplicación)

#### 1. Solicitudes (`rhSolicitudesAdminView.ts`)
- Importar desde `uiTokens.ts`: `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_GHOST`, `FIELD_FOCUS`, `SELECT_CHEVRON`, `FILTER_FIELD_WRAP`
- Importar desde `uiUtils.ts`: `escapeHtml`, `fmtFechaCorta`
- Eliminar definiciones locales duplicadas
- Unificar badges de estado con paleta global
- Estandarizar `filterFieldWrapClass()` usando `FILTER_FIELD_WRAP`

#### 2. Incidencias (`rhIncidenciasFilters.ts`, `rhIncidenciasTable.ts`, `rhIncidenciasUiUtils.ts`)
- Importar desde `uiTokens.ts` y `uiUtils.ts`
- Eliminar `INC_FIELD_FOCUS`, `INC_FILTERS_FIELD_WRAP`, `SELECT_CHEVRON` locales
- Badge `cerrado`: cambiar de uppercase+ring a píldora con dot
- Badge `abierto`/`en_investigacion`: mantener dot, agregar píldora wrapper para consistencia

#### 3. Actas (`pages/actas.ts`)
- Importar tokens y utils
- Botones header: `BTN_PRIMARY` / `BTN_SECONDARY`
- KPI cards: mantener `border-t-4` (patrón correcto), estandarizar colores con incidencias
- Tabla: padding, hover y header `bg-leoni-blue` igual que incidencias
- Paginación: misma estructura que incidencias/solicitudes

#### 4. Empleados (`pages/empleados.ts`)
- Eliminar `paginationRange` local → `uiUtils.ts`
- Eliminar `escapeHtml` local → `uiUtils.ts`
- Botones de acción (editar, desactivar): pasar a tokens
- Tabla: estandarizar header, padding de filas y hover

#### 5. Comedor (componentes en `src/components/comedor/`)
- Revisar botones, badges de estado de reservas
- Filtros y tabla de reservaciones: aplicar `FILTER_FIELD_WRAP`, `FIELD_FOCUS`, `SELECT_CHEVRON`
- Estandarizar con paleta global

#### 6. Dashboard (`src/components/dashboard/`)
- KPI cards tipo "icon accent": **mantener** el patrón diferente (es intencional en el dashboard)
- Botones de acceso rápido: pasar a tokens
- Cards operacionales: verificar padding interno consistente

---

### Capa 3 — Layout, espaciado y estados

#### Tabla — estándar unificado

| Elemento | Clase |
|---|---|
| Contenedor | `rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5` |
| Header bg | `bg-leoni-blue text-white` |
| Header padding | `px-3 py-2 sm:px-4` |
| Header font | `text-xs font-semibold sm:text-sm` |
| Row padding | `px-3 py-2.5 sm:px-4` |
| Row hover | `hover:bg-slate-100/90` |
| Divider | `divide-y divide-slate-100/90` |

#### Espaciado entre bloques

| Separación | Clase |
|---|---|
| Header → primer bloque | `gap-3 sm:gap-4` (en el flex container root) |
| Filtros → tabla | `gap-3 sm:gap-4` |
| KPI cards → filtros | `gap-3 sm:gap-4` |
| Cards KPI internas | `p-3 sm:p-4` |

#### Estados de interfaz

| Estado | Patrón |
|---|---|
| Loading spinner | `<svg class="size-5 animate-spin text-leoni-blue">` + texto "Cargando…" |
| Empty state | `py-10 text-center text-sm text-slate-500` |
| Error banner | `border-red-100 bg-red-50 text-red-800` arriba + mensaje centrado abajo |
| Disabled | `disabled:cursor-not-allowed disabled:opacity-40` |

#### Responsive

- Tablas mobile: `overflow-x-auto -mx-4 sm:mx-0` (ya implementado — verificar en todos)
- Modales: `max-h-[90dvh] overflow-y-auto` en contenedor interno
- Filtros: wrap responsivo con `FILTER_FIELD_WRAP` unificado

---

## Restricciones

- No cambiar lógica de negocio ni flujos funcionales
- No renombrar rutas, módulos o entidades
- No agregar estilos ad-hoc por página si el problema es de componentes compartidos
- Dashboard KPI cards de tipo "icon accent" se mantienen — son intencionalmente distintas al ser el dashboard principal
- No hardcodear colores que ya existen como design tokens en `style.css`

---

## Criterios de éxito

- `escapeHtml`, `paginationRange`, `fmtFechaCorta` existen en un solo lugar
- `FIELD_FOCUS`, `SELECT_CHEVRON`, `BTN_*`, `FILTER_FIELD_WRAP` definidos en `uiTokens.ts`
- Todos los módulos importan desde `uiTokens.ts` / `uiUtils.ts`
- El badge de `cerrado` en incidencias usa el mismo patrón que `rejected` en solicitudes
- Todas las tablas tienen header `bg-leoni-blue`, padding uniforme y hover consistente
- Los botones primario/secundario tienen el mismo padding en todos los módulos
- Los estados loading/empty/error usan el mismo lenguaje visual en todos los módulos

---

## Archivos a crear

- `src/ui/uiUtils.ts`
- `src/ui/uiTokens.ts`

## Archivos a modificar

- `src/components/solicitudes/rhSolicitudesAdminView.ts`
- `src/components/incidencias/rhIncidenciasFilters.ts`
- `src/components/incidencias/rhIncidenciasTable.ts`
- `src/components/incidencias/rhIncidenciasUiUtils.ts`
- `src/components/incidencias/rhIncidenciasHeader.ts`
- `src/pages/actas.ts`
- `src/pages/empleados.ts`
- `src/components/comedor/` (archivos relevantes)
- `src/components/dashboard/` (archivos relevantes)
