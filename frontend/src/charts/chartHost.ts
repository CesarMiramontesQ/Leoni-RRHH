import type { ChartConfiguration } from "chart.js";
import { escapeHtml } from "../ui/uiUtils.ts";
import { Chart } from "./chartSetup.ts";
import { chartPalette, chartSemanticColors, type ChartSemanticColors } from "./chartTokens.ts";

export type ChartHostContext = {
  colors: ChartSemanticColors;
  palette: readonly string[];
};

export type ChartConfigFactory = (ctx: ChartHostContext) => ChartConfiguration;

const registry = new Map<string, Chart>();

function defaultPluginOptions(colors: ChartSemanticColors): NonNullable<ChartConfiguration["options"]>["plugins"] {
  return {
    legend: {
      labels: {
        color: colors.textSecondary,
        font: { size: 11, weight: 500 },
        boxWidth: 10,
        boxHeight: 10,
        useBorderRadius: true,
        borderRadius: 2,
      },
    },
    tooltip: {
      titleColor: colors.textPrimary,
      bodyColor: colors.textSecondary,
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: colors.border,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 4,
    },
  };
}

/** Ejes cartesianos (bar, line, scatter) con tokens del design system. */
export function chartCartesianScales(colors: ChartSemanticColors): ChartConfiguration["options"] {
  return {
    scales: {
      x: {
        ticks: { color: colors.textMuted, font: { size: 10 } },
        grid: { color: colors.border, drawTicks: false },
        border: { color: colors.border },
      },
      y: {
        ticks: { color: colors.textMuted, font: { size: 10 } },
        grid: { color: colors.border, drawTicks: false },
        border: { color: colors.border },
      },
    },
  };
}

/** Markup de contenedor + canvas para insertar en plantillas HTML. */
export function renderChartCanvas(opts: {
  chartId: string;
  ariaLabel: string;
  /** Clases Tailwind de altura del contenedor (por defecto h-[220px]). */
  heightClass?: string;
  className?: string;
}): string {
  const height = opts.heightClass ?? "h-[220px]";
  const wrapCls = opts.className ?? "relative w-full min-w-0";
  return `
    <div class="${wrapCls} ${height}" data-chart-host>
      <canvas
        data-chart-canvas
        data-chart-id="${escapeHtml(opts.chartId)}"
        role="img"
        aria-label="${escapeHtml(opts.ariaLabel)}"
      ></canvas>
    </div>`;
}

/** Destruye una instancia registrada por id. */
export function destroyChart(chartId: string): void {
  const existing = registry.get(chartId);
  if (!existing) return;
  existing.destroy();
  registry.delete(chartId);
}

/** Destruye todas las gráficas dentro de un nodo (p. ej. antes de `innerHTML`). */
export function destroyChartsIn(root: ParentNode): void {
  root.querySelectorAll<HTMLCanvasElement>("[data-chart-canvas]").forEach((canvas) => {
    const id = canvas.dataset.chartId;
    if (id) destroyChart(id);
  });
}

/**
 * Monta (o remonta) una gráfica Chart.js en un canvas con `data-chart-id`.
 * Llamar después de asignar `innerHTML` al contenedor padre.
 */
export function mountChart(
  root: ParentNode,
  chartId: string,
  buildConfig: ChartConfigFactory,
): Chart | null {
  const canvas = root.querySelector<HTMLCanvasElement>(
    `[data-chart-canvas][data-chart-id="${CSS.escape(chartId)}"]`,
  );
  if (!canvas) return null;

  destroyChart(chartId);

  const ctx: ChartHostContext = {
    colors: chartSemanticColors(),
    palette: chartPalette(),
  };
  const built = buildConfig(ctx);
  const chart = new Chart(canvas, {
    ...built,
    options: {
      ...built.options,
      plugins: {
        ...defaultPluginOptions(ctx.colors),
        ...built.options?.plugins,
      },
    },
  });
  registry.set(chartId, chart);
  return chart;
}

/** Destruye todas las gráficas del registro global (p. ej. al salir de la app). */
export function destroyAllCharts(): void {
  for (const id of [...registry.keys()]) destroyChart(id);
}
