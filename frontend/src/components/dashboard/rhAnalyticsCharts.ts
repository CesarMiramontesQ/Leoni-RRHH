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
import {
  mountDashEmpleadosClasificacionAreaCharts,
  RH_DASH_EMPLEADOS_CHART_IDS,
} from "./rhEmpleadosDashboardCharts.ts";

export const RH_DASH_RETARDOS_EMPLEADOS_BAR_ID = "rh-dash-retardos-empleados-bar";
export { RH_DASH_INC_TENDENCIA_CHART_ID };

/** Gráficas que sí cambian con el selector de periodo. */
export const RH_DASH_PERIOD_CHART_IDS = [
  RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
  RH_DASH_INC_TENDENCIA_CHART_ID,
  ...RH_DASH_COMEDOR_CHART_IDS,
] as const;

export const RH_DASH_ANALYTICS_CHART_IDS = [
  ...RH_DASH_PERIOD_CHART_IDS,
  ...RH_DASH_EMPLEADOS_CHART_IDS,
] as const;

const RETARDOS_BAR_COLOR = cssVar("--color-accent", "#2563EB");

export function tendenciaIncidenciasChartSubtitle(
  t: IncidenciaTendenciaPorTipo | null,
  periodDays?: number,
): string {
  if (!t) return "Sin datos en el periodo";
  const periodo = periodDays ? `últimos ${periodDays} días` : "periodo seleccionado";
  if (t.agrupacion === "dia") return `Por día · ${periodo}`;
  if (t.agrupacion === "semana") return `Por semana · ${periodo}`;
  return `Por mes · ${periodo}`;
}

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
