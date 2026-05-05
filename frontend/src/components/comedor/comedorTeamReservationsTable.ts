import type {
  ComedorPanelState,
  ComedorTeamReservationsPage,
} from "../../comedor/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { COMEDOR_FILTER_INPUT, COMEDOR_TABLE_TH, escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

type TeamTableFiltersState = {
  search: string;
};

function estadoBadge(estado: string): string {
  const key = estado.trim().toUpperCase();
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  const dot = (cls: string) => `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
  if (key === "ACCEDIDO") {
    return `<span class="${base} border-emerald-200/90 bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-900">${dot("bg-emerald-500")}Accedido</span>`;
  }
  if (key === "PENDIENTE") {
    return `<span class="${base} border-amber-200/90 bg-linear-to-r from-amber-50 to-yellow-50 text-amber-950">${dot("bg-amber-400")}Pendiente</span>`;
  }
  return `<span class="${base} border-slate-200 bg-slate-50 text-slate-700">${dot("bg-slate-400")}Sin dato</span>`;
}

function th(label: string, extra = ""): string {
  return `<th scope="col" class="${COMEDOR_TABLE_TH} ${extra}">${escapeComedorHtml(label)}</th>`;
}

export function renderComedorTeamReservationsTable(
  state: ComedorPanelState,
  tableData: ComedorTeamReservationsPage | null,
  filters: TeamTableFiltersState,
  errorMessage: string | null,
): string {
  const toolbar = `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Buscar reservas del equipo">
      <input
        type="search"
        value="${escapeComedorHtml(filters.search)}"
        data-comedor-search
        placeholder="Buscar por empleado"
        autocomplete="off"
        class="${COMEDOR_FILTER_INPUT} max-w-md"
      />
    </section>`;

  if (state === "loading") {
    return `${toolbar}<section class="${RH_LISTADO_SURFACE} overflow-hidden"><div class="animate-pulse p-4"><div class="h-10 rounded-lg bg-slate-100"></div></div></section>`;
  }
  if (state === "error") {
    return `${toolbar}<section class="rounded-2xl border border-red-200/90 bg-white px-4 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</section>`;
  }
  if (state === "empty" || !tableData || tableData.items.length === 0) {
    return `${toolbar}<section class="${RH_LISTADO_SURFACE} overflow-hidden"><div class="rh-sol-empty px-4 py-12 text-center text-sm text-[#64748b]" role="status">No hay registros próximos del equipo.</div></section>`;
  }

  const rows = tableData.items
    .map(
      (item) => `<tr class="rh-comedor-data-row transition-colors">
        <td class="px-3 py-3 text-sm font-semibold text-[#0f172a] sm:px-4">${escapeComedorHtml(item.empleadoNombre)}</td>
        <td class="px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(item.tipoComida)}</td>
        <td class="px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(item.fecha)}</td>
        <td class="px-3 py-3 sm:px-4">${estadoBadge(item.estado)}</td>
        <td class="px-3 py-3 text-right sm:px-4">
          ${
            item.canManage
              ? `<div class="inline-flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  data-comedor-edit-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-[10px] border border-[rgba(37,99,235,0.35)] bg-[rgba(219,234,254,0.35)] px-2.5 py-1.5 text-xs font-semibold text-[#002147] shadow-sm transition hover:bg-[rgba(219,234,254,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                >
                  Editar
                </button>
                <button
                  type="button"
                  data-comedor-cancel-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-[10px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
                >
                  Cancelar
                </button>
              </div>`
              : '<span class="text-xs font-medium text-slate-400">—</span>'
          }
        </td>
      </tr>`,
    )
    .join("");

  const totalPages = Math.max(1, Math.ceil(tableData.total / tableData.pageSize));
  const pageButtons = paginationRange(totalPages, tableData.page)
    .map((entry) => {
      if (entry === "ellipsis") return '<span class="px-2 text-slate-500">…</span>';
      const active = entry === tableData.page;
      return `<button type="button" data-comedor-page="${entry}" class="${active ? "min-h-10 rounded-lg bg-leoni-blue px-3 py-2 text-sm font-bold text-white shadow-md" : "min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"}">${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3">
      ${toolbar}
      <section class="rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-left">
            <thead class="rh-sol-thead">
              <tr>
                ${th("Nombre del Empleado")}
                ${th("Tipo de Comida")}
                ${th("Fecha")}
                ${th("Estado")}
                ${th("Acciones", "text-right")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90 bg-white">${rows}</tbody>
          </table>
        </div>
        <footer class="flex items-center justify-center gap-1 border-t border-slate-100 px-4 py-3">${pageButtons}</footer>
      </section>
    </div>`;
}
