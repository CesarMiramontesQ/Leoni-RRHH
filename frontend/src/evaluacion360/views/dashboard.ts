import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  BRECHAS_ORGANIZACIONALES,
  COMPETENCIAS_MEJOR_EVALUADAS,
  COMPETENCIAS_OPORTUNIDAD,
  EVAL360_KPIS,
  PARTICIPACION_POR_TIPO,
  RESUMEN_GENERAL,
} from "../mockData.ts";
import { renderEval360KpiGrid, renderHorizontalGapBar, renderSurfaceCard } from "../shared.ts";
import { renderEval360ChartIds } from "../charts.ts";

export function renderEval360Dashboard(): string {
  const charts = renderEval360ChartIds();

  const resumenBody = `
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      ${[
        { label: "Empleados evaluados", value: RESUMEN_GENERAL.empleadosEvaluados },
        { label: "Evaluadores asignados", value: RESUMEN_GENERAL.evaluadoresAsignados },
        { label: "Evaluaciones pendientes", value: RESUMEN_GENERAL.evaluacionesPendientes, warn: true },
        { label: "Evaluaciones completadas", value: RESUMEN_GENERAL.evaluacionesCompletadas, ok: true },
      ]
        .map(
          (s) => `
        <div class="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-center">
          <p class="text-2xl font-bold tabular-nums ${s.warn ? "text-amber-600" : s.ok ? "text-emerald-600" : "text-text-primary"}">${s.value}</p>
          <p class="mt-1 text-xs text-text-muted">${escapeHtml(s.label)}</p>
        </div>`,
        )
        .join("")}
    </div>`;

  const participacionRows = PARTICIPACION_POR_TIPO.map(
    (r) => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(r.tipo)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${r.asignadas}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${r.completadas}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-accent" style="width:${r.pct}%"></div>
          </div>
          <span class="text-xs font-semibold tabular-nums text-slate-700">${r.pct}%</span>
        </div>
      </td>
    </tr>`,
  ).join("");

  const mejorEval = COMPETENCIAS_MEJOR_EVALUADAS.map(
    (c) => `
    <div class="flex items-center justify-between gap-3 py-2">
      <span class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
      <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">${c.puntuacion.toFixed(1)}</span>
    </div>`,
  ).join("");

  const oportunidad = COMPETENCIAS_OPORTUNIDAD.map(
    (c) => `
    <div class="flex items-center justify-between gap-3 py-2">
      <span class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
      <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800">${c.puntuacion.toFixed(1)}</span>
    </div>`,
  ).join("");

  const brechas = BRECHAS_ORGANIZACIONALES.map(
    (b) => `
    <div class="py-3 first:pt-0 last:pb-0">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium text-text-primary">${escapeHtml(b.competencia)}</span>
        <span class="text-xs tabular-nums text-slate-500">${b.actual.toFixed(1)} / ${b.requerida.toFixed(1)}</span>
      </div>
      ${renderHorizontalGapBar(b.requerida, b.actual)}
    </div>`,
  ).join("");

  return `
    ${renderEval360KpiGrid(EVAL360_KPIS)}
    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Resumen general", "Estado actual de la campaña Q2 2026", resumenBody)}
      ${renderSurfaceCard("Distribución de evaluadores", "Asignaciones por tipo de evaluador", charts.donut)}
    </div>
    <div class="mt-5">
      ${renderSurfaceCard(
        "Participación",
        "Avance por tipo de evaluador",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-2">Tipo evaluador</th>
                <th class="px-4 py-2">Asignadas</th>
                <th class="px-4 py-2">Completadas</th>
                <th class="px-4 py-2">Avance</th>
              </tr>
            </thead>
            <tbody>${participacionRows}</tbody>
          </table>
        </div>`,
      )}
    </div>
    <div class="mt-8">
      <h2 class="text-sm font-semibold text-text-primary">Indicadores organizacionales</h2>
      <p class="mt-0.5 text-xs text-text-muted">Competencias destacadas y brechas detectadas en la organización</p>
    </div>
    <div class="mt-4 grid gap-5 lg:grid-cols-3">
      ${renderSurfaceCard("Competencias mejor evaluadas", "", `<div class="divide-y divide-slate-100">${mejorEval}</div>`)}
      ${renderSurfaceCard("Competencias con oportunidad", "", `<div class="divide-y divide-slate-100">${oportunidad}</div>`)}
      ${renderSurfaceCard("Brechas organizacionales", "Requerida vs. actual", `<div class="divide-y divide-slate-100">${brechas}</div>`)}
    </div>`;
}
