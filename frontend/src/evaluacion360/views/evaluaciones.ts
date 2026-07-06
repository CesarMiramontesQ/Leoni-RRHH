import { escapeHtml } from "../../ui/uiUtils.ts";
import { tipoEvaluadorLabel } from "../shared.ts";
import type { TipoEvaluador } from "../types.ts";
import type { EvaluacionEstadoApi, EvaluacionRhApi } from "../../api/evaluacion360.ts";

export interface EvaluacionesViewData {
  evaluaciones: EvaluacionRhApi[] | null;
}

const ESTADO_BADGE: Record<EvaluacionEstadoApi, { cls: string; label: string }> = {
  pendiente: { cls: "border-amber-200 bg-amber-50 text-amber-900", label: "Pendiente" },
  en_progreso: { cls: "border-blue-200 bg-blue-50 text-blue-900", label: "En progreso" },
  completada: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", label: "Completada" },
  vencida: { cls: "border-red-200 bg-red-50 text-red-900", label: "Vencida" },
};

function estadoBadge(estado: EvaluacionEstadoApi): string {
  const b = ESTADO_BADGE[estado] ?? { cls: "border-slate-200 bg-slate-50 text-slate-700", label: estado };
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${b.cls}">${escapeHtml(b.label)}</span>`;
}

function renderSkeleton(): string {
  const row = `<div class="h-10 animate-pulse rounded bg-slate-100"></div>`;
  return `
    <div class="rounded-xl border border-border bg-white p-4">
      <div class="mb-4 h-4 w-56 animate-pulse rounded bg-slate-100"></div>
      <div class="space-y-2">${row.repeat(6)}</div>
    </div>`;
}

function renderRow(e: EvaluacionRhApi): string {
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50/50">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(e.evaluado_nombre ?? "—")}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.evaluador_nombre ?? "—")}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(tipoEvaluadorLabel(e.tipo_evaluador as TipoEvaluador) ?? e.tipo_evaluador)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.fecha_asignacion ?? "—")}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.fecha_limite ?? "—")}</td>
      <td class="px-4 py-3">${estadoBadge(e.estado)}</td>
    </tr>`;
}

export function renderEval360Evaluaciones(data: EvaluacionesViewData): string {
  if (data.evaluaciones === null) return renderSkeleton();
  const rows = data.evaluaciones.map(renderRow).join("");
  return `
    <div class="rounded-xl border border-border bg-white">
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-sm font-semibold text-text-primary">Evaluaciones asignadas</h2>
        <p class="mt-0.5 text-xs text-text-muted">${data.evaluaciones.length} evaluaciones en todas las campañas</p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Evaluado</th>
              <th class="px-4 py-3">Evaluador</th>
              <th class="px-4 py-3">Tipo evaluador</th>
              <th class="px-4 py-3">Fecha asignación</th>
              <th class="px-4 py-3">Fecha límite</th>
              <th class="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-text-muted">No hay evaluaciones asignadas.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}
