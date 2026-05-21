import { destroyChart } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import {
  mountIncidenciasTendenciaPorTipoChart,
  renderIncidenciasTendenciaPorTipoChart,
  RH_DASH_INC_TENDENCIA_CHART_ID,
} from "../incidencias/rhIncidenciasCharts.ts";
import {
  mountRankingHorizontalBar,
  renderRankingPlaceholder,
} from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import type { RhDashboardAnalyticsPayload } from "../../dashboard/rh/analyticsTypes.ts";
import type { IncidenciaTendenciaPorTipo } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import { tendenciaPorTipoTieneDatos } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const RH_DASH_SUP_PENDIENTES_BAR_ID = "rh-dash-sup-pendientes-bar";
export { RH_DASH_INC_TENDENCIA_CHART_ID };

export const RH_DASH_ANALYTICS_CHART_IDS = [
  RH_DASH_SUP_PENDIENTES_BAR_ID,
  RH_DASH_INC_TENDENCIA_CHART_ID,
] as const;

const SUP_PENDIENTES_BAR_COLOR = cssVar("--color-accent", "#2563EB");

export function tendenciaIncidenciasChartSubtitle(t: IncidenciaTendenciaPorTipo | null): string {
  if (!t) return "Sin datos en el periodo";
  if (t.agrupacion === "dia") return "Por día · últimos 7 días";
  if (t.agrupacion === "semana") return "Por semana · últimos 30 días";
  return "Por mes · últimos 90 días";
}

export function mountRhDashboardAnalyticsCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  for (const id of RH_DASH_ANALYTICS_CHART_IDS) destroyChart(id);

  const ranking = payload.laborales.supervisoresPendientesRanking;
  if (ranking.length > 0) {
    mountRankingHorizontalBar(
      root,
      RH_DASH_SUP_PENDIENTES_BAR_ID,
      ranking,
      SUP_PENDIENTES_BAR_COLOR,
      "Solicitudes pendientes",
    );
  }

  const tendencia = payload.laborales.incidenciasTendenciaPorTipo;
  if (tendenciaPorTipoTieneDatos(tendencia)) {
    mountIncidenciasTendenciaPorTipoChart(root, tendencia!, RH_DASH_INC_TENDENCIA_CHART_ID);
  }
}

export function renderDashSupervisoresPendientesChart(
  ranking: readonly SolicitudRankingRow[],
): string {
  if (ranking.length === 0) {
    return `<p class="rh-dash-analytics-empty">Sin solicitudes pendientes de aprobación.</p>`;
  }
  return renderRankingPlaceholder(
    ranking,
    RH_DASH_SUP_PENDIENTES_BAR_ID,
    "Supervisores y gerentes con más solicitudes pendientes",
  );
}

export function renderDashIncidenciasTendenciaChart(
  tendencia: IncidenciaTendenciaPorTipo | null,
): string {
  if (!tendenciaPorTipoTieneDatos(tendencia)) {
    return `<p class="rh-dash-analytics-empty">Sin incidencias en el periodo.</p>`;
  }
  return renderIncidenciasTendenciaPorTipoChart(tendencia!, RH_DASH_INC_TENDENCIA_CHART_ID);
}
