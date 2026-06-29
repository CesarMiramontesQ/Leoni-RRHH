import type {
  CursosDashboardCursoCompletadoItem,
  CursosDashboardEmpleadoResumenItem,
  CursosDashboardSesionProximaItem,
} from "../../dashboard/cursos/seguimientoTypes.ts";
import { ESTADO_SESION_LABELS } from "../../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../../dashboard/cursos/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

function quickTable(
  title: string,
  headers: string[],
  rows: string,
  emptyMsg: string,
): string {
  return `<section class="${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm">
    <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(title)}</h3>
    <div class="mt-3 overflow-x-auto">
      ${
        rows
          ? `<table class="min-w-full text-left text-sm">
        <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-text-muted">
          <tr>${headers.map((h) => `<th class="px-2 py-2 font-medium">${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${rows}</tbody>
      </table>`
          : `<p class="py-6 text-center text-sm text-text-muted">${escapeHtml(emptyMsg)}</p>`
      }
    </div>
  </section>`;
}

export function renderVistaRapida(opts: {
  empleadosCursosPendientes: CursosDashboardEmpleadoResumenItem[];
  empleadosSesionesPendientes: CursosDashboardEmpleadoResumenItem[];
  sesionesProximas: CursosDashboardSesionProximaItem[];
  cursosCompletados: CursosDashboardCursoCompletadoItem[];
}): string {
  const empPendRows = opts.empleadosCursosPendientes
    .map(
      (e) => `<tr class="hover:bg-slate-50/80 cursor-pointer" data-action="open-empleado" data-empleado-id="${e.empleado_id}">
      <td class="px-2 py-2 font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? "—")}</td>
      <td class="px-2 py-2 text-text-muted">${escapeHtml(e.no_empleado ?? "—")}</td>
      <td class="px-2 py-2 tabular-nums">${e.pendientes_count}</td>
    </tr>`,
    )
    .join("");

  const empSesRows = opts.empleadosSesionesPendientes
    .map(
      (e) => `<tr class="hover:bg-slate-50/80 cursor-pointer" data-action="open-empleado" data-empleado-id="${e.empleado_id}">
      <td class="px-2 py-2 font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? "—")}</td>
      <td class="px-2 py-2 text-text-muted">${escapeHtml(e.area_nombre ?? "—")}</td>
      <td class="px-2 py-2 tabular-nums">${e.pendientes_count}</td>
    </tr>`,
    )
    .join("");

  const sesRows = opts.sesionesProximas
    .map((s) => {
      const estadoLabel =
        ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;
      return `<tr class="hover:bg-slate-50/80">
      <td class="px-2 py-2 font-medium text-text-primary">${escapeHtml(s.curso_nombre ?? "—")}</td>
      <td class="px-2 py-2 text-text-muted">${escapeHtml(s.fecha_inicio)}</td>
      <td class="px-2 py-2">
        <a href="#/sesiones/${s.curso_id}/${s.sesion_id}" class="text-accent hover:underline">${escapeHtml(estadoLabel)}</a>
      </td>
    </tr>`;
    })
    .join("");

  const compRows = opts.cursosCompletados
    .map(
      (c) => `<tr class="hover:bg-slate-50/80 cursor-pointer" data-action="open-empleado" data-empleado-id="${c.empleado_id}">
      <td class="px-2 py-2 font-medium text-text-primary">${escapeHtml(c.nombre_empleado ?? "—")}</td>
      <td class="px-2 py-2 text-text-muted">${escapeHtml(c.curso_nombre ?? "—")}</td>
      <td class="px-2 py-2 text-text-muted">${escapeHtml(c.fecha_finalizacion ?? "—")}</td>
    </tr>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${quickTable("Empleados con cursos pendientes", ["Empleado", "No.", "Pendientes"], empPendRows, "Sin pendientes registrados")}
    ${quickTable("Empleados con sesiones pendientes", ["Empleado", "Área", "Pendientes"], empSesRows, "Sin sesiones pendientes")}
    ${quickTable("Próximas sesiones", ["Curso", "Fecha", "Estado"], sesRows, "No hay sesiones próximas")}
    ${quickTable("Completados recientes", ["Empleado", "Curso", "Fecha"], compRows, "Sin completados recientes")}
  </div>`;
}
