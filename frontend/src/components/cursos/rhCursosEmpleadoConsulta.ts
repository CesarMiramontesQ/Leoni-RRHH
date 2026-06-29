import type { CursosDashboardEmpleadoHistorial } from "../../dashboard/cursos/seguimientoTypes.ts";
import {
  renderEmpleadoHistorialContent,
  renderHistorialEstadoFiltros,
} from "./rhCursosEmpleadoHistorialContent.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  BTN_GHOST,
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

const SEARCH_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

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
    ? `<p class="px-2 py-3 text-center text-xs text-slate-500">Buscando…</p>`
    : opts.results.length === 0
      ? `<p class="px-2 py-3 text-center text-xs text-slate-500">Sin resultados</p>`
      : opts.results
          .map(
            (emp) => `<button type="button" data-action="pick-empleado" data-empleado-id="${emp.empleado_id}"
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/10">
              <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
              <span class="text-xs tabular-nums text-slate-500">${escapeHtml(emp.no_empleado)}</span>
              ${emp.area ? `<span class="ml-auto text-xs text-slate-400">${escapeHtml(emp.area)}</span>` : ""}
            </button>`,
          )
          .join("");

  const totalPages = Math.max(1, Math.ceil(opts.resultsTotal / opts.resultsPageSize));
  const pages = paginationRange(totalPages, opts.resultsPage);
  const paginationHtml =
    !opts.searching && opts.resultsTotal > opts.resultsPageSize
      ? `<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-2 py-2 text-xs text-text-muted">
          <span>${opts.resultsTotal} resultado(s)</span>
          <nav class="flex items-center gap-1" aria-label="Paginación de resultados">
            ${pages
              .map((p) =>
                typeof p === "number"
                  ? `<button type="button" class="${p === opts.resultsPage ? "rounded-md bg-accent px-2 py-0.5 text-white" : `${BTN_GHOST} px-2 py-0.5`}" data-action="emp-search-page" data-page="${p}">${p}</button>`
                  : `<span class="px-1">…</span>`,
              )
              .join("")}
          </nav>
        </div>`
      : opts.resultsTotal > 0 && !opts.searching
        ? `<div class="border-t border-slate-200 px-2 py-2 text-xs text-text-muted">${opts.resultsTotal} resultado(s)</div>`
        : "";

  const header = opts.historial
    ? `<div>
        <h3 class="text-lg font-semibold text-text-primary">${escapeHtml(opts.historial.nombre_empleado ?? "Empleado")}</h3>
        <p class="mt-0.5 text-sm text-text-muted">
          ${escapeHtml(opts.historial.no_empleado ?? "")}
          ${opts.historial.area_nombre ? ` · ${escapeHtml(opts.historial.area_nombre)}` : ""}
          ${opts.historial.puesto_nombre ? ` · ${escapeHtml(opts.historial.puesto_nombre)}` : ""}
        </p>
      </div>`
    : "";

  const detailSection =
    hasSelection || opts.historialLoading
      ? `<div class="${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm space-y-4">
          ${header}
          ${renderHistorialEstadoFiltros(opts.historialFiltroEstado)}
          ${renderEmpleadoHistorialContent(opts.historial, opts.historialLoading)}
        </div>`
      : `<div class="${RH_LISTADO_SURFACE} rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-text-muted">
          Busca y selecciona un empleado para ver sus cursos y sesiones.
        </div>`;

  return `<div class="space-y-4">
    <div class="${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm">
      <div class="${FILTER_FIELD_WRAP}">
        <label for="seg-empleado-search" class="${RH_LISTADO_LABEL}">Buscar empleado</label>
        <input
          id="seg-empleado-search"
          type="search"
          autocomplete="off"
          placeholder="Nombre o número de empleado…"
          class="${SEARCH_INPUT_CLS}"
          value="${escapeHtml(opts.searchQ)}"
          ${hasSelection ? "disabled" : ""}
        />
      </div>
      ${
        hasSelection
          ? `<div class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
              <span class="text-sm font-medium text-text-primary">${escapeHtml(opts.historial?.nombre_empleado ?? "Empleado seleccionado")}</span>
              <button type="button" data-action="clear-empleado" class="text-xs font-semibold text-accent hover:underline">Cambiar</button>
            </div>`
          : ""
      }
      <div id="seg-empleado-resultados" class="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50${showResults ? "" : " hidden"}">
        <div class="p-1">${resultsHtml}</div>
        ${paginationHtml}
      </div>
    </div>
    ${detailSection}
  </div>`;
}
