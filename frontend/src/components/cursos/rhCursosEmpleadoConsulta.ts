import type { CursosDashboardEmpleadoHistorial } from "../../dashboard/cursos/seguimientoTypes.ts";
import {
  renderEmpleadoHistorialContent,
  renderHistorialEstadoFiltros,
} from "./rhCursosEmpleadoHistorialContent.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SURFACE,
} from "../../ui/uiTokens.ts";
import { escapeHtml, paginationRange } from "../../ui/uiUtils.ts";

export interface EmpleadoBusquedaItem {
  empleado_id: number;
  nombre: string;
  no_empleado: string;
  area: string | null;
}

const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;

const FILTER_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

function renderSearchPagination(opts: {
  page: number;
  total: number;
  pageSize: number;
  searching: boolean;
}): string {
  if (opts.searching || opts.total === 0) return "";

  const totalPages = Math.max(1, Math.ceil(opts.total / opts.pageSize));
  if (totalPages <= 1) {
    return `<footer class="border-t border-slate-100 px-3 py-2.5 sm:px-4">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        <span class="tabular-nums text-slate-900">${opts.total}</span> resultado${opts.total === 1 ? "" : "s"}
      </p>
    </footer>`;
  }

  const from = (opts.page - 1) * opts.pageSize + 1;
  const to = Math.min(opts.page * opts.pageSize, opts.total);

  const pageButtons = paginationRange(totalPages, opts.page)
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
      }
      const active = x === opts.page;
      const cls = active
        ? "ss-page-btn ss-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
        : "ss-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-action="emp-search-page" data-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
    })
    .join("");

  return `<footer class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
    <p class="text-xs font-medium text-slate-600 sm:text-sm">
      Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${opts.total}</span>
    </p>
    <nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación de empleados">
      <button type="button" data-action="emp-search-prev" ${opts.page <= 1 ? "disabled" : ""}
        class="ss-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página anterior</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
      </button>
      ${pageButtons}
      <button type="button" data-action="emp-search-next" ${opts.page >= totalPages ? "disabled" : ""}
        class="ss-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página siguiente</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
      </button>
    </nav>
  </footer>`;
}

export function renderCursosEmpleadoConsulta(opts: {
  searchQ: string;
  searching: boolean;
  results: EmpleadoBusquedaItem[];
  resultsPage: number;
  resultsTotal: number;
  resultsPageSize: number;
  selectedEmpleadoId: number | null;
  historial: CursosDashboardEmpleadoHistorial | null;
  historialLoading: boolean;
  historialFiltroEstado: string;
}): string {
  const hasSelection = opts.selectedEmpleadoId != null;
  const showResults =
    !hasSelection && (opts.searching || opts.searchQ.trim().length >= 2);

  const resultsHtml = opts.searching
    ? `<div class="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <div class="size-6 animate-spin rounded-full border-2 border-slate-200 border-t-leoni-blue" aria-hidden="true"></div>
        <p class="text-xs text-text-secondary">Buscando empleados…</p>
      </div>`
    : opts.results.length === 0
      ? `<p class="px-4 py-8 text-center text-sm text-text-secondary">Sin resultados para esta búsqueda.</p>`
      : opts.results
          .map(
            (emp) => `<button type="button" data-action="pick-empleado" data-empleado-id="${emp.empleado_id}"
              class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-leoni-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40">
              <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
              <span class="text-xs tabular-nums text-text-muted">${escapeHtml(emp.no_empleado)}</span>
              ${emp.area ? `<span class="ml-auto truncate text-xs text-text-muted">${escapeHtml(emp.area)}</span>` : ""}
            </button>`,
          )
          .join("");

  const header = opts.historial
    ? `<div>
        <h3 class="text-base font-semibold text-text-primary">${escapeHtml(opts.historial.nombre_empleado ?? "Empleado")}</h3>
        <p class="mt-0.5 text-sm text-text-secondary">
          ${escapeHtml(opts.historial.no_empleado ?? "")}
          ${opts.historial.area_nombre ? ` · ${escapeHtml(opts.historial.area_nombre)}` : ""}
          ${opts.historial.puesto_nombre ? ` · ${escapeHtml(opts.historial.puesto_nombre)}` : ""}
        </p>
      </div>`
    : "";

  const detailSection =
    hasSelection || opts.historialLoading
      ? `<section class="${RH_LISTADO_SURFACE} space-y-4 p-4 sm:p-5" aria-label="Capacitación pendiente del empleado">
          ${header}
          ${renderHistorialEstadoFiltros(opts.historialFiltroEstado)}
          ${renderEmpleadoHistorialContent(opts.historial, opts.historialLoading)}
        </section>`
      : `<section class="${RH_LISTADO_SURFACE} px-6 py-14 text-center" aria-label="Seleccionar empleado">
          <p class="text-base font-semibold text-text-primary">Consulta individual</p>
          <p class="mt-2 text-sm text-text-secondary">Busca un empleado para ver sus cursos y sesiones pendientes o en curso.</p>
        </section>`;

  return `<div class="flex flex-col gap-4 sm:gap-5">
    <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Búsqueda de empleado">
      <div class="mb-4">
        <h2 class="text-sm font-semibold text-text-primary">Buscar empleado</h2>
        <p class="mt-0.5 text-xs text-text-muted">Localiza un colaborador por nombre o número de empleado.</p>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="seg-empleado-search" class="${RH_LISTADO_LABEL}">Búsqueda</label>
        <div class="relative mt-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
          <input
            id="seg-empleado-search"
            type="search"
            autocomplete="off"
            placeholder="Nombre o número de empleado…"
            class="${FILTER_INPUT_CLS}"
            value="${escapeHtml(opts.searchQ)}"
            ${hasSelection ? "disabled" : ""}
          />
        </div>
      </div>
      ${
        hasSelection
          ? `<div class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-leoni-blue/25 bg-leoni-blue/5 px-3 py-2.5">
              <span class="text-sm font-medium text-text-primary">${escapeHtml(opts.historial?.nombre_empleado ?? "Empleado seleccionado")}</span>
              <button type="button" data-action="clear-empleado" class="text-xs font-semibold text-leoni-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">Cambiar</button>
            </div>`
          : ""
      }
      <div id="seg-empleado-resultados" class="mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-[#f8fafc]${showResults ? "" : " hidden"}">
        <div class="divide-y divide-slate-100 p-1">${resultsHtml}</div>
        ${renderSearchPagination({
          page: opts.resultsPage,
          total: opts.resultsTotal,
          pageSize: opts.resultsPageSize,
          searching: opts.searching,
        })}
      </div>
    </section>
    ${detailSection}
  </div>`;
}
