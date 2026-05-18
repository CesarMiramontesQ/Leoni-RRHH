/**
 * Integración Chart.js para Vite (bundler).
 * Uso típico en vistas con innerHTML:
 *
 * 1. `renderChartCanvas({ chartId, ariaLabel })` en el HTML
 * 2. Tras pintar: `mountChart(root, chartId, ({ colors, palette }) => ({ type: 'bar', ... }))`
 * 3. Antes de re-render: `destroyChartsIn(root)`
 *
 * @see https://www.chartjs.org/docs/latest/getting-started/integration.html
 */
export { Chart, type ChartConfiguration, type ChartData, type ChartDataset, type ChartOptions, type ChartType } from "./chartSetup.ts";
export { chartPalette, chartSemanticColors, cssVar, type ChartSemanticColors } from "./chartTokens.ts";
export {
  chartCartesianScales,
  destroyAllCharts,
  destroyChart,
  destroyChartsIn,
  mountChart,
  renderChartCanvas,
  type ChartConfigFactory,
  type ChartHostContext,
} from "./chartHost.ts";
