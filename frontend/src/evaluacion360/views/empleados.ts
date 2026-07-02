import { escapeHtml } from "../../ui/uiUtils.ts";
import { evaluacionEstadoBadge } from "../shared.ts";
import type { EmpleadoEvaluadoApi } from "../../api/evaluacion360.ts";

export interface EmpleadosViewData {
  empleados: EmpleadoEvaluadoApi[] | null;
  search: string;
}

function iniciales(nombre: string | null): string {
  if (!nombre) return "—";
  const partes = nombre.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  return (partes.slice(0, 2).map((p) => p[0]).join("") || "—").toUpperCase();
}

function matches(e: EmpleadoEvaluadoApi, q: string): boolean {
  if (!q) return true;
  const hay = [e.nombre, String(e.no_empleado ?? ""), e.puesto, e.area, e.campana_nombre]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function renderSkeleton(): string {
  const row = `<div class="h-10 animate-pulse rounded bg-slate-100"></div>`;
  return `
    <section class="mt-6">
      <div class="rounded-xl border border-border bg-white p-4">
        <div class="mb-4 h-9 w-full max-w-xl animate-pulse rounded bg-slate-100"></div>
        <div class="space-y-2">${row.repeat(5)}</div>
      </div>
    </section>`;
}

function renderRow(e: EmpleadoEvaluadoApi): string {
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50/80">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">${escapeHtml(iniciales(e.nombre))}</span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre ?? `#${e.empleado_id}`)}</span>
        </div>
      </td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${e.no_empleado ?? "—"}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.puesto ?? "—")}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.area ?? "—")}</td>
      <td class="px-4 py-3 text-sm text-slate-600 max-w-[10rem] truncate" title="${escapeHtml(e.campana_nombre)}">${escapeHtml(e.campana_nombre)}</td>
      <td class="px-4 py-3">${evaluacionEstadoBadge(e.estado)}</td>
      <td class="px-4 py-3 text-sm font-semibold tabular-nums text-text-primary">${e.calificacion_general != null ? e.calificacion_general.toFixed(1) : "—"}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${Math.round(e.avance)}%</td>
      <td class="px-4 py-3">
        <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-select-empleado" data-id="${e.participante_id}">Ver evaluación</button>
      </td>
    </tr>`;
}

export function renderEval360Empleados(data: EmpleadosViewData): string {
  if (data.empleados === null) return renderSkeleton();
  const q = data.search.trim().toLowerCase();
  const filtrados = data.empleados.filter((e) => matches(e, q));
  const rows = filtrados.map(renderRow).join("");

  return `
    <section class="mt-6" aria-labelledby="e360-seccion-empleados">
      <h2 id="e360-seccion-empleados" class="text-sm font-semibold text-text-primary">Empleados evaluados</h2>
      <p class="mt-0.5 text-xs text-text-muted">${filtrados.length} de ${data.empleados.length} colaboradores · detalle en Resultados</p>
      <div class="mt-4 rounded-xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <label class="mb-1 block text-xs font-medium text-text-muted">Buscar empleado</label>
        <input
          type="search"
          name="e360-search"
          value="${escapeHtml(data.search)}"
          placeholder="Nombre, número, puesto, área o campaña…"
          class="w-full max-w-xl rounded-lg border border-border px-3 py-2 text-sm"
          data-input="e360-search"
        />
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-3">Empleado</th>
                <th class="px-4 py-3">Número</th>
                <th class="px-4 py-3">Puesto</th>
                <th class="px-4 py-3">Área</th>
                <th class="px-4 py-3">Campaña</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Calificación</th>
                <th class="px-4 py-3">Avance</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="9" class="px-4 py-8 text-center text-sm text-text-muted">Sin empleados evaluados${q ? " para la búsqueda actual" : ""}.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}
