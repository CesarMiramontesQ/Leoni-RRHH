import type {
  ComedorPanelState,
  ComedorTeamReservationsPage,
} from "../../comedor/rh/types.ts";
import { escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

type TeamTableFiltersState = {
  search: string;
};

function estadoBadge(estado: string): string {
  const key = estado.trim().toUpperCase();
  if (key === "ACCEDIDO") {
    return '<span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Accedido</span>';
  }
  if (key === "PENDIENTE") {
    return '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pendiente</span>';
  }
  return '<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Sin dato</span>';
}

export function renderComedorTeamReservationsTable(
  state: ComedorPanelState,
  tableData: ComedorTeamReservationsPage | null,
  filters: TeamTableFiltersState,
  errorMessage: string | null,
): string {
  const toolbar = `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6">
      <input
        type="search"
        value="${escapeComedorHtml(filters.search)}"
        data-comedor-search
        placeholder="Buscar por empleado"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm placeholder:text-slate-400 sm:max-w-md"
      />
    </section>`;

  if (state === "loading") {
    return `${toolbar}<section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"><div class="animate-pulse p-4"><div class="h-10 rounded bg-slate-100"></div></div></section>`;
  }
  if (state === "error") {
    return `${toolbar}<section class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</section>`;
  }
  if (state === "empty" || !tableData || tableData.items.length === 0) {
    return `${toolbar}<section class="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500">No hay registros próximos del equipo.</section>`;
  }

  const rows = tableData.items
    .map(
      (item) => `<tr class="hover:bg-slate-50">
        <td class="px-4 py-2.5 text-sm font-medium text-slate-800">${escapeComedorHtml(item.empleadoNombre)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-700">${escapeComedorHtml(item.tipoComida)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-700">${escapeComedorHtml(item.fecha)}</td>
        <td class="px-4 py-2.5">${estadoBadge(item.estado)}</td>
        <td class="px-4 py-2.5 text-right">
          ${
            item.canManage
              ? `<div class="inline-flex items-center gap-2">
                <button
                  type="button"
                  data-comedor-edit-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-md border border-leoni-blue/30 bg-leoni-blue/5 px-2.5 py-1 text-xs font-semibold text-leoni-blue hover:bg-leoni-blue/10"
                >
                  Editar
                </button>
                <button
                  type="button"
                  data-comedor-cancel-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
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
      return `<button type="button" data-comedor-page="${entry}" class="${active ? "rounded-lg bg-leoni-blue px-3 py-2 text-sm font-bold text-white" : "rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"}">${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3">
      ${toolbar}
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-left">
            <thead class="border-b border-leoni-blue-light bg-leoni-blue">
              <tr>
                <th class="px-4 py-2 text-xs font-semibold text-white">Nombre del Empleado</th>
                <th class="px-4 py-2 text-xs font-semibold text-white">Tipo de Comida</th>
                <th class="px-4 py-2 text-xs font-semibold text-white">Fecha</th>
                <th class="px-4 py-2 text-xs font-semibold text-white">Estado</th>
                <th class="px-4 py-2 text-right text-xs font-semibold text-white">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>
        <footer class="flex items-center justify-center gap-1 border-t border-slate-100 px-4 py-3">${pageButtons}</footer>
      </section>
    </div>`;
}
