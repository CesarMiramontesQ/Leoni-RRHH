/**
 * Gráficas de incidencias: dona en SVG; tendencia mensual con Chart.js.
 */

import { chartCartesianScales, mountChart, renderChartCanvas } from "../../charts/index.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

export const RH_INC_TENDENCIA_CHART_ID = "rh-inc-tendencia-mes";

const TENDENCIA_RED_ALPHA = 0.2;
const TENDENCIA_LINE_TENSION_SMOOTH = 0.4;

export type DonutTipoRow = { tipo: string; total: number; porcentaje: number };

export type SerieMesRow = { periodo: string; total: number };

/** Color por tipo usando tokens expuestos en `style.css` (@theme). */
function fillSliceForTipo(tipoRaw: string): string {
  const t = tipoRaw.toLowerCase();
  if (t.includes("seguridad")) return "var(--color-kpi-metric-inactivo-icon)";
  if (t.includes("calidad")) return "var(--color-leoni-green)";
  if (t.includes("retardo") || t.includes("tardan")) return "var(--color-accent)";
  if (t.includes("falta") || t.includes("ausencia")) return "var(--color-text-muted)";
  if (t.includes("daño") || t.includes("dano") || t.includes("equipo")) return "var(--color-leoni-blue-light)";
  if (t.includes("indisciplina")) return "var(--color-leoni-blue)";
  return "var(--color-border)";
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const p0o = polar(cx, cy, rOuter, startDeg);
  const p1o = polar(cx, cy, rOuter, endDeg);
  const p1i = polar(cx, cy, rInner, endDeg);
  const p0i = polar(cx, cy, rInner, startDeg);
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

function etiquetaMesCorto(periodo: string): string {
  const [y, m] = periodo.split("-");
  if (!y || !m) return periodo;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mi = Number.parseInt(m, 10) - 1;
  const pref = mi >= 0 && mi < 12 ? meses[mi] : m;
  return `${pref} ${y.slice(2)}`;
}

function colorConAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(239, 68, 68, ${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dona: distribución por tipo; segmentos con color por categoría y tooltips nativos. */
export function renderIncidenciasDonutPorTipo(rows: readonly DonutTipoRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0 || rows.length === 0) {
    return `<div class="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos por tipo</div>`;
  }
  const cx = 100;
  const cy = 100;
  const ro = 76;
  const ri = 50;
  let angle = -90;
  const slices: string[] = [];
  rows.forEach((r) => {
    const sweep = (r.total / total) * 360;
    const end = angle + sweep;
    if (sweep > 0.05) {
      const fill = fillSliceForTipo(r.tipo);
      const label = labelTipoIncidenciaUi(r.tipo);
      const tip = `${label}: ${r.total} (${r.porcentaje.toFixed(1)}%)`;
      slices.push(
        `<path d="${donutSlicePath(cx, cy, ro, ri, angle, end)}" fill="${fill}" opacity="0.92"><title>${escapeIncHtml(tip)}</title></path>`,
      );
    }
    angle = end;
  });
  const leyenda = rows
    .map((r) => {
      const label = labelTipoIncidenciaUi(r.tipo);
      const fill = fillSliceForTipo(r.tipo);
      return `<li class="flex items-start gap-2 text-xs leading-snug text-[color:var(--color-text-primary)]">
        <span class="mt-1 size-2.5 shrink-0 rounded-[2px]" style="background:${fill}" aria-hidden="true"></span>
        <span class="min-w-0 flex-1"><span class="font-medium">${escapeIncHtml(label)}</span>
        <span class="ml-1 tabular-nums text-[color:var(--color-text-secondary)]">${escapeIncHtml(String(r.total))} · ${escapeIncHtml(r.porcentaje.toFixed(0))}%</span></span>
      </li>`;
    })
    .join("");
  return `
    <div class="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div class="relative mx-auto shrink-0 lg:mx-0" style="width:200px;height:200px">
        <svg viewBox="0 0 200 200" class="size-[200px]" role="img" aria-label="Distribución por tipo de incidencia">
          ${slices.join("")}
          <circle cx="${cx}" cy="${cy}" r="${ri - 1}" class="fill-white" />
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="fill-[color:var(--color-text-primary)] text-[15px] font-bold">${escapeIncHtml(String(total))}</text>
          <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="fill-[color:var(--color-text-secondary)] text-[10px] font-semibold uppercase tracking-wide">Total</text>
        </svg>
      </div>
      <ul class="w-full min-w-0 flex-1 space-y-1.5 lg:max-w-[14rem]">${leyenda}</ul>
    </div>`;
}

/** Contenedor canvas para tendencia mensual (Chart.js se monta tras pintar el DOM). */
export function renderIncidenciasTendenciaPorMes(rows: readonly SerieMesRow[]): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  return renderChartCanvas({
    chartId: RH_INC_TENDENCIA_CHART_ID,
    ariaLabel: "Tendencia de incidencias por mes",
    heightClass: "h-[220px]",
    className: "w-full min-w-0 overflow-x-auto",
  });
}

/** Monta la gráfica de líneas con datos reales de `incidencias_por_mes`. */
export function mountIncidenciasTendenciaPorMesChart(root: ParentNode, rows: readonly SerieMesRow[]): void {
  if (rows.length === 0) return;

  const labels = rows.map((r) => etiquetaMesCorto(r.periodo));
  const values = rows.map((r) => r.total);

  mountChart(root, RH_INC_TENDENCIA_CHART_ID, ({ colors }) => {
    const borderColor = colors.danger;
    const backgroundColor = colorConAlpha(borderColor, TENDENCIA_RED_ALPHA);
    return {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            fill: "start",
            borderColor,
            backgroundColor,
          },
        ],
      },
      options: {
        plugins: {
          filler: {
            propagate: false,
          },
          legend: {
            display: false,
          },
        },
        interaction: {
          intersect: false,
        },
        elements: {
          line: {
            tension: TENDENCIA_LINE_TENSION_SMOOTH,
          },
        },
        ...chartCartesianScales(colors),
      },
    };
  });
}
