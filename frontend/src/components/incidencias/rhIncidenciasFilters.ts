import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type {
  RhIncidenciasAdminViewModel,
  RhIncidenciaFilterState,
} from "../../incidencias/rh/types.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
} from "./rhIncidenciasPageStyles.ts";

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
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeIncHtml(label)}</label>
  <div class="grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-inc-filter="${name}" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadoTextoBusquedaFilterField(f: RhIncidenciaFilterState): string {
  return `<div class="min-w-0">
  <label for="rh-inc-f-emp-q" class="${RH_LISTADO_LABEL}">${escapeIncHtml(INC_COPY.filtroEmpleado)}</label>
  <div class="relative">
    <span class="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-slate-400">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14 14 3 3m-1.5-8A6.5 6.5 0 1 1 2.5 9a6.5 6.5 0 0 1 13 0Z" /></svg>
    </span>
    <input
      type="search"
      id="rh-inc-f-emp-q"
      name="empleado_busqueda"
      data-rh-inc-empleado-busqueda
      autocomplete="off"
      enterkeyhint="search"
      placeholder="${escapeIncHtml(INC_COPY.placeholderBuscarEmpleado)}"
      value="${escapeIncHtml(f.empleado_busqueda)}"
      class="w-full rounded-[10px] border border-[#e5e7eb] bg-white py-2 pr-3 pl-9 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
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
    ? `<button
        type="button"
        data-rh-inc-clear-filters
        class="${RH_LISTADO_BTN_GHOST} w-full sm:w-auto"
      >
        ${escapeIncHtml(INC_COPY.limpiarFiltros)}
      </button>`
    : "";

  const advancedBtn =
    vm.ui.modoFiltros === "estandar"
      ? `<button
        type="button"
        id="rh-inc-filtros-av"
        aria-label="${escapeIncHtml(INC_COPY.filtrosAvanzadosAria)}"
        class="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-[#1e40af] shadow-sm transition hover:border-[#1e40af]/40 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v5.056a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
      </button>`
      : "";

  const primeraColumnaFiltro = modoRh
    ? empleadoTextoBusquedaFilterField(f)
    : selectFilter("rh-inc-f-area", INC_COPY.filtroArea, "area", areaOpts);

  const supervisorCol = vm.ui.mostrarFiltroSupervisor
    ? selectFilter("rh-inc-f-sup", INC_COPY.filtroSupervisor, "supervisor", supOpts)
    : "";

  return `
    <section class="${RH_LISTADO_SURFACE} p-4" aria-label="${escapeIncHtml(INC_COPY.filtrosSeccionAria)}">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-[#111827]">Filtros</h2>
        <div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          ${advancedBtn}
          ${clearBtn}
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="min-w-0 xl:col-span-1">${primeraColumnaFiltro}</div>
        ${supervisorCol ? `<div class="min-w-0">${supervisorCol}</div>` : ""}
        <div class="min-w-0">${selectFilter("rh-inc-f-tipo", INC_COPY.filtroTipo, "tipo", tipoOpts)}</div>
        <div class="min-w-0">${selectFilter("rh-inc-f-est", INC_COPY.filtroEstado, "estado", estOpts)}</div>
        <div class="min-w-0">${selectFilter("rh-inc-f-per", INC_COPY.filtroPeriodo, "periodo", perOpts)}</div>
      </div>
    </section>`;
}

function renderFiltersSkeleton(): string {
  return `
    <section class="animate-pulse ${RH_LISTADO_SURFACE} p-4" aria-busy="true">
      <div class="h-4 w-16 rounded bg-slate-200"></div>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="h-10 rounded bg-slate-100"></div>
        <div class="h-10 rounded bg-slate-100"></div>
        <div class="h-10 rounded bg-slate-100"></div>
        <div class="h-10 rounded bg-slate-100"></div>
        <div class="h-10 rounded bg-slate-100"></div>
      </div>
    </section>`;
}

/** Barra de filtros o skeleton según estado de carga. */
export function renderRhIncidenciasFiltersSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.tableStatus === "error" && vm.resumenStatus === "error") {
    return "";
  }
  if (vm.resumenStatus === "loading") {
    return renderFiltersSkeleton();
  }
  return renderFilters(vm);
}
