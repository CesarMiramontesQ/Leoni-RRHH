import type {
  ComedorPanelState,
  ComedorReservationsPage,
} from "../../comedor/rh/types.ts";
import { FIELD_FOCUS } from "../../ui/uiTokens.ts";
import {
  dietBadgeLabel,
  escapeComedorHtml,
  paginationRange,
  renderEmpleadoAvatarCell,
  reservationDietBadge,
  reservationStatusBadge,
} from "./comedorUiUtils.ts";

export type ComedorTableFiltersState = {
  statusFilter: "todos" | "confirmado" | "cancelado";
  search: string;
};

/** Misma barra de filtros; `rh-futuros` usa `data-comedor-rh-futuros-*` para no chocar con la tabla de líder. */
export type ComedorFiltersToolbarVariant = "reservas" | "rh-futuros";

function tabClass(active: boolean): string {
  return active
    ? "inline-flex min-h-10 items-center rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm"
    : "inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";
}

function th(label: string): string {
  return `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold text-white sm:px-4 sm:text-sm">${escapeComedorHtml(label)}</th>`;
}

export function renderComedorReservationsFiltersToolbar(
  filters: ComedorTableFiltersState,
  variant: ComedorFiltersToolbarVariant,
): string {
  const searchAttr =
    variant === "rh-futuros" ? "data-comedor-rh-futuros-search" : "data-comedor-search";
  const filterAttr =
    variant === "rh-futuros" ? "data-comedor-rh-futuros-filter-status" : "data-comedor-filter-status";
  const chips = (
    [
      { id: "todos", label: "Todos" },
      { id: "confirmado", label: "Confirmados" },
      { id: "cancelado", label: "Cancelados" },
    ] as const
  )
    .map(
      (chip) =>
        `<button type="button" ${filterAttr}="${chip.id}" class="${tabClass(filters.statusFilter === chip.id)}">${chip.label}</button>`,
    )
    .join("");

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-label="Filtros de la tabla de comedor">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value="${escapeComedorHtml(filters.search)}"
          ${searchAttr}=""
          placeholder="Buscar por nombre o número"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} sm:w-88"
        />
        <div class="overflow-x-auto">
          <div class="inline-flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            ${chips}
          </div>
        </div>
      </div>
    </section>`;
}

export function renderComedorReservationsTable(
  state: ComedorPanelState,
  tableData: ComedorReservationsPage | null,
  filters: ComedorTableFiltersState,
  errorMessage: string | null,
): string {
  const toolbar = renderComedorReservationsFiltersToolbar(filters, "reservas");

  if (state === "loading") {
    return `
      <div class="flex flex-col gap-3">
        ${toolbar}
        <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
          <div class="animate-pulse p-4 sm:p-5">
            <div class="h-10 rounded bg-slate-100"></div>
            <div class="mt-3 h-10 rounded bg-slate-100"></div>
            <div class="mt-3 h-10 rounded bg-slate-100"></div>
          </div>
        </section>
      </div>`;
  }

  if (state === "error") {
    return `
      <div class="flex flex-col gap-3">
        ${toolbar}
        <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
          <p class="font-semibold">No fue posible cargar la tabla de reservas.</p>
          <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
          <button type="button" data-comedor-retry-table class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
            Reintentar
          </button>
        </section>
      </div>`;
  }

  if (state === "empty" || !tableData || tableData.items.length === 0) {
    return `
      <div class="flex flex-col gap-3">
        ${toolbar}
        <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
          <p class="px-4 py-14 text-center text-sm text-slate-500">No hay reservas para el filtro seleccionado.</p>
        </section>
      </div>`;
  }

  const rows = tableData.items
    .map((row) => {
      return `
        <tr class="hover:bg-slate-50">
          <td class="px-3 py-2.5 sm:px-4">${renderEmpleadoAvatarCell(row.empleadoNombre, row.empleadoNumero, row.avatarUrl)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.empleadoNumero)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.area)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.turno)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 sm:px-4" title="${dietBadgeLabel(row.dieta)}">${reservationDietBadge(row.dieta)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 sm:px-4">${reservationStatusBadge(row.status)}</td>
          <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-600 sm:px-4">${escapeComedorHtml(row.horaReserva)}</td>
        </tr>`;
    })
    .join("");

  const totalPages = Math.max(1, Math.ceil(tableData.total / tableData.pageSize));
  const pageButtons = paginationRange(totalPages, tableData.page)
    .map((entry) => {
      if (entry === "ellipsis") {
        return '<span class="flex min-h-10 items-center px-2 text-sm text-slate-500">…</span>';
      }
      const active = entry === tableData.page;
      return `<button type="button" data-comedor-page="${entry}" class="${
        active
          ? "min-h-10 min-w-10 rounded-lg bg-leoni-blue px-3 text-sm font-bold text-white shadow-md transition hover:bg-leoni-blue-light"
          : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
      }">${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3">
      ${toolbar}
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Listado de reservas de comedor">
        <div class="overflow-x-auto">
          <table class="min-w-[980px] w-full text-left">
            <thead class="border-b border-leoni-blue-light shadow-sm">
              <tr>
                ${th("Empleado")}
                ${th("Número")}
                ${th("Área")}
                ${th("Turno")}
                ${th("Tipo de dieta")}
                ${th("Estatus")}
                ${th("Hora reserva")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-4">
          <button type="button" data-comedor-page="${tableData.page - 1}" ${tableData.page <= 1 ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            Anterior
          </button>
          <div class="flex items-center gap-1">${pageButtons}</div>
          <button type="button" data-comedor-page="${tableData.page + 1}" ${tableData.page >= totalPages ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            Siguiente
          </button>
        </footer>
      </section>
    </div>`;
}
