import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_SURFACE,
} from "../../../ui/uiTokens.ts";

export const AJUSTES_ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
export const AJUSTES_ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
export const AJUSTES_ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;

export const AJUSTES_TABLE_TH =
  "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted";
export const AJUSTES_TABLE_TD = "px-4 py-3 text-sm text-text-primary";
export const AJUSTES_TABLE_TD_MUTED = "px-4 py-3 text-sm text-text-muted";
export const AJUSTES_TABLE_TD_ACTIONS = "px-3 py-3 text-right";
export const AJUSTES_ROW_BTN_EDIT =
  "rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40";
export const AJUSTES_ROW_BTN_DELETE =
  "rounded p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40";

export const AJUSTES_MODAL_OVERLAY =
  "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]";
export const AJUSTES_MODAL_PANEL =
  "w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_48px_rgba(15,23,42,0.18)]";
export const AJUSTES_MODAL_PANEL_LG =
  "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_48px_rgba(15,23,42,0.18)]";

export const AJUSTES_INPUT = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-text-primary shadow-sm placeholder:text-text-muted ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;
export const AJUSTES_TEXTAREA = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-text-primary shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

export function ajustesLoadingState(message: string): string {
  return `<p class="px-4 py-8 text-center text-sm text-text-muted">${escapeHtml(message)}</p>`;
}

export function ajustesErrorAlert(message: string): string {
  return `<p class="mx-4 my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">${escapeHtml(message)}</p>`;
}

export function ajustesEmptyState(message: string): string {
  return `<p class="px-4 py-8 text-center text-sm text-text-muted">${escapeHtml(message)}</p>`;
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
}): string {
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="${escapeHtml(opts.titleId)}">
      <div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div class="min-w-0">
          <h2 id="${escapeHtml(opts.titleId)}" class="text-base font-semibold text-text-primary">${escapeHtml(opts.title)}</h2>
          <p class="mt-0.5 text-sm text-text-muted">${escapeHtml(opts.description)}</p>
        </div>
        ${opts.actionButtonHtml}
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
