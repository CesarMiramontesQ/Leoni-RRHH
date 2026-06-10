import { chartCartesianScales, mountChart, renderChartCanvas } from "../charts/index.ts";
import { cssVar } from "../charts/chartTokens.ts";
import type { CompetenciaPuntuacion, EmpleadoEval360 } from "./types.ts";
import { COMPARATIVO_DEPARTAMENTO, EVOLUCION_HISTORICA } from "./mockData.ts";

export const E360_DONUT_CHART_ID = "e360-donut-evaluadores";
export const E360_RADAR_CHART_ID = "e360-radar-competencias";
export const E360_BAR_COMPARATIVO_ID = "e360-bar-comparativo";
export const E360_LINE_EVOLUCION_ID = "e360-line-evolucion";
export const E360_BAR_DEPT_ID = "e360-bar-departamento";
export const E360_RADAR_DEPT_COMP_ID = "e360-radar-dept-competencias";
export const E360_LINE_EMPLEADO_ID = "e360-line-empleado-historico";

export function renderEval360ChartIds(): {
  donut: string;
  radar: string;
  barComparativo: string;
  lineEvolucion: string;
  barDept: string;
  barDeptComp: string;
  lineEmpleado: string;
} {
  return {
    donut: renderChartCanvas({ chartId: E360_DONUT_CHART_ID, ariaLabel: "Distribución de evaluadores", heightClass: "h-[220px]" }),
    radar: renderChartCanvas({ chartId: E360_RADAR_CHART_ID, ariaLabel: "Radar de competencias", heightClass: "h-[280px]" }),
    barComparativo: renderChartCanvas({ chartId: E360_BAR_COMPARATIVO_ID, ariaLabel: "Comparativo autoevaluación vs evaluadores", heightClass: "h-[260px]" }),
    lineEvolucion: renderChartCanvas({ chartId: E360_LINE_EVOLUCION_ID, ariaLabel: "Evolución histórica de calificación", heightClass: "h-[240px]" }),
    barDept: renderChartCanvas({ chartId: E360_BAR_DEPT_ID, ariaLabel: "Comparativo por departamento", heightClass: "h-[240px]" }),
    barDeptComp: renderChartCanvas({ chartId: E360_RADAR_DEPT_COMP_ID, ariaLabel: "Promedio de competencias por departamento", heightClass: "h-[320px]" }),
    lineEmpleado: renderChartCanvas({ chartId: E360_LINE_EMPLEADO_ID, ariaLabel: "Evolución histórica del empleado", heightClass: "h-[240px]" }),
  };
}

export function mountEval360RhDashboardCharts(
  root: ParentNode,
  competenciasDept: { departamentos: string[]; competencias: string[]; matrix: number[][] },
): void {
  const palette = [
    cssVar("--color-accent", "#2563EB"),
    cssVar("--color-success", "#22C55E"),
    cssVar("--color-info", "#3B82F6"),
    cssVar("--color-warning", "#F59E0B"),
    cssVar("--color-danger", "#EF4444"),
  ];

  const radarFillAlpha = 0.12;

  mountChart(root, E360_RADAR_DEPT_COMP_ID, ({ colors }) => ({
    type: "radar",
    data: {
      labels: competenciasDept.competencias,
      datasets: competenciasDept.departamentos.map((dept, i) => {
        const color = palette[i % palette.length]!;
        return {
          label: dept,
          data: competenciasDept.matrix[i] ?? [],
          borderColor: color,
          backgroundColor: colorWithAlpha(color, radarFillAlpha),
          borderWidth: 2,
          pointRadius: 2,
        };
      }),
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
}

function colorWithAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mountEval360EmployeeCharts(root: ParentNode, empleado: EmpleadoEval360): void {
  const competencias = empleado.competencias;
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
        { label: "Autoevaluación", data: competencias.map((c) => c.autoevaluacion), backgroundColor: cssVar("--color-accent", "#2563EB"), borderRadius: 4 },
        { label: "Evaluadores", data: competencias.map((c) => c.evaluadores), backgroundColor: cssVar("--color-success", "#22C55E"), borderRadius: 4 },
      ],
    },
    options: { ...chartCartesianScales(colors), plugins: { legend: { position: "bottom" } } },
  }));

  mountChart(root, E360_DONUT_CHART_ID, ({ colors, palette: pal }) => ({
    type: "doughnut",
    data: {
      labels: empleado.distribucionEvaluadores.map((d) => d.tipo),
      datasets: [{ data: empleado.distribucionEvaluadores.map((d) => d.valor), backgroundColor: pal.slice(0, 5), borderWidth: 0 }],
    },
    options: {
      cutout: "62%",
      plugins: { legend: { position: "right", labels: { color: colors.textSecondary, font: { size: 11 } } } },
    },
  }));

  mountChart(root, E360_LINE_EMPLEADO_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels: empleado.evolucion.map((e) => e.periodo),
        datasets: [
          { label: "Resultado individual", data: empleado.evolucion.map((e) => e.individual), borderColor: cssVar("--color-accent", "#2563EB"), tension: 0.35, pointRadius: 3 },
          { label: "Promedio departamento", data: empleado.evolucion.map((e) => e.departamento), borderColor: cssVar("--color-success", "#22C55E"), tension: 0.35, pointRadius: 3 },
          { label: "Promedio planta", data: empleado.evolucion.map((e) => e.planta), borderColor: cssVar("--color-text-muted", "#94A3B8"), borderDash: [4, 4], tension: 0.35, pointRadius: 3 },
        ],
      },
      options: {
        ...cartesian,
        scales: { ...cartesian?.scales, y: { ...cartesian?.scales?.y, min: 2.5, max: 5 } },
      },
    };
  });
}

export function mountEval360ResultadosCharts(root: ParentNode, competencias: CompetenciaPuntuacion[]): void {
  const labels = competencias.map((c) => c.nombre);
  mountChart(root, E360_RADAR_CHART_ID, ({ colors }) => ({
    type: "radar",
    data: {
      labels,
      datasets: [
        { label: "Autoevaluación", data: competencias.map((c) => c.autoevaluacion), borderColor: cssVar("--color-accent", "#2563EB"), backgroundColor: "rgba(37, 99, 235, 0.15)", borderWidth: 2, pointRadius: 3 },
        { label: "Promedio evaluadores", data: competencias.map((c) => c.evaluadores), borderColor: cssVar("--color-success", "#22C55E"), backgroundColor: "rgba(34, 197, 94, 0.12)", borderWidth: 2, pointRadius: 3 },
      ],
    },
    options: {
      scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, color: colors.textMuted, backdropColor: "transparent" }, grid: { color: colors.border }, pointLabels: { color: colors.textSecondary, font: { size: 10 } } } },
      plugins: { legend: { position: "bottom" } },
    },
  }));
  mountChart(root, E360_BAR_COMPARATIVO_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Autoevaluación", data: competencias.map((c) => c.autoevaluacion), backgroundColor: cssVar("--color-accent", "#2563EB"), borderRadius: 4 },
        { label: "Evaluadores", data: competencias.map((c) => c.evaluadores), backgroundColor: cssVar("--color-success", "#22C55E"), borderRadius: 4 },
      ],
    },
    options: { ...chartCartesianScales(colors), plugins: { legend: { position: "bottom" } } },
  }));
}

export function mountEval360ReportesCharts(root: ParentNode): void {
  mountChart(root, E360_LINE_EVOLUCION_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels: EVOLUCION_HISTORICA.map((e) => e.periodo),
        datasets: [{
          label: "Promedio general",
          data: EVOLUCION_HISTORICA.map((e) => e.valor),
          borderColor: cssVar("--color-accent", "#2563EB"),
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        }],
      },
      options: {
        ...cartesian,
        scales: { ...cartesian?.scales, y: { ...cartesian?.scales?.y, min: 2.5, max: 5 } },
      },
    };
  });

  mountChart(root, E360_BAR_DEPT_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels: COMPARATIVO_DEPARTAMENTO.map((d) => d.dept),
      datasets: [{ label: "Promedio", data: COMPARATIVO_DEPARTAMENTO.map((d) => d.valor), backgroundColor: cssVar("--color-accent", "#2563EB"), borderRadius: 6 }],
    },
    options: { ...chartCartesianScales(colors), indexAxis: "y" as const },
  }));
}
