import type { ComedorAlert, ComedorPanelState } from "../../comedor/rh/types.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

function alertLevelClasses(level: "critica" | "media" | "info"): string {
  if (level === "critica") return "border-red-200 bg-red-50 text-red-700";
  if (level === "media") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function renderAlertItem(alert: ComedorAlert): string {
  return `
    <li class="rounded-lg border px-3 py-2 ${alertLevelClasses(alert.level)}">
      <p class="text-xs font-semibold">${escapeComedorHtml(alert.titulo)}</p>
      <p class="mt-0.5 text-[11px]">${escapeComedorHtml(alert.detalle)}</p>
    </li>`;
}

export function renderComedorAlerts(
  state: ComedorPanelState,
  alerts: readonly ComedorAlert[] | null,
  errorMessage: string | null,
): string {
  if (state === "loading") {
    return `
      <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div class="animate-pulse">
          <div class="h-4 w-32 rounded bg-slate-100"></div>
          <div class="mt-3 space-y-2">
            <div class="h-14 rounded bg-slate-100"></div>
            <div class="h-14 rounded bg-slate-100"></div>
          </div>
        </div>
      </article>`;
  }

  if (state === "error") {
    return `
      <article class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
        <p class="font-semibold">No fue posible cargar alertas.</p>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-retry-sidebar class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </article>`;
  }

  if (state === "empty" || !alerts || alerts.length === 0) {
    return `
      <article class="rounded-2xl border border-border bg-white px-4 py-4 text-sm text-text-muted shadow-sm">
        <p class="font-semibold text-text-primary">Alertas operativas</p>
        <p class="mt-2">Sin incidencias activas.</p>
      </article>`;
  }

  return `
    <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-text-primary">Alertas operativas</h3>
        <span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">${alerts.length} alertas</span>
      </div>
      <ul class="mt-3 space-y-2">${alerts.map(renderAlertItem).join("")}</ul>
    </article>`;
}
