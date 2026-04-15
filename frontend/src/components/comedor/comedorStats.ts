import type { ComedorKpi, ComedorPanelState } from "../../comedor/rh/types.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

function renderProgressBar(percent: number | undefined): string {
  if (typeof percent !== "number") return "";
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div class="mt-3 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
      <div class="h-full rounded-full bg-leoni-blue" style="width:${value}%"></div>
    </div>`;
}

function renderKpiCard(kpi: ComedorKpi): string {
  const trend = kpi.tendencia
    ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-xs">${escapeComedorHtml(kpi.tendencia)}</span>`
    : "";
  return `
    <article class="rounded-xl border border-border border-t-4 ${kpi.accentClass} bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeComedorHtml(kpi.titulo)}</p>
      <div class="mt-2 flex items-center justify-between gap-2">
        <p class="text-3xl font-bold tracking-tight text-text-primary">${escapeComedorHtml(kpi.valor)}</p>
        ${trend}
      </div>
      <p class="mt-1 text-xs text-text-muted">${escapeComedorHtml(kpi.descripcion)}</p>
      ${renderProgressBar(kpi.progressPercent)}
    </article>`;
}

function renderLoadingCards(): string {
  return Array.from({ length: 4 })
    .map(
      () => `
      <article class="animate-pulse rounded-xl border border-border bg-white p-4 shadow-sm">
        <div class="h-3 w-24 rounded bg-slate-100"></div>
        <div class="mt-3 h-8 w-20 rounded bg-slate-200"></div>
        <div class="mt-3 h-2 w-full rounded bg-slate-100"></div>
      </article>`,
    )
    .join("");
}

export function renderComedorStats(
  state: ComedorPanelState,
  kpis: readonly ComedorKpi[] | null,
  errorMessage: string | null,
  gridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
): string {
  if (state === "loading") {
    return `<section class="${gridClass}">${renderLoadingCards()}</section>`;
  }

  if (state === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p class="font-semibold">No fue posible cargar métricas del comedor.</p>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button
          type="button"
          data-comedor-retry-kpis
          class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      </section>`;
  }

  if (state === "empty" || !kpis || kpis.length === 0) {
    return `
      <section class="rounded-xl border border-border bg-white px-4 py-6 text-sm text-text-muted">
        No hay métricas disponibles para este periodo.
      </section>`;
  }

  return `<section class="${gridClass}">${kpis.map(renderKpiCard).join("")}</section>`;
}
