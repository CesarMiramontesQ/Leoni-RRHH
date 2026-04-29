import type {
  ComedorExternalCodesCard,
  ComedorPanelState,
  ComedorRhSemanaPlatilloPorSemana,
  ComedorSuggestion,
  ComedorWeekOccupancyPoint,
} from "../../comedor/rh/types.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

/** Barras apiladas por semana: parte inferior caseras, superior saludables (misma escala entre columnas). */
function renderRhPlatillosPorSemanaChart(rows: readonly ComedorRhSemanaPlatilloPorSemana[]): string {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const cols = rows
    .map((p) => {
      const barPct = p.total === 0 ? 6 : Math.max(10, Math.round((p.total / maxTotal) * 100));
      const stack =
        p.total === 0 ?
          `<div class="w-[85%] rounded bg-slate-200" style="height:4px" aria-hidden="true"></div>`
        : `<div class="flex w-[85%] max-w-15 flex-col overflow-hidden rounded-md border border-slate-100 bg-slate-50 shadow-inner" style="height:${barPct}%">
            <div class="min-h-0 w-full bg-emerald-500" style="flex:${Math.max(0, p.saludables)} 1 0"></div>
            <div class="min-h-0 w-full bg-leoni-blue" style="flex:${Math.max(0, p.caseras)} 1 0"></div>
          </div>`;
      return `
        <div class="flex min-w-0 flex-col items-center gap-1">
          <div class="flex h-24 w-full items-end justify-center px-0.5">${stack}</div>
          <p class="max-w-full truncate px-0.5 text-center text-[10px] font-medium leading-tight text-slate-600" title="${escapeComedorHtml(p.label)}">${escapeComedorHtml(p.label)}</p>
          <p class="text-[9px] tabular-nums text-slate-500">${p.total} comidas</p>
        </div>`;
    })
    .join("");
  return `
    <div class="mt-3 space-y-2">
      <div class="grid grid-cols-4 gap-1 sm:gap-2">${cols}</div>
      <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
        <span class="inline-flex items-center gap-1"><span class="size-2 rounded-sm bg-leoni-blue"></span>Caseras</span>
        <span class="inline-flex items-center gap-1"><span class="size-2 rounded-sm bg-emerald-500"></span>Saludables</span>
      </div>
    </div>`;
}

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

export function renderComedorCharts(
  state: ComedorPanelState,
  weeklyOccupancy: readonly ComedorWeekOccupancyPoint[] | null,
  rhPlatillosPorSemana: readonly ComedorRhSemanaPlatilloPorSemana[] | null | undefined,
): string {
  const esRhGraficaPlatillosSemana =
    getRolFromAccessToken() === "rh" &&
    rhPlatillosPorSemana != null &&
    rhPlatillosPorSemana.length > 0;

  if (state !== "ready" || (!esRhGraficaPlatillosSemana && !weeklyOccupancy)) {
    const tituloCarga =
      getRolFromAccessToken() === "rh" ? "Distribución semanal de platillos" : "Ocupación por semana";
    return `
      <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-text-primary">${tituloCarga}</h3>
        <div class="mt-3 h-28 rounded bg-slate-100"></div>
      </article>`;
  }

  const seccionOcupacion = esRhGraficaPlatillosSemana
    ? `
      <section>
        <h3 class="text-sm font-semibold text-text-primary">Distribución semanal de platillos</h3>
        <p class="mt-0.5 text-xs text-text-muted">Últimas cuatro semanas: comidas caseras vs saludables (barras apiladas por semana).</p>
        ${renderRhPlatillosPorSemanaChart(rhPlatillosPorSemana!)}
      </section>`
    : `
      <section>
        <h3 class="text-sm font-semibold text-text-primary">Ocupación por semana</h3>
        ${renderOccupancyBars(weeklyOccupancy!)}</section>`;

  return `
    <article class="rounded-2xl border border-border bg-white p-4 shadow-sm">
      ${seccionOcupacion}
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
