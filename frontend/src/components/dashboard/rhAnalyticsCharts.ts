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

export const RH_DASH_RETARDOS_EMPLEADOS_BAR_ID = "rh-dash-retardos-empleados-bar";
export { RH_DASH_INC_TENDENCIA_CHART_ID };

export const RH_DASH_ANALYTICS_CHART_IDS = [
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
  RH_DASH_INC_TENDENCIA_CHART_ID,
] as const;

const RETARDOS_BAR_COLOR = cssVar("--color-accent", "#2563EB");

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

  const ranking = payload.laborales.empleadosRetardosRanking;
  if (ranking.length > 0) {
    mountRankingHorizontalBar(
      root,
      RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
      ranking,
      RETARDOS_BAR_COLOR,
      "Retardos",
    );
  }

  const tendencia = payload.laborales.incidenciasTendenciaPorTipo;
  if (tendenciaPorTipoTieneDatos(tendencia)) {
    mountIncidenciasTendenciaPorTipoChart(root, tendencia!, RH_DASH_INC_TENDENCIA_CHART_ID);
  }
}

export function renderDashEmpleadosRetardosChart(
  ranking: readonly SolicitudRankingRow[],
  emptyMessage = "Sin retardos registrados en el periodo.",
): string {
  if (ranking.length === 0) {
    return `<p class="rh-dash-analytics-empty">${emptyMessage}</p>`;
  }
  return renderRankingPlaceholder(
    ranking,
    RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
    "Top 5 empleados con más retardos",
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
