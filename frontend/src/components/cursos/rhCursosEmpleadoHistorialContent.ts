import type {
  CursosDashboardEmpleadoHistorial,
  EstadoCursoEmpleado,
} from "../../dashboard/cursos/seguimientoTypes.ts";
import {
  ESTADO_CURSO_BADGE,
  ESTADO_CURSO_LABELS,
} from "../../dashboard/cursos/seguimientoTypes.ts";
import { ESTADO_SESION_LABELS } from "../../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../../dashboard/cursos/types.ts";
import { BTN_GHOST, BTN_SECONDARY } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const ESTADOS_FILTRO: EstadoCursoEmpleado[] = [
  "pendiente",
  "programado",
  "completado",
  "no_acreditado",
  "en_progreso",
];

export function renderHistorialEstadoFiltros(filtroEstado: string): string {
  const filtroBtns = ESTADOS_FILTRO.map((e) => {
    const active = filtroEstado === e;
    const cls = active ? BTN_SECONDARY : BTN_GHOST;
    return `<button type="button" class="${cls} text-xs" data-action="hist-filtro-estado" data-estado="${e}">${escapeHtml(ESTADO_CURSO_LABELS[e])}</button>`;
  }).join("");

  return `<div class="flex flex-wrap gap-2">
    <button type="button" class="${filtroEstado === "" ? BTN_SECONDARY : BTN_GHOST} text-xs" data-action="hist-filtro-estado" data-estado="">Todos</button>
    ${filtroBtns}
  </div>`;
}

export function renderEmpleadoHistorialContent(
  historial: CursosDashboardEmpleadoHistorial | null,
  loading: boolean,
): string {
  if (loading) {
    return `<div class="space-y-3"><div class="h-24 animate-pulse rounded-lg bg-slate-100"></div><div class="h-24 animate-pulse rounded-lg bg-slate-100"></div></div>`;
  }
  if (!historial) {
    return `<p class="py-8 text-center text-sm text-text-muted">No se pudo cargar el historial del empleado.</p>`;
  }

  const cursosRows = historial.cursos
    .map((c) => {
      const badge = ESTADO_CURSO_BADGE[c.estado_curso];
      return `<tr>
        <td class="px-3 py-2 font-medium text-text-primary">${escapeHtml(c.curso_nombre ?? "—")}</td>
        <td class="px-3 py-2"><span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}">${escapeHtml(ESTADO_CURSO_LABELS[c.estado_curso])}</span></td>
        <td class="px-3 py-2 text-text-muted">${escapeHtml(c.fecha_finalizacion ?? "—")}</td>
      </tr>`;
    })
    .join("");

  const sesRows = historial.sesiones
    .map((s) => {
      const estadoLabel = ESTADO_SESION_LABELS[s.estado_sesion as EstadoSesion] ?? s.estado_sesion;
      const asistio = s.asistio === true ? "Sí" : s.asistio === false ? "No" : "—";
      return `<tr>
        <td class="px-3 py-2 font-medium text-text-primary">${escapeHtml(s.curso_nombre ?? "—")}</td>
        <td class="px-3 py-2 text-text-muted">${escapeHtml(s.fecha_inicio)}</td>
        <td class="px-3 py-2"><a href="#/sesiones/${s.curso_id}/${s.sesion_id}" class="text-accent hover:underline">${escapeHtml(estadoLabel)}</a></td>
        <td class="px-3 py-2 text-text-muted">${escapeHtml(asistio)}</td>
      </tr>`;
    })
    .join("");

  return `<div class="space-y-6">
    <div>
      <h3 class="text-sm font-semibold text-text-primary">Cursos</h3>
      <div class="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-text-muted">
            <tr><th class="px-3 py-2 text-left">Curso</th><th class="px-3 py-2 text-left">Estado</th><th class="px-3 py-2 text-left">Finalización</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${cursosRows || `<tr><td colspan="3" class="px-3 py-4 text-center text-text-muted">Sin cursos asignados</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div>
      <h3 class="text-sm font-semibold text-text-primary">Sesiones</h3>
      <div class="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-text-muted">
            <tr><th class="px-3 py-2 text-left">Curso</th><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Estado</th><th class="px-3 py-2 text-left">Asistió</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${sesRows || `<tr><td colspan="4" class="px-3 py-4 text-center text-text-muted">Sin sesiones registradas</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}
