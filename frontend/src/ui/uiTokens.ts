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
