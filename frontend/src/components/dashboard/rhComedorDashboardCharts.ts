import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { cssVar } from "../../charts/chartTokens.ts";
import type {
  RhDashComedorAsistenciaDia,
  RhDashComedorSemanaFutura,
} from "../../comedor/rh/buildRhDashboardComedorCharts.ts";
import { RH_DASH_PERIOD_EMPTY_MSG } from "../../dashboard/rh/analyticsTypes.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  asistenciaDiariaTieneDatos,
  registrosFuturosTieneDatos,
} from "../../comedor/rh/buildRhDashboardComedorCharts.ts";

export const RH_DASH_COMEDOR_ASISTENCIA_CHART_ID = "rh-dash-comedor-asistencia-line";
export const RH_DASH_COMEDOR_FUTUROS_CHART_ID = "rh-dash-comedor-futuros-bar";

export const RH_DASH_COMEDOR_CHART_IDS = [
  RH_DASH_COMEDOR_ASISTENCIA_CHART_ID,
  RH_DASH_COMEDOR_FUTUROS_CHART_ID,
] as const;

const CHART_H = "h-[260px]";
const LINE_FILL_ALPHA = 0.12;
const BAR_FILL_ALPHA = 0.85;

function colorConAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chartShell(chartId: string, ariaLabel: string): string {
  return `<div class="rh-sol-chart-panel flex w-full min-w-0 flex-1 flex-col justify-center ${CHART_H}">
    ${renderChartCanvas({ chartId, ariaLabel, heightClass: "h-full min-h-[200px]", className: "relative w-full min-w-0 h-full" })}
  </div>`;
}

export function renderDashComedorAsistenciaDiariaChart(
  serie: readonly RhDashComedorAsistenciaDia[] | null,
): string {
  if (!asistenciaDiariaTieneDatos(serie)) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(RH_DASH_PERIOD_EMPTY_MSG)}</p>`;
  }
  return chartShell(RH_DASH_COMEDOR_ASISTENCIA_CHART_ID, "Porcentaje de asistencia diario");
}

export function renderDashComedorRegistrosFuturosChart(
  semanas: readonly RhDashComedorSemanaFutura[] | null,
): string {
  if (!registrosFuturosTieneDatos(semanas)) {
    return `<p class="rh-dash-analytics-empty">${escapeHtml(RH_DASH_PERIOD_EMPTY_MSG)}</p>`;
  }
  return chartShell(RH_DASH_COMEDOR_FUTUROS_CHART_ID, "Registros por semana futura");
}

export function mountDashComedorAsistenciaDiariaChart(
  root: ParentNode,
  serie: readonly RhDashComedorAsistenciaDia[],
): void {
  if (!asistenciaDiariaTieneDatos(serie)) return;
  const accent = cssVar("--color-accent", "#2563EB");
  mountChart(root, RH_DASH_COMEDOR_ASISTENCIA_CHART_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels: serie.map((d) => d.label),
        datasets: [
          {
            label: "% asistencia",
            data: serie.map((d) => d.pct),
            borderColor: accent,
            backgroundColor: colorConAlpha(accent, LINE_FILL_ALPHA),
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: serie.length > 20 ? 0 : 3,
            pointHoverRadius: 4,
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
              title: (items) => {
                const idx = items[0]?.dataIndex ?? -1;
                return serie[idx]?.fecha ?? "";
              },
              label: (ctx) => ` ${ctx.parsed.y ?? 0}% asistencia`,
            },
          },
        },
        scales: {
          x: cartesian.scales?.x,
          y: {
            ...cartesian.scales?.y,
            min: 0,
            max: 100,
            ticks: {
              color: colors.textMuted,
              font: { size: 10 },
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  });
}

export function mountDashComedorRegistrosFuturosChart(
  root: ParentNode,
  semanas: readonly RhDashComedorSemanaFutura[],
): void {
  if (!registrosFuturosTieneDatos(semanas)) return;
  const accent = cssVar("--color-accent", "#2563EB");
  mountChart(root, RH_DASH_COMEDOR_FUTUROS_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels: semanas.map((s) => s.label),
      datasets: [
        {
          label: "Registros",
          data: semanas.map((s) => s.total),
          backgroundColor: colorConAlpha(accent, BAR_FILL_ALPHA),
          borderColor: accent,
          borderWidth: 1,
          borderRadius: 4,
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
