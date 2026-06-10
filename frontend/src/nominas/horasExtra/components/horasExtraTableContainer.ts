import { escapeHtml } from "../../../ui/uiUtils.ts";
import { RH_LISTADO_SURFACE } from "../../../ui/uiTokens.ts";
import { renderHorasExtraTableBody } from "./horasExtraTableRows.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

const TABLE_COLUMNS = [
  "Empleado",
  "Centro de costo",
  "Semana",
  "H. dobles",
  "H. descanso trab.",
  "Total H.E.",
  "Dif. caseta",
  "Estado de aprobación",
] as const;

function renderPagination(vm: HorasExtraPageViewModel): string {
  const start = (vm.currentPage - 1) * vm.pageSize + 1;
  const end = Math.min(vm.currentPage * vm.pageSize, vm.totalRegistros);
  const pages = Array.from({ length: vm.totalPages }, (_, i) => i + 1);

  return `
    <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p class="text-xs text-text-secondary">
        Mostrando <span class="font-semibold tabular-nums text-text-primary">${start}-${end}</span> de
        <span class="font-semibold tabular-nums text-text-primary">${vm.totalRegistros}</span> registros
        <span class="text-text-muted">· ${escapeHtml(vm.semanaLabel)}</span>
      </p>
      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button type="button" class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue" aria-label="Página anterior">‹</button>
        ${pages
          .map((page) => {
            const isActive = page === vm.currentPage;
            const cls = isActive
              ? "border-leoni-blue bg-leoni-blue text-white"
              : "cursor-pointer border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue";
            return `<button type="button" class="inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${cls}" aria-label="Página ${page}" ${isActive ? 'aria-current="page"' : ""}>${page}</button>`;
          })
          .join("")}
        <button type="button" class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue" aria-label="Página siguiente">›</button>
      </nav>
    </div>`;
}

export function renderHorasExtraTableContainer(vm: HorasExtraPageViewModel): string {
  return `
    <section class="rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Listado de horas extras">
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
              ${TABLE_COLUMNS.map(
                (col) =>
                  `<th scope="col" class="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap">${col}</th>`,
              ).join("")}
            </tr>
          </thead>
          <tbody id="horas-extra-table-body">
            ${renderHorasExtraTableBody(vm)}
          </tbody>
        </table>
      </div>

      ${renderPagination(vm)}
    </section>`;
}
