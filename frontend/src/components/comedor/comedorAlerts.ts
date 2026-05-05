import type { ComedorAlert, ComedorPanelState } from "../../comedor/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

function alertLevelClasses(level: "critica" | "media" | "info"): string {
  if (level === "critica") return "border-red-200/90 bg-linear-to-br from-red-50 to-rose-50 text-red-900";
  if (level === "media") return "border-amber-200/90 bg-linear-to-br from-amber-50 to-orange-50 text-amber-950";
  return "border-sky-200/90 bg-linear-to-br from-sky-50 to-blue-50 text-sky-950";
}

function renderAlertItem(alert: ComedorAlert): string {
  return `
    <li class="rounded-xl border px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] ${alertLevelClasses(alert.level)}">
      <p class="text-xs font-semibold">${escapeComedorHtml(alert.titulo)}</p>
      <p class="mt-0.5 text-[11px] leading-snug opacity-95">${escapeComedorHtml(alert.detalle)}</p>
    </li>`;
}

export function renderComedorAlerts(
  state: ComedorPanelState,
  alerts: readonly ComedorAlert[] | null,
  errorMessage: string | null,
): string {
  if (state === "loading") {
    return `
      <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
        <div class="animate-pulse space-y-3">
          <div class="h-4 w-40 rounded-lg bg-slate-100"></div>
          <div class="h-16 rounded-xl bg-slate-100"></div>
          <div class="h-16 rounded-xl bg-slate-100"></div>
        </div>
      </article>`;
  }

  if (state === "error") {
    return `
      <article class="rounded-2xl border border-red-200/90 bg-white px-4 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <p class="font-semibold text-red-900">No fue posible cargar alertas.</p>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-retry-sidebar class="mt-3 inline-flex min-h-10 items-center rounded-[10px] border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2">
          Reintentar
        </button>
      </article>`;
  }

  if (state === "empty" || !alerts || alerts.length === 0) {
    return `
      <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5" role="status">
        <h3 class="text-sm font-semibold tracking-tight text-[#0f172a]">Alertas operativas</h3>
        <div class="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-8 text-center">
          <span class="mb-2 inline-flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </span>
          <p class="text-sm font-medium text-[#475569]">Sin incidencias activas.</p>
          <p class="mt-1 max-w-xs text-xs leading-relaxed text-[#94a3b8]">No hay alertas que requieran atención en este momento.</p>
        </div>
      </article>`;
  }

  return `
    <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5 transition-[box-shadow] duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <div class="flex items-center justify-between gap-2 border-b border-slate-100/90 pb-3">
        <h3 class="text-sm font-semibold tracking-tight text-[#0f172a]">Alertas operativas</h3>
        <span class="inline-flex items-center rounded-full border border-red-200/80 bg-linear-to-r from-red-50 to-orange-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">${alerts.length} alertas</span>
      </div>
      <ul class="mt-3 space-y-2">${alerts.map(renderAlertItem).join("")}</ul>
    </article>`;
}
