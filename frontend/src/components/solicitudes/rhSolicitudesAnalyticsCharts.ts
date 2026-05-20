/**
 * Gráficas de vista previa analítica — solicitudes RH (Chart.js).
 */

import type { Plugin } from "chart.js";
import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar, type ChartSemanticColors } from "../../charts/chartTokens.ts";
import type { SolicitudPersonasDiaSerie } from "../../solicitudes/rh/aggregateSolicitudesPersonasDia.ts";
import { formatPersonasDiaChartLabel } from "../../solicitudes/rh/aggregateSolicitudesPersonasDia.ts";
import {
  etiquetaMesCorto,
  type RhSolicitudesAnalyticsData,
  type SolicitudAnalyticsSlice,
  type SolicitudMesVacHo,
  type SolicitudRankingRow,
} from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

export const RH_SOL_TIPO_DONUT_ID = "rh-sol-tipo-doughnut";
export const RH_SOL_ESTADO_DONUT_ID = "rh-sol-estado-doughnut";
export const RH_SOL_TENDENCIA_MES_ID = "rh-sol-tendencia-mes";
export const RH_SOL_AREAS_BAR_ID = "rh-sol-areas-bar";
export const RH_SOL_SUP_PEND_BAR_ID = "rh-sol-sup-pend-bar";
export const RH_SOL_VAC_HO_MES_ID = "rh-sol-vac-ho-mes";
export const RH_SOL_PERSONAS_DIA_CHART_ID = "rh-sol-personas-dia";

export const RH_SOL_ANALYTICS_CHART_IDS = [
  RH_SOL_TIPO_DONUT_ID,
  RH_SOL_ESTADO_DONUT_ID,
  RH_SOL_TENDENCIA_MES_ID,
  RH_SOL_AREAS_BAR_ID,
  RH_SOL_SUP_PEND_BAR_ID,
  RH_SOL_VAC_HO_MES_ID,
  RH_SOL_PERSONAS_DIA_CHART_ID,
] as const;

export const CHART_H = "h-[280px]";
export const CHART_H_RANK = "h-[260px]";
export const CHART_H_DAY = "h-[300px]";

const BAR_FILL_ALPHA = 0.85;
const BAR_RADIUS = 4;
const DONUT_CUTOUT = "58%";

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

const TIPO_COLORS = [
  () => cssVar("--color-success", "#22C55E"),
  () => cssVar("--color-accent", "#2563EB"),
  () => cssVar("--color-leoni-blue", "#002147"),
  () => cssVar("--color-warning", "#F59E0B"),
];

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
          backgroundColor: rows.map((r, i) => colorsForRow?.(r, i) ?? TIPO_COLORS[i % TIPO_COLORS.length]()),
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

export function mountTendenciaMesChart(
  root: ParentNode,
  rows: readonly { periodo: string; total: number }[],
): void {
  if (rows.every((r) => r.total === 0)) return;
  const labels = rows.map((r) => etiquetaMesCorto(r.periodo));
  const values = rows.map((r) => r.total);
  mountChart(root, RH_SOL_TENDENCIA_MES_ID, ({ colors }) => {
    const border = colors.accent;
    return {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Solicitudes creadas",
            data: values,
            borderColor: border,
            backgroundColor: colorConAlpha(border, 0.15),
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        ...chartCartesianScales(colors),
      },
    };
  });
}

export function renderRankingPlaceholder(rows: readonly SolicitudRankingRow[], chartId: string, aria: string): string {
  if (rows.length === 0) return emptyPanel("Sin datos", CHART_H_RANK);
  return chartShell(chartId, aria, CHART_H_RANK);
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

function serieHasAusencias(serie: SolicitudPersonasDiaSerie): boolean {
  return serie.totales.some((n) => n > 0);
}

export function renderPersonasDiaChart(serie: SolicitudPersonasDiaSerie): string {
  if (serie.labels.length === 0) return emptyPanel("Sin rango de fechas", CHART_H_DAY);
  if (!serieHasAusencias(serie)) return emptyPanel("Sin ausencias aprobadas en el mes", CHART_H_DAY);
  return chartShell(RH_SOL_PERSONAS_DIA_CHART_ID, "Ausencias aprobadas por día", CHART_H_DAY);
}

function ausenciaBarDataset(label: string, data: readonly number[], pal: { border: string; fill: string }) {
  return {
    label,
    data: [...data],
    backgroundColor: pal.fill,
    borderColor: pal.border,
    borderWidth: 1,
    borderRadius: BAR_RADIUS,
    stack: "ausencias",
  };
}

export function mountPersonasDiaChart(root: ParentNode, serie: SolicitudPersonasDiaSerie): void {
  if (!serieHasAusencias(serie)) return;
  const labels = serie.labels.map(formatPersonasDiaChartLabel);
  mountChart(root, RH_SOL_PERSONAS_DIA_CHART_ID, ({ colors }) => {
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
          ausenciaBarDataset("Vacaciones", serie.vacaciones, pal.vac),
          ausenciaBarDataset("Home office", serie.home_office, pal.ho),
          ausenciaBarDataset("Permisos con goce", serie.con_goce, pal.goce),
          ausenciaBarDataset("Sin goce", serie.sin_goce, pal.sin),
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
              title: (items) => serie.labels[items[0]?.dataIndex ?? -1] ?? "",
              footer: (items) => {
                const i = items[0]?.dataIndex ?? -1;
                const t = i >= 0 ? (serie.totales[i] ?? 0) : 0;
                return t > 0 ? `Total: ${t} ausencia${t === 1 ? "" : "s"}` : "";
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: colors.textMuted, font: { size: 10 }, maxTicksLimit: 12, autoSkip: true },
            grid: { color: colors.border, drawTicks: false },
            border: { color: colors.border },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: "Ausencias", color: colors.textMuted, font: { size: 10 } },
            ticks: { color: colors.textMuted, precision: 0 },
            grid: { color: colors.border },
            border: { color: colors.border },
          },
        },
      },
    };
  });
}

export function mountRhSolicitudesAnalyticsCharts(root: ParentNode, data: RhSolicitudesAnalyticsData): void {
  mountDonutChart(root, RH_SOL_TIPO_DONUT_ID, data.por_tipo, (_row, i) => TIPO_COLORS[i % TIPO_COLORS.length]());
  mountDonutChart(root, RH_SOL_ESTADO_DONUT_ID, data.por_estado, (row) => ESTADO_COLORS[row.label] ?? cssVar("--color-border"));
  mountTendenciaMesChart(root, data.por_mes_creadas);
  mountRankingHorizontalBar(root, RH_SOL_AREAS_BAR_ID, data.areas_top, cssVar("--color-accent"), "Solicitudes");
  mountRankingHorizontalBar(
    root,
    RH_SOL_SUP_PEND_BAR_ID,
    data.supervisores_pendientes,
    cssVar("--color-warning"),
    "Pendientes",
  );
  mountVacHoGroupedChart(root, data.por_mes_vac_ho);
  mountPersonasDiaChart(root, data.personas_dia);
}
