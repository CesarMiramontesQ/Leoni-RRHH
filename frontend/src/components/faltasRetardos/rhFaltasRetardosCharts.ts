import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import {
  filterSerieMesSinFuturo,
  type SerieMesRow,
} from "../incidencias/rhIncidenciasCharts.ts";
import { labelFaltaRetardoTipo } from "../../faltasRetardos/rh/constants.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";

export const RH_FR_TENDENCIA_CHART_ID = "rh-fr-tendencia-mes";
export const RH_FR_TIPO_BAR_CHART_ID = "rh-fr-tipo-bar";
export const RH_FR_EMPLEADOS_BAR_CHART_ID = "rh-fr-empleados-bar";

const CHART_H = "h-[280px]";
const BAR_RADIUS = 8;
const BAR_FILL_ALPHA = 0.5;

export type FaltaRetardoTipoRow = {
  tipo: FaltaRetardoTipo;
  total: number;
  porcentaje: number;
};

function colorConAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorForTipo(tipo: FaltaRetardoTipo): string {
  switch (tipo) {
    case "falta_justificada":
      return cssVar("--color-leoni-green", "#00C853");
    case "falta_injustificada":
      return cssVar("--color-kpi-metric-inactivo-icon", "#f87171");
    case "retardo":
      return cssVar("--color-accent", "#2563EB");
    case "incapacidad":
      return cssVar("--color-leoni-blue-light", "#0D3D66");
    case "suspension":
      return cssVar("--color-text-muted", "#5A6880");
    default:
      return cssVar("--color-border", "#D1DCE8");
  }
}

export function renderFaltasRetardosTendenciaChart(rows: readonly SerieMesRow[]): string {
  const serie = filterSerieMesSinFuturo(rows);
  if (serie.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  return `
    <div class="flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_TENDENCIA_CHART_ID,
        ariaLabel: "Tendencia de faltas y retardos por mes",
        heightClass: CHART_H,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

export function mountFaltasRetardosTendenciaChart(
  root: ParentNode,
  rows: readonly SerieMesRow[],
): void {
  const serie = filterSerieMesSinFuturo(rows);
  if (serie.length === 0) return;
  const labels = serie.map((r) => r.periodo);
  const values = serie.map((r) => r.total);
  const lineColor = cssVar("--color-accent", "#2563EB");
  mountChart(root, RH_FR_TENDENCIA_CHART_ID, ({ colors }) => ({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Eventos",
          data: values,
          borderColor: lineColor,
          backgroundColor: colorConAlpha(lineColor, 0.15),
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
  }));
}

export function renderFaltasRetardosTipoBarChart(rows: readonly FaltaRetardoTipoRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por tipo</div>`;
  }
  return `
    <div class="flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_TIPO_BAR_CHART_ID,
        ariaLabel: "Distribución por tipo de evento",
        heightClass: CHART_H,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

export function mountFaltasRetardosTipoBarChart(
  root: ParentNode,
  rows: readonly FaltaRetardoTipoRow[],
): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return;
  const labels = rows.map((r) => labelFaltaRetardoTipo(r.tipo));
  const values = rows.map((r) => r.total);
  const borderColors = rows.map((r) => colorForTipo(r.tipo));
  const backgroundColors = borderColors.map((c) => colorConAlpha(c, BAR_FILL_ALPHA));
  mountChart(root, RH_FR_TIPO_BAR_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Eventos",
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
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

export function renderFaltasRetardosEmpleadosBarChart(hasData: boolean): string {
  if (!hasData) {
    return `<div class="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin empleados con eventos en el periodo</div>`;
  }
  return `
    <div class="flex min-h-[260px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_EMPLEADOS_BAR_CHART_ID,
        ariaLabel: "Empleados con más eventos de asistencia",
        heightClass: "h-[260px]",
        className: "relative w-full min-w-0",
      })}
    </div>`;
}
