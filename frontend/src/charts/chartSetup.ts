/**
 * Chart.js + Vite: registro completo vía `chart.js/auto`.
 * @see https://www.chartjs.org/docs/latest/getting-started/integration.html
 */
import Chart from "chart.js/auto";

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
// Mutar la propiedad, NO reemplazar el objeto `animation`: asignar `= { duration }`
// descarta la estructura interna que Chart.js usa para interpolar la animación del
// tooltip y provoca `this._fn is not a function`, dejando el tooltip invisible.
Chart.defaults.animation.duration = 400;
// Hover más tolerante: el tooltip aparece al pasar el mouse por cualquier parte de
// la columna/punto (no solo justo encima). Cada gráfica puede sobrescribirlo con su
// propio `options.interaction`.
Chart.defaults.interaction = { mode: "index", intersect: false };

export { Chart };
export type {
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartOptions,
  ChartType,
  Plugin,
} from "chart.js";
