import { escapeHtml } from "../../ui/uiUtils.ts";
import type { EvaluacionAsignada } from "../types.ts";
import { evaluacionEstadoBadge, tipoEvaluadorLabel } from "../shared.ts";

export function renderEval360Evaluaciones(evaluaciones: EvaluacionAsignada[]): string {
  const rows = evaluaciones
    .map(
      (e) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/50">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(e.evaluado)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(tipoEvaluadorLabel(e.tipoEvaluador))}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.fechaAsignacion)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.fechaLimite)}</td>
      <td class="px-4 py-3">${evaluacionEstadoBadge(e.estado)}</td>
    </tr>`,
    )
    .join("");

  return `
    <div class="rounded-xl border border-border bg-white">
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-sm font-semibold text-text-primary">Evaluaciones asignadas</h2>
        <p class="mt-0.5 text-xs text-text-muted">Listado de evaluaciones pendientes y en progreso</p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Evaluado</th>
              <th class="px-4 py-3">Tipo evaluador</th>
              <th class="px-4 py-3">Fecha asignación</th>
              <th class="px-4 py-3">Fecha límite</th>
              <th class="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
