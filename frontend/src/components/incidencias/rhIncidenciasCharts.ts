/**
 * Gráficas de incidencias RH con Chart.js (tendencia line, doughnut, rankings bar).
 */

import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import type {
  IncidenciaTendenciaPorTipo,
  RhDashboardTendenciaAgrupacion,
} from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
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
/** Radio moderado para barras verticales (alineado con analítica de solicitudes). */
const VERTICAL_BAR_BORDER_RADIUS = 8;

const TENDENCIA_RED_ALPHA = 0.2;
const TENDENCIA_LINE_TENSION_SMOOTH = 0.4;
const TENDENCIA_TIPO_LINE_TENSION = 0.35;
const TENDENCIA_TIPO_FILL_ALPHA = 0.12;

export type DonutTipoRow = { tipo: string; total: number; porcentaje: number };

export type SerieMesRow = { periodo: string; total: number };

function periodoMesActualLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Excluye meses futuros del eje de tendencia mensual. */
export function filterSerieMesSinFuturo(rows: readonly SerieMesRow[]): SerieMesRow[] {
  const max = periodoMesActualLocal();
  return rows.filter((r) => {
    const p = r.periodo.trim();
    return /^\d{4}-\d{2}$/.test(p) && p <= max;
  });
}

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

function etiquetaMesTooltip(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  if (!y || !m) return periodo;
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}

function etiquetaPeriodoEje(periodo: string, agrupacion: RhDashboardTendenciaAgrupacion): string {
  if (agrupacion === "mes") return etiquetaMesCorto(periodo);
  if (agrupacion === "dia") {
    const [y, m, d] = periodo.split("-").map(Number);
    if (!y || !m || !d) return periodo;
    const raw = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
      new Date(y, m - 1, d),
    );
    return raw.replace(/\./g, "");
  }
  const [y, m, d] = periodo.split("-").map(Number);
  if (!y || !m || !d) return periodo;
  const end = new Date(y, m - 1, d + 6);
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
  const ini = fmt.format(new Date(y, m - 1, d)).replace(/\./g, "");
  const fin = fmt.format(end).replace(/\./g, "");
  return `${ini}–${fin}`;
}

function etiquetaPeriodoTooltip(periodo: string, agrupacion: RhDashboardTendenciaAgrupacion): string {
  if (agrupacion === "mes") return etiquetaMesTooltip(periodo);
  if (agrupacion === "dia") {
    const [y, m, d] = periodo.split("-").map(Number);
    if (!y || !m || !d) return periodo;
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  }
  const [y, m, d] = periodo.split("-").map(Number);
  if (!y || !m || !d) return periodo;
  const end = new Date(y, m - 1, d + 6);
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return `Semana ${fmt.format(new Date(y, m - 1, d))} – ${fmt.format(end)}`;
}

/** Contenedor canvas para tendencia multilínea por tipo de incidencia. */
export function renderIncidenciasTendenciaPorTipoChart(
  data: IncidenciaTendenciaPorTipo,
  chartId: string = RH_INC_TENDENCIA_CHART_ID,
): string {
  const has = data.series.some((s) => s.valores.some((v) => v > 0));
  if (!has || data.periodos.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId,
        ariaLabel: "Tendencia por tipo de incidencia",
        heightClass: RH_INC_ANALYTICS_CHART_HEIGHT_CLASS,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

/** Multilínea: una serie por tipo de incidencia (top N + Otros). */
export function mountIncidenciasTendenciaPorTipoChart(
  root: ParentNode,
  data: IncidenciaTendenciaPorTipo,
  chartId: string = RH_INC_TENDENCIA_CHART_ID,
): void {
  const seriesConDatos = data.series.filter((s) => s.valores.some((v) => v > 0));
  if (seriesConDatos.length === 0 || data.periodos.length === 0) return;

  const labels = data.periodos.map((p) => etiquetaPeriodoEje(p, data.agrupacion));
  const periodos = data.periodos;
  const agrupacion = data.agrupacion;

  mountChart(root, chartId, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels,
        datasets: seriesConDatos.map((s) => {
          const border = fillColorForTipo(s.tipo);
          return {
            label: s.label,
            data: [...s.valores],
            borderColor: border,
            backgroundColor: colorConAlpha(border, TENDENCIA_TIPO_FILL_ALPHA),
            fill: false,
            tension: TENDENCIA_TIPO_LINE_TENSION,
            pointRadius: 3,
            pointHoverRadius: 5,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: colors.textSecondary, font: { size: 11 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const i = items[0]?.dataIndex ?? -1;
                const p = i >= 0 ? periodos[i] : "";
                return p ? etiquetaPeriodoTooltip(p, agrupacion) : "";
              },
              label: (ctx) => {
                const tipo = ctx.dataset.label ?? "";
                const n = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
                return ` ${tipo}: ${n} incidencia${n === 1 ? "" : "s"}`;
              },
            },
          },
        },
        scales: {
          ...cartesian?.scales,
          x: {
            ...cartesian?.scales?.x,
            ticks: {
              color: colors.textMuted,
              font: { size: 10 },
              maxRotation: agrupacion === "dia" ? 45 : 0,
              autoSkip: agrupacion === "dia",
              maxTicksLimit: agrupacion === "dia" ? 8 : undefined,
            },
          },
          y: {
            ...cartesian?.scales?.y,
            beginAtZero: true,
            title: {
              display: true,
              text: "Incidencias",
              color: colors.textMuted,
              font: { size: 10 },
            },
            ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    };
  });
}

/** Contenedor canvas para tendencia mensual (Chart.js se monta tras pintar el DOM). */
export function renderIncidenciasTendenciaPorMes(rows: readonly SerieMesRow[]): string {
  const serie = filterSerieMesSinFuturo(rows);
  if (serie.length === 0) {
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
export function renderIncidenciasAreasBarChart(
  rows: readonly AreaRankingRow[],
  chartId: string = RH_INC_AREAS_BAR_CHART_ID,
): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por área</div>`;
  }
  return `
    <div class="rh-inc-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId,
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
  chartId: string = RH_INC_AREAS_BAR_CHART_ID,
): void {
  const topRows = rows.slice(0, RANKING_BAR_TOP);
  if (topRows.length === 0) return;

  const labels = topRows.map((r) => r.area);
  const values = topRows.map((r) => r.total);

  mountChart(root, chartId, ({ colors }) => {
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
  const serie = filterSerieMesSinFuturo(rows);
  if (serie.length === 0) return;

  const labels = serie.map((r) => etiquetaMesCorto(r.periodo));
  const values = serie.map((r) => r.total);

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
