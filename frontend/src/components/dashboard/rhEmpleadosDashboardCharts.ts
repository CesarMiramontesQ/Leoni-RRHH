import { mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import { RH_DASH_EMPLEADOS_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import {
  buildEmpleadosDirectoIndirectoPorAreaComparativo,
  buildEmpleadosPorAreaRanking,
  empleadosDirectoIndirectoComparativoTieneDatos,
  empleadosPorAreaTieneDatos,
  findEmpleadosSeriePorClasificacion,
} from "../../dashboard/rh/buildEmpleadosDashboardCharts.ts";
import type {
  EmpleadosClasificacionTipo,
  EmpleadosPorClasificacionAreaSerie,
} from "../../api/usuarios.ts";
import {
  CHART_H_RANK,
  mountRankingHorizontalBar,
  renderRankingPlaceholder,
} from "../solicitudes/rhSolicitudesAnalyticsCharts.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export const RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID = "rh-dash-empleados-admin-area-bar";
export const RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID =
  "rh-dash-empleados-directo-indirecto-area-bar";

export const RH_DASH_EMPLEADOS_CHART_IDS = [
  RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
  RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID,
] as const;

export const RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_CHART_TITLE =
  "Empleados directos e indirectos por área";

const DIRECTO_BAR_COLOR = cssVar("--color-leoni-green", "#00C853");
const INDIRECTO_BAR_COLOR = cssVar("--color-warning", "#F59E0B");
const BAR_FILL_ALPHA = 0.85;
const BAR_RADIUS = 4;

export type RhDashEmpleadosClasificacionChartDef = {
  tipo: EmpleadosClasificacionTipo;
  chartId: string;
  title: string;
  barColor: string;
};

export const RH_DASH_EMPLEADOS_ADMIN_CHART: RhDashEmpleadosClasificacionChartDef = {
  tipo: "administrativo",
  chartId: RH_DASH_EMPLEADOS_ADMIN_AREA_BAR_ID,
  title: "Empleados administrativos por área",
  barColor: cssVar("--color-accent", "#2563EB"),
};

function colorConAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chartSubtitle(serie: EmpleadosPorClasificacionAreaSerie | undefined): string {
  if (!serie?.clasificacion_id) {
    return "Sin clasificación registrada en catálogo (clasificacion_empleado)";
  }
  return `clasificacion_id ${serie.clasificacion_id} · ${serie.clasificacion_descripcion}`;
}

function buildDirectoIndirectoRows(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
) {
  const directo = findEmpleadosSeriePorClasificacion(series, "directo");
  const indirecto = findEmpleadosSeriePorClasificacion(series, "indirecto");
  return buildEmpleadosDirectoIndirectoPorAreaComparativo(directo?.por_area, indirecto?.por_area);
}

function renderDirectoIndirectoPlaceholder(): string {
  return `<div class="rh-sol-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center ${CHART_H_RANK}">
    ${renderChartCanvas({
      chartId: RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID,
      ariaLabel: RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_CHART_TITLE,
      heightClass: "h-full min-h-[200px]",
      className: "relative w-full min-w-0 h-full",
    })}
  </div>`;
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

export function renderDashEmpleadosDirectoIndirectoAreaChart(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
  emptyMessage = RH_DASH_EMPLEADOS_EMPTY_MSG,
): string {
  const rows = buildDirectoIndirectoRows(series);
  if (!empleadosDirectoIndirectoComparativoTieneDatos(rows)) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(emptyMessage)}</p>`;
  }
  return renderDirectoIndirectoPlaceholder();
}

export function empleadosClasificacionChartSubtitle(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
  tipo: EmpleadosClasificacionTipo,
): string {
  return chartSubtitle(findEmpleadosSeriePorClasificacion(series, tipo));
}

export function empleadosDirectoIndirectoChartSubtitle(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
): string {
  const directo = chartSubtitle(findEmpleadosSeriePorClasificacion(series, "directo"));
  const indirecto = chartSubtitle(findEmpleadosSeriePorClasificacion(series, "indirecto"));
  return `Directos: ${directo} · Indirectos: ${indirecto}`;
}

function mountDirectoIndirectoGroupedBar(
  root: ParentNode,
  rows: ReturnType<typeof buildDirectoIndirectoRows>,
): void {
  if (!empleadosDirectoIndirectoComparativoTieneDatos(rows)) return;

  const labels = rows.map((row) => row.label);
  const maxTotal = Math.max(...rows.map((row) => row.directo + row.indirecto), 1);

  mountChart(root, RH_DASH_EMPLEADOS_DIRECTO_INDIRECTO_AREA_BAR_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Directos",
          data: rows.map((row) => row.directo),
          backgroundColor: colorConAlpha(DIRECTO_BAR_COLOR, BAR_FILL_ALPHA),
          borderColor: DIRECTO_BAR_COLOR,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
        },
        {
          label: "Indirectos",
          data: rows.map((row) => row.indirecto),
          backgroundColor: colorConAlpha(INDIRECTO_BAR_COLOR, BAR_FILL_ALPHA),
          borderColor: INDIRECTO_BAR_COLOR,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", axis: "y", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: colors.textSecondary,
            boxWidth: 12,
            padding: 14,
            font: { size: 11, weight: 500 },
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => rows[items[0]?.dataIndex ?? -1]?.label ?? "",
            label: (ctx) => {
              const value = typeof ctx.parsed.x === "number" ? ctx.parsed.x : 0;
              return ` ${ctx.dataset.label}: ${value}`;
            },
            footer: (items) => {
              const row = rows[items[0]?.dataIndex ?? -1];
              if (!row) return "";
              return `Total: ${row.directo + row.indirecto}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: maxTotal * 1.08,
          ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
          grid: { color: colors.border },
          border: { color: colors.border },
        },
        y: {
          ticks: { color: colors.textMuted, font: { size: 10 } },
          grid: { display: false },
          border: { color: colors.border },
        },
      },
    },
  }));
}

export function mountDashEmpleadosClasificacionAreaCharts(
  root: ParentNode,
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
): void {
  const adminSerie = findEmpleadosSeriePorClasificacion(series, RH_DASH_EMPLEADOS_ADMIN_CHART.tipo);
  const adminRanking = buildEmpleadosPorAreaRanking(adminSerie?.por_area);
  if (empleadosPorAreaTieneDatos(adminRanking)) {
    mountRankingHorizontalBar(
      root,
      RH_DASH_EMPLEADOS_ADMIN_CHART.chartId,
      adminRanking,
      RH_DASH_EMPLEADOS_ADMIN_CHART.barColor,
      "Empleados activos",
    );
  }

  mountDirectoIndirectoGroupedBar(root, buildDirectoIndirectoRows(series));
}
