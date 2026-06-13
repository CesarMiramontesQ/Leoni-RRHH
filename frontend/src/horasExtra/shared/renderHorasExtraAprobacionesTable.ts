import type { HorasExtraPendiente } from "../../api/horasExtraAprobacion.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_SURFACE,
  badgeApproved,
  badgePending,
  badgeRejected,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type HorasExtraAprobacionesTableStatus = "loading" | "ready" | "error";

export type HorasExtraAprobacionesTableViewModel = {
  status: HorasExtraAprobacionesTableStatus;
  items: HorasExtraPendiente[];
  error?: string;
};

const TABLE_COLUMNS = [
  "Folio",
  "Empleado",
  "Puesto",
  "Área",
  "Sucursal",
  "Fecha",
  "Horas extras",
  "Estado",
  "Creación",
  "Acciones",
] as const;

const COLSPAN = TABLE_COLUMNS.length;

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
    <tr class="border-b border-slate-100 transition hover:bg-slate-50/70">
      <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap">#${item.solicitud_id}</td>
      <td class="px-3 py-3">
        <p class="truncate text-sm font-semibold text-text-primary">${escapeHtml(item.empleado_resumen ?? "—")}</p>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.puesto_descripcion ?? "—")}</p>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.area_descripcion ?? "—")}</p>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.subarea_descripcion ?? "—")}</p>
      </td>
      <td class="px-3 py-3 text-sm tabular-nums text-text-primary whitespace-nowrap">${escapeHtml(fmtFecha(item.fecha_solicitud))}</td>
      <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap text-right">${item.total_horas.toFixed(2)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${estadoBadge(item)}</td>
      <td class="px-3 py-3 text-sm tabular-nums text-text-secondary whitespace-nowrap">${escapeHtml(fmtFechaHora(item.created_at))}</td>
      <td class="px-3 py-3 whitespace-nowrap text-right">
        <button
          type="button"
          class="${RH_LISTADO_BTN_GHOST} min-h-9 px-3 py-1.5 text-xs font-semibold"
          data-he-aprob-ver-id="${item.solicitud_id}"
          aria-label="Ver solicitud ${item.solicitud_id}"
        >Ver solicitud</button>
      </td>
    </tr>`;
}

function renderTableBody(vm: HorasExtraAprobacionesTableViewModel): string {
  if (vm.status === "loading") {
    return `
      <tr>
        <td colspan="${COLSPAN}" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm text-text-secondary">Cargando solicitudes…</p>
        </td>
      </tr>`;
  }

  if (vm.status === "error") {
    return `
      <tr>
        <td colspan="${COLSPAN}" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm font-semibold text-text-primary">No se pudo cargar el listado</p>
          <p class="mt-1 text-sm text-text-secondary">${escapeHtml(vm.error ?? "Intenta de nuevo más tarde.")}</p>
        </td>
      </tr>`;
  }

  if (vm.items.length === 0) {
    return `
      <tr>
        <td colspan="${COLSPAN}" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm font-semibold text-text-primary">Sin solicitudes pendientes</p>
          <p class="mt-1 text-sm text-text-secondary">No tienes solicitudes de horas extra pendientes de aprobación.</p>
        </td>
      </tr>`;
  }

  return vm.items.map(renderRow).join("");
}

export function renderHorasExtraAprobacionesTable(vm: HorasExtraAprobacionesTableViewModel): string {
  return `
    <section class="rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Listado de solicitudes pendientes de aprobación">
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
              ${TABLE_COLUMNS.map((col) => {
                const align =
                  col === "Horas extras" || col === "Acciones" ? " text-right" : " text-left";
                return `<th scope="col" class="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap${align}">${col}</th>`;
              }).join("")}
            </tr>
          </thead>
          <tbody id="he-aprob-table-body">
            ${renderTableBody(vm)}
          </tbody>
        </table>
      </div>
    </section>`;
}
