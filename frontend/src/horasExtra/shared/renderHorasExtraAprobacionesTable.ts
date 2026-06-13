import type { HorasExtraPendiente } from "../../api/horasExtraAprobacion.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  HE_TABLE_ROW,
  HE_TABLE_TD,
  renderHorasExtraEstadoBadge,
  renderHorasExtraTableScroll,
  renderHorasExtraTableStatusRow,
  renderHorasExtraVerButton,
  type HorasExtraTableColumn,
} from "./horasExtraTableUi.ts";

export type HorasExtraAprobacionesTableStatus = "loading" | "ready" | "error";

export type HorasExtraAprobacionesTableViewModel = {
  status: HorasExtraAprobacionesTableStatus;
  items: HorasExtraPendiente[];
  error?: string;
};

const TABLE_COLUMNS: readonly HorasExtraTableColumn[] = [
  { label: "Folio" },
  { label: "Empleado" },
  { label: "Puesto" },
  { label: "Área" },
  { label: "Subárea" },
  { label: "Fecha" },
  { label: "Horas extras", align: "right" },
  { label: "Estado" },
  { label: "Creación" },
  { label: "Acciones", align: "right" },
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
  return renderHorasExtraEstadoBadge(item.estado, item.estado_consolidado);
}

function renderRow(item: HorasExtraPendiente): string {
  return `
    <tr class="${HE_TABLE_ROW}">
      <td class="${HE_TABLE_TD} text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap">#${item.solicitud_id}</td>
      <td class="${HE_TABLE_TD}">
        <p class="truncate text-sm font-semibold text-text-primary">${escapeHtml(item.empleado_resumen ?? "—")}</p>
      </td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.puesto_descripcion ?? "—")}</p>
      </td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.area_descripcion ?? "—")}</p>
      </td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">
        <p class="truncate text-sm text-text-primary">${escapeHtml(item.subarea_descripcion ?? "—")}</p>
      </td>
      <td class="${HE_TABLE_TD} text-sm tabular-nums text-text-primary whitespace-nowrap">${escapeHtml(fmtFecha(item.fecha_solicitud))}</td>
      <td class="${HE_TABLE_TD} text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap text-right">${item.total_horas.toFixed(2)}</td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">${estadoBadge(item)}</td>
      <td class="${HE_TABLE_TD} text-sm tabular-nums text-text-secondary whitespace-nowrap">${escapeHtml(fmtFechaHora(item.created_at))}</td>
      <td class="${HE_TABLE_TD} whitespace-nowrap text-right">${renderHorasExtraVerButton({ dataAttr: "he-aprob-ver-id", solicitudId: item.solicitud_id, label: "Ver solicitud" })}</td>
    </tr>`;
}

function renderTableBody(vm: HorasExtraAprobacionesTableViewModel): string {
  if (vm.status === "loading") {
    return renderHorasExtraTableStatusRow(
      COLSPAN,
      `<p class="text-sm text-text-secondary">Cargando solicitudes…</p>`,
    );
  }

  if (vm.status === "error") {
    return renderHorasExtraTableStatusRow(
      COLSPAN,
      `<p class="text-sm font-semibold text-text-primary">No se pudo cargar el listado</p>
       <p class="mt-1 text-sm text-text-secondary">${escapeHtml(vm.error ?? "Intenta de nuevo más tarde.")}</p>`,
    );
  }

  if (vm.items.length === 0) {
    return renderHorasExtraTableStatusRow(
      COLSPAN,
      `<p class="text-sm font-semibold text-text-primary">Sin solicitudes asignadas</p>
       <p class="mt-1 text-sm text-text-secondary">No tienes solicitudes de horas extra asignadas para aprobación.</p>`,
    );
  }

  return vm.items.map(renderRow).join("");
}

export function renderHorasExtraAprobacionesTable(vm: HorasExtraAprobacionesTableViewModel): string {
  return renderHorasExtraTableScroll(TABLE_COLUMNS, renderTableBody(vm));
}
