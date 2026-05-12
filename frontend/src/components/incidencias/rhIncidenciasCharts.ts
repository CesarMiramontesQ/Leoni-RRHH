/**
 * Gráficas ligeras en SVG para incidencias (sin dependencias externas).
 */

import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

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

/** Columnas mensuales con tooltips; prioridad visual alta (área amplia). */
export function renderIncidenciasColumnasPorMes(rows: readonly SerieMesRow[]): string {
  if (rows.length === 0) {
    return `<div class="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--color-text-muted)]">Sin datos de tendencia en el periodo</div>`;
  }
  const vbW = 560;
  const vbH = 220;
  const padL = 40;
  const padR = 16;
  const padB = 44;
  const padT = 20;
  const innerW = vbW - padL - padR;
  const innerH = vbH - padT - padB;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const n = rows.length;
  const gap = 6;
  const barW = Math.max(8, (innerW - gap * (n - 1)) / n);
  const cols: string[] = [];
  rows.forEach((r, i) => {
    const x = padL + i * (barW + gap);
    const h = (r.total / max) * innerH;
    const y = padT + innerH - h;
    const tip = `${r.periodo}: ${r.total} incidencias`;
    cols.push(
      `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 2)}" rx="3" fill="var(--color-leoni-blue)" opacity="0.78"><title>${escapeIncHtml(tip)}</title></rect>`,
    );
    const lx = x + barW / 2;
    const lab = etiquetaMesCorto(r.periodo);
    cols.push(
      `<text x="${lx}" y="${vbH - 12}" text-anchor="middle" class="fill-[color:var(--color-text-muted)] text-[9px] font-medium">${escapeIncHtml(lab)}</text>`,
    );
  });
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + innerH * (1 - t);
    const val = Math.round(max * t);
    return `<line x1="${padL}" y1="${y}" x2="${vbW - padR}" y2="${y}" stroke="var(--color-border)" stroke-opacity="0.45" stroke-width="1" />
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="fill-[color:var(--color-text-muted)] text-[10px] font-medium tabular-nums">${val}</text>`;
  });
  return `
    <div class="w-full overflow-x-auto">
      <svg viewBox="0 0 ${vbW} ${vbH}" class="h-[220px] min-w-[320px] w-full max-w-full" role="img" aria-label="Tendencia de incidencias por mes">
        ${gridY.join("")}
        ${cols.join("")}
      </svg>
    </div>`;
}
