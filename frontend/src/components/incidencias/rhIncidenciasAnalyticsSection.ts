import { cssVar } from "../../charts/chartTokens.ts";
import {
  renderDashEmpleadosRetardosChart,
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
} from "../dashboard/rhAnalyticsCharts.ts";
import { mountRankingHorizontalBar } from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import {
  mountIncidenciasAreasBarChart,
  mountIncidenciasTipoBarChart,
  mountIncidenciasSubareasBarChart,
  mountIncidenciasTendenciaPorMesChart,
  RH_INC_AREAS_BAR_CHART_ID,
  RH_INC_SUBAREAS_BAR_CHART_ID,
  RH_INC_TENDENCIA_CHART_ID,
  RH_INC_TIPO_BAR_CHART_ID,
  renderIncidenciasAreasBarChart,
  renderIncidenciasTipoBarChart,
  renderIncidenciasSubareasBarChart,
  renderIncidenciasTendenciaPorMes,
} from "./rhIncidenciasCharts.ts";
import { RH_LISTADO_SURFACE } from "./rhIncidenciasPageStyles.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

const CARD =
  `${RH_LISTADO_SURFACE} rh-inc-analytics-card flex min-h-0 flex-col rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-4`;

/** Misma base que solicitudes RH (`rhSolicitudesAdminView`) para que apliquen las variantes `.rh-sol-kpi-card--*`. Icono centrado, tamaño moderado. */
const KPI_ICON_WRAP =
  "rh-sol-kpi-card__icon flex size-10 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_10px_rgba(15,23,42,0.05)]";

const ICO_TOTAL = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3.75A2.25 2.25 0 0 1 12 6v3.75A2.25 2.25 0 0 1 9.75 12H6A2.25 2.25 0 0 1 3.75 9.75V6ZM14.25 8.25h6M14.25 12h6M3.75 16.5h16.5M3.75 21h16.5" /></svg></span>`;

const ICO_SHIELD = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg></span>`;

const ICO_CHECK = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span>`;

const ICO_MAP = `<span class="${KPI_ICON_WRAP}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg></span>`;

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

function renderKpisContent(d: NonNullable<RhIncidenciasAdminViewModel["estadisticas"]>): string {
  const total = d.total_incidencias ?? 0;
  if (total === 0) {
    return `
      <div class="${CARD} items-center py-10 text-center">
        <h3 class="text-base font-semibold text-[color:var(--color-text-primary)]">${escapeIncHtml(INC_COPY.analiticaVaciaTitulo)}</h3>
        <p class="mt-2 max-w-md text-sm text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
      </div>`;
  }
  const topArea = d.areas_con_mas_incidencias[0];
  return `
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
}

function renderChartsContent(
  d: NonNullable<RhIncidenciasAdminViewModel["estadisticas"]>,
  empleadosRetardosRanking: RhIncidenciasAdminViewModel["empleadosRetardosRanking"],
): string {
  const total = d.total_incidencias ?? 0;
  if (total === 0) {
    return `
      <div class="${CARD} items-center py-10 text-center">
        <h3 class="text-base font-semibold text-[color:var(--color-text-primary)]">${escapeIncHtml(INC_COPY.analiticaVaciaTitulo)}</h3>
        <p class="mt-2 max-w-md text-sm text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
      </div>`;
  }
  const serie = d.incidencias_por_mes ?? [];
  const tendencia = renderIncidenciasTendenciaPorMes(serie);
  const tipoBar = renderIncidenciasTipoBarChart(d.incidencias_por_tipo);
  const bloquePrincipal = `
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch" aria-label="${escapeIncHtml(INC_COPY.analiticaBloquePrincipalAria)}">
      <div class="h-full w-full min-w-0 lg:col-span-7">
        ${cardShell("tendencia", INC_COPY.analiticaTendenciaTitulo, INC_COPY.analiticaTendenciaSub, tendencia, true)}
      </div>
      <div class="h-full w-full min-w-0 lg:col-span-5">
        ${cardShell("tipo", INC_COPY.analiticaTipoTitulo, INC_COPY.analiticaTipoSub, tipoBar, true)}
      </div>
    </section>`;
  const areasBody = renderIncidenciasAreasBarChart(d.areas_con_mas_incidencias);
  const subareasBody = renderIncidenciasSubareasBarChart(d.subareas_con_mas_incidencias);
  const retardosBody = renderDashEmpleadosRetardosChart(
    empleadosRetardosRanking,
    INC_COPY.analiticaRetardosVacio,
  );
  const rankings = `
    <section class="flex flex-col gap-3" aria-label="${escapeIncHtml(INC_COPY.analiticaRankingsAria)}">
      ${cardShell("retardos", INC_COPY.analiticaRetardosTitulo, INC_COPY.analiticaRetardosSub, retardosBody, true)}
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        ${cardShell("areas", INC_COPY.analiticaAreas, INC_COPY.analiticaAreasSub, areasBody, true)}
        ${cardShell("subareas", INC_COPY.analiticaSubareas, INC_COPY.analiticaSubareasSub, subareasBody, true)}
      </div>
    </section>`;
  return `${bloquePrincipal}${rankings}`;
}

/** Tarjetas KPI de incidencias (página Incidencias). */
export function renderRhIncidenciasKpiSection(vm: RhIncidenciasAdminViewModel): string {
  if (!vm.ui.mostrarTarjetasEstadisticas) return "";
  if (vm.estadisticasStatus === "loading") {
    return `<div id="rh-inc-kpis" class="shrink-0" aria-busy="true">${kpiSkeleton()}</div>`;
  }
  if (vm.estadisticasStatus === "error") {
    const msg = vm.estadisticasErrorMessage?.trim() || INC_COPY.errorEstadisticas;
    return `<div id="rh-inc-kpis" class="shrink-0">
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p>${escapeIncHtml(msg)}</p>
      </div>
    </div>`;
  }
  const d = vm.estadisticas;
  if (!d) {
    return `<div id="rh-inc-kpis" class="shrink-0">
      <div class="rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm text-[color:var(--color-text-muted)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</div>
    </div>`;
  }
  return `<div id="rh-inc-kpis" class="shrink-0">${renderKpisContent(d)}</div>`;
}

/** Gráficas de incidencias (sección Métricas). */
export function renderRhIncidenciasChartsSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.estadisticasStatus === "loading") {
    return `
      <div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4 sm:gap-5" aria-busy="true">
        ${chartPairSkeleton()}
        <div class="flex flex-col gap-3" aria-hidden="true">
          <div class="${CARD} min-h-[260px] animate-pulse"><div class="mb-2 h-4 w-48 rounded bg-slate-200"></div><div class="h-48 rounded bg-slate-100"></div></div>
          <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
            ${`<div class="${CARD} min-h-[260px] animate-pulse"><div class="mb-2 h-4 w-32 rounded bg-slate-200"></div><div class="h-48 rounded bg-slate-100"></div></div>`.repeat(2)}
          </div>
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
  return `<div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4 sm:gap-5">${renderChartsContent(d, vm.empleadosRetardosRanking)}</div>`;
}

const RH_INC_ANALYTICS_CHART_IDS = [
  RH_INC_TENDENCIA_CHART_ID,
  RH_INC_TIPO_BAR_CHART_ID,
  RH_INC_AREAS_BAR_CHART_ID,
  RH_INC_SUBAREAS_BAR_CHART_ID,
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
] as const;

const RETARDOS_BAR_COLOR = cssVar("--color-accent", "#2563EB");

/** Monta Chart.js tras pintar la analítica de incidencias (página Incidencias o sección Métricas). */
export function mountRhIncidenciasAnalyticsCharts(
  root: ParentNode,
  vm: RhIncidenciasAdminViewModel,
  destroyChartById: (chartId: string) => void,
  destroyChartsInContainer: (container: ParentNode) => void,
): void {
  for (const id of RH_INC_ANALYTICS_CHART_IDS) destroyChartById(id);
  const analyticsHost = root.querySelector("#rh-inc-analytics");
  if (analyticsHost) destroyChartsInContainer(analyticsHost);
  if (vm.estadisticasStatus !== "ready" || !vm.estadisticas) return;
  const d = vm.estadisticas;
  mountIncidenciasTendenciaPorMesChart(root, d.incidencias_por_mes ?? []);
  mountIncidenciasTipoBarChart(root, d.incidencias_por_tipo ?? []);
  mountIncidenciasAreasBarChart(root, d.areas_con_mas_incidencias ?? [], d.total_incidencias ?? 0);
  mountIncidenciasSubareasBarChart(root, d.subareas_con_mas_incidencias ?? [], d.total_incidencias ?? 0);
  if (vm.empleadosRetardosRanking.length > 0) {
    mountRankingHorizontalBar(
      root,
      RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
      vm.empleadosRetardosRanking,
      RETARDOS_BAR_COLOR,
      "Retardos",
    );
  }
}
