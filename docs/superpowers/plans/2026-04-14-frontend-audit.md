# Frontend Audit — Consistencia Visual y UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar visualmente el frontend completo extrayendo utilidades duplicadas a módulos compartidos y estandarizando botones, badges, filtros y tablas en todos los módulos.

**Architecture:** Enfoque B por capas — primero se crean `src/ui/uiUtils.ts` y `src/ui/uiTokens.ts` como base compartida, luego cada módulo los importa y elimina sus definiciones locales duplicadas. No se toca lógica de negocio ni rutas.

**Tech Stack:** TypeScript + Tailwind CSS v4 + Vite — sin framework de componentes; HTML generado como template strings. Tests con Vitest (`npm test` en `frontend/`).

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `frontend/src/ui/uiUtils.ts` |
| Crear | `frontend/src/ui/uiTokens.ts` |
| Crear | `frontend/src/ui/uiUtils.test.ts` |
| Modificar | `frontend/src/components/incidencias/rhIncidenciasUiUtils.ts` |
| Modificar | `frontend/src/components/incidencias/rhIncidenciasFilters.ts` |
| Modificar | `frontend/src/components/incidencias/rhIncidenciasTable.ts` |
| Modificar | `frontend/src/components/incidencias/rhIncidenciasHeader.ts` |
| Modificar | `frontend/src/components/solicitudes/rhSolicitudesAdminView.ts` |
| Modificar | `frontend/src/pages/actas.ts` |
| Modificar | `frontend/src/pages/empleados.ts` |
| Modificar | `frontend/src/components/comedor/comedorUiUtils.ts` |
| Modificar | `frontend/src/components/comedor/comedorReservationsTable.ts` |

---

## Task 1: Crear `src/ui/uiUtils.ts`

**Files:**
- Create: `frontend/src/ui/uiUtils.ts`
- Create: `frontend/src/ui/uiUtils.test.ts`

- [ ] **Step 1: Escribir los tests primero**

Crear `frontend/src/ui/uiUtils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escapeHtml, fmtFechaCorta, paginationRange } from "./uiUtils.ts";

describe("escapeHtml", () => {
  it("escapa & < > \"", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
  it("cadena vacía", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("sin caracteres especiales", () => {
    expect(escapeHtml("hola mundo")).toBe("hola mundo");
  });
});

describe("fmtFechaCorta", () => {
  it("formatea 2025-01-15 en español MX", () => {
    const result = fmtFechaCorta("2025-01-15");
    expect(result).toContain("ene");
    expect(result).toContain("2025");
  });
  it("retorna el input original si el formato es inválido", () => {
    expect(fmtFechaCorta("no-es-fecha")).toBe("no-es-fecha");
    expect(fmtFechaCorta("")).toBe("");
  });
});

describe("paginationRange", () => {
  it("7 páginas o menos: devuelve todos los números", () => {
    expect(paginationRange(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });
  it("8+ páginas en el centro: muestra ellipsis en ambos lados", () => {
    const result = paginationRange(10, 5);
    expect(result[0]).toBe(1);
    expect(result).toContain("ellipsis");
    expect(result[result.length - 1]).toBe(10);
  });
  it("0 páginas devuelve []", () => {
    expect(paginationRange(0, 1)).toEqual([]);
  });
  it("página 1 de 10: no hay ellipsis al inicio", () => {
    const result = paginationRange(10, 1);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
  });
  it("página 10 de 10: no hay ellipsis al final", () => {
    const result = paginationRange(10, 10);
    expect(result[result.length - 1]).toBe(10);
    expect(result[result.length - 2]).toBe(9);
  });
});
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan**

```bash
cd "frontend" && npm test -- uiUtils
```

Resultado esperado: `FAIL` con "Cannot find module './uiUtils.ts'"

- [ ] **Step 3: Crear `frontend/src/ui/uiUtils.ts`**

```ts
/**
 * Utilidades de presentación puras compartidas por todos los módulos.
 * No importa nada del dominio ni de la app — solo strings.
 */

/** Escapa caracteres HTML. Reemplaza todas las copias locales de escapeHtml/escapeIncHtml/escapeComedorHtml. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Formatea fecha ISO 'YYYY-MM-DD' a string localizado en es-MX (ej: "15 ene. 2025"). */
export function fmtFechaCorta(iso: string): string {
  const p = iso.trim().split("-");
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return iso;
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Genera array de páginas con "ellipsis" para controles de paginación.
 * Ej: paginationRange(10, 5) → [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
export function paginationRange(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [];
  const push = (x: number | "ellipsis"): void => {
    if (out[out.length - 1] !== x) out.push(x);
  };
  push(1);
  if (currentPage > 3) push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) push(i);
  if (currentPage < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}
```

- [ ] **Step 4: Ejecutar tests — verificar que pasan**

```bash
cd "frontend" && npm test -- uiUtils
```

Resultado esperado: `PASS` — 3 suites, todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
cd "frontend/.." && git add frontend/src/ui/uiUtils.ts frontend/src/ui/uiUtils.test.ts
git commit -m "feat(ui): add shared uiUtils — escapeHtml, fmtFechaCorta, paginationRange"
```

---

## Task 2: Crear `src/ui/uiTokens.ts`

**Files:**
- Create: `frontend/src/ui/uiTokens.ts`

- [ ] **Step 1: Crear el archivo con todos los tokens**

Crear `frontend/src/ui/uiTokens.ts`:

```ts
/**
 * Tokens de Tailwind compartidos — constantes de clases CSS y helpers de badge.
 * Todos los módulos importan desde aquí en lugar de definir sus propias variantes.
 */
import { escapeHtml } from "./uiUtils.ts";

// ── Focus ring para inputs y selects ─────────────────────────────────────────
export const FIELD_FOCUS =
  "outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2";

// ── Chevron SVG para todos los <select> ──────────────────────────────────────
export const SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

// ── Botones ───────────────────────────────────────────────────────────────────
/** Acción principal (Nueva solicitud, Nueva incidencia, Nueva acta). */
export const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

/** Acción secundaria (Exportar, Cancelar en modal). */
export const BTN_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

/** Acción terciaria sin peso visual prominente (Limpiar filtros). */
export const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

/** Acción destructiva (Rechazar, Eliminar). */
export const BTN_DANGER =
  "inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2";

// ── Wrapper de campo de filtro (responsive) ───────────────────────────────────
export const FILTER_FIELD_WRAP =
  "min-w-0 w-full flex-1 basis-full sm:basis-[calc(50%-0.375rem)] lg:min-w-[9rem] lg:basis-0 xl:min-w-[7.75rem]";

// ── Badges de estado — patrón unificado: píldora + dot ───────────────────────
// Cada función recibe un label opcional para i18n.

/** Pendiente / Abierto transitorio que necesita atención (amber). */
export function badgePending(label = "Pendiente"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Aprobado / Firmado / Confirmado (emerald). */
export function badgeApproved(label = "Aprobado"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Rechazado / Crítico (red). */
export function badgeRejected(label = "Rechazado"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Cancelado / Cerrado sin resolución positiva (slate). */
export function badgeCancelled(label = "Cancelado"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"><span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Cambios solicitados / En revisión (sky). */
export function badgeChangesRequested(label = "Cambios solicitados"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900"><span class="size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Abierto / En curso activo (blue). */
export function badgeOpen(label = "Abierto"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900"><span class="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** En investigación / En proceso activo (amber). */
export function badgeInProgress(label = "En investigación"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** Override / Sobreescrito con resultado positivo (emerald, label diferente). */
export function badgeOverridden(label = "Override"): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
cd "frontend" && npx tsc --noEmit
```

Resultado esperado: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
cd "frontend/.." && git add frontend/src/ui/uiTokens.ts
git commit -m "feat(ui): add shared uiTokens — buttons, field focus, select chevron, badges"
```

---

## Task 3: Aplicar tokens a Incidencias

**Files:**
- Modify: `frontend/src/components/incidencias/rhIncidenciasUiUtils.ts`
- Modify: `frontend/src/components/incidencias/rhIncidenciasFilters.ts`
- Modify: `frontend/src/components/incidencias/rhIncidenciasTable.ts`
- Modify: `frontend/src/components/incidencias/rhIncidenciasHeader.ts`

- [ ] **Step 1: Reemplazar `rhIncidenciasUiUtils.ts`**

Reemplazar el contenido completo de `frontend/src/components/incidencias/rhIncidenciasUiUtils.ts`:

```ts
// Re-exportamos desde ui/ para que los importadores de este módulo no rompan.
export { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
export { FIELD_FOCUS as INC_FIELD_FOCUS, FILTER_FIELD_WRAP as INC_FILTERS_FIELD_WRAP } from "../../ui/uiTokens.ts";
```

- [ ] **Step 2: Actualizar imports en `rhIncidenciasFilters.ts`**

En `frontend/src/components/incidencias/rhIncidenciasFilters.ts`, reemplazar el import de la línea 6:

```ts
// ANTES:
import { escapeIncHtml, INC_FIELD_FOCUS, INC_FILTERS_FIELD_WRAP } from "./rhIncidenciasUiUtils.ts";
```

```ts
// DESPUÉS:
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS as INC_FIELD_FOCUS, FILTER_FIELD_WRAP as INC_FILTERS_FIELD_WRAP, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
```

Luego eliminar la constante `SELECT_CHEVRON` local (líneas 8-10) ya que ahora viene de `uiTokens.ts`.

- [ ] **Step 3: Actualizar `badgeEstadoFromRow` en `rhIncidenciasTable.ts` — eliminar uppercase en "cerrado"**

En `frontend/src/components/incidencias/rhIncidenciasTable.ts`, primero actualizar los imports al inicio del archivo:

```ts
// Agregar estas dos líneas a los imports existentes:
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { fmtFechaCorta } from "../../ui/uiUtils.ts";
import {
  badgeOpen,
  badgeInProgress,
  badgeCancelled,
} from "../../ui/uiTokens.ts";
```

Reemplazar la función `badgeEstadoFromRow` completa (líneas 66-82):

```ts
function badgeEstadoFromRow(row: RhIncidenciaTablaFila): string {
  switch (row.estado) {
    case "abierto":
      return badgeOpen("Abierto");
    case "en_investigacion":
      return badgeInProgress("En investigación");
    case "cerrado":
      return badgeCancelled("Cerrado");
    default:
      return escapeIncHtml(labelEstado(row.estado));
  }
}
```

Reemplazar la función `fmtFechaCorta` local (líneas 16-25) eliminándola por completo — ya se importa de `uiUtils.ts`.

Reemplazar la función `paginationRange` local (líneas 130-147) eliminándola por completo e importando de `uiUtils.ts`:

```ts
import { escapeHtml as escapeIncHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
```

Consolidar todos los imports de `uiUtils.ts` en una sola línea:

```ts
import { escapeHtml as escapeIncHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import { badgeOpen, badgeInProgress, badgeCancelled } from "../../ui/uiTokens.ts";
```

- [ ] **Step 4: Actualizar botones en `rhIncidenciasHeader.ts`**

En `frontend/src/components/incidencias/rhIncidenciasHeader.ts`, reemplazar el bloque de imports:

```ts
import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../../ui/uiTokens.ts";
```

Reemplazar el botón Exportar (la clase larga actual):

```ts
// ANTES — clase inline larga en rhIncidenciasHeader.ts:
class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-4 sm:py-2"

// DESPUÉS:
class="${BTN_SECONDARY}"
```

Reemplazar el botón Nueva incidencia:

```ts
// ANTES:
class="inline-flex items-center gap-1.5 rounded-lg bg-leoni-blue px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-4 sm:py-2"

// DESPUÉS:
class="${BTN_PRIMARY}"
```

- [ ] **Step 5: Verificar compilación**

```bash
cd "frontend" && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
cd "frontend/.." && git add frontend/src/components/incidencias/
git commit -m "refactor(incidencias): apply shared uiUtils and uiTokens — unify badges, buttons, remove duplicates"
```

---

## Task 4: Aplicar tokens a Solicitudes

**Files:**
- Modify: `frontend/src/components/solicitudes/rhSolicitudesAdminView.ts`

- [ ] **Step 1: Actualizar imports en `rhSolicitudesAdminView.ts`**

Al inicio del archivo, reemplazar los bloques de constantes locales `escapeHtml`, `FIELD_FOCUS`, `SELECT_CHEVRON`, `RH_SOL_FILTERS_FIELD_WRAP`:

```ts
// Agregar al bloque de imports existente, después de los imports de tipos:
import { escapeHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  FILTER_FIELD_WRAP,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_GHOST,
  badgePending,
  badgeApproved,
  badgeRejected,
  badgeCancelled,
  badgeChangesRequested,
  badgeOverridden,
} from "../../ui/uiTokens.ts";
```

- [ ] **Step 2: Eliminar definiciones locales duplicadas**

Eliminar del archivo las siguientes funciones/constantes locales (ya vienen de los imports):

1. La función `escapeHtml` (líneas 21-27)
2. La constante `FIELD_FOCUS` (líneas 29-30)  
3. La constante `SELECT_CHEVRON` (líneas 47-49)
4. La constante `RH_SOL_FILTERS_FIELD_WRAP` (líneas 33-34)
5. La función `filterFieldWrapClass` (líneas 37-45) — reemplazar todos sus usos por `FILTER_FIELD_WRAP` directamente
6. La función `fmtFechaCorta` (líneas 51-60)
7. La función `paginationRange` (líneas 118-135)

- [ ] **Step 3: Reemplazar `badgeEstado` con funciones de `uiTokens`**

Reemplazar la función completa `badgeEstado` (líneas 77-99):

```ts
function badgeEstado(e: RhSolicitudEstadoCodigo): string {
  switch (e) {
    case "pending":          return badgePending("Pendiente");
    case "approved":         return badgeApproved("Aprobado");
    case "rejected":         return badgeRejected("Rechazado");
    case "changes_requested":return badgeChangesRequested("Cambios solicitados");
    case "cancelled":        return badgeCancelled("Cancelado");
    case "overridden":       return badgeOverridden("Override");
    default:                 return escapeHtml(e);
  }
}
```

- [ ] **Step 4: Reemplazar botones del header de solicitudes**

Buscar en el archivo los botones con ids `rh-sol-nueva` y `rh-sol-export` y reemplazar sus clases:

```ts
// Botón exportar — reemplazar clase inline por:
class="${BTN_SECONDARY}"

// Botón nueva solicitud — reemplazar clase inline por:
class="${BTN_PRIMARY}"

// Botón limpiar filtros — reemplazar clase inline por:
class="${BTN_GHOST} w-full sm:w-auto"
```

- [ ] **Step 5: Verificar compilación y tests**

```bash
cd "frontend" && npx tsc --noEmit && npm test
```

Resultado esperado: sin errores de tipos, todos los tests en verde.

- [ ] **Step 6: Commit**

```bash
cd "frontend/.." && git add frontend/src/components/solicitudes/rhSolicitudesAdminView.ts
git commit -m "refactor(solicitudes): apply shared uiUtils and uiTokens — remove 7 local duplicates"
```

---

## Task 5: Aplicar tokens a Actas

**Files:**
- Modify: `frontend/src/pages/actas.ts`

- [ ] **Step 1: Actualizar imports en `actas.ts`**

Agregar al bloque de imports:

```ts
import { escapeHtml, fmtFechaCorta, paginationRange } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  FILTER_FIELD_WRAP,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_GHOST,
  badgeOpen,
  badgeInProgress,
  badgeApproved,
  badgeCancelled,
} from "../ui/uiTokens.ts";
```

- [ ] **Step 2: Eliminar definiciones locales duplicadas en `actas.ts`**

Eliminar:
1. La función `escapeHtml` local (líneas 76-82)
2. La función `fmtFechaCorta` local — junto con su helper `parseLocalDate` (líneas 101-117) — reemplazar todos los usos de `fmtFechaCorta` por el import de `uiUtils.ts`
3. La función `paginationRange` local (líneas 172-186)

- [ ] **Step 3: Reemplazar `badgeEstado` en `actas.ts` — unificar píldoras**

Reemplazar la función completa `badgeEstado` (líneas 212-224):

```ts
function badgeEstado(estado: ActaEstadoCodigo): string {
  switch (estado) {
    case "abierta":    return badgeOpen("Abierta");
    case "en_proceso": return badgeInProgress("En proceso");
    case "firmada":    return badgeApproved("Firmada");
    case "cerrada":    return badgeCancelled("Cerrada");
    default:           return escapeHtml(estado);
  }
}
```

- [ ] **Step 4: Reemplazar botones del header de actas**

Buscar los botones con ids `rh-actas-nueva` y `rh-actas-export` en el archivo y reemplazar sus clases inline por los tokens. Buscar el botón "Nueva acta" y "Exportar":

```ts
// Botón exportar:
class="${BTN_SECONDARY}"

// Botón nueva acta:
class="${BTN_PRIMARY}"

// Botón limpiar filtros:
class="${BTN_GHOST} w-full sm:w-auto"
```

- [ ] **Step 5: Reemplazar `SELECT_CHEVRON` inline en `renderSelectFilter`**

En la función `renderSelectFilter` de `actas.ts`, reemplazar el SVG inline del chevron por `${SELECT_CHEVRON}`. El SVG ocupa las líneas 310-312 del archivo.

- [ ] **Step 6: Reemplazar clases de focus en `renderSelectFilter` y el input de búsqueda**

En `renderSelectFilter`, el `<select>` tiene:
```
focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40
```

Reemplazar por `${FIELD_FOCUS}`.

En el input de búsqueda de empleado, misma sustitución.

- [ ] **Step 7: Unificar wrapper de filtros**

En `renderActasFilters`, los divs de campo usan `min-w-0 flex-1 basis-48 xl:basis-46`. Reemplazar por `${FILTER_FIELD_WRAP}` para consistencia con los demás módulos.

- [ ] **Step 8: Verificar compilación**

```bash
cd "frontend" && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
cd "frontend/.." && git add frontend/src/pages/actas.ts
git commit -m "refactor(actas): apply shared tokens — unify badges firmada/cerrada, buttons, remove duplicates"
```

---

## Task 6: Aplicar tokens a Empleados

**Files:**
- Modify: `frontend/src/pages/empleados.ts`

- [ ] **Step 1: Actualizar imports en `empleados.ts`**

Agregar al bloque de imports:

```ts
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FIELD_FOCUS, SELECT_CHEVRON } from "../ui/uiTokens.ts";
```

- [ ] **Step 2: Eliminar definiciones locales**

Eliminar:
1. La función `escapeHtml` local (líneas 24-30)
2. La función `paginationRange` local (líneas 63-79)

- [ ] **Step 3: Reemplazar botones de acción en la tabla de empleados**

Buscar en el archivo los botones de acción (Editar asignación, Ver perfil, Desactivar) y aplicar los tokens correspondientes:

```ts
// Botón editar / acción secundaria:
class="${BTN_SECONDARY}"

// Botón Nuevo empleado / acción primaria (si existe):
class="${BTN_PRIMARY}"
```

- [ ] **Step 4: Reemplazar `SELECT_CHEVRON` y `FIELD_FOCUS` inline**

Buscar en el archivo los SVGs de chevron inline y los strings de focus ring y reemplazarlos por `${SELECT_CHEVRON}` y `${FIELD_FOCUS}`.

- [ ] **Step 5: Verificar compilación y tests**

```bash
cd "frontend" && npx tsc --noEmit && npm test
```

Resultado esperado: sin errores, todos los tests verdes.

- [ ] **Step 6: Commit**

```bash
cd "frontend/.." && git add frontend/src/pages/empleados.ts
git commit -m "refactor(empleados): apply shared uiUtils and uiTokens — remove paginationRange and escapeHtml duplicates"
```

---

## Task 7: Aplicar tokens a Comedor

**Files:**
- Modify: `frontend/src/components/comedor/comedorUiUtils.ts`
- Modify: `frontend/src/components/comedor/comedorReservationsTable.ts`

- [ ] **Step 1: Actualizar `comedorUiUtils.ts` — eliminar `escapeComedorHtml` y `paginationRange` locales**

Reemplazar el contenido de `frontend/src/components/comedor/comedorUiUtils.ts`:

```ts
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

// Re-exportamos escapeHtml con el nombre legacy para no romper importadores.
export { escapeHtml as escapeComedorHtml } from "../../ui/uiUtils.ts";
export { paginationRange } from "../../ui/uiUtils.ts";

export function formatComedorMonthTitle(year: number, monthIndex: number): string {
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function addComedorMonths(year: number, monthIndex: number, delta: number): [number, number] {
  const dt = new Date(year, monthIndex + delta, 1);
  return [dt.getFullYear(), dt.getMonth()];
}

export function isoLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dietBadgeLabel(type: "normal" | "dieta"): string {
  return type === "dieta" ? "Dieta" : "Normal";
}

/** Badge de estado de reserva — unificado con la paleta global (píldora + dot). */
export function reservationStatusBadge(status: "confirmado" | "cancelado" | "pendiente"): string {
  if (status === "confirmado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml("Confirmado")}</span>`;
  }
  if (status === "cancelado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${escapeHtml("Cancelado")}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${escapeHtml("Pendiente")}</span>`;
}

export function reservationDietBadge(type: "normal" | "dieta"): string {
  if (type === "dieta") {
    return '<span class="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Dieta</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Normal</span>';
}

export function renderEmpleadoAvatarCell(
  empleadoNombre: string,
  empleadoNumero: string,
  avatarUrl: string | null,
): string {
  const display = formatNombreEmpleadoUi(empleadoNombre) || empleadoNombre || "Sin nombre";
  const initials = inicialesDesdeNombreDisplay(display);
  const avatar =
    avatarUrl && avatarUrl.trim()
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
      : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(initials)}</span>`;

  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(display)}</p>
        <p class="truncate text-xs text-slate-500">${escapeHtml(empleadoNumero)}</p>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Estandarizar tabla header en `comedorReservationsTable.ts`**

En `frontend/src/components/comedor/comedorReservationsTable.ts`, agregar import de `uiTokens`:

```ts
import { FIELD_FOCUS } from "../../ui/uiTokens.ts";
```

La función `th` usa `px-4 py-3 text-sm` mientras el estándar es `px-3 py-2 sm:px-4 text-xs font-semibold sm:text-sm`. Reemplazar:

```ts
// ANTES:
function th(label: string): string {
  return `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold text-white">${escapeComedorHtml(label)}</th>`;
}

// DESPUÉS:
function th(label: string): string {
  return `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold text-white sm:px-4 sm:text-sm">${escapeComedorHtml(label)}</th>`;
}
```

El input de búsqueda usa `focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2`. Reemplazar por `${FIELD_FOCUS}`.

- [ ] **Step 3: Verificar compilación**

```bash
cd "frontend" && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
cd "frontend/.." && git add frontend/src/components/comedor/
git commit -m "refactor(comedor): unify badges to pill+dot pattern, standardize table header padding, remove escapeComedorHtml duplicate"
```

---

## Task 8: Verificación final — build completo

**Files:** ninguno nuevo

- [ ] **Step 1: Ejecutar todos los tests**

```bash
cd "frontend" && npm test
```

Resultado esperado: todos los tests en verde.

- [ ] **Step 2: Ejecutar build de producción**

```bash
cd "frontend" && npm run build
```

Resultado esperado: `dist/` generado sin errores. Si hay errores de tipos, leerlos, ir al archivo indicado y corregir el import faltante.

- [ ] **Step 3: Verificar que no quedan duplicados**

```bash
# No debe haber función escapeHtml definida (solo importada) fuera de uiUtils.ts
grep -rn "function escapeHtml\|function escapeIncHtml\|function escapeComedorHtml" frontend/src/ --include="*.ts"

# No debe haber función paginationRange definida fuera de uiUtils.ts y comedorUiUtils.ts (este re-exporta)
grep -rn "function paginationRange" frontend/src/ --include="*.ts"

# No debe haber función fmtFechaCorta definida fuera de uiUtils.ts
grep -rn "function fmtFechaCorta" frontend/src/ --include="*.ts"
```

Resultado esperado:
- `escapeHtml` definida solo en `src/ui/uiUtils.ts`
- `paginationRange` definida solo en `src/ui/uiUtils.ts`
- `fmtFechaCorta` definida solo en `src/ui/uiUtils.ts`

- [ ] **Step 4: Commit final**

```bash
cd "frontend/.." && git add -A
git commit -m "chore: frontend audit complete — unified tokens, removed all duplicate utils"
```

---

## Resumen de cambios

| Categoría | Antes | Después |
|---|---|---|
| `escapeHtml` | 5 implementaciones distintas | 1 en `uiUtils.ts` |
| `paginationRange` | 4 implementaciones distintas | 1 en `uiUtils.ts` |
| `fmtFechaCorta` | 3 implementaciones distintas | 1 en `uiUtils.ts` |
| `FIELD_FOCUS` | 2 strings distintos | 1 en `uiTokens.ts` |
| `SELECT_CHEVRON` | 3 SVGs inline repetidos | 1 en `uiTokens.ts` |
| Botones primarios | `px-3 py-1.5 sm:px-4 sm:py-2` responsive | `px-4 py-2` fijo con `BTN_PRIMARY` |
| Badge `cerrado` (incidencias) | uppercase + `ring-1` | píldora + dot (consistente) |
| Badge `firmada`/`cerrada` (actas) | uppercase + `ring-1` | píldora + dot (consistente) |
| Badge `abierto` (incidencias/actas) | dot inline sin píldora | píldora + dot (consistente) |
| Badge comedor | uppercase bold | píldora + dot (consistente) |
| Table header comedor | `px-4 py-3 text-sm` | `px-3 py-2 sm:px-4 text-xs sm:text-sm` |
