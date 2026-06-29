import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  BRECHAS_PERFIL_PUESTO,
  COMENTARIOS_GRUPO,
  PERFIL_EVALUADO,
  RADAR_COMPETENCIAS,
} from "../mockData.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { renderSurfaceCard, tipoEvaluadorLabel } from "../shared.ts";
import type { BrechaEstado } from "../types.ts";

function brechaBadge(estado: BrechaEstado): string {
  const map: Record<BrechaEstado, string> = {
    cumple: "border-emerald-200 bg-emerald-50 text-emerald-800",
    riesgo: "border-amber-200 bg-amber-50 text-amber-800",
    brecha: "border-red-200 bg-red-50 text-red-800",
  };
  const labels: Record<BrechaEstado, string> = {
    cumple: "Cumple",
    riesgo: "Riesgo",
    brecha: "Brecha",
  };
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[estado]}">${labels[estado]}</span>`;
}

export function renderEval360Resultados(): string {
  const charts = renderEval360ChartIds();
  const p = PERFIL_EVALUADO;

  const fortalezas = [...RADAR_COMPETENCIAS]
    .sort((a, b) => b.evaluadores - a.evaluadores)
    .slice(0, 3)
    .map(
      (c) => `
    <div class="flex items-center justify-between py-2">
      <span class="text-sm text-text-primary">${escapeHtml(c.nombre)}</span>
      <span class="text-sm font-semibold tabular-nums text-emerald-700">${c.evaluadores.toFixed(1)}</span>
    </div>`,
    )
    .join("");

  const mejoras = [...RADAR_COMPETENCIAS]
    .sort((a, b) => a.evaluadores - b.evaluadores)
    .slice(0, 3)
    .map(
      (c) => `
    <div class="flex items-center justify-between py-2">
      <span class="text-sm text-text-primary">${escapeHtml(c.nombre)}</span>
      <span class="text-sm font-semibold tabular-nums text-amber-700">${c.evaluadores.toFixed(1)}</span>
    </div>`,
    )
    .join("");

  const comentarios = COMENTARIOS_GRUPO.map(
    (g) => `
    <div class="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(tipoEvaluadorLabel(g.tipo))}</h3>
      <ul class="mt-2 space-y-2">
        ${g.comentarios.map((c) => `<li class="text-sm text-slate-700 before:mr-2 before:text-accent before:content-['•']">${escapeHtml(c)}</li>`).join("")}
      </ul>
    </div>`,
  ).join("");

  const brechasPuesto = BRECHAS_PERFIL_PUESTO.map(
    (b) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(b.competencia)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center text-slate-600">${b.requerida.toFixed(1)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center text-slate-600">${b.actual.toFixed(1)}</td>
      <td class="px-4 py-3 text-center">${brechaBadge(b.estado)}</td>
    </tr>`,
  ).join("");

  return `
    <div class="rounded-xl border border-border bg-white p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-light text-lg font-bold text-accent" aria-hidden="true">${escapeHtml(p.iniciales)}</div>
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-text-primary">${escapeHtml(p.nombre)}</h2>
          <p class="text-sm text-text-muted">${escapeHtml(p.puesto)} · ${escapeHtml(p.departamento)}</p>
        </div>
        <div class="flex gap-6 text-center">
          <div>
            <p class="text-2xl font-bold tabular-nums text-accent">${p.calificacionGeneral.toFixed(1)}</p>
            <p class="text-xs text-text-muted">Calificación general</p>
          </div>
          <div>
            <p class="text-lg font-semibold text-emerald-700">${escapeHtml(p.nivel)}</p>
            <p class="text-xs text-text-muted">Nivel obtenido</p>
          </div>
        </div>
      </div>
      <p class="mt-3 text-xs text-text-muted">
        Integración: <a href="#/puestos" class="font-medium text-accent hover:underline">Perfiles de puesto</a> ·
        <a href="#/competencias" class="font-medium text-accent hover:underline">Competencias</a> ·
        <a href="#/capacidades" class="font-medium text-accent hover:underline">Matriz multihabilidad</a> ·
        <a href="#/cursos" class="font-medium text-accent hover:underline">Cursos</a>
      </p>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Radar de competencias", "Autoevaluación vs. promedio evaluadores", charts.radar)}
      ${renderSurfaceCard("Comparativo", "Autoevaluación vs. evaluadores", charts.barComparativo)}
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Fortalezas", "Top competencias", `<div class="divide-y divide-slate-100">${fortalezas}</div>`)}
      ${renderSurfaceCard("Áreas de mejora", "Competencias con menor resultado", `<div class="divide-y divide-slate-100">${mejoras}</div>`)}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard("Comentarios", "Retroalimentación anónima agrupada por tipo de evaluador", `<div class="grid gap-4 sm:grid-cols-2">${comentarios}</div>`)}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard(
        "Brecha contra perfil de puesto",
        "Competencias requeridas del puesto vs. obtenidas",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-2">Competencia</th>
                <th class="px-4 py-2 text-center">Requerida</th>
                <th class="px-4 py-2 text-center">Obtenida</th>
                <th class="px-4 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>${brechasPuesto}</tbody>
          </table>
        </div>`,
      )}
    </div>`;
}
