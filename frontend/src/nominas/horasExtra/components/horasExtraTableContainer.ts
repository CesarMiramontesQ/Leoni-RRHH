import {
  HE_TABLE_SECTION,
  HE_TABLE_EL,
  renderHorasExtraTableThead,
  type HorasExtraTableColumn,
} from "../../../horasExtra/shared/horasExtraTableUi.ts";
import { paginationRange } from "../../../ui/uiUtils.ts";
import { renderHorasExtraTableBody } from "./horasExtraTableRows.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

const TABLE_COLUMNS: readonly HorasExtraTableColumn[] = [
  { label: "Empleado" },
  { label: "Centro de costo / Área" },
  { label: "Semana" },
  { label: "Fecha solicitud" },
  { label: "Horas solicitadas" },
  { label: "Motivo" },
  { label: "Estado" },
  { label: "Acciones", align: "right" },
] as const;

function renderPagination(vm: HorasExtraPageViewModel): string {
  const visibleCount = vm.filas.length;
  if (visibleCount === 0) return "";

  const start = (vm.currentPage - 1) * vm.pageSize + 1;
  const end = start + visibleCount - 1;
  const pages = paginationRange(vm.totalPages, vm.currentPage);
  const prevDisabled = vm.currentPage <= 1;
  const nextDisabled = vm.currentPage >= vm.totalPages;

  const pageButtons = pages
    .map((entry) => {
      if (entry === "ellipsis") {
        return `<span class="inline-flex size-8 items-center justify-center text-xs text-text-muted">…</span>`;
      }
      const isActive = entry === vm.currentPage;
      const cls = isActive
        ? "border-leoni-blue bg-leoni-blue text-white"
        : "cursor-pointer border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue";
      return `<button type="button" data-he-page="${entry}" class="inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${cls}" aria-label="Página ${entry}" ${isActive ? 'aria-current="page"' : ""}>${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p class="text-xs text-text-secondary">
        Mostrando <span class="font-semibold tabular-nums text-text-primary">${start}-${end}</span> de
        <span class="font-semibold tabular-nums text-text-primary">${vm.totalRegistros}</span> registros
      </p>
      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button type="button" data-he-page="${vm.currentPage - 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior" ${prevDisabled ? "disabled" : ""}>‹</button>
        ${pageButtons}
        <button type="button" data-he-page="${vm.currentPage + 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente" ${nextDisabled ? "disabled" : ""}>›</button>
      </nav>
    </div>`;
}

export function renderHorasExtraTableContainer(vm: HorasExtraPageViewModel): string {
  return `
    <section class="${HE_TABLE_SECTION}" aria-label="Listado de horas extras">
      <div class="overflow-x-auto">
        <table class="${HE_TABLE_EL}">
          ${renderHorasExtraTableThead(TABLE_COLUMNS)}
          <tbody id="horas-extra-table-body">
            ${renderHorasExtraTableBody(vm)}
          </tbody>
        </table>
      </div>

      ${renderPagination(vm)}
    </section>`;
}
