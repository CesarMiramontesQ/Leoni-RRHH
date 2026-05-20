/**
 * Gráficas de vista previa analítica — solicitudes RH (Chart.js).
 */

import type { Plugin } from "chart.js";
import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar, type ChartSemanticColors } from "../../charts/chartTokens.ts";
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
  type SolicitudAreasVacHoRow,
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
/** Barras verticales con esquinas redondeadas — @see https://www.chartjs.org/docs/latest/samples/bar/border-radius.html */
const TIPO_BAR_BORDER_RADIUS = Number.MAX_VALUE;
const TIPO_BAR_FILL_ALPHA = 0.5;
const TIPO_BAR_BORDER_WIDTH = 2;
const DONUT_CUTOUT = "58%";
const TENDENCIA_LINE_FILL_ALPHA = 0.5;
const TENDENCIA_LINE_TENSION = 0.35;
/** Radio moderado para barras HO por día laboral (evita aspecto píldora). */
const HO_DIA_LABORAL_BAR_RADIUS = 8;

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
  vacaciones: () => cssVar("--color-success", "#22C55E"),
  home_office: () => cssVar("--color-accent", "#2563EB"),
  matrimonio: () => cssVar("--color-leoni-green", "#00C853"),
  incapacidad_interna: () => cssVar("--color-leoni-blue-light", "#0D3D66"),
  defuncion: () => cssVar("--color-text-muted", "#5A6880"),
  paternidad: () => cssVar("--color-leoni-blue", "#002147"),
  permiso_sin_goce_sueldo: () => cssVar("--color-warning", "#F59E0B"),
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
          borderWidth: TIPO_BAR_BORDER_WIDTH,
          borderRadius: TIPO_BAR_BORDER_RADIUS,
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

export function renderAreasVacHoRankingPlaceholder(
  rows: readonly SolicitudAreasVacHoRow[],
  chartId: string,
  aria: string,
): string {
  if (rows.length === 0) return emptyPanel("Sin vacaciones ni home office por área", CHART_H_RANK);
  return chartShell(chartId, aria, CHART_H_RANK);
}

/** Ranking horizontal agrupado: vacaciones vs home office por área. */
export function mountAreasVacHoRankingBar(root: ParentNode, rows: readonly SolicitudAreasVacHoRow[]): void {
  if (rows.length === 0) return;
  const labels = rows.map((r) => r.label);

  mountChart(root, RH_SOL_AREAS_BAR_ID, ({ colors }) => ({
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
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
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
            borderRadius: HO_DIA_LABORAL_BAR_RADIUS,
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
    colorForTipoCodigo(row.codigo),
  );
  mountDonutChart(root, RH_SOL_ESTADO_DONUT_ID, data.por_estado, (row) => ESTADO_COLORS[row.label] ?? cssVar("--color-border"));
  mountTendenciaMesChart(root, data.tendencia_mes_por_tipo);
  mountAreasVacHoRankingBar(root, data.areas_top_vac_ho);
  mountVacHoGroupedChart(root, data.por_mes_vac_ho);
  mountDiasSolicitadosPorMesChart(root, data.dias_solicitados_por_mes);
  mountHoDiasPorDiaLaboralChart(root, data.ho_dias_por_dia_laboral);
}
