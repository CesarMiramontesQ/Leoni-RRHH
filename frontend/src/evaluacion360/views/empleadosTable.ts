import { escapeHtml } from "../../ui/uiUtils.ts";
import type { EmpleadoEval360 } from "../types.ts";
import { evaluacionEstadoBadge } from "../shared.ts";

export function renderEmpleadosEval360Table(empleados: EmpleadoEval360[]): string {
  const rows = empleados
    .map(
      (e) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/80">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">${escapeHtml(e.iniciales)}</span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre)}</span>
        </div>
      </td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.numero)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.puesto)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.departamento)}</td>
      <td class="px-4 py-3 text-sm text-slate-600 max-w-[10rem] truncate" title="${escapeHtml(e.campana)}">${escapeHtml(e.campana)}</td>
      <td class="px-4 py-3">${evaluacionEstadoBadge(e.estado)}</td>
      <td class="px-4 py-3 text-sm font-semibold tabular-nums text-text-primary">${e.calificacion > 0 ? e.calificacion.toFixed(1) : "—"}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.nivel)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.brechaPrincipal)}</td>
      <td class="px-4 py-3">
        <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-select-empleado" data-id="${escapeHtml(e.id)}">Ver evaluación</button>
      </td>
    </tr>`,
    )
    .join("");

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-4 py-3">Empleado</th>
            <th class="px-4 py-3">Número</th>
            <th class="px-4 py-3">Puesto</th>
            <th class="px-4 py-3">Departamento</th>
            <th class="px-4 py-3">Campaña</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Calificación</th>
            <th class="px-4 py-3">Nivel</th>
            <th class="px-4 py-3">Brecha principal</th>
            <th class="px-4 py-3">Acción</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="10" class="px-4 py-8 text-center text-sm text-text-muted">Sin empleados con los filtros actuales</td></tr>`}</tbody>
      </table>
    </div>`;
}
