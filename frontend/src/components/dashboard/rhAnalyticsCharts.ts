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
import { RH_DASH_PERIOD_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import { destroyChart, getChart } from "../../charts/index.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import type { IncidenciaTendenciaPorTipo } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import { tendenciaPorTipoTieneDatos } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import {
  mountDashComedorAsistenciaDiariaChart,
  mountDashComedorRegistrosFuturosChart,
  RH_DASH_COMEDOR_CHART_IDS,
} from "./rhComedorDashboardCharts.ts";

export const RH_DASH_RETARDOS_EMPLEADOS_BAR_ID = "rh-dash-retardos-empleados-bar";
export { RH_DASH_INC_TENDENCIA_CHART_ID };

export const RH_DASH_ANALYTICS_CHART_IDS = [
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
  RH_DASH_INC_TENDENCIA_CHART_ID,
  ...RH_DASH_COMEDOR_CHART_IDS,
] as const;

const RETARDOS_BAR_COLOR = cssVar("--color-accent", "#2563EB");

export function tendenciaIncidenciasChartSubtitle(t: IncidenciaTendenciaPorTipo | null): string {
  if (!t) return "Sin datos en el periodo";
  if (t.agrupacion === "dia") return "Por día · últimos 7 días";
  if (t.agrupacion === "semana") return "Por semana · últimos 30 días";
  return "Por mes · últimos 90 días";
}

function safeMountChart(label: string, mount: () => void): void {
  try {
    mount();
  } catch (e: unknown) {
    console.error(`[rh-dashboard] ${label}`, e);
  }
}

/** Reajusta gráficas tras cambio de layout (p. ej. tras filtro de periodo). */
export function resizeRhDashboardAnalyticsCharts(): void {
  for (const id of RH_DASH_ANALYTICS_CHART_IDS) {
    getChart(id)?.resize();
  }
}

export function mountRhDashboardAnalyticsCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  for (const id of RH_DASH_ANALYTICS_CHART_IDS) destroyChart(id);

  const ranking = payload.laborales.empleadosRetardosRanking;
  if (ranking.length > 0) {
    safeMountChart("retardos", () =>
      mountRankingHorizontalBar(
        root,
        RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
        ranking,
        RETARDOS_BAR_COLOR,
        "Retardos",
      ),
    );
  }

  const tendencia = payload.laborales.incidenciasTendenciaPorTipo;
  if (tendenciaPorTipoTieneDatos(tendencia)) {
    safeMountChart("tendencia incidencias", () =>
      mountIncidenciasTendenciaPorTipoChart(root, tendencia!, RH_DASH_INC_TENDENCIA_CHART_ID),
    );
  }

  const asistencia = payload.comedor.asistenciaDiaria;
  if (asistencia && asistencia.length > 0) {
    safeMountChart("asistencia comedor", () => mountDashComedorAsistenciaDiariaChart(root, asistencia));
  }

  const futuros = payload.comedor.registrosFuturosPorSemana;
  if (futuros && futuros.length > 0) {
    safeMountChart("registros futuros comedor", () =>
      mountDashComedorRegistrosFuturosChart(root, futuros),
    );
  }
}

export function renderDashEmpleadosRetardosChart(
  ranking: readonly SolicitudRankingRow[],
  emptyMessage = RH_DASH_PERIOD_EMPTY_MSG,
): string {
  if (ranking.length === 0) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(emptyMessage)}</p>`;
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
    return `<p class="rh-dash-analytics-empty">${escapeHtml(RH_DASH_PERIOD_EMPTY_MSG)}</p>`;
  }
  return renderIncidenciasTendenciaPorTipoChart(tendencia!, RH_DASH_INC_TENDENCIA_CHART_ID);
}
