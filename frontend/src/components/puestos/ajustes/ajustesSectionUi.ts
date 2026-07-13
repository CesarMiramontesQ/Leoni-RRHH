import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_SURFACE,
} from "../../../ui/uiTokens.ts";

export const AJUSTES_ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
export const AJUSTES_ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
export const AJUSTES_ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;
export const AJUSTES_ICON_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 5.25h16.5M3.75 6.75h16.5"/></svg>`;

export const AJUSTES_TABLE_TH =
  "bg-[var(--color-grid-header-bg,#f8fafc)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-grid-header-text,#64748b)]";
export const AJUSTES_TABLE_TD = "px-4 py-3 text-sm text-text-primary";
export const AJUSTES_TABLE_TD_MUTED = "px-4 py-3 text-sm text-text-muted";
export const AJUSTES_TABLE_TD_ACTIONS = "px-3 py-3 text-right";
export const AJUSTES_ROW_BTN_EDIT =
  "rounded-md p-1.5 text-slate-500 transition hover:bg-active-tint hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
export const AJUSTES_ROW_BTN_DELETE =
  "rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40";

/** Iconos de dominio para cards de ajustes de puesto. */
export const AJUSTES_ICON_GRADES = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a.75.75 0 0 1 .75.75V3h3.5A2.75 2.75 0 0 1 17 5.75v8.5A2.75 2.75 0 0 1 14.25 17h-8.5A2.75 2.75 0 0 1 3 14.25v-8.5A2.75 2.75 0 0 1 5.75 3H9.25V1.75A.75.75 0 0 1 10 1Zm-3 8.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H7Zm0 3a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5H7Z" clip-rule="evenodd"/></svg>`;
export const AJUSTES_ICON_COMPETENCY = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1c.4 0 .77.2.98.53l1.79 2.86 3.3.48a1.13 1.13 0 0 1 .63 1.92l-2.39 2.33.56 3.29a1.13 1.13 0 0 1-1.64 1.19L10 12.62l-2.95 1.55a1.13 1.13 0 0 1-1.64-1.19l.56-3.29-2.39-2.33a1.13 1.13 0 0 1 .63-1.92l3.3-.48L9.02 1.53A1.13 1.13 0 0 1 10 1Z"/></svg>`;
export const AJUSTES_ICON_QUAL = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM6 6.75A.75.75 0 0 1 6.75 6h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 6.75ZM6.75 9a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5ZM6 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/></svg>`;
export const AJUSTES_ICON_SCALE = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.75 3A.75.75 0 0 0 2 3.75v12.5c0 .414.336.75.75.75h14.5a.75.75 0 0 0 0-1.5H3.5V4.5h4.75a.75.75 0 0 0 0-1.5H2.75Zm8.47 2.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 1 1 1.06-1.06l1.72 1.72 3.97-3.97a.75.75 0 0 1 0-1.06Z"/></svg>`;
export const AJUSTES_ICON_GROUP = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z"/></svg>`;
export const AJUSTES_ICON_TYPE = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/></svg>`;

export function ajustesCountBadge(count: number, loading = false): string {
  if (loading) {
    return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-muted">…</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">${count}</span>`;
}

export const AJUSTES_MODAL_OVERLAY = MODAL_OVERLAY;
export const AJUSTES_MODAL_PANEL = `${MODAL_PANEL} max-w-md p-6`;
export const AJUSTES_MODAL_PANEL_LG = `${MODAL_PANEL} max-w-lg p-6 max-h-[90vh] overflow-y-auto`;

export const AJUSTES_INPUT = FIELD_INPUT;
export const AJUSTES_TEXTAREA = FIELD_TEXTAREA;

export function ajustesLoadingState(message: string): string {
  return `<p class="px-4 py-8 text-center text-sm text-text-muted">${escapeHtml(message)}</p>`;
}

export function ajustesErrorAlert(message: string): string {
  return `<p class="mx-4 my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">${escapeHtml(message)}</p>`;
}

export function ajustesEmptyState(message: string, ctaHtml = ""): string {
  return `<div class="m-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
    <span class="flex size-11 items-center justify-center rounded-full bg-accent-light text-accent [&_svg]:size-5" aria-hidden="true">${AJUSTES_ICON_EMPTY}</span>
    <p class="max-w-sm text-sm leading-relaxed text-text-muted">${escapeHtml(message)}</p>
    ${ctaHtml ? `<div class="mt-1">${ctaHtml}</div>` : ""}
  </div>`;
}

export function ajustesModalError(message: string): string {
  return `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">${escapeHtml(message)}</p>`;
}

export function ajustesSectionCard(opts: {
  titleId: string;
  title: string;
  description: string;
  actionButtonHtml: string;
  bodyHtml: string;
  iconHtml?: string;
  badgeHtml?: string;
}): string {
  const icon = opts.iconHtml
    ? `<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:size-4" aria-hidden="true">${opts.iconHtml}</span>`
    : "";
  const badge = opts.badgeHtml
    ? `<span class="ml-2 inline-flex items-center">${opts.badgeHtml}</span>`
    : "";
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="${escapeHtml(opts.titleId)}">
      <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div class="flex min-w-0 items-start gap-3">
          ${icon}
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1">
              <h2 id="${escapeHtml(opts.titleId)}" class="text-base font-semibold text-text-primary">${escapeHtml(opts.title)}</h2>
              ${badge}
            </div>
            <p class="mt-0.5 text-sm text-text-muted">${escapeHtml(opts.description)}</p>
          </div>
        </div>
        <div class="shrink-0 self-stretch sm:self-center">${opts.actionButtonHtml}</div>
      </div>
      ${opts.bodyHtml}
    </section>`;
}

export function ajustesTableWrap(tableHtml: string): string {
  return `<div class="overflow-x-auto">${tableHtml}</div>`;
}

/** Disparado cuando cambia el catálogo de métodos de calificación (cualificaciones). */
export const AJUSTES_METODOS_CALIFICACION_CHANGED = "ajustes:metodos-calificacion-changed";

export function notifyAjustesMetodosCalificacionChanged(): void {
  document.dispatchEvent(new CustomEvent(AJUSTES_METODOS_CALIFICACION_CHANGED));
}

/** Disparado cuando cambia el catálogo de grupos de competencia. */
export const AJUSTES_GRUPOS_COMPETENCIA_CHANGED = "ajustes:grupos-competencia-changed";

export function notifyAjustesGruposCompetenciaChanged(): void {
  document.dispatchEvent(new CustomEvent(AJUSTES_GRUPOS_COMPETENCIA_CHANGED));
}
