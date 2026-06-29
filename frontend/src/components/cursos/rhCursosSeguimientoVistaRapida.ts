import type {
  CursosDashboardEmpleadoResumenItem,
  CursosDashboardSesionProximaItem,
} from "../../dashboard/cursos/seguimientoTypes.ts";
import { ESTADO_SESION_LABELS } from "../../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../../dashboard/cursos/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const TABLE_HEAD =
  "border-b border-slate-200 bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500";

function quickTable(
  title: string,
  headers: string[],
  rows: string,
  emptyMsg: string,
  fullWidth = false,
): string {
  const spanCls = fullWidth ? " lg:col-span-2" : "";
  return `<section class="${RH_LISTADO_SURFACE} p-4 sm:p-5${spanCls}" aria-label="${escapeHtml(title)}">
    <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(title)}</h3>
    <div class="mt-3 overflow-x-auto">
      ${
        rows
          ? `<table class="cs-seguimiento-table min-w-full text-left text-sm">
        <thead class="${TABLE_HEAD}">
          <tr>${headers.map((h) => `<th class="px-4 py-3 font-medium">${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${rows}</tbody>
      </table>`
          : `<p class="py-8 text-center text-sm text-text-secondary">${escapeHtml(emptyMsg)}</p>`
      }
    </div>
  </section>`;
}

export function renderVistaRapida(opts: {
  empleadosCursosPendientes: CursosDashboardEmpleadoResumenItem[];
  empleadosSesionesPendientes: CursosDashboardEmpleadoResumenItem[];
  sesionesProximas: CursosDashboardSesionProximaItem[];
}): string {
  const empPendRows = opts.empleadosCursosPendientes
    .map(
      (e) => `<tr class="cs-seguimiento-row cursor-pointer transition hover:bg-slate-50/80" data-action="open-empleado" data-empleado-id="${e.empleado_id}">
      <td class="px-4 py-3 font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? "—")}</td>
      <td class="px-4 py-3 text-text-muted tabular-nums">${escapeHtml(e.no_empleado ?? "—")}</td>
      <td class="px-4 py-3 tabular-nums text-text-primary">${e.pendientes_count}</td>
    </tr>`,
    )
    .join("");

  const empSesRows = opts.empleadosSesionesPendientes
    .map(
      (e) => `<tr class="cs-seguimiento-row cursor-pointer transition hover:bg-slate-50/80" data-action="open-empleado" data-empleado-id="${e.empleado_id}">
      <td class="px-4 py-3 font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? "—")}</td>
      <td class="px-4 py-3 text-text-muted">${escapeHtml(e.area_nombre ?? "—")}</td>
      <td class="px-4 py-3 tabular-nums text-text-primary">${e.pendientes_count}</td>
    </tr>`,
    )
    .join("");

  const sesRows = opts.sesionesProximas
    .map((s) => {
      const estadoLabel =
        ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;
      return `<tr class="cs-seguimiento-row transition hover:bg-slate-50/80">
      <td class="px-4 py-3 font-medium text-text-primary">${escapeHtml(s.curso_nombre ?? "—")}</td>
      <td class="px-4 py-3 whitespace-nowrap text-text-muted">${escapeHtml(s.fecha_inicio)}</td>
      <td class="px-4 py-3">
        <a href="#/sesiones/${s.curso_id}/${s.sesion_id}" class="font-medium text-leoni-blue hover:underline">${escapeHtml(estadoLabel)}</a>
      </td>
    </tr>`;
    })
    .join("");

  return `<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${quickTable("Empleados con cursos pendientes", ["Empleado", "No.", "Pendientes"], empPendRows, "Sin pendientes registrados")}
    ${quickTable("Empleados con sesiones pendientes", ["Empleado", "Área", "Pendientes"], empSesRows, "Sin sesiones pendientes")}
    ${quickTable("Próximas sesiones", ["Curso", "Fecha", "Estado"], sesRows, "No hay sesiones próximas", true)}
  </div>`;
}
