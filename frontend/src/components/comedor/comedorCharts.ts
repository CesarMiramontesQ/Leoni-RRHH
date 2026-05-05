import type {
  ComedorExternalCodesCard,
  ComedorPanelState,
  ComedorRhSemanaPlatilloPorSemana,
  ComedorWeekOccupancyPoint,
} from "../../comedor/rh/types.ts";
import { getRolFromAccessToken } from "../../auth/jwt.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

/** Barras apiladas por semana: parte inferior caseras, superior saludables (misma escala entre columnas). */
function renderRhPlatillosPorSemanaChart(rows: readonly ComedorRhSemanaPlatilloPorSemana[]): string {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const cols = rows
    .map((p) => {
      const barPct = p.total === 0 ? 6 : Math.max(10, Math.round((p.total / maxTotal) * 100));
      const stack =
        p.total === 0 ?
          `<div class="w-[85%] rounded-full bg-slate-200/90" style="height:4px" aria-hidden="true"></div>`
        : `<div class="flex w-[85%] max-w-15 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/90 shadow-inner" style="height:${barPct}%">
            <div class="min-h-0 w-full bg-linear-to-b from-emerald-400 to-emerald-600" style="flex:${Math.max(0, p.saludables)} 1 0"></div>
            <div class="min-h-0 w-full bg-linear-to-b from-sky-400 to-[#1e40af]" style="flex:${Math.max(0, p.caseras)} 1 0"></div>
          </div>`;
      return `
        <div class="flex min-w-0 flex-col items-center gap-1.5">
          <div class="flex h-28 w-full items-end justify-center px-0.5">${stack}</div>
          <p class="max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight text-slate-600" title="${escapeComedorHtml(p.label)}">${escapeComedorHtml(p.label)}</p>
          <p class="text-[10px] font-medium tabular-nums text-slate-500">${p.total} comidas</p>
        </div>`;
    })
    .join("");
  return `
    <div class="mt-4 space-y-3">
      <div class="grid grid-cols-4 gap-2 sm:gap-3">${cols}</div>
      <div class="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-100/90 pt-3 text-[11px] text-slate-600">
        <span class="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-2.5 py-1 font-medium text-sky-900">
          <span class="size-2.5 rounded-full bg-linear-to-br from-sky-400 to-[#1e40af] shadow-sm" aria-hidden="true"></span>Caseras
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 font-medium text-emerald-900">
          <span class="size-2.5 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 shadow-sm" aria-hidden="true"></span>Saludables
        </span>
      </div>
    </div>`;
}

function renderOccupancyBars(points: readonly ComedorWeekOccupancyPoint[]): string {
  return `
    <div class="mt-4 grid grid-cols-4 items-end gap-2 sm:gap-3">
      ${points
        .map(
          (point) => `
          <div class="flex flex-col items-center gap-1.5">
            <div class="flex h-28 w-full items-end rounded-xl border border-slate-100/90 bg-slate-50/90 p-1.5 shadow-inner">
              <div class="w-full rounded-lg bg-linear-to-t from-[#1e40af] to-sky-500 shadow-sm" style="height:${Math.max(4, Math.min(100, point.percent))}%"></div>
            </div>
            <p class="text-[10px] font-semibold text-slate-500">${escapeComedorHtml(point.label)}</p>
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
      <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
        <h3 class="text-sm font-semibold tracking-tight text-[#0f172a]">${tituloCarga}</h3>
        <p class="mt-1 text-xs text-[#64748b]">Cargando datos de la semana…</p>
        <div class="mt-4 h-32 animate-pulse rounded-xl bg-slate-100/90"></div>
      </article>`;
  }

  const seccionOcupacion = esRhGraficaPlatillosSemana
    ? `
      <section>
        <h3 class="text-sm font-semibold tracking-tight text-[#0f172a]">Distribución semanal de platillos</h3>
        <p class="mt-1 text-xs leading-relaxed text-[#64748b]">Últimas cuatro semanas: comidas caseras vs saludables (barras apiladas por semana).</p>
        ${renderRhPlatillosPorSemanaChart(rhPlatillosPorSemana!)}
      </section>`
    : `
      <section>
        <h3 class="text-sm font-semibold tracking-tight text-[#0f172a]">Ocupación por semana</h3>
        <p class="mt-1 text-xs text-[#64748b]">Participación relativa por semana.</p>
        ${renderOccupancyBars(weeklyOccupancy!)}</section>`;

  return `
    <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5 transition-[box-shadow,transform] duration-200 ease-out hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      ${seccionOcupacion}
    </article>`;
}

export function renderComedorExternalCodesCard(
  state: ComedorPanelState,
  card: ComedorExternalCodesCard | null,
): string {
  if (state !== "ready" || !card) {
    return `
      <article class="rh-comedor-external-codes-card relative overflow-hidden p-4 sm:p-5" aria-hidden="true">
        <div class="rh-comedor-external-codes-card__glow" aria-hidden="true"></div>
        <div class="relative animate-pulse space-y-2">
          <div class="h-3 w-40 rounded bg-white/20"></div>
          <div class="h-10 w-full max-w-sm rounded-lg bg-white/10"></div>
          <div class="h-9 w-44 rounded-lg bg-white/15"></div>
        </div>
      </article>`;
  }
  return `
    <article class="rh-comedor-external-codes-card relative overflow-hidden p-4 transition-[box-shadow,transform] duration-200 ease-out sm:p-5">
      <div class="rh-comedor-external-codes-card__glow" aria-hidden="true"></div>
      <div class="relative">
        <h3 class="text-sm font-semibold tracking-tight text-white">${escapeComedorHtml(card.titulo)}</h3>
        <p class="mt-2 text-sm leading-relaxed text-blue-100/95">${escapeComedorHtml(card.mensaje)}</p>
        <button type="button" data-comedor-external-codes-route="${escapeComedorHtml(card.ctaRoute)}" class="rh-comedor-external-codes-card__btn mt-4 inline-flex min-h-10 w-full min-[400px]:w-auto items-center justify-center rounded-[10px] px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#021b3a]">
          ${escapeComedorHtml(card.ctaLabel)}
        </button>
      </div>
    </article>`;
}
