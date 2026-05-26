/** Altura del área de trazado para emparejar ambas gráficas del supervisor en desktop. */
export const SUPERVISOR_CHARTS_PLOT_HEIGHT_PX = 300;

export const SUPERVISOR_CHART_CARD_BODY_CLASS = "mt-5 flex min-h-0 flex-1 flex-col";

export const supervisorChartPlotWrap = (extraClass = ""): string =>
  `supervisor-chart-plot relative w-full min-w-0 flex-1 ${extraClass}`.trim();

export const supervisorChartPlotStyle = (): string =>
  `min-height:${SUPERVISOR_CHARTS_PLOT_HEIGHT_PX}px;height:${SUPERVISOR_CHARTS_PLOT_HEIGHT_PX}px`;
