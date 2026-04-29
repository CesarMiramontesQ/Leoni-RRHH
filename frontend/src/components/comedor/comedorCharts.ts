import type {
  ComedorDietDistribution,
  ComedorExternalCodesCard,
  ComedorPanelState,
  ComedorSuggestion,
  ComedorWeekOccupancyPoint,
} from "../../comedor/rh/types.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

function renderOccupancyBars(points: readonly ComedorWeekOccupancyPoint[]): string {
  return `
    <div class="mt-3 grid grid-cols-4 items-end gap-2">
      ${points
        .map(
          (point) => `
          <div class="flex flex-col items-center gap-1">
            <div class="flex h-24 w-full items-end rounded bg-slate-100 p-1">
              <div class="w-full rounded bg-leoni-blue" style="height:${Math.max(4, Math.min(100, point.percent))}%"></div>
            </div>
            <p class="text-[10px] font-medium text-slate-500">${escapeComedorHtml(point.label)}</p>
          </div>`,
        )
        .join("")}
    </div>`;
}

function renderDonut(distribution: ComedorDietDistribution): string {
  const healthy = Math.max(0, Math.min(100, Math.round(distribution.saludablePercent)));
  const regular = Math.max(0, Math.min(100, Math.round(distribution.regularPercent)));
  const gradient = `conic-gradient(#2563eb 0 ${healthy}%, #93c5fd ${healthy}% 100%)`;
  return `
    <div class="mt-3 flex items-center gap-3">
      <div class="relative grid size-20 place-items-center rounded-full" style="background:${gradient}">
        <div class="grid size-14 place-items-center rounded-full bg-white text-xs font-bold text-slate-700">${healthy}%</div>
      </div>
      <div class="space-y-1 text-xs">
        <p class="flex items-center gap-2 text-slate-600"><span class="size-2 rounded-full bg-blue-600"></span>Saludable ${healthy}%</p>
        <p class="flex items-center gap-2 text-slate-600"><span class="size-2 rounded-full bg-blue-300"></span>Regular ${regular}%</p>
      </div>
    </div>`;
}

export function renderComedorCharts(
  state: ComedorPanelState,
  weeklyOccupancy: readonly ComedorWeekOccupancyPoint[] | null,
  dietDistribution: ComedorDietDistribution | null,
): string {
  if (state !== "ready" || !weeklyOccupancy || !dietDistribution) {
    return `
      <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-text-primary">Ocupación por semana</h3>
        <div class="mt-3 h-28 rounded bg-slate-100"></div>
        <h3 class="mt-4 text-sm font-semibold text-text-primary">Distribución dieta</h3>
        <div class="mt-3 h-20 rounded bg-slate-100"></div>
      </article>`;
  }

  return `
    <article class="space-y-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <section>
        <h3 class="text-sm font-semibold text-text-primary">Ocupación por semana</h3>
        ${renderOccupancyBars(weeklyOccupancy)}
      </section>
      <section class="border-t border-slate-100 pt-3">
        <h3 class="text-sm font-semibold text-text-primary">Distribución dieta</h3>
        ${renderDonut(dietDistribution)}
      </section>
    </article>`;
}

export function renderComedorSuggestion(
  state: ComedorPanelState,
  suggestion: ComedorSuggestion | null,
): string {
  if (state !== "ready" || !suggestion) {
    return `
      <article class="rounded-2xl border border-border bg-linear-to-br from-blue-700 to-blue-800 p-4 text-white shadow-sm">
        <div class="h-20 animate-pulse rounded bg-white/10"></div>
      </article>`;
  }

  return `
    <article class="rounded-2xl border border-blue-500 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-4 text-white shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-blue-100">${escapeComedorHtml(suggestion.titulo)}</p>
      <p class="mt-2 text-sm leading-snug text-blue-50">${escapeComedorHtml(suggestion.mensaje)}</p>
      <button type="button" data-comedor-suggestion-route="${escapeComedorHtml(suggestion.ctaRoute ?? "")}" class="mt-3 inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
        ${escapeComedorHtml(suggestion.ctaLabel)}
      </button>
    </article>`;
}

export function renderComedorExternalCodesCard(
  state: ComedorPanelState,
  card: ComedorExternalCodesCard | null,
): string {
  if (state !== "ready" || !card) {
    return `
      <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div class="h-20 animate-pulse rounded bg-slate-100"></div>
      </article>`;
  }
  return `
    <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeComedorHtml(card.titulo)}</p>
      <p class="mt-2 text-sm leading-snug text-slate-600">${escapeComedorHtml(card.mensaje)}</p>
      <button type="button" data-comedor-external-codes-route="${escapeComedorHtml(card.ctaRoute)}" class="mt-3 inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
        ${escapeComedorHtml(card.ctaLabel)}
      </button>
    </article>`;
}
