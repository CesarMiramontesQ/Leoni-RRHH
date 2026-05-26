/**
 * Home office por día laboral (lun–vie) — dashboard supervisor.
 */
import type { Plugin } from "chart.js";
import { mountChart, renderChartCanvas } from "../../charts/index.ts";
import type { SupervisorHomeOfficeWeekdayChartData } from "../../dashboard/lider/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  SUPERVISOR_CHART_CARD_BODY_CLASS,
  supervisorChartPlotStyle,
  supervisorChartPlotWrap,
} from "./supervisorChartsLayout.ts";

export const LIDER_SUPERVISOR_HO_WEEKDAY_CHART_ID = "lider-supervisor-ho-weekday-chart";

const HO_BAR_FILL = "rgba(153, 180, 255, 0.55)";
const HO_BAR_BORDER = "#5C7CFA";

function hoBarValueLabelsPlugin(values: readonly number[]): Plugin<"bar"> {
  return {
    id: "ho-bar-value-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      if (!dataset) return;
      const meta = chart.getDatasetMeta(0);
      meta.data.forEach((bar, index) => {
        const value = values[index] ?? 0;
        if (value <= 0) return;
        const props = bar.getProps(["x", "y"], true);
        ctx.save();
        ctx.fillStyle = "#334155";
        ctx.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(value), props.x, props.y - 6);
        ctx.restore();
      });
    },
  };
}

function miniKpiCard(label: string, value: string, sub?: string): string {
  const subHtml =
    sub != null && sub.trim() !== ""
      ? `<p class="mt-0.5 text-xs text-text-muted">${escapeHtml(sub)}</p>`
      : "";
  return `<div class="rounded-lg border border-[#e5e7eb] bg-white px-3 py-3">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(label)}</p>
    <p class="mt-1 text-lg font-bold leading-tight text-text-primary">${escapeHtml(value)}</p>
    ${subHtml}
  </div>`;
}

function summaryRow(data: SupervisorHomeOfficeWeekdayChartData): string {
  const dia =
    data.dia_mas_solicitado != null && data.total_dias_ho > 0 ? data.dia_mas_solicitado : "—";
  const concentracion =
    data.concentracion_dia_principal_pct != null ? `${data.concentracion_dia_principal_pct}%` : "—";
  const subSolicitudes =
    data.solicitudes_ho > 0 ?
      `${data.solicitudes_ho} ${data.solicitudes_ho === 1 ? "solicitud HO" : "solicitudes HO"}`
    : undefined;

  return `<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
    ${miniKpiCard("Día más solicitado", dia)}
    ${miniKpiCard("Total días HO", String(data.total_dias_ho), subSolicitudes)}
    ${miniKpiCard("Concentración del día principal", concentracion)}
  </div>`;
}

function emptyState(): string {
  return `<div class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-gradient-to-br from-slate-50/80 to-white px-4 py-10 text-center" style="${supervisorChartPlotStyle()}">
    <div>
      <p class="text-sm font-semibold text-text-primary">Sin solicitudes de home office aprobadas</p>
      <p class="mt-1 text-xs text-text-muted">Las solicitudes aprobadas de tu equipo aparecerán aquí.</p>
    </div>
  </div>`;
}

function chartPanel(): string {
  return `<div class="${supervisorChartPlotWrap("mt-4")}" style="${supervisorChartPlotStyle()}">
    ${renderChartCanvas({
      chartId: LIDER_SUPERVISOR_HO_WEEKDAY_CHART_ID,
      ariaLabel: "Días con mayor uso de home office",
      heightClass: "h-full min-h-0",
      className: "relative h-full w-full min-w-0",
    })}
  </div>`;
}

export function renderSupervisorHomeOfficeWeekdayChartCard(
  data: SupervisorHomeOfficeWeekdayChartData | null,
): string {
  const hasData = (data?.total_dias_ho ?? 0) > 0 || (data?.solicitudes_ho ?? 0) > 0;

  const body =
    !data || !hasData ?
      emptyState()
    : `<div class="flex min-h-0 flex-1 flex-col">${summaryRow(data)}${chartPanel()}</div>`;

  return `
    <div class="flex h-full min-h-0 min-w-0 flex-col">
      <header class="shrink-0">
        <h2 class="text-lg font-semibold text-text-primary">Días con mayor uso de Home Office</h2>
        <p class="mt-1 text-sm text-text-muted">Distribución de Home Office aprobado por día laboral</p>
      </header>
      <div class="${SUPERVISOR_CHART_CARD_BODY_CLASS} mt-1 min-w-0">${body}</div>
    </div>`;
}

export function mountSupervisorHomeOfficeWeekdayChart(
  root: ParentNode,
  data: SupervisorHomeOfficeWeekdayChartData,
): void {
  if (data.total_dias_ho <= 0 && data.solicitudes_ho <= 0) return;

  const labels = data.days.map((d) => d.label);
  const values = data.days.map((d) => d.count);
  const maxVal = Math.max(...values, 0);
  const yMax = Math.max(5, maxVal + 1);

  mountChart(root, LIDER_SUPERVISOR_HO_WEEKDAY_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Días HO",
          data: values,
          backgroundColor: HO_BAR_FILL,
          borderColor: HO_BAR_BORDER,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    plugins: [hoBarValueLabelsPlugin(values)],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      datasets: {
        bar: {
          maxBarThickness: 48,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => labels[items[0]?.dataIndex ?? -1] ?? "",
            label: (ctx) => {
              const value = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
              return ` Días HO: ${value}`;
            },
            afterBody: () => [`${data.solicitudes_ho} solicitudes HO aprobadas`],
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: colors.textMuted,
            font: { size: 11, weight: 500 },
          },
          grid: { display: false },
          border: { color: colors.border },
        },
        y: {
          beginAtZero: true,
          suggestedMax: yMax,
          ticks: {
            color: colors.textMuted,
            font: { size: 10 },
            stepSize: 1,
            precision: 0,
          },
          grid: { color: colors.border, drawTicks: false },
          border: { color: colors.border },
        },
      },
    },
  }));
}
