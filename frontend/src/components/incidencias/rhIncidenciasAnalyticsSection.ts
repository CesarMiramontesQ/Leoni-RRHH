import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import {
  renderIncidenciasAreasBarChart,
  renderIncidenciasDonutPorTipo,
  renderIncidenciasTendenciaPorMes,
} from "./rhIncidenciasCharts.ts";
import { RH_LISTADO_SURFACE } from "./rhIncidenciasPageStyles.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

const TOP = 5;

const CARD =
  `${RH_LISTADO_SURFACE} rh-inc-analytics-card flex min-h-0 flex-col rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-4`;

/** Misma base que solicitudes RH (`rhSolicitudesAdminView`) para que apliquen las variantes `.rh-sol-kpi-card--*`. Icono centrado, tamaño moderado. */
const KPI_ICON_WRAP =
  "rh-sol-kpi-card__icon flex size-10 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_10px_rgba(15,23,42,0.05)]";

const ICO_TOTAL = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3.75A2.25 2.25 0 0 1 12 6v3.75A2.25 2.25 0 0 1 9.75 12H6A2.25 2.25 0 0 1 3.75 9.75V6ZM14.25 8.25h6M14.25 12h6M3.75 16.5h16.5M3.75 21h16.5" /></svg></span>`;

const ICO_SHIELD = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg></span>`;

const ICO_CHECK = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span>`;

const ICO_MAP = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg></span>`;

function pctDelTotal(parte: number, total: number): string {
  if (total <= 0) return "0";
  return (Math.round((1000 * parte) / total) / 10).toFixed(1);
}

function kpiCard(opts: {
  iconHtml: string;
  labelLine1: string;
  labelLine2: string;
  value: string;
  /** Clases extra en el valor (p. ej. nombre de área largo). El color lo dan las variantes `.rh-sol-kpi-card--*`. */
  valueClass?: string;
  variantClass?: string;
}): string {
  const valCls = opts.valueClass ?? "";
  const variantCls = opts.variantClass ?? "";
  const ariaTitulo = `${opts.labelLine1} ${opts.labelLine2}`.trim();
  return `
    <article class="rh-sol-kpi-card ${variantCls} flex h-full min-h-[16.75rem] flex-col rounded-[14px] border px-5 pt-8 pb-7 text-center sm:min-h-[17.5rem] sm:px-6 sm:pt-9 sm:pb-8" aria-label="${escapeIncHtml(ariaTitulo)}">
      <div class="flex min-h-0 w-full flex-1 flex-col items-center">
        <div class="mb-5 flex justify-center">${opts.iconHtml}</div>
        <div class="max-w-[17rem] sm:max-w-[19rem]">
          <p class="text-base font-bold uppercase leading-tight tracking-[0.05em] text-[color:var(--color-text-primary)] sm:text-lg">${escapeIncHtml(opts.labelLine1)}</p>
          <p class="mt-1.5 text-sm font-medium leading-snug text-[color:var(--color-text-secondary)] sm:text-[0.9375rem]">${escapeIncHtml(opts.labelLine2)}</p>
        </div>
        <div class="min-h-4 flex-1 basis-6" aria-hidden="true"></div>
        <p class="rh-sol-kpi-card__value w-full max-w-full text-center text-3xl font-bold tabular-nums leading-none tracking-tight sm:text-4xl ${valCls}">${escapeIncHtml(opts.value)}</p>
      </div>
    </article>`;
}

function kpiSkeleton(): string {
  const one = `
    <div class="rh-sol-kpi-card flex h-full min-h-[16.75rem] flex-col items-center rounded-[14px] border border-[rgba(148,163,184,0.26)] bg-white/80 px-5 pt-8 pb-7 animate-pulse sm:min-h-[17.5rem] sm:px-6 sm:pt-9 sm:pb-8" aria-hidden="true">
      <div class="flex w-full flex-1 flex-col items-center">
        <div class="mb-5 size-10 shrink-0 rounded-[12px] bg-slate-200"></div>
        <div class="flex flex-col items-center gap-1.5">
          <div class="h-4 w-24 rounded bg-slate-200 sm:h-5 sm:w-28"></div>
          <div class="h-3.5 w-32 rounded bg-slate-100 sm:w-36"></div>
        </div>
        <div class="min-h-4 flex-1 basis-6"></div>
        <div class="h-9 w-16 rounded bg-slate-200 sm:h-10 sm:w-20"></div>
      </div>
    </div>`;
  return `<div class="rh-inc-analytics-kpis grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">${one.repeat(4)}</div>`;
}

function chartPairSkeleton(): string {
  return `<div class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch" aria-hidden="true">
      <div class="${CARD} h-full min-h-[360px] w-full animate-pulse space-y-3 lg:col-span-7">
      <div class="h-4 w-48 rounded bg-slate-200"></div>
      <div class="min-h-[280px] w-full rounded-md bg-slate-100"></div>
    </div>
    <div class="${CARD} h-full min-h-[360px] w-full animate-pulse space-y-3 lg:col-span-5">
      <div class="h-4 w-40 rounded bg-slate-200"></div>
      <div class="min-h-[280px] w-full rounded-md bg-slate-100"></div>
    </div>
  </div>`;
}

function rankingExtraDetails(slug: string, rowsHtmlTop: string, rowsHtmlRest: string): string {
  if (!rowsHtmlRest.trim()) return rowsHtmlTop;
  return `
    ${rowsHtmlTop}
    <details class="mt-2 border-t border-[color:var(--color-border)] pt-2">
      <summary class="cursor-pointer list-none text-xs font-semibold text-[color:var(--color-text-secondary)] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        ${escapeIncHtml(INC_COPY.verRankingCompleto)}
      </summary>
      <div class="mt-2 space-y-0" data-rh-inc-ranking-rest="${slug}">
        ${rowsHtmlRest}
      </div>
    </details>`;
}


function subareaBarsBlock(
  rows: readonly { subarea: string; total: number; area?: string | null }[],
  totalGeneral: number,
): { top: string; rest: string } {
  const topRows = rows.slice(0, TOP);
  const max = Math.max(1, ...topRows.map((r) => r.total));
  const rowHtml = (r: (typeof rows)[number], idx: number) => {
    const barPct = Math.min(100, Math.max(6, Math.round((r.total / max) * 100)));
    const delTotal = pctDelTotal(r.total, totalGeneral);
    const ar = r.area?.trim();
    const meta =
      ar && ar.length > 0
        ? `<span class="block text-[10px] font-medium text-[color:var(--color-text-muted)]">${escapeIncHtml(ar)}</span>`
        : "";
    const isLead = idx === 0;
    const leadCls = isLead ? "rounded-md bg-slate-50 px-2 -mx-0.5" : "";
    return `
      <div class="flex flex-col gap-1 border-b border-[color:var(--color-border)] py-2 first:pt-0 last:border-b-0 last:pb-0 ${leadCls}">
        <div class="flex items-start justify-between gap-2 text-xs">
          <span class="min-w-0 flex-1 font-medium leading-snug text-[color:var(--color-text-primary)]" title="${escapeIncHtml(r.subarea)}">
            ${escapeIncHtml(r.subarea)}
            ${meta}
          </span>
          <span class="shrink-0 text-right">
            <span class="text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeIncHtml(String(r.total))}</span>
            <span class="ml-1.5 text-[10px] font-medium tabular-nums text-[color:var(--color-text-muted)]">${escapeIncHtml(delTotal)}%</span>
          </span>
        </div>
        <div class="h-2 max-w-[min(100%,12rem)] overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-[color:var(--color-leoni-blue-light)] opacity-90" style="width:${barPct}%"></div>
        </div>
      </div>`;
  };
  const top = topRows.map((r, i) => rowHtml(r, i)).join("");
  const rest = rows.slice(TOP).map((r, i) => rowHtml(r, i + TOP)).join("");
  return { top, rest };
}

function cardShell(
  slug: string,
  title: string,
  subtitle: string | undefined,
  body: string,
  stretch = false,
): string {
  const hid = `rh-inc-anl-${slug}-h`;
  const sub =
    subtitle && subtitle.length > 0
      ? `<p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(subtitle)}</p>`
      : "";
  const cardCls = stretch ? `${CARD} h-full w-full min-w-0` : CARD;
  const bodyCls = stretch ? "min-h-0 flex flex-1 flex-col" : "min-h-0 flex-1 text-left";
  return `
    <article class="${cardCls}" aria-labelledby="${hid}">
      <header class="mb-4 shrink-0 text-center">
        <h3 id="${hid}" class="text-base font-bold tracking-tight text-[color:var(--color-text-primary)]">${escapeIncHtml(title)}</h3>
        ${sub}
      </header>
      <div class="${bodyCls}">${body}</div>
    </article>`;
}

export function renderRhIncidenciasAnalyticsSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.estadisticasStatus === "loading") {
    return `
      <div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4" aria-busy="true">
        ${kpiSkeleton()}
        ${chartPairSkeleton()}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${`<div class="${CARD} min-h-[140px] animate-pulse" aria-hidden="true"><div class="mb-2 h-4 w-32 rounded bg-slate-200"></div><div class="h-20 rounded bg-slate-100"></div></div>`.repeat(3)}
        </div>
      </div>`;
  }

  if (vm.estadisticasStatus === "error") {
    const msg = vm.estadisticasErrorMessage?.trim() || INC_COPY.errorEstadisticas;
    return `
      <div id="rh-inc-analytics" class="shrink-0">
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>${escapeIncHtml(msg)}</p>
          <p class="mt-2 text-xs text-red-700">${escapeIncHtml(INC_COPY.errorEstadisticasAccion)}</p>
          <button type="button" data-rh-inc-apply-filters class="mt-3 inline-flex items-center justify-center rounded border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-primary)] shadow-sm hover:bg-slate-50">
            ${escapeIncHtml(INC_COPY.reintentarCarga)}
          </button>
        </div>
      </div>`;
  }

  const d = vm.estadisticas;
  if (!d) {
    return `<div id="rh-inc-analytics" class="shrink-0">
      <div class="rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm text-[color:var(--color-text-muted)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</div>
    </div>`;
  }

  const total = d.total_incidencias ?? 0;

  if (total === 0) {
    return `
      <div id="rh-inc-analytics" class="shrink-0">
        <div class="${CARD} items-center py-10 text-center">
          <h3 class="text-base font-semibold text-[color:var(--color-text-primary)]">${escapeIncHtml(INC_COPY.analiticaVaciaTitulo)}</h3>
          <p class="mt-2 max-w-md text-sm text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
        </div>
      </div>`;
  }

  const topArea = d.areas_con_mas_incidencias[0];

  const kpis = `
    <section class="rh-inc-analytics-kpis grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" aria-label="${escapeIncHtml(INC_COPY.analiticaSeccionAria)}">
      ${kpiCard({
        iconHtml: ICO_TOTAL,
        labelLine1: INC_COPY.kpiTotalLine1,
        labelLine2: INC_COPY.kpiTotalLine2,
        value: String(total),
        variantClass: "rh-inc-kpi-card--total",
      })}
      ${kpiCard({
        iconHtml: ICO_SHIELD,
        labelLine1: INC_COPY.kpiSeguridadLine1,
        labelLine2: INC_COPY.kpiSeguridadLine2,
        value: String(d.incidencias_seguridad ?? 0),
        variantClass: "rh-sol-kpi-card--inc-criticas",
      })}
      ${kpiCard({
        iconHtml: ICO_CHECK,
        labelLine1: INC_COPY.kpiCalidadLine1,
        labelLine2: INC_COPY.kpiCalidadLine2,
        value: String(d.incidencias_calidad ?? 0),
        variantClass: "rh-sol-kpi-card--inc-investigacion",
      })}
      ${kpiCard({
        iconHtml: ICO_MAP,
        labelLine1: INC_COPY.kpiAreaTopLine1,
        labelLine2: INC_COPY.kpiAreaTopLine2,
        value: topArea ? topArea.area : INC_COPY.kpiSinDato,
        variantClass: "rh-sol-kpi-card--inc-abiertas",
        valueClass: topArea ? "text-lg font-bold sm:text-xl" : "",
      })}
    </section>`;

  const serie = d.incidencias_por_mes ?? [];
  const tendencia = renderIncidenciasTendenciaPorMes(serie);
  const donut = renderIncidenciasDonutPorTipo(d.incidencias_por_tipo);

  const bloquePrincipal = `
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch" aria-label="${escapeIncHtml(INC_COPY.analiticaBloquePrincipalAria)}">
      <div class="h-full w-full min-w-0 lg:col-span-7">
        ${cardShell("tendencia", INC_COPY.analiticaTendenciaTitulo, INC_COPY.analiticaTendenciaSub, tendencia, true)}
      </div>
      <div class="h-full w-full min-w-0 lg:col-span-5">
        ${cardShell("tipo", INC_COPY.analiticaTipoTitulo, INC_COPY.analiticaTipoSub, donut, true)}
      </div>
    </section>`;

  const subSplit = subareaBarsBlock(d.subareas_con_mas_incidencias, total);

  const areasBody = renderIncidenciasAreasBarChart(d.areas_con_mas_incidencias);

  const subBody =
    d.subareas_con_mas_incidencias.length === 0
      ? `<p class="py-6 text-center text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</p>`
      : rankingExtraDetails("subareas", subSplit.top, subSplit.rest);

  const rankings = `
    <section class="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="${escapeIncHtml(INC_COPY.analiticaRankingsAria)}">
      ${cardShell("areas", INC_COPY.analiticaAreas, INC_COPY.analiticaAreasSub, areasBody, true)}
      ${cardShell("subareas", INC_COPY.analiticaSubareas, INC_COPY.analiticaSubareasSub, subBody)}
    </section>`;

  return `<div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4 sm:gap-5">
    ${kpis}
    ${bloquePrincipal}
    ${rankings}
  </div>`;
}
