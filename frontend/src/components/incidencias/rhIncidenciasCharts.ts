/**
 * Gráficas de incidencias RH con Chart.js (tendencia line, doughnut, rankings bar).
 */

import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";

export const RH_INC_TENDENCIA_CHART_ID = "rh-inc-tendencia-mes";
export const RH_INC_TIPO_BAR_CHART_ID = "rh-inc-tipo-bar";
export const RH_INC_AREAS_BAR_CHART_ID = "rh-inc-areas-bar";
export const RH_INC_SUBAREAS_BAR_CHART_ID = "rh-inc-subareas-bar";

/** Altura compartida del área de gráfica (tendencia + distribución por tipo). */
export const RH_INC_ANALYTICS_CHART_HEIGHT_CLASS = "h-[280px]";

/** Altura de rankings por área/subárea (barras verticales). */
export const RH_INC_RANKING_BAR_CHART_HEIGHT_CLASS = "h-[260px]";

const RANKING_BAR_TOP = 5;
const RANKING_BAR_FILL_ALPHA = 0.5;
/** Barras verticales con esquinas redondeadas — @see https://www.chartjs.org/docs/latest/samples/bar/border-radius.html */
const TIPO_BAR_BORDER_RADIUS = Number.MAX_VALUE;
const TIPO_BAR_BORDER_WIDTH = 2;

const TENDENCIA_RED_ALPHA = 0.2;
const TENDENCIA_LINE_TENSION_SMOOTH = 0.4;

export type DonutTipoRow = { tipo: string; total: number; porcentaje: number };

export type SerieMesRow = { periodo: string; total: number };

export type AreaRankingRow = { area: string; total: number };

export type SubareaRankingRow = { subarea: string; total: number; area?: string | null };

/** Color por tipo (valores resueltos para canvas Chart.js). */
function fillColorForTipo(tipoRaw: string): string {
  const t = tipoRaw.toLowerCase();
  if (t.includes("seguridad")) return cssVar("--color-kpi-metric-inactivo-icon", "#f87171");
  if (t.includes("calidad")) return cssVar("--color-leoni-green", "#00C853");
  if (t.includes("retardo") || t.includes("tardan")) return cssVar("--color-accent", "#2563EB");
  if (t.includes("falta") || t.includes("ausencia")) return cssVar("--color-text-muted", "#5A6880");
  if (t.includes("daño") || t.includes("dano") || t.includes("equipo")) {
    return cssVar("--color-leoni-blue-light", "#0D3D66");
  }
  if (t.includes("indisciplina")) return cssVar("--color-leoni-blue", "#002147");
  return cssVar("--color-border", "#D1DCE8");
}

function etiquetaMesCorto(periodo: string): string {
  const [y, m] = periodo.split("-");
  if (!y || !m) return periodo;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mi = Number.parseInt(m, 10) - 1;
  const pref = mi >= 0 && mi < 12 ? meses[mi] : m;
  return `${pref} ${y.slice(2)}`;
}

function colorConAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(239, 68, 68, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Contenedor canvas para distribución por tipo (Chart.js bar con border radius). */
export function renderIncidenciasTipoBarChart(rows: readonly DonutTipoRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0 || rows.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por tipo</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_INC_TIPO_BAR_CHART_ID,
        ariaLabel: "Distribución por tipo de incidencia",
        heightClass: RH_INC_ANALYTICS_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Monta barras verticales por tipo. @see https://www.chartjs.org/docs/latest/samples/bar/border-radius.html */
export function mountIncidenciasTipoBarChart(root: ParentNode, rows: readonly DonutTipoRow[]): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0 || rows.length === 0) return;

  const labels = rows.map((r) => labelTipoIncidenciaUi(r.tipo));
  const values = rows.map((r) => r.total);
  const borderColors = rows.map((r) => fillColorForTipo(r.tipo));
  const backgroundColors = borderColors.map((c) => colorConAlpha(c, RANKING_BAR_FILL_ALPHA));

  mountChart(root, RH_INC_TIPO_BAR_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Incidencias",
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
              if (!row) return "";
              return ` ${row.total} (${row.porcentaje.toFixed(1)}%)`;
            },
          },
        },
      },
      ...chartCartesianScales(colors),
    },
  }));
}

/** Contenedor canvas para tendencia mensual (Chart.js se monta tras pintar el DOM). */
export function renderIncidenciasTendenciaPorMes(rows: readonly SerieMesRow[]): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_INC_TENDENCIA_CHART_ID,
        ariaLabel: "Tendencia de incidencias por mes",
        heightClass: RH_INC_ANALYTICS_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Contenedor canvas para ranking por área (Chart.js bar vertical). */
export function renderIncidenciasAreasBarChart(rows: readonly AreaRankingRow[]): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por área</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_INC_AREAS_BAR_CHART_ID,
        ariaLabel: "Áreas con más incidencias",
        heightClass: RH_INC_RANKING_BAR_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Monta barras verticales con `areas_con_mas_incidencias` (top 5). @see https://www.chartjs.org/docs/latest/samples/bar/vertical.html */
export function mountIncidenciasAreasBarChart(
  root: ParentNode,
  rows: readonly AreaRankingRow[],
  totalGeneral: number,
): void {
  const topRows = rows.slice(0, RANKING_BAR_TOP);
  if (topRows.length === 0) return;

  const labels = topRows.map((r) => r.area);
  const values = topRows.map((r) => r.total);

  mountChart(root, RH_INC_AREAS_BAR_CHART_ID, ({ colors }) => {
    const borderColor = colors.accent;
    const backgroundColor = colorConAlpha(borderColor, RANKING_BAR_FILL_ALPHA);
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Incidencias",
            data: values,
            borderColor,
            backgroundColor,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const row = topRows[items[0]?.dataIndex ?? -1];
                return row?.area ?? "";
              },
              label: (ctx) => {
                const row = topRows[ctx.dataIndex];
                if (!row) return "";
                const pct =
                  totalGeneral > 0
                    ? (Math.round((1000 * row.total) / totalGeneral) / 10).toFixed(1)
                    : "0";
                return ` ${row.total} (${pct}% del total)`;
              },
            },
          },
        },
        ...chartCartesianScales(colors),
      },
    };
  });
}

/** Contenedor canvas para ranking por subárea (Chart.js bar vertical). */
export function renderIncidenciasSubareasBarChart(rows: readonly SubareaRankingRow[]): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por subárea</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_INC_SUBAREAS_BAR_CHART_ID,
        ariaLabel: "Subáreas con más incidencias",
        heightClass: RH_INC_RANKING_BAR_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Monta barras verticales con `subareas_con_mas_incidencias` (top 5). @see https://www.chartjs.org/docs/latest/samples/bar/vertical.html */
export function mountIncidenciasSubareasBarChart(
  root: ParentNode,
  rows: readonly SubareaRankingRow[],
  totalGeneral: number,
): void {
  const topRows = rows.slice(0, RANKING_BAR_TOP);
  if (topRows.length === 0) return;

  const labels = topRows.map((r) => r.subarea);
  const values = topRows.map((r) => r.total);

  mountChart(root, RH_INC_SUBAREAS_BAR_CHART_ID, ({ colors }) => {
    const borderColor = cssVar("--color-leoni-blue-light", "#0D3D66");
    const backgroundColor = colorConAlpha(borderColor, RANKING_BAR_FILL_ALPHA);
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Incidencias",
            data: values,
            borderColor,
            backgroundColor,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const row = topRows[items[0]?.dataIndex ?? -1];
                return row?.subarea ?? "";
              },
              afterTitle: (items) => {
                const row = topRows[items[0]?.dataIndex ?? -1];
                const ar = row?.area?.trim();
                return ar && ar.length > 0 ? ar : "";
              },
              label: (ctx) => {
                const row = topRows[ctx.dataIndex];
                if (!row) return "";
                const pct =
                  totalGeneral > 0
                    ? (Math.round((1000 * row.total) / totalGeneral) / 10).toFixed(1)
                    : "0";
                return ` ${row.total} (${pct}% del total)`;
              },
            },
          },
        },
        ...chartCartesianScales(colors),
      },
    };
  });
}

/** Monta la gráfica de líneas con datos reales de `incidencias_por_mes`. */
export function mountIncidenciasTendenciaPorMesChart(root: ParentNode, rows: readonly SerieMesRow[]): void {
  if (rows.length === 0) return;

  const labels = rows.map((r) => etiquetaMesCorto(r.periodo));
  const values = rows.map((r) => r.total);

  mountChart(root, RH_INC_TENDENCIA_CHART_ID, ({ colors }) => {
    const borderColor = colors.danger;
    const backgroundColor = colorConAlpha(borderColor, TENDENCIA_RED_ALPHA);
    return {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            fill: "start",
            borderColor,
            backgroundColor,
          },
        ],
      },
      options: {
        plugins: {
          filler: {
            propagate: false,
          },
          legend: {
            display: false,
          },
        },
        interaction: {
          intersect: false,
        },
        elements: {
          line: {
            tension: TENDENCIA_LINE_TENSION_SMOOTH,
          },
        },
        ...chartCartesianScales(colors),
      },
    };
  });
}
