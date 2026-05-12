import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import type { RhIncidenciasAdminViewModel, RhIncidenciaListFilters } from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhIncidenciasPageStyles.ts";

const INC_FILTER_CONTROL =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

function filtrosDraftActivos(f: RhIncidenciaListFilters): boolean {
  return (
    f.tipo.trim().length > 0 || f.no_empleado.trim().length > 0 || f.nombre.trim().length > 0
  );
}

function filtrosAppliedActivos(a: RhIncidenciaListFilters): boolean {
  return (
    a.tipo.trim().length > 0 || a.no_empleado.trim().length > 0 || a.nombre.trim().length > 0
  );
}

function textField(
  id: string,
  label: string,
  field: keyof RhIncidenciaListFilters,
  f: RhIncidenciaListFilters,
  inputType: "text" | "search" | "date" | "number" = "text",
): string {
  const val = f[field];
  const v = typeof val === "string" ? val : "";
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeIncHtml(label)}</label>
  <input
    type="${inputType}"
    id="${id}"
    name="${field}"
    data-rh-inc-filter-field="${field}"
    autocomplete="off"
    value="${escapeIncHtml(v)}"
    class="${INC_FILTER_CONTROL} ${FIELD_FOCUS}"
  />
</div>`;
}

function tipoSelectField(f: RhIncidenciaListFilters, tiposApi: readonly string[]): string {
  const selected = f.tipo.trim();
  const seen = new Set(tiposApi);
  const merged = selected && !seen.has(selected) ? [selected, ...tiposApi] : [...tiposApi];
  const opts =
    `<option value="" ${selected === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optTodosTipos)}</option>` +
    merged
      .map(
        (t) =>
          `<option value="${escapeIncHtml(t)}" ${selected === t ? "selected" : ""}>${escapeIncHtml(labelTipoIncidenciaUi(t))}</option>`,
      )
      .join("");
  return `<div class="min-w-0">
  <label for="rh-inc-f-tipo" class="${RH_LISTADO_LABEL}">${escapeIncHtml(INC_COPY.filtroTipo)}</label>
  <div class="grid grid-cols-1">
    <select
      id="rh-inc-f-tipo"
      name="tipo"
      data-rh-inc-filter-field="tipo"
      class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}"
    >
      ${opts}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function renderFilters(vm: RhIncidenciasAdminViewModel, opts?: { resultCount?: number | null }): string {
  const countHtml =
    opts?.resultCount !== null && opts?.resultCount !== undefined
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeIncHtml(String(opts.resultCount))}</span> incidencias</p>`
      : "";

  const f = vm.filterDraft;
  const clearVisible = filtrosDraftActivos(f) || filtrosAppliedActivos(vm.appliedFilters);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto">
        <button type="button" data-rh-inc-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">
          ${escapeIncHtml(INC_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const applyBtn = `<div class="w-full shrink-0 sm:w-auto">
      <button type="button" data-rh-inc-apply-filters class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary w-full sm:w-auto">
        ${escapeIncHtml(INC_COPY.aplicarFiltros)}
      </button>
    </div>`;

  const wrapCls = FILTER_FIELD_WRAP;
  const grid = `
    <div class="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <div class="${wrapCls}">${tipoSelectField(f, vm.tiposRegistrados)}</div>
      <div class="${wrapCls}">${textField("rh-inc-f-noemp", INC_COPY.filtroNoEmpleado, "no_empleado", f, "text")}</div>
      <div class="${wrapCls}">${textField("rh-inc-f-nom", INC_COPY.colNombre, "nombre", f, "search")}</div>
    </div>`;

  const inner = `
      <div class="flex flex-col gap-3">
        ${grid}
        <p class="text-xs text-[#64748b]">${escapeIncHtml(INC_COPY.filtrosAplicadosHint)}</p>
        <div class="flex flex-wrap items-end gap-2 sm:gap-3">
          ${applyBtn}
          ${clearBtn}
        </div>
      </div>`;

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="${escapeIncHtml(INC_COPY.filtrosSeccionAria)}">
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">${escapeIncHtml(INC_COPY.filtrosTitulo)}</h2>
        ${countHtml}
      </div>
      ${inner}
    </section>`;
}

function renderFiltersSkeleton(): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-24 max-w-full rounded bg-slate-200"></div>
      <div class="h-[42px] w-full rounded-[12px] bg-slate-100"></div>
    </div>`;
  const wrapCls = FILTER_FIELD_WRAP;
  const slots = Array.from({ length: 3 }, () => `<div class="${wrapCls}">${cell}</div>`).join("");
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-hidden="true" aria-label="Cargando filtros">
      <div class="mb-3 h-5 w-48 animate-pulse rounded-md bg-slate-200/80"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        ${slots}
      </div>
    </section>`;
}

/** Barra de filtros o skeleton según estado de carga (patrón Solicitudes). */
export function renderRhIncidenciasFiltersSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "error" && vm.resumenStatus === "error") {
    return "";
  }
  const filtersLoading = vm.resumenStatus === "loading" || vm.tableStatus === "loading";
  if (filtersLoading) {
    return renderFiltersSkeleton();
  }
  const resultCount =
    vm.table && vm.tableStatus !== "loading" && vm.tableStatus !== "error" ? vm.table.total : null;
  return renderFilters(vm, { resultCount });
}
