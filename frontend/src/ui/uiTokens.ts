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

/** Acción destructiva secundaria, tonal (Deshabilitar, Quitar) — alineada a `RH_LISTADO_BTN_*`. */
export const RH_LISTADO_BTN_DANGER =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2";

// ── Wrapper de campo de filtro (responsive) ───────────────────────────────────
export const FILTER_FIELD_WRAP =
  "min-w-0 w-full flex-1 basis-full sm:basis-[calc(50%-0.375rem)] lg:min-w-[9rem] lg:basis-0 xl:min-w-[7.75rem]";

// ── Encabezado de página (título + subtítulo) ────────────────────────────────
/** Encabezado de página consistente: título H1 y subtítulo opcional. */
export function pageHeading(title: string, subtitle?: string): string {
  return `<header class="flex flex-col gap-2">
    <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="max-w-2xl text-sm leading-relaxed text-text-secondary">${escapeHtml(subtitle)}</p>` : ""}
  </header>`;
}

// ── Encabezado de tabla estándar (thead) ─────────────────────────────────────
/** `<thead>` consistente: borde inferior, fondo claro, texto micro en mayúsculas. */
export const RH_TABLE_HEAD =
  "border-b border-slate-200 bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500";

// ── Alertas en bloque (status / error) ───────────────────────────────────────
/** Mensaje de éxito (emerald). */
export function alertSuccess(message: string, role = "status"): string {
  return `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="${role}">${escapeHtml(message)}</div>`;
}

/** Mensaje de error (red). */
export function alertError(message: string, role = "alert"): string {
  return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="${role}">${escapeHtml(message)}</div>`;
}

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

// ── Vistas listado RH (Actas, Incidencias, Solicitudes, Empleados) ───────────
/** Contenedor principal: fondo gris-azulado y ancho máximo alineado a Actas. */
export const RH_LISTADO_PAGE_OUTER =
  "mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col gap-5 bg-[#f6f8fb] px-2 pb-2 sm:gap-6 sm:px-3";

/**
 * Mismo layout que `RH_LISTADO_PAGE_OUTER`, sin fondo plano (p. ej. sobre `.rh-dashboard-page`).
 */
export const RH_LISTADO_PAGE_OUTER_GRADIENT =
  "mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col gap-5 px-2 pb-2 sm:gap-6 sm:px-3";

/**
 * Envoltorio full-bleed con degradado (`.rh-dashboard-page`).
 * Cancela y reaplica el padding horizontal de `<main>` (`px-4 sm:px-6 lg:px-8`).
 */
export const RH_DASHBOARD_PAGE_SHELL =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

/** Tarjeta / panel estándar: borde suave, sombra institucional. */
export const RH_LISTADO_SURFACE =
  "rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

export const RH_LISTADO_BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-[10px] bg-[#1e40af] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

export const RH_LISTADO_BTN_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1e40af]/40 hover:bg-slate-50 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

export const RH_LISTADO_BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#1e40af]/40 hover:bg-slate-50 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

/** Botones listado Solicitudes (jerarquía + estilos `rh-sol-btn-*` en style.css). */
export const RH_SOLICITUDES_BTN_PRIMARY = `${RH_LISTADO_BTN_PRIMARY} rh-sol-btn-primary`;
export const RH_SOLICITUDES_BTN_SECONDARY = `${RH_LISTADO_BTN_SECONDARY} rh-sol-btn-secondary`;

export const RH_LISTADO_LABEL = "mb-1 block text-xs font-medium text-[#667085]";

export const RH_LISTADO_SELECT =
  "col-start-1 row-start-1 w-full appearance-none rounded-[10px] border border-[#e5e7eb] bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm";

export const RH_LISTADO_FOCUS_RING =
  "focus:border-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

/** Alias corto para nuevas vistas (mismo valor que RH_LISTADO_*). */
export const RH_PAGE_OUTER = RH_LISTADO_PAGE_OUTER;
export const RH_SURFACE_CARD = RH_LISTADO_SURFACE;

/**
 * Panel homogéneo de “acceso restringido” (amber, sin romper flujos existentes).
 */
export function htmlAccessDenied(opts: {
  title: string;
  description: string;
  linkHref?: string;
  linkLabel?: string;
}): string {
  const linkHtml =
    opts.linkHref && opts.linkLabel
      ? `<a href="${escapeHtml(opts.linkHref)}" class="mt-4 inline-flex font-semibold text-[#1e40af] transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2">${escapeHtml(opts.linkLabel)}</a>`
      : "";
  return `
    <div class="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 px-5 py-5 text-sm text-amber-950 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <p class="font-semibold text-[#111827]">${escapeHtml(opts.title)}</p>
      <p class="mt-1.5 leading-snug text-amber-950/90">${escapeHtml(opts.description)}</p>
      ${linkHtml}
    </div>`;
}
