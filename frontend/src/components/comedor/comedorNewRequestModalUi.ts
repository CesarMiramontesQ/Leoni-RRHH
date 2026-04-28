import type {
  ComedorEmployeeOption,
  ComedorMenuOption,
  ComedorPersonType,
} from "../../comedor/rh/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type ComedorNewRequestFormState = {
  personType: ComedorPersonType;
  employeeSearch: string;
  selectedEmployeeId: string | null;
  externalPeopleCount: string;
  menuId: string;
  fechaInicio: string;
  fechaFin: string;
  observaciones: string;
};

export type ComedorNewRequestFormErrors = Partial<
  Record<"personType" | "employee" | "externalPeopleCount" | "menuId" | "fechaInicio" | "fechaFin", string>
>;

export type BuildComedorNewRequestFormParams = {
  state: ComedorNewRequestFormState;
  allowExternalPeople: boolean;
  allowEmployeeSearch: boolean;
  errors: ComedorNewRequestFormErrors;
  isSubmitting: boolean;
  menuOptions: readonly ComedorMenuOption[];
  /** Etiqueta del selector (ej. "Tipo de comida" para empleados). */
  menuFieldLabel?: string;
  /** ISO yyyy-mm-dd: límite mínimo del input type="date". */
  fechaMinIso?: string | null;
  /** Cuántas fechas ya tienen reserva (para texto de ayuda; el input no deshabilita días aislados). */
  fechasBloqueadasCount?: number;
  searchResults: readonly ComedorEmployeeOption[];
  employeeOptions: readonly ComedorEmployeeOption[];
  isSearchingEmployees: boolean;
  searchEmployeesError: string | null;
  selectedEmployee: ComedorEmployeeOption | null;
};

function personTabClass(active: boolean): string {
  return active
    ? "inline-flex min-h-10 items-center rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm"
    : "inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue";
}

function fieldError(error: string | undefined): string {
  if (!error) return "";
  return `<p class="mt-1 text-xs font-medium text-red-700" role="alert">${escapeHtml(error)}</p>`;
}

function renderEmployeeSearchResults(
  search: string,
  results: readonly ComedorEmployeeOption[],
  selectedId: string | null,
  isSearching: boolean,
  errorMessage: string | null,
): string {
  if (search.trim().length === 0) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Empieza escribiendo para buscar un empleado.</p>`;
  }
  if (isSearching) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Buscando empleados...</p>`;
  }
  if (errorMessage) {
    return `<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(errorMessage)}</p>`;
  }
  if (results.length === 0) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No se encontraron coincidencias.</p>`;
  }
  return `
    <ul class="space-y-2">
      ${results
        .map((employee) => {
          const isSelected = employee.id === selectedId;
          return `
            <li>
              <button
                type="button"
                data-comedor-modal-employee-id="${escapeHtml(employee.id)}"
                class="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  isSelected
                    ? "border-leoni-blue bg-leoni-blue/5 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }"
              >
                <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  ${escapeHtml(employee.nombre.slice(0, 2).toUpperCase())}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-slate-800">${escapeHtml(employee.nombre)}</span>
                  <span class="block truncate text-xs text-slate-500">${escapeHtml(employee.numero)} · ${escapeHtml(employee.area)}</span>
                </span>
                ${
                  isSelected
                    ? `<span class="inline-flex size-5 items-center justify-center rounded-full bg-leoni-blue text-white" aria-hidden="true">
                         <svg viewBox="0 0 20 20" fill="currentColor" class="size-3.5"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.42-.007l-4-4a1 1 0 0 1 1.414-1.414l3.293 3.294 7.293-7.294a1 1 0 0 1 1.414.007Z" clip-rule="evenodd"/></svg>
                       </span>`
                    : ""
                }
              </button>
            </li>`;
        })
        .join("")}
    </ul>`;
}

function renderSelectedEmployeeCard(employee: ComedorEmployeeOption | null): string {
  if (!employee) return "";
  return `
    <article class="mt-3 flex items-center gap-3 rounded-xl border border-leoni-blue/35 bg-leoni-blue/5 px-3 py-2">
      <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue/15 text-xs font-semibold text-leoni-blue">
        ${escapeHtml(employee.nombre.slice(0, 2).toUpperCase())}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800">${escapeHtml(employee.nombre)}</p>
        <p class="truncate text-xs text-slate-500">${escapeHtml(employee.numero)} · ${escapeHtml(employee.area)}</p>
      </div>
      <span class="inline-flex size-5 items-center justify-center rounded-full bg-leoni-blue text-white" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-3.5"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.42-.007l-4-4a1 1 0 0 1 1.414-1.414l3.293 3.294 7.293-7.294a1 1 0 0 1 1.414.007Z" clip-rule="evenodd"/></svg>
      </span>
    </article>`;
}

function renderMenuOptions(menuOptions: readonly ComedorMenuOption[], selected: string): string {
  const first = `<option value="" ${selected === "" ? "selected" : ""}>Selecciona menú...</option>`;
  const rest = menuOptions
    .map((menu) => `<option value="${escapeHtml(menu.id)}" ${menu.id === selected ? "selected" : ""}>${escapeHtml(menu.label)}</option>`)
    .join("");
  return `${first}${rest}`;
}

export function comedorNewRequestModalShellHtml(): string {
  return `
    <div
      id="comedor-new-request-overlay"
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="comedor-new-request-panel"
        class="scheme-light flex max-h-[min(94vh,920px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-new-request-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="comedor-new-request-title" class="text-xl font-bold tracking-tight text-slate-900">Registrar solicitud de comida</h2>
          </div>
          <button
            type="button"
            data-comedor-modal-close
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="comedor-new-request-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6"></div>
      </div>
    </div>`;
}

export function buildComedorNewRequestFormHtml(params: BuildComedorNewRequestFormParams): string {
  const {
    state,
    allowExternalPeople,
    allowEmployeeSearch,
    errors,
    isSubmitting,
    menuOptions,
    menuFieldLabel = "Selector de menú",
    fechaMinIso,
    fechasBloqueadasCount = 0,
    searchResults,
    employeeOptions,
    isSearchingEmployees,
    searchEmployeesError,
    selectedEmployee,
  } = params;
  const fieldClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20";
  const textareaClass =
    "min-h-[7.5rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20";
  const errorClass = "border-red-300 focus:border-red-500 focus:ring-red-500/20";
  const menuClass = `${fieldClass} ${errors.menuId ? errorClass : ""}`;
  const dateClassStart = `${fieldClass} pr-10 ${errors.fechaInicio ? errorClass : ""}`;
  const dateClassEnd = `${fieldClass} pr-10 ${errors.fechaFin ? errorClass : ""}`;
  const employeeClass = `${fieldClass} ${errors.employee ? errorClass : ""}`;
  const externalPeopleClass = `${fieldClass} ${errors.externalPeopleCount ? errorClass : ""}`;
  const submitText = isSubmitting ? "Guardando..." : "Confirmar registro";

  return `
    <form id="comedor-new-request-form" class="space-y-5" novalidate>
      ${
        allowExternalPeople
          ? `<section>
               <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de persona</label>
               <div class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                 <button type="button" data-comedor-modal-person-type="interno" class="${personTabClass(state.personType === "interno")}">Empleado Interno</button>
                 <button type="button" data-comedor-modal-person-type="externo" class="${personTabClass(state.personType === "externo")}">Personal Externo</button>
               </div>
               ${fieldError(errors.personType)}
             </section>`
          : ""
      }

      ${
        state.personType === "interno"
          ? allowEmployeeSearch
            ? `<section>
              <label for="comedor-modal-employee-search" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Buscador de empleado</label>
              <input
                id="comedor-modal-employee-search"
                type="search"
                value="${escapeHtml(state.employeeSearch)}"
                data-comedor-modal-employee-search
                placeholder="Nombre o ID de empleado..."
                autocomplete="off"
                class="${employeeClass}"
                aria-invalid="${errors.employee ? "true" : "false"}"
              />
              <div class="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                ${renderEmployeeSearchResults(
                  state.employeeSearch,
                  searchResults,
                  state.selectedEmployeeId,
                  isSearchingEmployees,
                  searchEmployeesError,
                )}
              </div>
              ${renderSelectedEmployeeCard(selectedEmployee)}
              ${fieldError(errors.employee)}
            </section>`
            : employeeOptions.length > 0
              ? `<section>
                   <label for="comedor-modal-employee-select" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Registro para</label>
                   <select
                     id="comedor-modal-employee-select"
                     data-comedor-modal-employee-select
                     class="${employeeClass}"
                     aria-invalid="${errors.employee ? "true" : "false"}"
                   >
                     <option value="">Selecciona empleado...</option>
                     ${employeeOptions
                       .map((employee) => {
                         const selected = state.selectedEmployeeId === employee.id ? "selected" : "";
                         return `<option value="${escapeHtml(employee.id)}" ${selected}>${escapeHtml(employee.nombre)}</option>`;
                       })
                       .join("")}
                   </select>
                   ${renderSelectedEmployeeCard(selectedEmployee)}
                   ${fieldError(errors.employee)}
                 </section>`
            : `<section>
                 <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Registro para</label>
                 ${renderSelectedEmployeeCard(selectedEmployee)}
                 ${fieldError(errors.employee)}
               </section>`
          : ""
      }
      ${
        allowExternalPeople && state.personType === "externo"
          ? `<section>
              <label for="comedor-modal-external-count" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad de personas</label>
              <input
                id="comedor-modal-external-count"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                data-comedor-modal-external-count
                value="${escapeHtml(state.externalPeopleCount)}"
                placeholder="Cantidad de personas"
                class="${externalPeopleClass}"
                aria-invalid="${errors.externalPeopleCount ? "true" : "false"}"
              />
              ${fieldError(errors.externalPeopleCount)}
            </section>`
          : ""
      }

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label for="comedor-modal-menu" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(menuFieldLabel)}</label>
          <select
            id="comedor-modal-menu"
            data-comedor-modal-menu
            class="${menuClass}"
            aria-invalid="${errors.menuId ? "true" : "false"}"
          >
            ${renderMenuOptions(menuOptions, state.menuId)}
          </select>
          ${fieldError(errors.menuId)}
        </div>

        <div>
          <label for="comedor-modal-date-start" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Rango de fechas</label>
          <div class="relative">
            <input
              id="comedor-modal-date-start"
              type="date"
              data-comedor-modal-date-start
              value="${escapeHtml(state.fechaInicio)}"
              ${fechaMinIso ? `min="${escapeHtml(fechaMinIso)}"` : ""}
              class="${dateClassStart}"
              aria-invalid="${errors.fechaInicio ? "true" : "false"}"
            />
            <span class="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" class="size-4">
                <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.75A2.25 2.25 0 0 1 18 6.25v9.5A2.25 2.25 0 0 1 15.75 18h-11.5A2.25 2.25 0 0 1 2 15.75v-9.5A2.25 2.25 0 0 1 4.25 4H5V2.75A.75.75 0 0 1 5.75 2Zm10.75 6H3.5v7.75c0 .414.336.75.75.75h11.5a.75.75 0 0 0 .75-.75V8Z" clip-rule="evenodd" />
              </svg>
            </span>
          </div>
          ${fieldError(errors.fechaInicio)}
          <div class="relative mt-2">
            <input
              id="comedor-modal-date-end"
              type="date"
              data-comedor-modal-date-end
              value="${escapeHtml(state.fechaFin)}"
              ${fechaMinIso ? `min="${escapeHtml(fechaMinIso)}"` : ""}
              class="${dateClassEnd}"
              aria-invalid="${errors.fechaFin ? "true" : "false"}"
            />
            <span class="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" class="size-4">
                <path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.75A2.25 2.25 0 0 1 18 6.25v9.5A2.25 2.25 0 0 1 15.75 18h-11.5A2.25 2.25 0 0 1 2 15.75v-9.5A2.25 2.25 0 0 1 4.25 4H5V2.75A.75.75 0 0 1 5.75 2Zm10.75 6H3.5v7.75c0 .414.336.75.75.75h11.5a.75.75 0 0 0 .75-.75V8Z" clip-rule="evenodd" />
              </svg>
            </span>
          </div>
          ${fieldError(errors.fechaFin)}
          ${
            fechasBloqueadasCount > 0
              ? `<p class="mt-1.5 text-xs text-slate-500" id="comedor-modal-date-hint">Ya tienes reservas en ${fechasBloqueadasCount} día${
                  fechasBloqueadasCount === 1 ? "" : "s"
                } de este rango. Si intentas reservar de nuevo, verás un aviso.</p>`
              : ""
          }
        </div>
      </section>

      <section>
        <label for="comedor-modal-observaciones" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones o comentarios</label>
        <textarea
          id="comedor-modal-observaciones"
          data-comedor-modal-observaciones
          class="${textareaClass}"
          placeholder="Ej: Sin cebolla, entrega en área de carga..."
        >${escapeHtml(state.observaciones)}</textarea>
      </section>

      <footer class="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-comedor-modal-cancel
          class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="submit"
          ${isSubmitting ? "disabled" : ""}
          class="min-h-11 w-full rounded-xl bg-leoni-blue px-6 text-sm font-semibold text-white shadow-md shadow-leoni-blue/20 transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          ${submitText}
        </button>
      </footer>
    </form>`;
}
