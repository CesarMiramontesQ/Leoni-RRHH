/**
 * Gráficas de vista previa analítica — solicitudes RH (Chart.js).
 */

import type { Plugin, ScriptableContext } from "chart.js";
import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { chartColorSlots, cssVar, type ChartSemanticColors } from "../../charts/chartTokens.ts";
import type { HoDiasPorDiaLaboralSerie } from "../../solicitudes/rh/aggregateHoDiasPorDiaLaboral.ts";
import { hoDiasPorDiaLaboralTieneDatos } from "../../solicitudes/rh/aggregateHoDiasPorDiaLaboral.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import type { SolicitudDiasPorMesSerie } from "../../solicitudes/rh/aggregateSolicitudesDiasPorMes.ts";
import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";
import {
  etiquetaMesCorto,
  type RhSolicitudesAnalyticsData,
  type SolicitudAnalyticsSlice,
  type SolicitudMesVacHo,
  type SolicitudDepartamentoVacHoRow,
  type SolicitudPorDepartamentoChart,
  type SolicitudRankingRow,
  type SolicitudTendenciaMesPorTipo,
} from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const RH_SOL_TIPO_BAR_ID = "rh-sol-tipo-bar";
export const RH_SOL_ESTADO_DONUT_ID = "rh-sol-estado-doughnut";
export const RH_SOL_TENDENCIA_MES_ID = "rh-sol-tendencia-mes";
export const RH_SOL_AREAS_BAR_ID = "rh-sol-areas-bar";
export const RH_SOL_VAC_HO_MES_ID = "rh-sol-vac-ho-mes";
export const RH_SOL_DIAS_MES_CHART_ID = "rh-sol-dias-mes";
export const RH_SOL_HO_DIA_LABORAL_CHART_ID = "rh-sol-ho-dia-laboral";

export const RH_SOL_ANALYTICS_CHART_IDS = [
  RH_SOL_TIPO_BAR_ID,
  RH_SOL_ESTADO_DONUT_ID,
  RH_SOL_TENDENCIA_MES_ID,
  RH_SOL_AREAS_BAR_ID,
  RH_SOL_VAC_HO_MES_ID,
  RH_SOL_DIAS_MES_CHART_ID,
  RH_SOL_HO_DIA_LABORAL_CHART_ID,
] as const;

export const CHART_H = "h-[280px]";
export const CHART_H_RANK = "h-[260px]";
export const CHART_H_DAY = "h-[300px]";

const BAR_FILL_ALPHA = 0.85;
const BAR_RADIUS = 4;
const TIPO_BAR_FILL_ALPHA = 0.5;
const DONUT_CUTOUT = "58%";
const TENDENCIA_LINE_FILL_ALPHA = 0.5;
const TENDENCIA_LINE_TENSION = 0.35;
/** Radio moderado para barras verticales (Distribución por tipo, HO por día laboral). */
const VERTICAL_BAR_BORDER_RADIUS = 8;
const DEPT_STACK_BAR_RADIUS = 7;
const DEPT_STACK_BAR_MAX_THICKNESS = 16;
const DEPT_SEGMENT_LABEL_MIN_PX = 28;
const DEPT_CHART_TOP_N = 8;
const GRID_COLOR_ALPHA = 0.28;

function colorConAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function emptyPanel(msg: string, minH = "min-h-[280px]"): string {
  return `<div class="flex ${minH} items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">${msg}</div>`;
}

function chartShell(chartId: string, ariaLabel: string, heightClass: string): string {
  return `<div class="rh-sol-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center ${heightClass}">
    ${renderChartCanvas({ chartId, ariaLabel, heightClass: "h-full min-h-[200px]", className: "relative w-full min-w-0 h-full" })}
  </div>`;
}

function donutCenterPlugin(total: number, colors: ChartSemanticColors): Plugin<"doughnut"> {
  return {
    id: "rh-sol-donut-center",
    afterDraw(chart) {
      const arcs = chart.getDatasetMeta(0).data;
      if (!arcs.length) return;
      const { x, y } = arcs[0];
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.textPrimary;
      ctx.font = "600 22px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(String(total), x, y - 6);
      ctx.fillStyle = colors.textMuted;
      ctx.font = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("total", x, y + 14);
      ctx.restore();
    },
  };
}

const TIPO_COLORS_BY_CODIGO: Record<RhSolicitudTipoCodigo, () => string> = {
  vacaciones: () => chartColorSlots().green,
  home_office: () => chartColorSlots().accent,
  matrimonio: () => chartColorSlots().violet,
  incapacidad_interna: () => chartColorSlots().teal,
  defuncion: () => chartColorSlots().slate,
  paternidad: () => chartColorSlots().orange,
  permiso_sin_goce_sueldo: () => chartColorSlots().amber,
};

function colorForTipoCodigo(codigo: RhSolicitudTipoCodigo): string {
  return TIPO_COLORS_BY_CODIGO[codigo]?.() ?? cssVar("--color-border", "#D1DCE8");
}

const ESTADO_COLORS: Record<string, string> = {
  Pendiente: "#F59E0B",
  Aprobada: "#22C55E",
  Rechazada: "#EF4444",
  "Cambios solicitados": "#0EA5E9",
  Cancelada: "#94A3B8",
  Override: "#8B5CF6",
};

export function renderDonutPlaceholder(rows: readonly SolicitudAnalyticsSlice[], chartId: string, aria: string): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return emptyPanel("Sin datos");
  return chartShell(chartId, aria, CHART_H);
}

export function renderTipoBarPlaceholder(rows: readonly SolicitudAnalyticsSlice[], chartId: string, aria: string): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return emptyPanel("Sin datos");
  return chartShell(chartId, aria, CHART_H);
}

/** Barras verticales por categoría con `borderRadius` (Chart.js border-radius sample). */
export function mountTipoDistribucionBarChart(
  root: ParentNode,
  chartId: string,
  rows: readonly SolicitudAnalyticsSlice[],
  colorsForRow?: (row: SolicitudAnalyticsSlice, i: number) => string,
): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return;
  const labels = rows.map((r) => r.label);
  const values = rows.map((r) => r.total);
  const borderColors = rows.map(
    (r, i) => colorsForRow?.(r, i) ?? (r.codigo ? colorForTipoCodigo(r.codigo) : cssVar("--color-border")),
  );
  const backgroundColors = borderColors.map((c) => colorConAlpha(c, TIPO_BAR_FILL_ALPHA));

  mountChart(root, chartId, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Solicitudes",
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: VERTICAL_BAR_BORDER_RADIUS,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = rows[ctx.dataIndex];
              return row ? ` ${row.total} (${row.porcentaje}%)` : "";
            },
          },
        },
      },
      ...chartCartesianScales(colors),
    },
  }));
}

export function mountDonutChart(
  root: ParentNode,
  chartId: string,
  rows: readonly SolicitudAnalyticsSlice[],
  colorsForRow?: (row: SolicitudAnalyticsSlice, i: number) => string,
): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return;
  mountChart(root, chartId, ({ colors }) => ({
    type: "doughnut",
    plugins: [donutCenterPlugin(total, colors)],
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          data: rows.map((r) => r.total),
          backgroundColor: rows.map(
            (r, i) => colorsForRow?.(r, i) ?? (r.codigo ? colorForTipoCodigo(r.codigo) : cssVar("--color-border")),
          ),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: DONUT_CUTOUT,
      plugins: {
        legend: { position: "bottom", labels: { color: colors.textSecondary, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = rows[ctx.dataIndex];
              return row ? ` ${row.total} (${row.porcentaje}%)` : "";
            },
          },
        },
      },
    },
  }));
}

export function renderLinePlaceholder(hasData: boolean, chartId: string, aria: string): string {
  if (!hasData) return emptyPanel("Sin datos de tendencia");
  return chartShell(chartId, aria, CHART_H);
}

/**
 * Líneas por tipo en un solo eje Y (izquierdo).
 * @see https://www.chartjs.org/docs/latest/samples/line/line.html
 */
export function mountTendenciaMesChart(root: ParentNode, tendencia: SolicitudTendenciaMesPorTipo): void {
  const seriesConDatos = tendencia.series.filter((s) => s.valores.some((v) => v > 0));
  if (seriesConDatos.length === 0) return;
  const labels = tendencia.periodos.map(etiquetaMesCorto);

  mountChart(root, RH_SOL_TENDENCIA_MES_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels,
        datasets: seriesConDatos.map((s) => {
          const border = colorForTipoCodigo(s.codigo);
          return {
            label: s.label,
            data: [...s.valores],
            borderColor: border,
            backgroundColor: colorConAlpha(border, TENDENCIA_LINE_FILL_ALPHA),
            yAxisID: "y",
            tension: TENDENCIA_LINE_TENSION,
            pointRadius: 3,
            pointHoverRadius: 5,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          ...cartesian?.scales,
          y: {
            ...cartesian?.scales?.y,
            beginAtZero: true,
            ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    };
  });
}

export function renderRankingPlaceholder(rows: readonly SolicitudRankingRow[], chartId: string, aria: string): string {
  if (rows.length === 0) return emptyPanel("Sin datos", CHART_H_RANK);
  return chartShell(chartId, aria, CHART_H_RANK);
}

function gridColorMuted(hex: string): string {
  return colorConAlpha(hex, GRID_COLOR_ALPHA);
}

/** Recorte visual: top N + «Otros» sin alterar datos de analítica. */
export function visualDeptChartRows(
  rows: readonly SolicitudDepartamentoVacHoRow[],
): SolicitudDepartamentoVacHoRow[] {
  if (rows.length <= DEPT_CHART_TOP_N) return [...rows];
  const top = rows.slice(0, DEPT_CHART_TOP_N);
  const rest = rows.slice(DEPT_CHART_TOP_N);
  const otros = rest.reduce<SolicitudDepartamentoVacHoRow>(
    (acc, r) => ({
      label: "Otros",
      vacaciones: acc.vacaciones + r.vacaciones,
      home_office: acc.home_office + r.home_office,
      total: acc.total + r.total,
    }),
    { label: "Otros", vacaciones: 0, home_office: 0, total: 0 },
  );
  return [...top, otros];
}

function deptStackedSegmentLabelsPlugin(
  rows: readonly SolicitudDepartamentoVacHoRow[],
): Plugin<"bar"> {
  return {
    id: "rh-sol-dept-segment-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const datasets = chart.data.datasets;
      for (let di = 0; di < datasets.length; di += 1) {
        const meta = chart.getDatasetMeta(di);
        for (let i = 0; i < meta.data.length; i += 1) {
          const row = rows[i];
          if (!row) continue;
          const value = di === 0 ? row.vacaciones : row.home_office;
          if (value <= 0) continue;
          const el = meta.data[i] as { x: number; y: number; base?: number };
          if (typeof el.x !== "number" || typeof el.y !== "number") continue;
          const x0 = typeof el.base === "number" ? el.base : chart.scales.x?.getPixelForValue(0) ?? 0;
          const segW = Math.abs(el.x - x0);
          if (segW < DEPT_SEGMENT_LABEL_MIN_PX) continue;
          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), (x0 + el.x) / 2, el.y);
          ctx.restore();
        }
      }
    },
  };
}

function deptStackedTotalPlugin(rows: readonly { total: number }[], textColor: string): Plugin<"bar"> {
  return {
    id: "rh-sol-dept-stacked-total",
    afterDatasetsDraw(chart) {
      const datasets = chart.data.datasets;
      const lastMeta = chart.getDatasetMeta(Math.max(0, datasets.length - 1));
      if (!lastMeta?.data?.length) return;
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let i = 0; i < lastMeta.data.length; i += 1) {
        const total = rows[i]?.total ?? 0;
        if (total <= 0) continue;
        const bar = lastMeta.data[i] as { x: number; y: number };
        if (typeof bar.x !== "number" || typeof bar.y !== "number") continue;
        ctx.fillText(String(total), bar.x + 6, bar.y);
      }
      ctx.restore();
    },
  };
}

export function renderDeptVacHoLegendHtml(): string {
  return `<div class="flex shrink-0 flex-wrap items-center justify-end gap-3 text-[11px] font-medium text-[color:var(--color-text-secondary)]" aria-hidden="true">
    <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-[color:var(--color-success)]"></span>Vacaciones</span>
    <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-[color:var(--color-accent)]"></span>Home Office</span>
  </div>`;
}

/** Altura fija del canvas según filas visibles (compacta, alineada con card HO). */
export function deptChartHeightPx(visualRowCount: number): number {
  if (visualRowCount <= 0) return 200;
  if (visualRowCount < 5) return Math.max(132, visualRowCount * 32 + 52);
  return 260;
}

export function renderSolicitudesPorDepartamentoFootnote(): string {
  return `<p class="mt-1.5 text-left text-[10px] leading-snug text-[color:var(--color-text-muted)]">Solo se consideran solicitudes aprobadas dentro del periodo seleccionado.</p>`;
}

export function renderSolicitudesPorDepartamentoChart(chart: SolicitudPorDepartamentoChart): string {
  if (chart.rows.length === 0) {
    return emptyPanel("Sin vacaciones ni home office por departamento", "min-h-[200px]");
  }
  const visualRows = visualDeptChartRows(chart.rows);
  const h = deptChartHeightPx(visualRows.length);
  return `<div class="rh-sol-chart-panel w-full min-w-0 shrink-0" style="height:${h}px">
    ${renderChartCanvas({
      chartId: RH_SOL_AREAS_BAR_ID,
      ariaLabel: "Solicitudes por departamento",
      heightClass: "h-full min-h-0",
      className: "relative h-full w-full min-w-0",
    })}
  </div>`;
}

/** Barras horizontales apiladas: vacaciones + home office por departamento. */
export function mountSolicitudesPorDepartamentoChart(
  root: ParentNode,
  chart: SolicitudPorDepartamentoChart,
): void {
  const rows = visualDeptChartRows(chart.rows);
  if (rows.length === 0) return;
  const labels = rows.map((r) => r.label);
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  mountChart(root, RH_SOL_AREAS_BAR_ID, ({ colors }) => {
    const vacBorder = colors.success;
    const hoBorder = colors.accent;
    const gridMuted = gridColorMuted(colors.border);

    return {
      type: "bar",
      plugins: [
        deptStackedSegmentLabelsPlugin(rows),
        deptStackedTotalPlugin(rows, colors.textSecondary),
      ],
      data: {
        labels,
        datasets: [
          {
            label: "Vacaciones",
            data: rows.map((r) => r.vacaciones),
            backgroundColor: colorConAlpha(vacBorder, BAR_FILL_ALPHA),
            borderColor: vacBorder,
            borderWidth: 1,
            borderRadius: (ctx: ScriptableContext<"bar">) => {
              const row = rows[ctx.dataIndex];
              if (!row || row.vacaciones <= 0) return 0;
              const soloVac = row.home_office <= 0;
              return soloVac
                ? DEPT_STACK_BAR_RADIUS
                : { topLeft: DEPT_STACK_BAR_RADIUS, bottomLeft: DEPT_STACK_BAR_RADIUS, topRight: 0, bottomRight: 0 };
            },
            stack: "departamento",
          },
          {
            label: "Home Office",
            data: rows.map((r) => r.home_office),
            backgroundColor: colorConAlpha(hoBorder, BAR_FILL_ALPHA),
            borderColor: hoBorder,
            borderWidth: 1,
            borderRadius: (ctx: ScriptableContext<"bar">) => {
              const row = rows[ctx.dataIndex];
              if (!row || row.home_office <= 0) return 0;
              const soloHo = row.vacaciones <= 0;
              return soloHo
                ? DEPT_STACK_BAR_RADIUS
                : { topLeft: 0, bottomLeft: 0, topRight: DEPT_STACK_BAR_RADIUS, bottomRight: DEPT_STACK_BAR_RADIUS };
            },
            stack: "departamento",
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        datasets: {
          bar: {
            maxBarThickness: DEPT_STACK_BAR_MAX_THICKNESS,
            barPercentage: 0.92,
            categoryPercentage: 0.88,
          },
        },
        interaction: { mode: "index", axis: "y", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const row = rows[items[0]?.dataIndex ?? -1];
                return row ? row.label : "";
              },
              label: (ctx) => {
                const n = typeof ctx.parsed.x === "number" ? ctx.parsed.x : 0;
                return ` ${ctx.dataset.label}: ${n}`;
              },
              footer: (items) => {
                const row = rows[items[0]?.dataIndex ?? -1];
                return row ? `Total: ${row.total}` : "";
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            suggestedMax: maxTotal * 1.12,
            ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
            grid: { color: gridMuted, drawTicks: false },
            border: { color: colors.border },
          },
          y: {
            stacked: true,
            ticks: {
              color: colors.textPrimary,
              font: { size: 11, weight: 500 },
              autoSkip: false,
              padding: 4,
            },
            grid: { display: false },
            border: { display: false },
          },
        },
        layout: { padding: { top: 4, bottom: 4, right: 32 } },
      },
    };
  });
}

export function mountRankingHorizontalBar(
  root: ParentNode,
  chartId: string,
  rows: readonly SolicitudRankingRow[],
  barColor: string,
  datasetLabel: string,
): void {
  if (rows.length === 0) return;
  const labels = rows.map((r) => r.label);
  const values = rows.map((r) => r.total);
  mountChart(root, chartId, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data: values,
          backgroundColor: colorConAlpha(barColor, BAR_FILL_ALPHA),
          borderColor: barColor,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
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

export function renderVacHoPlaceholder(rows: readonly SolicitudMesVacHo[]): string {
  const has = rows.some((r) => r.vacaciones > 0 || r.home_office > 0);
  if (!has) return emptyPanel("Sin vacaciones ni home office por mes");
  return chartShell(RH_SOL_VAC_HO_MES_ID, "Vacaciones y home office por mes de creación", CHART_H);
}

export function mountVacHoGroupedChart(root: ParentNode, rows: readonly SolicitudMesVacHo[]): void {
  if (rows.every((r) => r.vacaciones === 0 && r.home_office === 0)) return;
  const labels = rows.map((r) => etiquetaMesCorto(r.periodo));
  mountChart(root, RH_SOL_VAC_HO_MES_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Vacaciones",
          data: rows.map((r) => r.vacaciones),
          backgroundColor: colorConAlpha(colors.success, BAR_FILL_ALPHA),
          borderColor: colors.success,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
        },
        {
          label: "Home office",
          data: rows.map((r) => r.home_office),
          backgroundColor: colorConAlpha(colors.accent, BAR_FILL_ALPHA),
          borderColor: colors.accent,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      ...chartCartesianScales(colors),
    },
  }));
}

function diasMesTieneDatos(serie: SolicitudDiasPorMesSerie): boolean {
  return serie.totales.some((n) => n > 0);
}

export function renderDiasSolicitadosPorMesChart(serie: SolicitudDiasPorMesSerie): string {
  if (serie.periodos.length === 0) return emptyPanel("Sin periodo", CHART_H_DAY);
  if (!diasMesTieneDatos(serie)) {
    return emptyPanel("Sin días solicitados aprobados en el periodo", CHART_H_DAY);
  }
  return chartShell(RH_SOL_DIAS_MES_CHART_ID, "Días solicitados por mes", CHART_H_DAY);
}

function diasMesBarDataset(label: string, data: readonly number[], pal: { border: string; fill: string }) {
  return {
    label,
    data: [...data],
    backgroundColor: pal.fill,
    borderColor: pal.border,
    borderWidth: 1,
    borderRadius: BAR_RADIUS,
    stack: "dias",
  };
}

export function mountDiasSolicitadosPorMesChart(root: ParentNode, serie: SolicitudDiasPorMesSerie): void {
  if (!diasMesTieneDatos(serie)) return;
  const labels = serie.periodos.map(etiquetaMesCorto);

  mountChart(root, RH_SOL_DIAS_MES_CHART_ID, ({ colors }) => {
    const pal = {
      vac: { border: colors.success, fill: colorConAlpha(colors.success, BAR_FILL_ALPHA) },
      ho: { border: colors.accent, fill: colorConAlpha(colors.accent, BAR_FILL_ALPHA) },
      goce: { border: colors.leoniBlue, fill: colorConAlpha(colors.leoniBlue, BAR_FILL_ALPHA) },
      sin: { border: colors.warning, fill: colorConAlpha(colors.warning, BAR_FILL_ALPHA) },
    };
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          diasMesBarDataset("Días de vacaciones", serie.vacaciones, pal.vac),
          diasMesBarDataset("Días de home office", serie.home_office, pal.ho),
          diasMesBarDataset("Días de permisos con goce", serie.con_goce, pal.goce),
          diasMesBarDataset("Días de permisos sin goce", serie.sin_goce, pal.sin),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const i = items[0]?.dataIndex ?? -1;
                const t = i >= 0 ? (serie.totales[i] ?? 0) : 0;
                return t > 0 ? `Total: ${t} día${t === 1 ? "" : "s"}` : "";
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: colors.textMuted, font: { size: 10 } },
            grid: { color: colors.border, drawTicks: false },
            border: { color: colors.border },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: "Días solicitados", color: colors.textMuted, font: { size: 10 } },
            ticks: { color: colors.textMuted, precision: 0 },
            grid: { color: colors.border },
            border: { color: colors.border },
          },
        },
      },
    };
  });
}

function hoBarValueLabelsPlugin(values: readonly number[], textColor: string): Plugin<"bar"> {
  return {
    id: "rh-sol-ho-bar-value-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;
      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let i = 0; i < meta.data.length; i += 1) {
        const n = values[i] ?? 0;
        if (n <= 0) continue;
        const bar = meta.data[i] as { x: number; y: number };
        if (typeof bar.x !== "number" || typeof bar.y !== "number") continue;
        ctx.fillText(String(n), bar.x, bar.y - 6);
      }
      ctx.restore();
    },
  };
}

export function renderHoDiasPorDiaLaboralChart(serie: HoDiasPorDiaLaboralSerie): string {
  if (!hoDiasPorDiaLaboralTieneDatos(serie)) {
    return `${emptyPanel("Sin días de home office en el periodo filtrado", CHART_H_RANK)}${renderHoDiasPorDiaLaboralFootnote(serie)}`;
  }
  return `${chartShell(
    RH_SOL_HO_DIA_LABORAL_CHART_ID,
    "Días de home office por día laboral",
    CHART_H_RANK,
  )}${renderHoDiasPorDiaLaboralFootnote(serie)}`;
}

export function renderHoDiasPorDiaLaboralFootnote(serie: HoDiasPorDiaLaboralSerie): string {
  const diff =
    serie.solicitudes_ho > serie.total
      ? ` · ${serie.solicitudes_ho} solicitudes HO, ${serie.total} días laborales (sáb/dom no cuentan)`
      : "";
  return `<p class="mt-2 text-center text-[10px] leading-snug text-[color:var(--color-text-muted)]">Solo solicitudes aprobadas del periodo filtrado. El total cuenta días de lunes a viernes en cada periodo, no el número de solicitudes.${escapeHtml(diff)}.</p>`;
}

export function mountHoDiasPorDiaLaboralChart(root: ParentNode, serie: HoDiasPorDiaLaboralSerie): void {
  if (!hoDiasPorDiaLaboralTieneDatos(serie)) return;
  const border = colorForTipoCodigo("home_office");
  const valores = [...serie.valores];
  const maxVal = Math.max(...valores, 0);

  mountChart(root, RH_SOL_HO_DIA_LABORAL_CHART_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "bar",
      plugins: [hoBarValueLabelsPlugin(valores, colors.textSecondary)],
      data: {
        labels: [...serie.labels],
        datasets: [
          {
            label: "Días HO",
            data: valores,
            backgroundColor: colorConAlpha(border, TIPO_BAR_FILL_ALPHA),
            borderColor: border,
            borderWidth: 1,
            borderRadius: VERTICAL_BAR_BORDER_RADIUS,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const n = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
                return ` ${n} día${n === 1 ? "" : "s"}`;
              },
            },
          },
        },
        scales: {
          ...cartesian?.scales,
          y: {
            ...cartesian?.scales?.y,
            beginAtZero: true,
            suggestedMax: maxVal > 0 ? maxVal + Math.max(1, Math.ceil(maxVal * 0.15)) : 1,
            ticks: {
              color: colors.textMuted,
              font: { size: 10 },
              stepSize: 1,
              precision: 0,
              callback: (tickValue) => {
                const n = typeof tickValue === "number" ? tickValue : Number(tickValue);
                return Number.isInteger(n) ? String(n) : "";
              },
            },
          },
        },
      },
    };
  });
}

export function mountRhSolicitudesAnalyticsCharts(root: ParentNode, data: RhSolicitudesAnalyticsData): void {
  mountTipoDistribucionBarChart(root, RH_SOL_TIPO_BAR_ID, data.por_tipo, (row) =>
    colorForTipoCodigo(row.codigo ?? "vacaciones"),
  );
  mountDonutChart(root, RH_SOL_ESTADO_DONUT_ID, data.por_estado, (row) => ESTADO_COLORS[row.label] ?? cssVar("--color-border"));
  mountTendenciaMesChart(root, data.tendencia_mes_por_tipo);
  mountSolicitudesPorDepartamentoChart(root, data.solicitudes_por_departamento);
  mountVacHoGroupedChart(root, data.por_mes_vac_ho);
  mountDiasSolicitadosPorMesChart(root, data.dias_solicitados_por_mes);
  mountHoDiasPorDiaLaboralChart(root, data.ho_dias_por_dia_laboral);
}
