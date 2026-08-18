/**
 * Incidencias por colaborador y tipo — dashboard supervisor.
 * Vista barras horizontales apiladas (≤15) o heatmap tabular (>15).
 */
import { mountChart, renderChartCanvas } from "../../charts/index.ts";
import {
  SUPERVISOR_INC_CHART_OTROS_TIPO,
} from "../../dashboard/lider/buildSupervisorIncidenciasChart.ts";
import type { SupervisorIncidenciasChartData } from "../../dashboard/lider/types.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import { FALTA_RETARDO_TIPO_LABELS } from "../../faltasRetardos/rh/constants.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  SUPERVISOR_CHARTS_PLOT_HEIGHT_PX,
  SUPERVISOR_CHART_CARD_BODY_CLASS,
  supervisorChartPlotStyle,
  supervisorChartPlotWrap,
} from "./supervisorChartsLayout.ts";

export const LIDER_SUPERVISOR_INC_CHART_ID = "lider-supervisor-incidencias-chart";

const BAR_FILL_ALPHA = 0.82;

/** Colores fijos por tipo de incidencia (leyenda y barras apiladas). */
const TIPO_COLOR_RETARDO = "#DC2626";
const TIPO_COLOR_FALTA_INJUSTIFICADA = "#9333EA";
const TIPO_COLOR_FALTA_JUSTIFICADA = "#2563EB";
const TIPO_COLOR_VACACIONES = "#0891B2";
const TIPO_COLOR_PERMISO_GOCE = "#059669";
const TIPO_COLOR_PERMISO_SIN_GOCE = "#D97706";
const TIPO_COLOR_INDISCIPLINA = "#002147";
const TIPO_COLOR_DANO = "#EA580C";
const TIPO_COLOR_SEGURIDAD = "#F87171";
const TIPO_COLOR_CALIDAD = "#00C853";
const TIPO_COLOR_INCAPACIDAD = "#7C3AED";
const TIPO_COLOR_SUSPENSION = "#B45309";
const TIPO_COLOR_OTROS = "#64748B";

type TipoColor = { fill: string; border: string };

function colorConAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tipoColorEntry(hex: string, alpha = BAR_FILL_ALPHA): TipoColor {
  return { fill: colorConAlpha(hex, alpha), border: hex };
}

/** Paleta fija y contrastada por clave normalizada. */
function tipoColorMap(): Record<string, TipoColor> {
  return {
    retardo: tipoColorEntry(TIPO_COLOR_RETARDO),
    falta_injustificada: tipoColorEntry(TIPO_COLOR_FALTA_INJUSTIFICADA),
    falta_justificada: tipoColorEntry(TIPO_COLOR_FALTA_JUSTIFICADA),
    vacaciones: tipoColorEntry(TIPO_COLOR_VACACIONES),
    permiso_con_goce: tipoColorEntry(TIPO_COLOR_PERMISO_GOCE),
    permiso_sin_goce: tipoColorEntry(TIPO_COLOR_PERMISO_SIN_GOCE),
    indisciplina: tipoColorEntry(TIPO_COLOR_INDISCIPLINA),
    dano_equipo: tipoColorEntry(TIPO_COLOR_DANO),
    seguridad: tipoColorEntry(TIPO_COLOR_SEGURIDAD),
    calidad: tipoColorEntry(TIPO_COLOR_CALIDAD),
    incapacidad: tipoColorEntry(TIPO_COLOR_INCAPACIDAD),
    suspension: tipoColorEntry(TIPO_COLOR_SUSPENSION),
    [SUPERVISOR_INC_CHART_OTROS_TIPO]: tipoColorEntry(TIPO_COLOR_OTROS, 0.35),
  };
}

const FALLBACK_TIPO_COLORS: readonly TipoColor[] = [
  tipoColorEntry(TIPO_COLOR_FALTA_JUSTIFICADA),
  tipoColorEntry(TIPO_COLOR_VACACIONES),
  tipoColorEntry(TIPO_COLOR_PERMISO_GOCE),
  tipoColorEntry(TIPO_COLOR_PERMISO_SIN_GOCE),
  tipoColorEntry("#7C3AED"),
  tipoColorEntry(TIPO_COLOR_OTROS),
];

function normalizeTipoKey(tipo: string): string {
  return tipo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
}

function resolveTipoColor(tipo: string, index: number): TipoColor {
  const key = normalizeTipoKey(tipo);
  const map = tipoColorMap();

  if (map[key]) return map[key]!;

  if (key.includes("retard") || key.includes("tardan")) {
    return map.retardo!;
  }
  if (key.includes("injustific") || key === "falta_injustificada") {
    return map.falta_injustificada!;
  }
  if (key.includes("justific") || key === "falta_justificada") {
    return map.falta_justificada!;
  }
  if (key.includes("vacacion")) {
    return map.vacaciones!;
  }
  if (key.includes("permiso") && key.includes("sin") && key.includes("goce")) {
    return map.permiso_sin_goce!;
  }
  if (key.includes("permiso") && key.includes("goce")) {
    return map.permiso_con_goce!;
  }
  if (key.includes("falta") || key.includes("ausencia")) {
    return map.falta_injustificada!;
  }
  if (key.includes("indisciplina")) return map.indisciplina!;
  if (key.includes("dano") || key.includes("daño") || key.includes("equipo")) return map.dano_equipo!;
  if (key.includes("seguridad")) return map.seguridad!;
  if (key.includes("calidad")) return map.calidad!;
  if (key === SUPERVISOR_INC_CHART_OTROS_TIPO || key === "otro") {
    return map[SUPERVISOR_INC_CHART_OTROS_TIPO]!;
  }

  return FALLBACK_TIPO_COLORS[index % FALLBACK_TIPO_COLORS.length]!;
}

function labelTipo(tipo: string): string {
  if (tipo === SUPERVISOR_INC_CHART_OTROS_TIPO) return "Otros";
  // La tarjeta se alimenta de la página Incidencias (`#/faltas-retardos`), cuyo catálogo
  // cubre tipos que el labeler de Seguridad y Calidad no conoce (incapacidad,
  // suspensión) y devolvería en crudo.
  const propio = FALTA_RETARDO_TIPO_LABELS[tipo as FaltaRetardoTipo];
  if (propio) return propio;
  return labelTipoIncidenciaUi(tipo);
}

/** Ancho mínimo del eje Y según el nombre corto más largo (~6px por carácter a 11px). */
function yAxisLabelWidthPx(labels: readonly string[]): number {
  const maxChars = labels.reduce((max, label) => Math.max(max, label.trim().length), 0);
  return Math.min(168, maxChars * 6.2 + 14);
}

function emptyState(): string {
  return `<div class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-gradient-to-br from-slate-50/80 to-white px-4 py-10 text-center" style="${supervisorChartPlotStyle()}">
    <div>
      <p class="text-sm font-semibold text-text-primary">Sin incidencias registradas</p>
      <p class="mt-1 text-xs text-text-muted">Las incidencias de tu equipo aparecerán aquí agrupadas por colaborador y tipo.</p>
    </div>
  </div>`;
}

function renderLegend(tipos: readonly string[]): string {
  const items = tipos
    .map((tipo, i) => {
      const { border } = resolveTipoColor(tipo, i);
      return `<li class="inline-flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-medium text-text-secondary">
        <span class="size-2.5 shrink-0 rounded-sm" style="background:${escapeHtml(border)}" aria-hidden="true"></span>
        ${escapeHtml(labelTipo(tipo))}
      </li>`;
    })
    .join("");
  return `<ul class="mb-4 flex flex-wrap gap-2" aria-label="Leyenda de tipos de incidencia">${items}</ul>`;
}

function renderHorizontalChartPanel(data: SupervisorIncidenciasChartData): string {
  return `<div class="flex min-h-0 flex-1 flex-col">
    ${renderLegend(data.tipos)}
    <div class="${supervisorChartPlotWrap()}" style="${supervisorChartPlotStyle()}">
      ${renderChartCanvas({
        chartId: LIDER_SUPERVISOR_INC_CHART_ID,
        ariaLabel: "Incidencias por colaborador y tipo",
        heightClass: "h-full min-h-0",
        className: "relative h-full w-full min-w-0",
      })}
    </div>
  </div>`;
}

function heatmapCellStyle(count: number, maxCount: number, tipo: string, tipoIndex: number): string {
  if (count <= 0) return "background:transparent;color:#94a3b8";
  const { border } = resolveTipoColor(tipo, tipoIndex);
  const intensity = Math.max(0.18, Math.min(1, count / Math.max(maxCount, 1)));
  return `background:${colorConAlpha(border, intensity * 0.55)};color:#0f172a;font-weight:600`;
}

function renderHeatmapTable(data: SupervisorIncidenciasChartData): string {
  const maxCell = Math.max(
    1,
    ...data.rows.flatMap((row) => data.tipos.map((t) => row.byTipo[t] ?? 0)),
  );
  const headerCells = data.tipos
    .map((tipo, i) => {
      const { border } = resolveTipoColor(tipo, i);
      return `<th scope="col" class="min-w-[4.5rem] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <span class="inline-flex items-center gap-1"><span class="size-2 rounded-sm" style="background:${escapeHtml(border)}" aria-hidden="true"></span>${escapeHtml(labelTipo(tipo))}</span>
      </th>`;
    })
    .join("");

  const bodyRows = data.rows
    .map((row) => {
      const cells = data.tipos
        .map((tipo, i) => {
          const count = row.byTipo[tipo] ?? 0;
          const style = heatmapCellStyle(count, maxCell, tipo, i);
          return `<td class="px-2 py-2 text-center text-sm tabular-nums" style="${style}" title="${escapeHtml(labelTipo(tipo))}: ${count}">${count > 0 ? count : "—"}</td>`;
        })
        .join("");
      return `<tr class="border-t border-[#e5e7eb]/80 hover:bg-slate-50/60">
        <th scope="row" class="max-w-[10rem] truncate px-3 py-2 text-left text-sm font-semibold text-text-primary" title="${escapeHtml(row.empleado_nombre)}">${escapeHtml(row.empleado_nombre_corto)}</th>
        ${cells}
        <td class="px-3 py-2 text-right text-sm font-bold tabular-nums text-text-primary">${row.total}</td>
      </tr>`;
    })
    .join("");

  return `<div class="flex min-h-0 flex-1 flex-col">
    ${renderLegend(data.tipos)}
    <div class="min-h-0 flex-1 overflow-x-auto rounded-xl border border-[#e5e7eb]" style="min-height:${SUPERVISOR_CHARTS_PLOT_HEIGHT_PX}px">
      <table class="min-w-full w-full border-collapse text-left text-sm">
        <thead class="bg-slate-50/90">
          <tr>
            <th scope="col" class="sticky left-0 z-[1] bg-slate-50/95 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Colaborador</th>
            ${headerCells}
            <th scope="col" class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-text-muted">Vista compacta para equipos grandes. Pasa el cursor sobre una celda para ver el detalle.</p>
  </div>`;
}

export function renderSupervisorIncidenciasChartCard(
  data: SupervisorIncidenciasChartData | null,
): string {
  const visibleTotal = data?.rows.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const grandTotal = data?.total_incidencias ?? visibleTotal;
  const body =
    grandTotal <= 0 || !data?.rows.length
      ? emptyState()
      : data.view === "heatmap"
        ? renderHeatmapTable(data)
        : renderHorizontalChartPanel(data);

  // Solo el alcance: la tarjeta ya no es el histórico completo, y un número sin ventana
  // ni tipos se lee como "todo lo que ha pasado". El total va en su propia línea.
  const subtitle = "Faltas, retardos, incapacidades y suspensiones del último año.";

  const totalBadge =
    grandTotal > 0
      ? `<p class="mt-2 text-sm font-semibold tabular-nums text-text-primary">${grandTotal} incidencias en total</p>`
      : "";

  return `
    <div class="flex h-full min-h-0 min-w-0 flex-col" aria-label="Incidencias por colaborador">
      <header class="shrink-0">
        <h2 class="text-lg font-semibold text-text-primary">Incidencias por colaborador</h2>
        ${totalBadge}
        <p class="mt-1 text-sm text-text-muted">${subtitle}</p>
      </header>
      <div class="${SUPERVISOR_CHART_CARD_BODY_CLASS} min-w-0">${body}</div>
    </div>`;
}

export function mountSupervisorIncidenciasChart(
  root: ParentNode,
  data: SupervisorIncidenciasChartData,
): void {
  if (data.view !== "bars") return;

  const total = data.rows.reduce((sum, row) => sum + row.total, 0);
  if (total <= 0 || data.rows.length === 0 || data.tipos.length === 0) return;

  const shortLabels = data.rows.map((row) => row.empleado_nombre_corto.trim() || row.empleado_nombre);
  const fullNames = data.rows.map((row) => row.empleado_nombre);
  const yAxisWidth = yAxisLabelWidthPx(shortLabels);

  mountChart(root, LIDER_SUPERVISOR_INC_CHART_ID, ({ colors }) => ({
    type: "bar",
    data: {
      labels: shortLabels,
      datasets: data.tipos.map((tipo, i) => {
        const { fill, border } = resolveTipoColor(tipo, i);
        return {
          label: labelTipo(tipo),
          data: data.rows.map((row) => row.byTipo[tipo] ?? 0),
          backgroundColor: fill,
          borderColor: border,
          borderWidth: 1,
          stack: "incidencias",
          borderRadius: 0,
          borderSkipped: false,
        };
      }),
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 4, right: 8, top: 4, bottom: 4 },
      },
      datasets: {
        bar: {
          maxBarThickness: 28,
          barPercentage: 0.82,
          categoryPercentage: 0.78,
        },
      },
      interaction: { mode: "index", axis: "y", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => fullNames[items[0]?.dataIndex ?? -1] ?? "",
            label: (ctx) => {
              const value = typeof ctx.parsed.x === "number" ? ctx.parsed.x : 0;
              if (value <= 0) return "";
              return ` ${ctx.dataset.label}: ${value}`;
            },
            footer: (items) => {
              const idx = items[0]?.dataIndex ?? -1;
              const row = data.rows[idx];
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
          title: {
            display: true,
            text: "Incidencias",
            color: colors.textSecondary,
            font: { size: 11, weight: 600 },
          },
          ticks: {
            color: colors.textMuted,
            font: { size: 10 },
            stepSize: 1,
            precision: 0,
          },
          grid: { color: colors.border, drawTicks: false },
          border: { color: colors.border },
        },
        y: {
          stacked: true,
          afterFit: (scale) => {
            if (scale.width < yAxisWidth) scale.width = yAxisWidth;
          },
          ticks: {
            color: colors.textMuted,
            font: { size: 11, weight: 500 },
            autoSkip: false,
            padding: 4,
            mirror: false,
          },
          grid: { display: false },
          border: { color: colors.border },
        },
      },
    },
  }));
}
