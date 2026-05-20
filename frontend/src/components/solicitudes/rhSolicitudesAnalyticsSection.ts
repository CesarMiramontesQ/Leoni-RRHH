import { computeSolicitudesAnalytics } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  mountRhSolicitudesAnalyticsCharts,
  renderDonutPlaceholder,
  renderLinePlaceholder,
  renderPersonasDiaChart,
  renderRankingPlaceholder,
  renderVacHoPlaceholder,
  RH_SOL_ANALYTICS_CHART_IDS,
  RH_SOL_AREAS_BAR_ID,
  RH_SOL_ESTADO_DONUT_ID,
  RH_SOL_SUP_PEND_BAR_ID,
  RH_SOL_TENDENCIA_MES_ID,
  RH_SOL_TIPO_DONUT_ID,
} from "./rhSolicitudesAnalyticsCharts.ts";

const CARD = `${RH_LISTADO_SURFACE} rh-sol-analytics-card flex min-h-0 flex-col rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-5`;

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
}): string {
  if (opts.state === "hidden") return "";
  if (opts.state === "loading") return skeletonBlock();

  const d = computeSolicitudesAnalytics(opts.rows);
  if (d.kpis.total === 0) {
    return `<div id="rh-sol-analytics" class="shrink-0">
      <div class="${CARD} py-10 text-center">
        <h2 class="text-base font-semibold text-[color:var(--color-text-primary)]">Analítica de solicitudes</h2>
        <p class="mt-2 text-sm text-[color:var(--color-text-secondary)]">No hay solicitudes con los filtros actuales.</p>
      </div>
    </div>`;
  }

  const tendenciaHas = d.por_mes_creadas.some((m) => m.total > 0);

  const filaTipoEstado = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${card("Distribución por tipo", "Conteo de solicitudes por categoría", renderDonutPlaceholder(d.por_tipo, RH_SOL_TIPO_DONUT_ID, "Distribución por tipo"))}
    ${card("Distribución por estado", "Salud del pipeline de aprobación", renderDonutPlaceholder(d.por_estado, RH_SOL_ESTADO_DONUT_ID, "Distribución por estado"))}
  </section>`;

  const filaTendenciaVacHo = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
    <div class="lg:col-span-7">${card("Tendencia mensual", "Solicitudes creadas por mes (últimos 6 meses)", renderLinePlaceholder(tendenciaHas, RH_SOL_TENDENCIA_MES_ID, "Tendencia mensual"), "h-full")}</div>
    <div class="lg:col-span-5">${card("Vacaciones vs Home office", "Por mes de creación de la solicitud", renderVacHoPlaceholder(d.por_mes_vac_ho), "h-full")}</div>
  </section>`;

  const filaRankings = `<section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${card("Top 5 áreas", "Mayor volumen de solicitudes", renderRankingPlaceholder(d.areas_top, RH_SOL_AREAS_BAR_ID, "Top áreas"))}
    ${card("Supervisores con pendientes", "Cuellos de botella en aprobación", renderRankingPlaceholder(d.supervisores_pendientes, RH_SOL_SUP_PEND_BAR_ID, "Supervisores con pendientes"))}
  </section>`;

  const filaAusencias = card(
    "Ausencias por día",
    `${d.periodo_ausencias_titulo} · solo aprobadas · días naturales`,
    renderPersonasDiaChart(d.personas_dia),
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
): void {
  for (const id of RH_SOL_ANALYTICS_CHART_IDS) destroyChartById(id);
  const analyticsHost = root.querySelector("#rh-sol-analytics");
  if (analyticsHost) destroyChartsInContainer(analyticsHost);
  if (tableStatus === "loading") return;
  const analytics = computeSolicitudesAnalytics(rows);
  if (analytics.kpis.total <= 0) return;
  mountRhSolicitudesAnalyticsCharts(root, analytics);
}
