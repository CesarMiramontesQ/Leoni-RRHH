import { chartCartesianScales, mountChart, renderChartCanvas } from "../charts/index.ts";
import { cssVar } from "../charts/chartTokens.ts";
import type { CompetenciaPuntuacion } from "./types.ts";
import { DISTRIBUCION_EVALUADORES, COMPARATIVO_DEPARTAMENTO, EVOLUCION_HISTORICA } from "./mockData.ts";

export const E360_DONUT_CHART_ID = "e360-donut-evaluadores";
export const E360_RADAR_CHART_ID = "e360-radar-competencias";
export const E360_BAR_COMPARATIVO_ID = "e360-bar-comparativo";
export const E360_LINE_EVOLUCION_ID = "e360-line-evolucion";
export const E360_BAR_DEPT_ID = "e360-bar-departamento";

export function renderEval360ChartIds(): {
  donut: string;
  radar: string;
  barComparativo: string;
  lineEvolucion: string;
  barDept: string;
} {
  return {
    donut: renderChartCanvas({ chartId: E360_DONUT_CHART_ID, ariaLabel: "Distribución de evaluadores", heightClass: "h-[220px]" }),
    radar: renderChartCanvas({ chartId: E360_RADAR_CHART_ID, ariaLabel: "Radar de competencias", heightClass: "h-[280px]" }),
    barComparativo: renderChartCanvas({ chartId: E360_BAR_COMPARATIVO_ID, ariaLabel: "Comparativo autoevaluación vs evaluadores", heightClass: "h-[260px]" }),
    lineEvolucion: renderChartCanvas({ chartId: E360_LINE_EVOLUCION_ID, ariaLabel: "Evolución histórica de calificación", heightClass: "h-[240px]" }),
    barDept: renderChartCanvas({ chartId: E360_BAR_DEPT_ID, ariaLabel: "Comparativo por departamento", heightClass: "h-[240px]" }),
  };
}

export function mountEval360DashboardCharts(root: ParentNode): void {
  mountChart(root, E360_DONUT_CHART_ID, ({ colors, palette }) => ({
    type: "doughnut",
    data: {
      labels: DISTRIBUCION_EVALUADORES.map((d) => d.tipo),
      datasets: [
        {
          data: DISTRIBUCION_EVALUADORES.map((d) => d.valor),
          backgroundColor: palette.slice(0, 5),
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: colors.textSecondary, font: { size: 11 } } },
      },
    },
  }));
}

export function mountEval360ResultadosCharts(root: ParentNode, competencias: CompetenciaPuntuacion[]): void {
  const labels = competencias.map((c) => c.nombre);

  mountChart(root, E360_RADAR_CHART_ID, ({ colors }) => ({
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "Autoevaluación",
          data: competencias.map((c) => c.autoevaluacion),
          borderColor: cssVar("--color-accent", "#2563EB"),
          backgroundColor: "rgba(37, 99, 235, 0.15)",
          borderWidth: 2,
          pointRadius: 3,
        },
        {
          label: "Promedio evaluadores",
          data: competencias.map((c) => c.evaluadores),
          borderColor: cssVar("--color-success", "#22C55E"),
          backgroundColor: "rgba(34, 197, 94, 0.12)",
          borderWidth: 2,
          pointRadius: 3,
        },
      ],
    },
    options: {
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, color: colors.textMuted, backdropColor: "transparent" },
          grid: { color: colors.border },
          pointLabels: { color: colors.textSecondary, font: { size: 10 } },
        },
      },
      plugins: { legend: { position: "bottom" } },
    },
  }));

  mountChart(root, E360_BAR_COMPARATIVO_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Autoevaluación",
          data: competencias.map((c) => c.autoevaluacion),
          backgroundColor: cssVar("--color-accent", "#2563EB"),
          borderRadius: 4,
        },
        {
          label: "Evaluadores",
          data: competencias.map((c) => c.evaluadores),
          backgroundColor: cssVar("--color-success", "#22C55E"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...chartCartesianScales(colors),
      plugins: { legend: { position: "bottom" } },
    },
  }));
}

export function mountEval360ReportesCharts(root: ParentNode): void {
  mountChart(root, E360_LINE_EVOLUCION_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels: EVOLUCION_HISTORICA.map((e) => e.periodo),
        datasets: [
          {
            label: "Promedio general",
            data: EVOLUCION_HISTORICA.map((e) => e.valor),
            borderColor: cssVar("--color-accent", "#2563EB"),
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
        ],
      },
      options: {
        ...cartesian,
        scales: {
          ...cartesian?.scales,
          y: { ...cartesian?.scales?.y, min: 2.5, max: 5 },
        },
      },
    };
  });

  mountChart(root, E360_BAR_DEPT_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels: COMPARATIVO_DEPARTAMENTO.map((d) => d.dept),
      datasets: [
        {
          label: "Promedio",
          data: COMPARATIVO_DEPARTAMENTO.map((d) => d.valor),
          backgroundColor: cssVar("--color-accent", "#2563EB"),
          borderRadius: 6,
        },
      ],
    },
    options: {
      ...chartCartesianScales(colors),
      indexAxis: "y" as const,
    },
  }));
}
