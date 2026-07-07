import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { chartColorSlots } from "../../charts/chartTokens.ts";
import type { FaltaRetardoTendenciaPorTipo } from "../../faltasRetardos/rh/buildFaltasRetardosTendenciaPorTipo.ts";
import type { RhDashboardTendenciaAgrupacion } from "../../dashboard/rh/filterRowsByPeriod.ts";
import { labelFaltaRetardoTipo } from "../../faltasRetardos/rh/constants.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";

export const RH_FR_TENDENCIA_CHART_ID = "rh-fr-tendencia-mes";
export const RH_FR_TIPO_BAR_CHART_ID = "rh-fr-tipo-bar";
export const RH_FR_EMPLEADOS_BAR_CHART_ID = "rh-fr-empleados-bar";

const CHART_H = "h-[280px]";
const BAR_RADIUS = 8;
const BAR_FILL_ALPHA = 0.5;
const TENDENCIA_TIPO_LINE_TENSION = 0.35;
const TENDENCIA_TIPO_FILL_ALPHA = 0.12;

export type FaltaRetardoTipoRow = {
  tipo: FaltaRetardoTipo;
  total: number;
  porcentaje: number;
};

function colorConAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorForTipo(tipo: FaltaRetardoTipo): string {
  const s = chartColorSlots();
  switch (tipo) {
    case "falta_justificada":
      return s.green;
    case "falta_injustificada":
      return s.red;
    case "retardo":
      return s.accent;
    case "incapacidad":
      return s.teal;
    case "suspension":
      return s.amber;
    default:
      return s.violet;
  }
}

function etiquetaMesCorto(periodo: string): string {
  const [y, m] = periodo.split("-");
  if (!y || !m) return periodo;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mi = Number.parseInt(m, 10) - 1;
  const pref = mi >= 0 && mi < 12 ? meses[mi] : m;
  return `${pref} ${y.slice(2)}`;
}

function etiquetaMesTooltip(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  if (!y || !m) return periodo;
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}

function etiquetaPeriodoEje(periodo: string, agrupacion: RhDashboardTendenciaAgrupacion): string {
  if (agrupacion === "mes") return etiquetaMesCorto(periodo);
  if (agrupacion === "dia") {
    const [y, m, d] = periodo.split("-").map(Number);
    if (!y || !m || !d) return periodo;
    const raw = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
      new Date(y, m - 1, d),
    );
    return raw.replace(/\./g, "");
  }
  const [y, m, d] = periodo.split("-").map(Number);
  if (!y || !m || !d) return periodo;
  const end = new Date(y, m - 1, d + 6);
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
  const ini = fmt.format(new Date(y, m - 1, d)).replace(/\./g, "");
  const fin = fmt.format(end).replace(/\./g, "");
  return `${ini}–${fin}`;
}

function etiquetaPeriodoTooltip(periodo: string, agrupacion: RhDashboardTendenciaAgrupacion): string {
  if (agrupacion === "mes") return etiquetaMesTooltip(periodo);
  if (agrupacion === "dia") {
    const [y, m, d] = periodo.split("-").map(Number);
    if (!y || !m || !d) return periodo;
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  }
  const [y, m, d] = periodo.split("-").map(Number);
  if (!y || !m || !d) return periodo;
  const end = new Date(y, m - 1, d + 6);
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return `Semana ${fmt.format(new Date(y, m - 1, d))} – ${fmt.format(end)}`;
}

export function renderFaltasRetardosTendenciaPorTipoChart(data: FaltaRetardoTendenciaPorTipo): string {
  const has = data.series.some((s) => s.valores.some((v) => v > 0));
  if (!has || data.periodos.length === 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  return `
    <div class="flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_TENDENCIA_CHART_ID,
        ariaLabel: "Tendencia por tipo de falta o retardo",
        heightClass: CHART_H,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

export function mountFaltasRetardosTendenciaPorTipoChart(
  root: ParentNode,
  data: FaltaRetardoTendenciaPorTipo,
): void {
  const seriesConDatos = data.series.filter((s) => s.valores.some((v) => v > 0));
  if (seriesConDatos.length === 0 || data.periodos.length === 0) return;

  const labels = data.periodos.map((p) => etiquetaPeriodoEje(p, data.agrupacion));
  const periodos = data.periodos;
  const agrupacion = data.agrupacion;

  mountChart(root, RH_FR_TENDENCIA_CHART_ID, ({ colors }) => {
    const cartesian = chartCartesianScales(colors);
    return {
      type: "line",
      data: {
        labels,
        datasets: seriesConDatos.map((s) => {
          const border = colorForTipo(s.tipo);
          return {
            label: s.label,
            data: [...s.valores],
            borderColor: border,
            backgroundColor: colorConAlpha(border, TENDENCIA_TIPO_FILL_ALPHA),
            fill: false,
            tension: TENDENCIA_TIPO_LINE_TENSION,
            pointRadius: 3,
            pointHoverRadius: 5,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: colors.textSecondary, font: { size: 11 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const i = items[0]?.dataIndex ?? -1;
                const p = i >= 0 ? periodos[i] : "";
                return p ? etiquetaPeriodoTooltip(p, agrupacion) : "";
              },
              label: (ctx) => {
                const tipo = ctx.dataset.label ?? "";
                const n = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
                return ` ${tipo}: ${n} evento${n === 1 ? "" : "s"}`;
              },
            },
          },
        },
        scales: {
          ...cartesian?.scales,
          x: {
            ...cartesian?.scales?.x,
            ticks: {
              color: colors.textMuted,
              font: { size: 10 },
              maxRotation: agrupacion === "dia" ? 45 : 0,
              autoSkip: agrupacion === "dia",
              maxTicksLimit: agrupacion === "dia" ? 8 : undefined,
            },
          },
          y: {
            ...cartesian?.scales?.y,
            beginAtZero: true,
            title: {
              display: true,
              text: "Eventos",
              color: colors.textMuted,
              font: { size: 10 },
            },
            ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    };
  });
}

export function renderFaltasRetardosTipoBarChart(rows: readonly FaltaRetardoTipoRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) {
    return `<div class="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por tipo</div>`;
  }
  return `
    <div class="flex min-h-[280px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_TIPO_BAR_CHART_ID,
        ariaLabel: "Distribución por tipo de evento",
        heightClass: CHART_H,
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

export function mountFaltasRetardosTipoBarChart(
  root: ParentNode,
  rows: readonly FaltaRetardoTipoRow[],
): void {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return;
  const labels = rows.map((r) => labelFaltaRetardoTipo(r.tipo));
  const values = rows.map((r) => r.total);
  const borderColors = rows.map((r) => colorForTipo(r.tipo));
  const backgroundColors = borderColors.map((c) => colorConAlpha(c, BAR_FILL_ALPHA));
  mountChart(root, RH_FR_TIPO_BAR_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Eventos",
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: BAR_RADIUS,
          borderSkipped: false,
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
            label: (ctx) => {
              const row = rows[ctx.dataIndex];
              if (!row) return "";
              return ` ${row.total} (${row.porcentaje.toFixed(1)}%)`;
            },
          },
        },
      },
      ...chartCartesianScales(colors),
    },
  }));
}

export function renderFaltasRetardosEmpleadosBarChart(hasData: boolean): string {
  if (!hasData) {
    return `<div class="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin empleados con eventos en el periodo</div>`;
  }
  return `
    <div class="flex min-h-[300px] w-full min-w-0 flex-1 flex-col justify-center">
      ${renderChartCanvas({
        chartId: RH_FR_EMPLEADOS_BAR_CHART_ID,
        ariaLabel: "Empleados con más eventos de asistencia por tipo",
        heightClass: "h-[300px]",
        className: "relative w-full min-w-0",
      })}
    </div>`;
}

export type FaltaRetardoEmpleadoChartRow = {
  label: string;
  total: number;
  byTipo: Partial<Record<FaltaRetardoTipo, number>>;
};

function tiposPresentesEnEmpleados(
  rows: readonly FaltaRetardoEmpleadoChartRow[],
): FaltaRetardoTipo[] {
  const present = new Set<FaltaRetardoTipo>();
  for (const row of rows) {
    for (const [tipo, count] of Object.entries(row.byTipo)) {
      if ((count ?? 0) > 0) present.add(tipo as FaltaRetardoTipo);
    }
  }
  const ordered: FaltaRetardoTipo[] = [
    "falta_justificada",
    "falta_injustificada",
    "retardo",
    "incapacidad",
    "suspension",
  ];
  return ordered.filter((t) => present.has(t));
}

export function mountFaltasRetardosEmpleadosStackedBarChart(
  root: ParentNode,
  rows: readonly FaltaRetardoEmpleadoChartRow[],
): void {
  if (rows.length === 0) return;
  const tipos = tiposPresentesEnEmpleados(rows);
  if (tipos.length === 0) return;
  const labels = rows.map((r) => r.label);
  mountChart(root, RH_FR_EMPLEADOS_BAR_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels,
      datasets: tipos.map((tipo) => {
        const border = colorForTipo(tipo);
        return {
          label: labelFaltaRetardoTipo(tipo),
          data: rows.map((row) => row.byTipo[tipo] ?? 0),
          backgroundColor: colorConAlpha(border, BAR_FILL_ALPHA),
          borderColor: border,
          borderWidth: 1,
          stack: "eventos",
          borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
          borderSkipped: false,
        };
      }),
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", axis: "y", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = typeof ctx.parsed.x === "number" ? ctx.parsed.x : 0;
              if (value <= 0) return "";
              return ` ${ctx.dataset.label}: ${value}`;
            },
            footer: (items) => {
              const idx = items[0]?.dataIndex ?? -1;
              const row = rows[idx];
              if (!row) return "";
              return `Total: ${row.total}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: colors.textMuted, font: { size: 10 }, precision: 0 },
          grid: { color: colors.border },
          border: { color: colors.border },
        },
        y: {
          stacked: true,
          ticks: { color: colors.textMuted, font: { size: 10 } },
          grid: { display: false },
          border: { color: colors.border },
        },
      },
    },
  }));
}
