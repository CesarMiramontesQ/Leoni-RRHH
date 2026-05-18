import type {
  ComedorEmployeeOption,
  ComedorMenuOption,
  ComedorPersonType,
} from "../../comedor/rh/types.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type SupervisorRecipientScope = "personal" | "team";

export type ComedorNewRequestFormState = {
  personType: ComedorPersonType;
  employeeSearch: string;
  selectedEmployeeId: string | null;
  /** Solo modal supervisor comedor: null si no aplica. */
  supervisorRecipientScope: SupervisorRecipientScope | null;
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
  showObservacionesField?: boolean;
  allowEmployeeSelection?: boolean;
  /** Beneficiario propio (supervisor en sesión); si está definido, se muestra el selector de destinatario. */
  supervisorSelfOption?: ComedorEmployeeOption | null;
  teamEmployeeOptions?: readonly ComedorEmployeeOption[];
};

/** Etiquetas de sección: jerarquía suave para no competir con el contenido. */
function formSectionLabelClass(): string {
  return "mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500";
}

/** Pista secundaria bajo controles */
function formHintClass(): string {
  return "mt-2.5 max-w-prose text-[13px] leading-relaxed text-slate-500";
}

/** Contenedor tipo segmented control — contraste entre pista y segmento activo */
function segmentedTrackClass(extra = ""): string {
  return [
    "flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-100/95 p-1 sm:inline-flex sm:w-auto sm:flex-row sm:flex-nowrap sm:items-stretch",
    "shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function segmentedTabClass(active: boolean): string {
  const base =
    "inline-flex min-h-10 flex-1 items-center justify-center rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-[color,background-color,box-shadow,transform] duration-150 motion-reduce:transition-none sm:flex-initial sm:px-4 sm:justify-center focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-leoni-blue/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  return active
    ? `${base} bg-white font-semibold text-leoni-blue shadow-sm ring-1 ring-slate-200/70`
    : `${base} text-slate-600 hover:bg-white/70 hover:text-slate-900 active:scale-[0.99] motion-reduce:active:scale-100`;
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
    <article class="mt-3 overflow-hidden rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/95 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/90 sm:p-5">
      <div class="flex items-start gap-4">
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-leoni-blue/12 text-[13px] font-semibold uppercase tracking-wide text-leoni-blue shadow-[0_1px_2px_rgba(37,99,235,0.12)] ring-2 ring-white sm:size-[3.25rem] sm:text-sm">
          ${escapeHtml(employee.nombre.slice(0, 2).toUpperCase())}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <p class="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug tracking-tight text-slate-900 sm:text-base">${escapeHtml(employee.nombre)}</p>
            <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-white shadow-sm" aria-hidden="true" title="Seleccionado">
              <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.42-.007l-4-4a1 1 0 0 1 1.414-1.414l3.293 3.294 7.293-7.294a1 1 0 0 1 1.414.007Z" clip-rule="evenodd"/></svg>
            </span>
          </div>
          <dl class="mt-3 grid grid-cols-1 gap-2 text-[13px] text-slate-600 sm:grid-cols-2 sm:gap-3">
            <div class="min-w-0 rounded-lg bg-white/75 px-3 py-2 ring-1 ring-slate-200/70">
              <dt class="text-[11px] font-medium uppercase tracking-wider text-slate-400">Número</dt>
              <dd class="mt-0.5 truncate font-medium text-slate-800">${escapeHtml(employee.numero)}</dd>
            </div>
            <div class="min-w-0 rounded-lg bg-white/75 px-3 py-2 ring-1 ring-slate-200/70">
              <dt class="text-[11px] font-medium uppercase tracking-wider text-slate-400">Área</dt>
              <dd class="mt-0.5 truncate font-medium text-slate-800">${escapeHtml(employee.area)}</dd>
            </div>
          </dl>
        </div>
      </div>
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
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100/95 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="comedor-new-request-title" class="text-lg font-semibold leading-snug tracking-tight text-[#0A1628] sm:text-xl">Registrar solicitud de comida</h2>
          </div>
          <button
            type="button"
            data-comedor-modal-close
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="comedor-new-request-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/35 px-5 py-5 sm:px-6 sm:py-7"></div>
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
    showObservacionesField = true,
    allowEmployeeSelection = true,
  } = params;
  const fieldClass =
    "h-11 w-full rounded-lg border border-slate-200 bg-[var(--color-surface-container-lowest,#FFFFFF)] px-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25 focus:shadow-[0_1px_3px_rgba(37,99,235,0.12)]";
  const textareaClass =
    "min-h-[7.5rem] w-full resize-y rounded-lg border border-slate-200 bg-[var(--color-surface-container-lowest,#FFFFFF)] px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25 focus:shadow-[0_1px_3px_rgba(37,99,235,0.12)]";
  const errorClass = "border-red-300 focus:border-red-500 focus:ring-red-500/20";
  const menuClass = `${fieldClass} ${errors.menuId ? errorClass : ""}`;
  const dateClassStart = `${fieldClass} ${errors.fechaInicio ? errorClass : ""}`;
  const dateClassEnd = `${fieldClass} ${errors.fechaFin ? errorClass : ""}`;
  const employeeClass = `${fieldClass} ${errors.employee ? errorClass : ""}`;
  const externalPeopleClass = `${fieldClass} ${errors.externalPeopleCount ? errorClass : ""}`;
  const submitText = isSubmitting ? "Guardando..." : "Confirmar registro";

  const supervisorSelfOption = params.supervisorSelfOption ?? null;
  const teamEmployeeOptions = params.teamEmployeeOptions ?? employeeOptions;
  const showSupervisorDestinatario =
    state.personType === "interno" && supervisorSelfOption != null && state.supervisorRecipientScope != null;
  const isSupervisorPersonal = showSupervisorDestinatario && state.supervisorRecipientScope === "personal";
  const isSupervisorTeam = showSupervisorDestinatario && state.supervisorRecipientScope === "team";

  return `
    <form id="comedor-new-request-form" class="space-y-6" novalidate>
      ${
        allowExternalPeople
          ? `<section>
               <span class="${formSectionLabelClass()}">Tipo de persona</span>
               <div class="${segmentedTrackClass()}" role="group" aria-label="Tipo de persona">
                 <button type="button" data-comedor-modal-person-type="interno" class="${segmentedTabClass(state.personType === "interno")}">Empleado interno</button>
                 <button type="button" data-comedor-modal-person-type="externo" class="${segmentedTabClass(state.personType === "externo")}">Personal externo</button>
               </div>
               ${fieldError(errors.personType)}
             </section>`
          : ""
      }

      ${
        showSupervisorDestinatario
          ? `<section>
               <span class="${formSectionLabelClass()}">Destinatario</span>
               <div class="${segmentedTrackClass("w-full sm:w-auto")}" role="group" aria-label="Destinatario de la reserva">
                 <button type="button" data-comedor-modal-supervisor-scope="personal" class="${segmentedTabClass(isSupervisorPersonal)}">Registro personal</button>
                 <button type="button" data-comedor-modal-supervisor-scope="team" class="${segmentedTabClass(isSupervisorTeam)}">Registro para miembro de equipo</button>
               </div>
               <p class="${formHintClass()}">El registro personal usa tu ficha; el de equipo solo lista colaboradores de tu equipo directo.</p>
             </section>`
          : ""
      }

      ${
        state.personType === "interno"
          ? isSupervisorPersonal
            ? `<section>
                 <span class="${formSectionLabelClass()}">Beneficiario</span>
                 ${renderSelectedEmployeeCard(supervisorSelfOption)}
                 ${fieldError(errors.employee)}
               </section>`
            : isSupervisorTeam
              ? teamEmployeeOptions.length > 0
                ? `<section>
                     <label for="comedor-modal-employee-select" class="${formSectionLabelClass()}">Integrante del equipo</label>
                     <select
                       id="comedor-modal-employee-select"
                       data-comedor-modal-employee-select
                       class="${employeeClass}"
                       aria-invalid="${errors.employee ? "true" : "false"}"
                     >
                       <option value="">Selecciona colaborador...</option>
                       ${teamEmployeeOptions
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
                     <p class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                       No hay colaboradores en tu equipo directo. Puedes usar «Registro personal» o solicitar apoyo a RH.
                     </p>
                     ${fieldError(errors.employee)}
                   </section>`
          : allowEmployeeSearch
            ? `<section>
              <label for="comedor-modal-employee-search" class="${formSectionLabelClass()}">Buscador de empleado</label>
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
            : !allowEmployeeSelection
              ? `<section>
                   <span class="${formSectionLabelClass()}">Registro para</span>
                   ${renderSelectedEmployeeCard(selectedEmployee)}
                   ${fieldError(errors.employee)}
                 </section>`
            : employeeOptions.length > 0
              ? `<section>
                   <label for="comedor-modal-employee-select" class="${formSectionLabelClass()}">Registro para</label>
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
                 <span class="${formSectionLabelClass()}">Registro para</span>
                 ${renderSelectedEmployeeCard(selectedEmployee)}
                 ${fieldError(errors.employee)}
               </section>`
          : ""
      }
      ${
        allowExternalPeople && state.personType === "externo"
          ? `<section>
              <label for="comedor-modal-external-count" class="${formSectionLabelClass()}">Cantidad de personas</label>
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

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5">
          <label for="comedor-modal-menu" class="${formSectionLabelClass()}">${escapeHtml(menuFieldLabel)}</label>
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

        <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5">
          <label for="comedor-modal-date-start" class="${formSectionLabelClass()}">Rango de fechas</label>
          <div class="grid grid-cols-1 gap-2.5">
            <input
              id="comedor-modal-date-start"
              type="date"
              data-comedor-modal-date-start
              value="${escapeHtml(state.fechaInicio)}"
              ${fechaMinIso ? `min="${escapeHtml(fechaMinIso)}"` : ""}
              class="${dateClassStart}"
              aria-invalid="${errors.fechaInicio ? "true" : "false"}"
            />
            ${fieldError(errors.fechaInicio)}
            <input
              id="comedor-modal-date-end"
              type="date"
              data-comedor-modal-date-end
              value="${escapeHtml(state.fechaFin)}"
              ${fechaMinIso ? `min="${escapeHtml(fechaMinIso)}"` : ""}
              class="${dateClassEnd}"
              aria-invalid="${errors.fechaFin ? "true" : "false"}"
            />
            ${fieldError(errors.fechaFin)}
          </div>
          ${
            fechaMinIso
              ? `<p class="${formHintClass()}" id="comedor-modal-date-window-hint">Ventana vigente hasta el jueves previo al servicio. Fechas seleccionables desde <span class="font-medium text-slate-600">${escapeHtml(fechaMinIso)}</span>.</p>`
              : ""
          }
          ${
            fechasBloqueadasCount > 0
              ? `<p class="${formHintClass()} mt-1.5 text-slate-500/95" id="comedor-modal-date-hint">Ya tienes reservas en ${fechasBloqueadasCount} día${
                  fechasBloqueadasCount === 1 ? "" : "s"
                } de este rango. Si repites fechas ocupadas la operación será rechazada.</p>`
              : ""
          }
        </div>
      </section>

      ${
        showObservacionesField ?
          `<section>
            <label for="comedor-modal-observaciones" class="${formSectionLabelClass()}">Observaciones o comentarios</label>
            <textarea
              id="comedor-modal-observaciones"
              data-comedor-modal-observaciones
              class="${textareaClass}"
              placeholder="Ej: Sin cebolla, entrega en área de carga..."
            >${escapeHtml(state.observaciones)}</textarea>
          </section>`
        : ""
      }

      <footer class="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-3 border-t border-slate-100/95 bg-[var(--color-surface-container-lowest,#FFFFFF)]/95 px-1 pt-5 pb-1 backdrop-blur-[2px] sm:flex-row sm:justify-end sm:gap-4">
        <button
          type="button"
          data-comedor-modal-cancel
          class="${BTN_SECONDARY} order-2 min-h-11 w-full justify-center px-6 transition-colors duration-150 sm:order-1 sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="submit"
          ${isSubmitting ? "disabled" : ""}
          class="${BTN_PRIMARY} order-1 min-h-11 w-full justify-center px-7 shadow-md shadow-blue-900/15 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-65 sm:order-2 sm:min-w-[12.5rem] sm:w-auto"
        >
          ${submitText}
        </button>
      </footer>
    </form>`;
}
