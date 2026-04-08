import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type {
  RhIncidenciasAdminViewModel,
  RhIncidenciaFilterState,
} from "../../incidencias/rh/types.ts";
import { escapeIncHtml, INC_FIELD_FOCUS, INC_FILTERS_FIELD_WRAP } from "./rhIncidenciasUiUtils.ts";

const SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

function filtrosActivos(f: RhIncidenciaFilterState, ui: RhIncidenciasAdminViewModel["ui"]): boolean {
  const filtroUbicacionOEmpleado = ui.modoFiltros === "rh" ? f.empleado_busqueda.trim() : f.area_id;
  const supervisorCuenta =
    ui.modoFiltros === "estandar" || (ui.modoFiltros === "rh" && ui.mostrarFiltroSupervisor);
  const supActivo = Boolean(supervisorCuenta && f.supervisor_id);
  return Boolean(filtroUbicacionOEmpleado || supActivo || f.tipo || f.estado || f.periodo !== "30d");
}

function selectFilter(
  id: string,
  label: string,
  name: string,
  optionsHtml: string,
): string {
  return `<div class="min-w-0">
  <label for="${id}" class="mb-1 block text-xs font-medium text-gray-800">${escapeIncHtml(label)}</label>
  <div class="grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-inc-filter="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-md border border-slate-300 bg-white py-1.5 pr-8 pl-2.5 text-sm text-slate-900 shadow-sm ${INC_FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadoTextoBusquedaFilterField(f: RhIncidenciaFilterState): string {
  return `<div class="min-w-0">
  <label for="rh-inc-f-emp-q" class="mb-1 block text-xs font-medium text-gray-800">${escapeIncHtml(INC_COPY.filtroEmpleado)}</label>
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
      class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm ${INC_FIELD_FOCUS}"
    />
  </div>
</div>`;
}

function renderFilters(vm: RhIncidenciasAdminViewModel): string {
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
          class="inline-flex h-8 w-full min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto sm:text-sm"
        >
          ${escapeIncHtml(INC_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const advancedBtn =
    vm.ui.modoFiltros === "estandar"
      ? `
    <div class="flex w-full shrink-0 justify-end sm:w-auto sm:justify-start">
      <button
        type="button"
        id="rh-inc-filtros-av"
        aria-label="${escapeIncHtml(INC_COPY.filtrosAvanzadosAria)}"
        class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-leoni-blue shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v5.056a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
      </button>
    </div>`
      : "";

  const primeraColumnaFiltro = modoRh
    ? `<div class="${INC_FILTERS_FIELD_WRAP}">${empleadoTextoBusquedaFilterField(f)}</div>`
    : `<div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-area", INC_COPY.filtroArea, "area", areaOpts)}</div>`;

  const supervisorCol = vm.ui.mostrarFiltroSupervisor
    ? `<div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-sup", INC_COPY.filtroSupervisor, "supervisor", supOpts)}</div>`
    : "";

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-label="${escapeIncHtml(INC_COPY.filtrosSeccionAria)}">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${primeraColumnaFiltro}
        ${supervisorCol}
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-tipo", INC_COPY.filtroTipo, "tipo", tipoOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-est", INC_COPY.filtroEstado, "estado", estOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-per", INC_COPY.filtroPeriodo, "periodo", perOpts)}</div>
        ${advancedBtn}
        ${clearBtn}
      </div>
    </section>`;
}

function renderFiltersSkeleton(ui: RhIncidenciasAdminViewModel["ui"]): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-20 max-w-full rounded bg-slate-200"></div>
      <div class="h-8 w-full rounded-md bg-slate-100"></div>
    </div>`;
  const iconSlot =
    ui.modoFiltros === "estandar"
      ? `<div class="size-9 shrink-0 rounded-lg bg-slate-100"></div>`
      : "";
  const fieldCount =
    ui.modoFiltros === "estandar"
      ? 5
      : ui.mostrarFiltroSupervisor
        ? 5
        : 4;
  const cells = Array.from(
    { length: fieldCount },
    () => `<div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>`,
  ).join("");
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-hidden="true">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${cells}
        ${iconSlot}
      </div>
    </section>`;
}

/** Barra de filtros o skeleton según estado de carga. */
export function renderRhIncidenciasFiltersSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "error" && vm.resumenStatus === "error") {
    return "";
  }
  if (vm.resumenStatus === "loading") {
    return renderFiltersSkeleton(vm.ui);
  }
  return renderFilters(vm);
}
