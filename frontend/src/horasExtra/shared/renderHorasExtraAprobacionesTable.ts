import type { HorasExtraPendiente } from "../../api/horasExtraAprobacion.ts";
import { badgeApproved, badgePending, badgeRejected } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type HorasExtraAprobacionesTableStatus = "loading" | "ready" | "error";

export type HorasExtraAprobacionesTableViewModel = {
  status: HorasExtraAprobacionesTableStatus;
  items: HorasExtraPendiente[];
  error?: string;
};

function fmtFecha(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtFechaHora(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function estadoBadge(item: HorasExtraPendiente): string {
  if (item.estado_consolidado === "aprobado_parcial") {
    return badgePending("Aprobación parcial");
  }
  if (item.estado_consolidado === "aprobado") return badgeApproved("Aprobado");
  if (item.estado_consolidado === "rechazado") return badgeRejected("Rechazado");
  return badgePending("Pendiente");
}

function renderRow(item: HorasExtraPendiente): string {
  return `
    <tr>
      <td class="px-3 py-3 text-sm font-semibold text-text-primary">#${item.solicitud_id}</td>
      <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(item.empleado_resumen ?? "—")}</td>
      <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(item.puesto_descripcion ?? "—")}</td>
      <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(item.area_descripcion ?? "—")}</td>
      <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(item.subarea_descripcion ?? "—")}</td>
      <td class="px-3 py-3 text-sm text-text-primary whitespace-nowrap">${escapeHtml(fmtFecha(item.fecha_solicitud))}</td>
      <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary text-right">${item.total_horas.toFixed(2)}</td>
      <td class="px-3 py-3">${estadoBadge(item)}</td>
      <td class="px-3 py-3 text-sm text-text-secondary whitespace-nowrap">${escapeHtml(fmtFechaHora(item.created_at))}</td>
      <td class="px-3 py-3">
        <button type="button" data-he-aprob-ver-id="${item.solicitud_id}" class="text-sm font-semibold text-accent hover:underline">Ver solicitud</button>
      </td>
    </tr>`;
}

export function renderHorasExtraAprobacionesTable(vm: HorasExtraAprobacionesTableViewModel): string {
  if (vm.status === "loading") {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">Cargando solicitudes…</p>`;
  }
  if (vm.status === "error") {
    return `<p class="px-4 py-8 text-center text-sm text-red-700">${escapeHtml(vm.error ?? "Error al cargar solicitudes.")}</p>`;
  }
  if (!vm.items.length) {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">No tienes solicitudes de horas extra asignadas para aprobación.</p>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left">
        <thead class="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th class="px-3 py-3">Folio</th>
            <th class="px-3 py-3">Empleado</th>
            <th class="px-3 py-3">Puesto</th>
            <th class="px-3 py-3">Área</th>
            <th class="px-3 py-3">Sucursal</th>
            <th class="px-3 py-3">Fecha</th>
            <th class="px-3 py-3 text-right">Horas extras</th>
            <th class="px-3 py-3">Estado</th>
            <th class="px-3 py-3">Creación</th>
            <th class="px-3 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${vm.items.map(renderRow).join("")}
        </tbody>
      </table>
    </div>`;
}
