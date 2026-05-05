import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type {
  RhIncidenciasAdminViewModel,
  RhIncidenciaFilterState,
} from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
} from "./rhIncidenciasPageStyles.ts";

const INC_FILTER_CONTROL =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

function filtrosActivos(f: RhIncidenciaFilterState, ui: RhIncidenciasAdminViewModel["ui"]): boolean {
  const filtroUbicacionOEmpleado = ui.modoFiltros === "rh" ? f.empleado_busqueda.trim() : f.area_id;
  const supervisorCuenta =
    ui.modoFiltros === "estandar" || (ui.modoFiltros === "rh" && ui.mostrarFiltroSupervisor);
  const supActivo = Boolean(supervisorCuenta && f.supervisor_id);
  return Boolean(filtroUbicacionOEmpleado || supActivo || f.tipo || f.estado || f.periodo !== "30d");
}

function visibleFilterFieldCount(vm: RhIncidenciasAdminViewModel): number {
  let n = 3;
  n += 1;
  if (vm.ui.mostrarFiltroSupervisor) n += 1;
  return n;
}

function selectFilter(id: string, label: string, name: string, optionsHtml: string): string {
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeIncHtml(label)}</label>
  <div class="grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-inc-filter="${name}" class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadoTextoBusquedaFilterField(f: RhIncidenciaFilterState): string {
  return `<div class="min-w-0">
  <label for="rh-inc-f-emp-q" class="${RH_LISTADO_LABEL}">${escapeIncHtml(INC_COPY.filtroEmpleado)}</label>
  <div>
    <input
      type="search"
      id="rh-inc-f-emp-q"
      name="empleado_busqueda"
      data-rh-inc-empleado-busqueda
      autocomplete="off"
      enterkeyhint="search"
      placeholder="${escapeIncHtml(INC_COPY.placeholderBuscarEmpleado)}"
      value="${escapeIncHtml(f.empleado_busqueda)}"
      class="${INC_FILTER_CONTROL} ${FIELD_FOCUS}"
    />
  </div>
</div>`;
}

function renderFilters(vm: RhIncidenciasAdminViewModel, opts?: { resultCount?: number | null }): string {
  const countHtml =
    opts?.resultCount !== null && opts?.resultCount !== undefined
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeIncHtml(String(opts.resultCount))}</span> incidencias</p>`
      : "";

  const f = vm.filters;
  const opt = vm.filterOptions;
  const modoRh = vm.ui.modoFiltros === "rh";

  const areaOpts =
    `<option value="" ${f.area_id === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optTodasAreas)}</option>` +
    opt.areas
      .map(
        (a) =>
          `<option value="${escapeIncHtml(a.id)}" ${f.area_id === a.id ? "selected" : ""}>${escapeIncHtml(a.label)}</option>`,
      )
      .join("");

  const supOpts =
    `<option value="" ${f.supervisor_id === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optCualquierSupervisor)}</option>` +
    opt.supervisores
      .map(
        (s) =>
          `<option value="${escapeIncHtml(s.id)}" ${f.supervisor_id === s.id ? "selected" : ""}>${escapeIncHtml(s.label)}</option>`,
      )
      .join("");

  const tipoOpts =
    `<option value="" ${f.tipo === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optTodosTipos)}</option>` +
    opt.tipos
      .map(
        (t) =>
          `<option value="${escapeIncHtml(t.id)}" ${f.tipo === t.id ? "selected" : ""}>${escapeIncHtml(t.label)}</option>`,
      )
      .join("");

  const estOpts =
    `<option value="" ${f.estado === "" ? "selected" : ""}>${escapeIncHtml(INC_COPY.optCualquierEstado)}</option>` +
    opt.estados
      .map(
        (e) =>
          `<option value="${escapeIncHtml(e.id)}" ${f.estado === e.id ? "selected" : ""}>${escapeIncHtml(e.label)}</option>`,
      )
      .join("");

  const perOpts = opt.periodos
    .map(
      (p) =>
        `<option value="${escapeIncHtml(p.id)}" ${f.periodo === p.id ? "selected" : ""}>${escapeIncHtml(p.label)}</option>`,
    )
    .join("");

  const clearVisible = filtrosActivos(f, vm.ui);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
        <button
          type="button"
          data-rh-inc-clear-filters
          class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto"
        >
          ${escapeIncHtml(INC_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const advancedBtn =
    vm.ui.modoFiltros === "estandar"
      ? `<div class="w-full shrink-0 sm:w-auto">
      <button
        type="button"
        id="rh-inc-filtros-av"
        aria-label="${escapeIncHtml(INC_COPY.filtrosAvanzadosAria)}"
        title="${escapeIncHtml(INC_COPY.filtrosAvanzadosAria)}"
        class="inline-flex size-10 w-full items-center justify-center rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white text-[#1e40af] shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:border-[#1e40af]/40 hover:bg-[#fafbfc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:size-10 sm:w-auto"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v5.056a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
      </button>
    </div>`
      : "";

  const wrapCls = FILTER_FIELD_WRAP;
  const primeraColumnaFiltro = modoRh
    ? empleadoTextoBusquedaFilterField(f)
    : selectFilter("rh-inc-f-area", INC_COPY.filtroArea, "area", areaOpts);

  const supervisorCol = vm.ui.mostrarFiltroSupervisor
    ? selectFilter("rh-inc-f-sup", INC_COPY.filtroSupervisor, "supervisor", supOpts)
    : "";

  const inner = `
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        <div class="${wrapCls}">${primeraColumnaFiltro}</div>
        ${supervisorCol ? `<div class="${wrapCls}">${supervisorCol}</div>` : ""}
        <div class="${wrapCls}">${selectFilter("rh-inc-f-tipo", INC_COPY.filtroTipo, "tipo", tipoOpts)}</div>
        <div class="${wrapCls}">${selectFilter("rh-inc-f-est", INC_COPY.filtroEstado, "estado", estOpts)}</div>
        <div class="${wrapCls}">${selectFilter("rh-inc-f-per", INC_COPY.filtroPeriodo, "periodo", perOpts)}</div>
        ${advancedBtn}
        ${clearBtn}
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

function renderFiltersSkeleton(visibleCount: number): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-24 max-w-full rounded bg-slate-200"></div>
      <div class="h-[42px] w-full rounded-[12px] bg-slate-100"></div>
    </div>`;
  const wrapCls = FILTER_FIELD_WRAP;
  const slots = Array.from({ length: Math.max(1, visibleCount) }, () => `<div class="${wrapCls}">${cell}</div>`).join("");
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-hidden="true" aria-label="Cargando filtros">
      <div class="mb-3 h-5 w-48 animate-pulse rounded-md bg-slate-200/80"></div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
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
    return renderFiltersSkeleton(visibleFilterFieldCount(vm));
  }
  const resultCount =
    vm.table && vm.tableStatus !== "loading" && vm.tableStatus !== "error" ? vm.table.total : null;
  return renderFilters(vm, { resultCount });
}
