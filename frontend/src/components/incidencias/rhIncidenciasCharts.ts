/**
 * Gráficas de incidencias RH con Chart.js (tendencia line, distribución doughnut).
 */

import type { Plugin } from "chart.js";
import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar, type ChartSemanticColors } from "../../charts/chartTokens.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";

export const RH_INC_TENDENCIA_CHART_ID = "rh-inc-tendencia-mes";
export const RH_INC_TIPO_DOUGHNUT_CHART_ID = "rh-inc-tipo-doughnut";

/** Altura compartida del área de gráfica (tendencia + distribución por tipo). */
export const RH_INC_ANALYTICS_CHART_HEIGHT_CLASS = "h-[280px]";

const TENDENCIA_RED_ALPHA = 0.2;
const TENDENCIA_LINE_TENSION_SMOOTH = 0.4;

export type DonutTipoRow = { tipo: string; total: number; porcentaje: number };

export type SerieMesRow = { periodo: string; total: number };

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

function doughnutCenterPlugin(total: number, colors: ChartSemanticColors): Plugin<"doughnut"> {
  return {
    id: "rh-inc-doughnut-center",
    afterDraw(chart) {
      const arcs = chart.getDatasetMeta(0).data;
      if (arcs.length === 0) return;
      const arc = arcs[0] as { x: number; y: number };
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.textPrimary;
      ctx.font = "bold 15px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(String(total), arc.x, arc.y - 6);
      ctx.fillStyle = colors.textSecondary;
      ctx.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("TOTAL", arc.x, arc.y + 10);
      ctx.restore();
    },
  };
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

/** Contenedor canvas para distribución por tipo (Chart.js doughnut). */
export function renderIncidenciasDonutPorTipo(rows: readonly DonutTipoRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0 || rows.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por tipo</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_INC_TIPO_DOUGHNUT_CHART_ID,
        ariaLabel: "Distribución por tipo de incidencia",
        heightClass: RH_INC_ANALYTICS_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Monta doughnut con datos reales de `incidencias_por_tipo`. @see https://www.chartjs.org/docs/latest/samples/other-charts/doughnut.html */
export function mountIncidenciasDonutPorTipoChart(root: ParentNode, rows: readonly DonutTipoRow[]): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0 || rows.length === 0) return;

  const labels = rows.map((r) => labelTipoIncidenciaUi(r.tipo));
  const values = rows.map((r) => r.total);
  const sliceColors = rows.map((r) => fillColorForTipo(r.tipo));

  mountChart(root, RH_INC_TIPO_DOUGHNUT_CHART_ID, ({ colors }) => ({
    type: "doughnut",
    plugins: [doughnutCenterPlugin(total, colors)],
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: sliceColors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "58%",
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: colors.textSecondary,
            font: { size: 11, weight: 500 },
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
          },
        },
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
