/**
 * Integración Chart.js para Vite (bundler).
 * Uso típico en vistas con innerHTML:
 *
 * 1. `renderChartCanvas({ chartId, ariaLabel })` o `renderChartLoadingSkeleton()` mientras cargan datos
 * 2. Antes de re-render: `destroyChartsIn(root)`
 * 3. Tras pintar: `runChartsAfterLayout(root, () => mountChart(...))`
 *
 * `mountChart` espera dimensiones válidas del contenedor antes de instanciar Chart.js.
 *
 * @see https://www.chartjs.org/docs/latest/getting-started/integration.html
 */
export { Chart, type ChartConfiguration, type ChartData, type ChartDataset, type ChartOptions, type ChartType } from "./chartSetup.ts";
export { chartPalette, chartSemanticColors, cssVar, type ChartSemanticColors } from "./chartTokens.ts";
export {
  chartCartesianScales,
  chartCanvasHostHasDimensions,
  destroyAllCharts,
  destroyChart,
  destroyChartsIn,
  getChart,
  mountChart,
  renderChartCanvas,
  renderChartLoadingSkeleton,
  resizeChartsIn,
  retryPendingChartMounts,
  runChartsAfterLayout,
  updateChart,
  type ChartConfigFactory,
  type ChartHostContext,
  type MountChartOptions,
} from "./chartHost.ts";
