import { cssVar } from "../../charts/chartTokens.ts";
import { RH_DASH_EMPLEADOS_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import {
  buildEmpleadosPorAreaRanking,
  empleadosPorAreaTieneDatos,
  findEmpleadosSeriePorClasificacion,
} from "../../dashboard/rh/buildEmpleadosDashboardCharts.ts";
import type {
  EmpleadosClasificacionTipo,
  EmpleadosPorClasificacionAreaSerie,
} from "../../api/usuarios.ts";
import {
  mountRankingHorizontalBar,
  renderRankingPlaceholder,
} from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export const RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID = "rh-dash-empleados-admin-area-bar";
export const RH_DASH_EMPLEADOS_DIRECTO_AREA_BAR_ID = "rh-dash-empleados-directo-area-bar";
export const RH_DASH_EMPLEADOS_INDIRECTO_AREA_BAR_ID = "rh-dash-empleados-indirecto-area-bar";

export const RH_DASH_EMPLEADOS_CHART_IDS = [
  RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
  RH_DASH_EMPLEADOS_DIRECTO_AREA_BAR_ID,
  RH_DASH_EMPLEADOS_INDIRECTO_AREA_BAR_ID,
] as const;

export type RhDashEmpleadosClasificacionChartDef = {
  tipo: EmpleadosClasificacionTipo;
  chartId: string;
  title: string;
  barColor: string;
};

export const RH_DASH_EMPLEADOS_CLASIFICACION_CHARTS: readonly RhDashEmpleadosClasificacionChartDef[] = [
  {
    tipo: "administrativo",
    chartId: RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
    title: "Empleados administrativos por área",
    barColor: cssVar("--color-accent", "#2563EB"),
  },
  {
    tipo: "directo",
    chartId: RH_DASH_EMPLEADOS_DIRECTO_AREA_BAR_ID,
    title: "Empleados directos por área",
    barColor: cssVar("--color-leoni-green", "#00C853"),
  },
  {
    tipo: "indirecto",
    chartId: RH_DASH_EMPLEADOS_INDIRECTO_AREA_BAR_ID,
    title: "Empleados indirectos por área",
    barColor: cssVar("--color-warning", "#F59E0B"),
  },
] as const;

function chartSubtitle(serie: EmpleadosPorClasificacionAreaSerie | undefined): string {
  if (!serie?.clasificacion_id) {
    return "Sin clasificación registrada en catálogo (clasificacion_empleado)";
  }
  return `clasificacion_id ${serie.clasificacion_id} · ${serie.clasificacion_descripcion}`;
}

export function renderDashEmpleadosClasificacionAreaChart(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
  def: RhDashEmpleadosClasificacionChartDef,
  emptyMessage = RH_DASH_EMPLEADOS_EMPTY_MSG,
): string {
  const serie = findEmpleadosSeriePorClasificacion(series, def.tipo);
  const ranking = buildEmpleadosPorAreaRanking(serie?.por_area);
  if (!empleadosPorAreaTieneDatos(ranking)) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(emptyMessage)}</p>`;
  }
  return renderRankingPlaceholder(ranking, def.chartId, def.title);
}

export function empleadosClasificacionChartSubtitle(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
  tipo: EmpleadosClasificacionTipo,
): string {
  return chartSubtitle(findEmpleadosSeriePorClasificacion(series, tipo));
}

export function mountDashEmpleadosClasificacionAreaCharts(
  root: ParentNode,
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
): void {
  for (const def of RH_DASH_EMPLEADOS_CLASIFICACION_CHARTS) {
    const serie = findEmpleadosSeriePorClasificacion(series, def.tipo);
    const ranking = buildEmpleadosPorAreaRanking(serie?.por_area);
    if (!empleadosPorAreaTieneDatos(ranking)) continue;
    mountRankingHorizontalBar(root, def.chartId, ranking, def.barColor, "Empleados activos");
  }
}
