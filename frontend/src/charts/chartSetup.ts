/**
 * Chart.js + Vite: registro completo vía `chart.js/auto`.
 * @see https://www.chartjs.org/docs/latest/getting-started/integration.html
 */
import Chart from "chart.js/auto";

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = { duration: 400 };

export { Chart };
export type {
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartOptions,
  ChartType,
  Plugin,
} from "chart.js";
