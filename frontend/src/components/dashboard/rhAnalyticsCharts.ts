import { cssVar } from "../../charts/chartTokens.ts";
import {
  mountRankingHorizontalBar,
  renderRankingPlaceholder,
} from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import type { RhDashboardAnalyticsPayload } from "../../dashboard/rh/analyticsTypes.ts";
import { RH_DASH_PERIOD_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import { destroyChart, getChart, isChartHealthy } from "../../charts/index.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import {
  mountDashComedorAsistenciaDiariaChart,
  mountDashComedorRegistrosFuturosChart,
  RH_DASH_COMEDOR_ASISTENCIA_CHART_ID,
  RH_DASH_COMEDOR_FUTUROS_CHART_ID,
  RH_DASH_COMEDOR_CHART_IDS,
} from "./rhComedorDashboardCharts.ts";
import {
  mountDashEmpleadosClasificacionAreaCharts,
  RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
  RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID,
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

/**
 * Descriptor de una gráfica del dashboard: los canvases (`ids`) que produce su
 * `mount`, y si hay datos para dibujarla. Fuente única de los guards para el
 * primer montaje y para la reconciliación posterior.
 */
type DashboardChartDescriptor = {
  ids: readonly string[];
  hasData: boolean;
  mount: () => void;
};

function periodChartDescriptors(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): DashboardChartDescriptor[] {
  const rankingRetardos = payload.laborales.empleadosRetardosRanking;
  const rankingFaltas = payload.laborales.empleadosFaltasInjustificadasRanking;
  const asistencia = payload.comedor.asistenciaDiaria;
  const futuros = payload.comedor.registrosFuturosPorSemana;
  return [
    {
      ids: [RH_DASH_RETARDOS_EMPLEADOS_BAR_ID],
      hasData: rankingRetardos.length > 0,
      mount: () =>
        safeMountChart("retardos", () =>
          mountRankingHorizontalBar(
            root,
            RH_DASH_RETARDOS_EMPLEADOS_BAR_ID,
            rankingRetardos,
            RETARDOS_BAR_COLOR,
            "Retardos",
          ),
        ),
    },
    {
      ids: [RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID],
      hasData: rankingFaltas.length > 0,
      mount: () =>
        safeMountChart("faltas injustificadas", () =>
          mountRankingHorizontalBar(
            root,
            RH_DASH_FALTAS_INJUSTIFICADAS_EMPLEADOS_BAR_ID,
            rankingFaltas,
            FALTAS_INJUSTIFICADAS_BAR_COLOR,
            "Faltas injustificadas",
          ),
        ),
    },
    {
      ids: [RH_DASH_COMEDOR_ASISTENCIA_CHART_ID],
      hasData: !!asistencia && asistencia.length > 0,
      mount: () =>
        safeMountChart("asistencia comedor", () =>
          mountDashComedorAsistenciaDiariaChart(root, asistencia!),
        ),
    },
    {
      ids: [RH_DASH_COMEDOR_FUTUROS_CHART_ID],
      hasData: !!futuros && futuros.length > 0,
      mount: () =>
        safeMountChart("registros futuros comedor", () =>
          mountDashComedorRegistrosFuturosChart(root, futuros!),
        ),
    },
  ];
}

function empleadosChartDescriptors(
  root: ParentNode,
  empleados: RhDashboardAnalyticsPayload["empleados"],
): DashboardChartDescriptor[] {
  const series = empleados.resumen?.empleados_por_clasificacion_y_area;
  // Un solo mount produce ambos canvases (clasificación/área y directo/indirecto).
  return [
    {
      ids: [
        RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
        RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID,
      ],
      hasData: !!series?.length,
      mount: () =>
        safeMountChart("empleados por clasificacion y area", () =>
          mountDashEmpleadosClasificacionAreaCharts(root, series!),
        ),
    },
  ];
}

/** Primer montaje: destruye instancias previas y monta las que tengan datos. */
function mountDescriptors(descriptors: DashboardChartDescriptor[]): void {
  for (const desc of descriptors) {
    for (const id of desc.ids) destroyChart(id);
    if (desc.hasData) desc.mount();
  }
}

export function mountRhDashboardPeriodCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  mountDescriptors(periodChartDescriptors(root, payload));
}

export function mountRhDashboardEmpleadosCharts(
  root: ParentNode,
  empleados: RhDashboardAnalyticsPayload["empleados"],
): void {
  mountDescriptors(empleadosChartDescriptors(root, empleados));
}

/** Monta periodo + empleados (carga inicial). */
export function mountRhDashboardAnalyticsCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  mountRhDashboardPeriodCharts(root, payload);
  mountRhDashboardEmpleadosCharts(root, payload.empleados);
}

/**
 * Red de seguridad idempotente: remonta cualquier gráfica con datos cuyo canvas
 * exista pero haya quedado sin instancia viva (o pintada a 0px) por una carrera de
 * layout al cambiar el periodo. No toca las gráficas sanas (cero parpadeo).
 */
export function reconcileRhDashboardCharts(
  root: ParentNode,
  payload: RhDashboardAnalyticsPayload,
): void {
  const descriptors = [
    ...periodChartDescriptors(root, payload),
    ...empleadosChartDescriptors(root, payload.empleados),
  ];
  const toRemount = selectDescriptorsToRemount(
    descriptors,
    (id) => canvasPresent(root, id),
    isChartHealthy,
  );
  for (const desc of toRemount) desc.mount();
}

/**
 * Decisión pura de reconciliación: una gráfica necesita remontarse si tiene datos y
 * al menos uno de sus canvases está presente en el DOM pero sin instancia sana.
 * Aislada del DOM/Chart.js para poder testearla.
 */
export function selectDescriptorsToRemount<T extends { ids: readonly string[]; hasData: boolean }>(
  descriptors: readonly T[],
  canvasPresent: (id: string) => boolean,
  healthy: (id: string) => boolean,
): T[] {
  return descriptors.filter(
    (desc) =>
      desc.hasData && desc.ids.some((id) => canvasPresent(id) && !healthy(id)),
  );
}

function canvasPresent(root: ParentNode, chartId: string): boolean {
  return (
    root.querySelector(`[data-chart-canvas][data-chart-id="${CSS.escape(chartId)}"]`) !== null
  );
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
