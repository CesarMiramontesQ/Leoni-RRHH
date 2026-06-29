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

export function renderEmpleadoHistorialPanel(
  historial: CursosDashboardEmpleadoHistorial | null,
  loading: boolean,
  filtroEstado: string,
  visible: boolean,
): string {
  if (!visible) return "";

  const estados: EstadoCursoEmpleado[] = [
    "pendiente",
    "programado",
    "completado",
    "no_acreditado",
    "en_progreso",
  ];

  const filtroBtns = estados
    .map((e) => {
      const active = filtroEstado === e;
      const cls = active ? BTN_SECONDARY : BTN_GHOST;
      return `<button type="button" class="${cls} text-xs" data-action="hist-filtro-estado" data-estado="${e}">${escapeHtml(ESTADO_CURSO_LABELS[e])}</button>`;
    })
    .join("");

  const header = historial
    ? `<div>
        <h2 class="text-lg font-semibold text-text-primary">${escapeHtml(historial.nombre_empleado ?? "Empleado")}</h2>
        <p class="mt-0.5 text-sm text-text-muted">${escapeHtml(historial.no_empleado ?? "")}${historial.area_nombre ? ` · ${escapeHtml(historial.area_nombre)}` : ""}${historial.puesto_nombre ? ` · ${escapeHtml(historial.puesto_nombre)}` : ""}</p>
      </div>`
    : `<div class="h-10 w-48 animate-pulse rounded bg-slate-200"></div>`;

  let body = "";
  if (loading) {
    body = `<div class="space-y-3 p-4"><div class="h-24 animate-pulse rounded-lg bg-slate-100"></div><div class="h-24 animate-pulse rounded-lg bg-slate-100"></div></div>`;
  } else if (!historial) {
    body = `<p class="p-4 text-sm text-text-muted">No se pudo cargar el historial.</p>`;
  } else {
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
        const asistio =
          s.asistio === true ? "Sí" : s.asistio === false ? "No" : "—";
        return `<tr>
          <td class="px-3 py-2 font-medium text-text-primary">${escapeHtml(s.curso_nombre ?? "—")}</td>
          <td class="px-3 py-2 text-text-muted">${escapeHtml(s.fecha_inicio)}</td>
          <td class="px-3 py-2"><a href="#/sesiones/${s.curso_id}/${s.sesion_id}" class="text-accent hover:underline">${escapeHtml(estadoLabel)}</a></td>
          <td class="px-3 py-2 text-text-muted">${escapeHtml(asistio)}</td>
        </tr>`;
      })
      .join("");

    body = `<div class="flex-1 overflow-y-auto p-4 space-y-6">
      <div>
        <h3 class="text-sm font-semibold text-text-primary">Cursos</h3>
        <div class="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-text-muted">
              <tr><th class="px-3 py-2 text-left">Curso</th><th class="px-3 py-2 text-left">Estado</th><th class="px-3 py-2 text-left">Finalización</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${cursosRows || `<tr><td colspan="3" class="px-3 py-4 text-center text-text-muted">Sin cursos</td></tr>`}</tbody>
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
            <tbody class="divide-y divide-slate-100">${sesRows || `<tr><td colspan="4" class="px-3 py-4 text-center text-text-muted">Sin sesiones</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  return `<aside id="cursos-seg-historial-panel" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl" role="dialog" aria-label="Historial de capacitación">
    <div class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
      ${header}
      <button type="button" class="${BTN_GHOST}" data-action="close-historial" aria-label="Cerrar">✕</button>
    </div>
    <div class="border-b border-slate-100 px-4 py-3 flex flex-wrap gap-2">
      <button type="button" class="${filtroEstado === "" ? BTN_SECONDARY : BTN_GHOST} text-xs" data-action="hist-filtro-estado" data-estado="">Todos</button>
      ${filtroBtns}
    </div>
    ${body}
  </aside>
  <div class="fixed inset-0 z-30 bg-slate-900/30" data-action="close-historial" aria-hidden="true"></div>`;
}
