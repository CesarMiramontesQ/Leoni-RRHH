import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel, RhIncidenciaFilterState } from "../../incidencias/rh/types.ts";
import { escapeIncHtml, INC_FIELD_FOCUS, INC_FILTERS_FIELD_WRAP } from "./rhIncidenciasUiUtils.ts";

const SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

function filtrosActivos(f: RhIncidenciaFilterState): boolean {
  return Boolean(f.area_id || f.supervisor_id || f.tipo || f.estado || f.periodo !== "30d");
}

function selectFilter(
  id: string,
  label: string,
  name: string,
  optionsHtml: string,
): string {
  return `<div class="min-w-0">
  <label for="${id}" class="block text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeIncHtml(label)}</label>
  <div class="mt-2 grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-inc-filter="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${INC_FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function renderFilters(vm: RhIncidenciasAdminViewModel): string {
  const f = vm.filters;
  const opt = vm.filterOptions;

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

  const clearVisible = filtrosActivos(f);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto">
        <button
          type="button"
          data-rh-inc-clear-filters
          class="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
        >
          ${escapeIncHtml(INC_COPY.limpiarFiltros)}
        </button>
      </div>`
    : "";

  const advancedBtn = `
    <div class="flex w-full shrink-0 justify-end sm:w-auto sm:justify-start">
      <button
        type="button"
        id="rh-inc-filtros-av"
        aria-label="${escapeIncHtml(INC_COPY.filtrosAvanzadosAria)}"
        class="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-leoni-blue shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v5.056a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
      </button>
    </div>`;

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-label="${escapeIncHtml(INC_COPY.filtrosSeccionAria)}">
      <div class="flex flex-wrap items-end gap-4">
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-area", INC_COPY.filtroArea, "area", areaOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-sup", INC_COPY.filtroSupervisor, "supervisor", supOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-tipo", INC_COPY.filtroTipo, "tipo", tipoOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-est", INC_COPY.filtroEstado, "estado", estOpts)}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${selectFilter("rh-inc-f-per", INC_COPY.filtroPeriodo, "periodo", perOpts)}</div>
        ${advancedBtn}
        ${clearBtn}
      </div>
    </section>`;
}

function renderFiltersSkeleton(): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="h-3 w-20 max-w-full rounded bg-slate-200"></div>
      <div class="mt-2 h-10 w-full rounded-lg bg-slate-100"></div>
    </div>`;
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-hidden="true">
      <div class="flex flex-wrap items-end gap-4">
        <div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${INC_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="size-10 shrink-0 rounded-lg bg-slate-100"></div>
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
