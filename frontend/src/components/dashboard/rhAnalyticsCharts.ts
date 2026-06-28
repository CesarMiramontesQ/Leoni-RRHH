import { cssVar } from "../../charts/chartTokens.ts";
import {
  mountRankingHorizontalBar,
  renderRankingPlaceholder,
} from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import type { RhDashboardAnalyticsPayload } from "../../dashboard/rh/analyticsTypes.ts";
import { RH_DASH_PERIOD_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import { destroyChart, getChart } from "../../charts/index.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import {
  mountDashComedorAsistenciaDiariaChart,
  mountDashComedorRegistrosFuturosChart,
  RH_DASH_COMEDOR_CHART_IDS,
} from "./rhComedorDashboardCharts.ts";
import {
  mountDashEmpleadosClasificacionAreaCharts,
  RH_DASH_EMPLEADOS_CHART_IDS,
} from "./rhEmpleadosDashboardCharts.ts";

export const RH_DASH_RETARDOS_EMPLEADOS_BAR_ID = "rh-dash-retardos-empleados-bar";
export const RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID =
  "rh-dash-faltas-injustificadas-empleados-bar";

/** Gráficas que sí cambian con el selector de periodo. */
export const RH_DASH_PERIOD_CHART_IDS = [
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
  RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID,
  ...RH_DASH_COMEDOR_CHART_IDS,
] as const;

export const RH_DASH_ANALYTICS_CHART_IDS = [
  ...RH_DASH_PERIOD_CHART_IDS,
  ...RH_DASH_EMPLEADOS_CHART_IDS,
] as const;

const RETARDOS_BAR_COLOR = cssVar("--color-accent", "#2563EB");
const FALTAS_INJUSTIFICADAS_BAR_COLOR = cssVar("--color-kpi-metric-inactivo-icon", "#f87171");

function safeMountChart(label: string, mount: () => void): void {
  try {
    mount();
  } catch (e: unknown) {
    console.error(`[rh-dashboard] ${label}`, e);
  }
}

/** Reajusta gráficas del dashboard RH por id (compatibilidad). */
export function resizeRhDashboardAnalyticsCharts(): void {
  for (const id of RH_DASH_ANALYTICS_CHART_IDS) {
    getChart(id)?.resize();
  }
}

export function mountRhDashboardPeriodCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  for (const id of RH_DASH_PERIOD_CHART_IDS) destroyChart(id);

  const rankingRetardos = payload.laborales.empleadosRetardosRanking;
  if (rankingRetardos.length > 0) {
    safeMountChart("retardos", () =>
      mountRankingHorizontalBar(
        root,
        RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
        rankingRetardos,
        RETARDOS_BAR_COLOR,
        "Retardos",
      ),
    );
  }

  const rankingFaltas = payload.laborales.empleadosFaltasInjustificadasRanking;
  if (rankingFaltas.length > 0) {
    safeMountChart("faltas injustificadas", () =>
      mountRankingHorizontalBar(
        root,
        RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID,
        rankingFaltas,
        FALTAS_INJUSTIFICADAS_BAR_COLOR,
        "Faltas injustificadas",
      ),
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

export function mountRhDashboardEmpleadosCharts(
  root: ParentNode,
  empleados: RhDashboardAnalyticsPayload["empleados"],
): void {
  for (const id of RH_DASH_EMPLEADOS_CHART_IDS) destroyChart(id);
  const series = empleados.resumen?.empleados_por_clasificacion_y_area;
  if (!series?.length) return;
  safeMountChart("empleados por clasificacion y area", () =>
    mountDashEmpleadosClasificacionAreaCharts(root, series),
  );
}

/** Monta periodo + empleados (carga inicial). */
export function mountRhDashboardAnalyticsCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  mountRhDashboardPeriodCharts(root, payload);
  mountRhDashboardEmpleadosCharts(root, payload.empleados);
}

function renderDashEmpleadosRankingChart(
  ranking: readonly SolicitudRankingRow[],
  chartId: string,
  ariaLabel: string,
  emptyMessage = RH_DASH_PERIOD_EMPTY_MSG,
): string {
  if (ranking.length === 0) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(emptyMessage)}</p>`;
  }
  return renderRankingPlaceholder(ranking, chartId, ariaLabel);
}

export function renderDashEmpleadosRetardosChart(
  ranking: readonly SolicitudRankingRow[],
  emptyMessage = RH_DASH_PERIOD_EMPTY_MSG,
): string {
  return renderDashEmpleadosRankingChart(
    ranking,
    RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
    "Top 5 empleados con más retardos",
    emptyMessage,
  );
}

export function renderDashEmpleadosFaltasInjustificadasChart(
  ranking: readonly SolicitudRankingRow[],
  emptyMessage = RH_DASH_PERIOD_EMPTY_MSG,
): string {
  return renderDashEmpleadosRankingChart(
    ranking,
    RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID,
    "Top 5 empleados con más faltas injustificadas",
    emptyMessage,
  );
}
