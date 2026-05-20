import { hoDiasPorDiaLaboralTieneDatos } from "../../solicitudes/rh/aggregateHoDiasPorDiaLaboral.ts";
import type { HoDiasPorDiaLaboralSerie } from "../../solicitudes/rh/aggregateHoDiasPorDiaLaboral.ts";
import { computeSolicitudesAnalytics } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  mountRhSolicitudesAnalyticsCharts,
  renderDonutPlaceholder,
  renderTipoBarPlaceholder,
  renderLinePlaceholder,
  renderDiasSolicitadosPorMesChart,
  renderHoDiasPorDiaLaboralChart,
  renderAreasVacHoRankingPlaceholder,
  renderVacHoPlaceholder,
  RH_SOL_ANALYTICS_CHART_IDS,
  RH_SOL_AREAS_BAR_ID,
  RH_SOL_ESTADO_DONUT_ID,
  RH_SOL_TENDENCIA_MES_ID,
  RH_SOL_TIPO_BAR_ID,
} from "./rhSolicitudesAnalyticsCharts.ts";

const CARD = `${RH_LISTADO_SURFACE} rh-sol-analytics-card flex min-h-0 flex-col rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-5`;

const KPI_MINI =
  "rounded-lg border border-[rgba(148,163,184,0.22)] bg-[color:var(--color-surface-container-low)] px-3 py-2";

function renderHoDiaLaboralKpis(serie: HoDiasPorDiaLaboralSerie): string {
  const dia = serie.dia_mas_solicitado ?? "—";
  const pct =
    serie.total > 0 && serie.dia_mas_solicitado
      ? `${serie.dia_mas_solicitado_pct.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
      : "—";
  const total = serie.total.toLocaleString("es-MX");
  const totalSub =
    serie.solicitudes_ho > serie.total
      ? `<p class="mt-0.5 text-[10px] text-[color:var(--color-text-muted)]">${escapeHtml(String(serie.solicitudes_ho))} solicitudes HO</p>`
      : "";
  return `<div class="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Indicadores de home office por día">
    <div class="${KPI_MINI}">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">Día más solicitado</p>
      <p class="mt-0.5 text-sm font-bold text-[color:var(--color-text-primary)]">${escapeHtml(dia)}</p>
    </div>
    <div class="${KPI_MINI}">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">Total días HO</p>
      <p class="mt-0.5 text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeHtml(total)}</p>
      ${totalSub}
    </div>
    <div class="${KPI_MINI}">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">Concentración del día principal</p>
      <p class="mt-0.5 text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeHtml(pct)}</p>
    </div>
  </div>`;
}

function card(title: string, subtitle: string | undefined, body: string, colClass = ""): string {
  const sub = subtitle ? `<p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">${escapeHtml(subtitle)}</p>` : "";
  return `<article class="${CARD} h-full w-full min-w-0 ${colClass}">
    <header class="mb-3 shrink-0">
      <h3 class="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">${escapeHtml(title)}</h3>
      ${sub}
    </header>
    <div class="min-h-0 flex-1">${body}</div>
  </article>`;
}

function skeletonBlock(): string {
  return `<div id="rh-sol-analytics" class="flex shrink-0 flex-col gap-4" aria-busy="true">
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${`<div class="${CARD} min-h-[320px] animate-pulse"><div class="h-full rounded bg-slate-100"></div></div>`.repeat(2)}</div>
  </div>`;
}

export type RhSolicitudesAnalyticsSectionState = "hidden" | "loading" | "ready";

export function renderRhSolicitudesAnalyticsSection(opts: {
  state: RhSolicitudesAnalyticsSectionState;
  rows: readonly RhSolicitudTablaFila[];
  /** Filtro global de estado (`""` = gráfica HO usa solo aprobadas por defecto). */
  estadoFiltroActivo?: string;
}): string {
  if (opts.state === "hidden") return "";
  if (opts.state === "loading") return skeletonBlock();

  const d = computeSolicitudesAnalytics(opts.rows, undefined, {
    estadoFiltroActivo: opts.estadoFiltroActivo ?? "",
  });
  if (d.kpis.total === 0) {
    return `<div id="rh-sol-analytics" class="shrink-0">
      <div class="${CARD} py-10 text-center">
        <h2 class="text-base font-semibold text-[color:var(--color-text-primary)]">Analítica de solicitudes</h2>
        <p class="mt-2 text-sm text-[color:var(--color-text-secondary)]">No hay solicitudes con los filtros actuales.</p>
      </div>
    </div>`;
  }

  const tendenciaHas = d.tendencia_mes_por_tipo.series.some((s) => s.valores.some((v) => v > 0));

  const filaTipoEstado = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${card("Distribución por tipo", "Conteo de solicitudes por categoría", renderTipoBarPlaceholder(d.por_tipo, RH_SOL_TIPO_BAR_ID, "Distribución por tipo"))}
    ${card("Distribución por estado", "Salud del pipeline de aprobación", renderDonutPlaceholder(d.por_estado, RH_SOL_ESTADO_DONUT_ID, "Distribución por estado"))}
  </section>`;

  const filaTendenciaVacHo = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
    <div class="lg:col-span-7">${card("Tendencia mensual", "Solicitudes creadas por mes y tipo (últimos 6 meses)", renderLinePlaceholder(tendenciaHas, RH_SOL_TENDENCIA_MES_ID, "Tendencia mensual por tipo"), "h-full")}</div>
    <div class="lg:col-span-5">${card("Vacaciones vs Home office", "Por mes de creación de la solicitud", renderVacHoPlaceholder(d.por_mes_vac_ho), "h-full")}</div>
  </section>`;

  const hoDiaLaboralBody = `${renderHoDiaLaboralKpis(d.ho_dias_por_dia_laboral)}${renderHoDiasPorDiaLaboralChart(d.ho_dias_por_dia_laboral)}`;

  const filaRankings = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${card("Departamentos con más solicitudes", "Vacaciones y home office por área", renderAreasVacHoRankingPlaceholder(d.areas_top_vac_ho, RH_SOL_AREAS_BAR_ID, "Departamentos con más solicitudes de vacaciones y home office"))}
    ${card("Días con mayor uso de Home Office", "Distribución de Home Office aprobado por día laboral", hoDiaLaboralBody)}
  </section>`;

  const filaAusencias = card(
    "Días solicitados por mes",
    "Últimos 6 meses · solo aprobadas · días naturales · carga real de ausencias",
    renderDiasSolicitadosPorMesChart(d.dias_solicitados_por_mes),
  );

  return `<div id="rh-sol-analytics" class="flex shrink-0 flex-col gap-4 sm:gap-5">
    ${filaTipoEstado}
    ${filaTendenciaVacHo}
    ${filaRankings}
    ${filaAusencias}
  </div>`;
}

/** Monta Chart.js tras pintar el HTML de analítica (misma lógica que en la antigua vista de Solicitudes). */
export function mountRhSolicitudesAnalyticsFromRows(
  root: ParentNode,
  rows: readonly RhSolicitudTablaFila[],
  tableStatus: "loading" | "ready" | "empty" | "error",
  destroyChartById: (chartId: string) => void,
  destroyChartsInContainer: (container: ParentNode) => void,
  estadoFiltroActivo = "",
): void {
  for (const id of RH_SOL_ANALYTICS_CHART_IDS) destroyChartById(id);
  const analyticsHost = root.querySelector("#rh-sol-analytics");
  if (analyticsHost) destroyChartsInContainer(analyticsHost);
  if (tableStatus === "loading") return;
  const analytics = computeSolicitudesAnalytics(rows, undefined, { estadoFiltroActivo });
  if (analytics.kpis.total <= 0 && !hoDiasPorDiaLaboralTieneDatos(analytics.ho_dias_por_dia_laboral)) return;
  mountRhSolicitudesAnalyticsCharts(root, analytics);
}
