import type {
  ComedorCreateRequestPayload,
  ComedorEmployeeOption,
  ComedorMenuOption,
  ComedorPersonType,
} from "../../comedor/rh/types.ts";
import { comedorErrorMessage } from "../../api/comedor.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  buildComedorNewRequestFormHtml,
  comedorNewRequestModalShellHtml,
  type ComedorNewRequestFormErrors,
  type ComedorNewRequestFormState,
} from "./comedorNewRequestModalUi.ts";
import {
  buildDescansosFeedback,
  createDescansosEmpleadoController,
} from "../../solicitudes/rh/descansosEmpleado.ts";
import {
  errorFechaEnDescanso,
  mesesCargadosParaCalendario,
} from "../../comedor/rh/descansosComedorFecha.ts";
import {
  bindWorkdayDatePicker,
  type WorkdayDatePickerHandle,
} from "../../ui/workdayDatePicker.ts";
import type { ComedorMenuDelDia } from "../../comedor/rh/resolveMenuDiaFromSemana.ts";
import type { ComedorMenuDelDiaLoader } from "../../comedor/rh/loadMenuDelDia.ts";
import type { MenuDelDiaPanelState } from "./comedorMenuPreview.ts";

type Catalog = {
  menus: readonly ComedorMenuOption[];
};

export type ComedorSupervisorBeneficiaryModalConfig = {
  /** Ficha del líder (supervisor o gerente) en sesión (beneficiario en «Registro personal»). */
  self: ComedorEmployeeOption;
  /** Todo el subárbol del líder; el propio líder debe estar excluido. */
  loadTeamOptions: () => Promise<readonly ComedorEmployeeOption[]>;
};

export type ComedorNewRequestModalOptions = {
  toastContainer: HTMLElement;
  allowExternalPeople?: boolean;
  allowEmployeeSearch?: boolean;
  loadEmployeeOptions?: () => Promise<readonly ComedorEmployeeOption[]>;
  /** Roles supervisor y gerente (comedor líder): selector personal vs equipo; no combinar con `loadEmployeeOptions` para el mismo flujo. */
  supervisorBeneficiaryConfig?: ComedorSupervisorBeneficiaryModalConfig;
  defaultEmployeeId?: string | null;
  fixedEmployee?: ComedorEmployeeOption | null;
  /** ISO yyyy-mm-dd para `min` del date input y validación. */
  fechaMinReservaIso?: string | null;
  /** Mensaje cuando la fecha elegida es anterior al mínimo. */
  fechaServicioMinMensaje?: string;
  /** Texto de ayuda bajo el selector de fecha (sustituye el hint de ventana jueves). */
  fechaMinHint?: string | null;
  /**
   * Fechas (ISO yyyy-mm-dd) con reserva activa: validación y mensaje al elegir el día.
   * El input nativo no deshabilita días sueltos; se bloquea por feedback y 409 en backend.
   */
  loadFechasBloqueadas?: () => Promise<readonly string[]>;
  menuFieldLabel?: string;
  loadMenuOptions: () => Promise<readonly ComedorMenuOption[]>;
  /** Consulta el menú planeado para la fecha seleccionada (sin acción extra del usuario). */
  loadMenuDelDia?: ComedorMenuDelDiaLoader;
  searchEmployees: (query: string) => Promise<readonly ComedorEmployeeOption[]>;
  onSubmit: (payload: ComedorCreateRequestPayload) => Promise<unknown> | unknown;
  onSuccess?: (result: unknown, payload: ComedorCreateRequestPayload) => void;
  /** Notifica el beneficiario interno (id numérico) para resolver comedor/menú asignado. */
  onBeneficiaryUserIdChange?: (userId: number | undefined) => void;
};

export type ComedorNewRequestModalHandle = {
  open: () => Promise<void>;
  close: () => void;
  destroy: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function initialState(
  initialEmployeeId: string | null,
  supervisorBeneficiaryConfig: ComedorSupervisorBeneficiaryModalConfig | undefined,
): ComedorNewRequestFormState {
  const selfId = supervisorBeneficiaryConfig?.self.id ?? null;
  return {
    personType: "interno",
    employeeSearch: "",
    selectedEmployeeId: supervisorBeneficiaryConfig ? selfId : initialEmployeeId,
    supervisorRecipientScope: supervisorBeneficiaryConfig ? "personal" : null,
    externalPeopleCount: "1",
    menuId: "",
    fechaServicio: "",
  };
}

function validateForm(
  state: ComedorNewRequestFormState,
  allowExternalPeople: boolean,
  allowEmployeeSearch: boolean,
  fixedEmployeeId: string | null,
  fechaMinReservaIso: string | null | undefined,
  fechasBloqueadas: ReadonlySet<string> | null,
  supervisorBeneficiaryConfig: ComedorSupervisorBeneficiaryModalConfig | undefined,
  teamEmployeeIds: ReadonlySet<string>,
  fechaServicioMinMensaje: string | undefined,
  descansos: ReadonlySet<string>,
): ComedorNewRequestFormErrors {
  const errors: ComedorNewRequestFormErrors = {};
  if (state.personType !== "interno" && state.personType !== "externo") {
    errors.personType = "Selecciona un tipo de persona.";
  }
  if (state.personType === "interno") {
    if (supervisorBeneficiaryConfig) {
      if (state.supervisorRecipientScope === "team") {
        if (teamEmployeeIds.size === 0) {
          errors.employee = "No hay colaboradores en tu equipo para este registro.";
        } else if (!state.selectedEmployeeId) {
          errors.employee = "Selecciona un integrante del equipo.";
        } else if (state.selectedEmployeeId === supervisorBeneficiaryConfig.self.id) {
          errors.employee = "Selecciona un integrante del equipo.";
        } else if (!teamEmployeeIds.has(state.selectedEmployeeId)) {
          errors.employee = "Selecciona un integrante válido del equipo.";
        }
      } else if (state.supervisorRecipientScope === "personal") {
        if (!supervisorBeneficiaryConfig.self.id.trim()) {
          errors.employee = "No se pudo identificar tu empleado en sesión.";
        }
      }
    } else {
      const effectiveSelectedEmployeeId =
        state.personType === "interno" && !allowEmployeeSearch
          ? (state.selectedEmployeeId || fixedEmployeeId)
          : state.selectedEmployeeId;
      if (!effectiveSelectedEmployeeId) {
        errors.employee = "Selecciona un empleado.";
      }
    }
  }
  if (allowExternalPeople && state.personType === "externo") {
    const peopleCount = Number.parseInt(state.externalPeopleCount, 10);
    if (!Number.isFinite(peopleCount) || peopleCount < 1) {
      errors.externalPeopleCount = "Ingresa una cantidad valida (minimo 1).";
    }
  }
  if (!state.menuId.trim()) {
    errors.menuId = "Selecciona un menú.";
  }
  if (!state.fechaServicio.trim()) {
    errors.fechaServicio = "Selecciona la fecha del servicio.";
  } else if (fechaMinReservaIso && state.fechaServicio < fechaMinReservaIso) {
    errors.fechaServicio =
      fechaServicioMinMensaje ??
      "La fecha límite para modificar este servicio de comedor ya venció (jueves de la semana anterior).";
  } else if (fechasBloqueadas?.has(state.fechaServicio)) {
    errors.fechaServicio = "Ya tienes un registro para este día.";
  } else {
    const descanso = errorFechaEnDescanso(state.fechaServicio, descansos);
    if (descanso) errors.fechaServicio = descanso;
  }
  return errors;
}

function firstInvalidSelector(
  errors: ComedorNewRequestFormErrors,
  allowExternalPeople: boolean,
  allowEmployeeSearch: boolean,
  supervisorTeamEmpty: boolean,
  supervisorTeamPicker = false,
): string | null {
  if (errors.personType) return "[data-comedor-modal-person-type='interno']";
  if (errors.employee) {
    if (allowEmployeeSearch) return "#comedor-modal-employee-search";
    if (supervisorTeamEmpty) return "[data-comedor-modal-supervisor-scope='team']";
    if (supervisorTeamPicker) return "#comedor-modal-team-search";
    return "#comedor-modal-employee-select";
  }
  if (allowExternalPeople && errors.externalPeopleCount) return "#comedor-modal-external-count";
  if (errors.menuId) return "#comedor-modal-menu";
  if (errors.fechaServicio) return "#comedor-modal-date-trigger";
  return null;
}

export function mountComedorNewRequestModal(
  host: HTMLElement,
  options: ComedorNewRequestModalOptions,
): ComedorNewRequestModalHandle {
  host.innerHTML = comedorNewRequestModalShellHtml();
  const overlay = host.querySelector("#comedor-new-request-overlay");
  const panel = host.querySelector("#comedor-new-request-panel");
  const body = host.querySelector("#comedor-new-request-body");
  if (!(overlay instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(body instanceof HTMLElement)) {
    return {
      open: async () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }

  const overlayEl = overlay;
  const panelEl = panel;
  const bodyEl = body;
  const allowExternalPeople = options.allowExternalPeople ?? true;
  const allowEmployeeSearch = options.allowEmployeeSearch ?? true;
  const fixedEmployee = options.fixedEmployee ?? null;
  const defaultEmployeeId = options.defaultEmployeeId ?? fixedEmployee?.id ?? null;
  const fixedEmployeeId = fixedEmployee?.id ?? null;
  const fechaMinReservaIso = options.fechaMinReservaIso ?? null;
  const fechaServicioMinMensaje = options.fechaServicioMinMensaje;
  const fechaMinHint = options.fechaMinHint ?? null;
  const menuFieldLabel = options.menuFieldLabel;
  const loadFechasBloqueadas = options.loadFechasBloqueadas;
  const loadMenuDelDia = options.loadMenuDelDia;
  const supervisorBeneficiaryConfig = options.supervisorBeneficiaryConfig;
  let fechasBloqueadasSet: ReadonlySet<string> | null = null;
  const descansosController = createDescansosEmpleadoController();
  let datePickerHandle: WorkdayDatePickerHandle | null = null;
  // El aviso de carga y los días bloqueados se refrescan por parche puntual del DOM,
  // no con `renderForm()`: repintar cerraría el calendario abierto.
  const desuscribirDescansos = descansosController.subscribe(() => {
    if (!isOpen()) return;
    aplicarDescansosAlCalendario();
  });
  let catalog: Catalog | null = null;
  let formState = initialState(defaultEmployeeId, supervisorBeneficiaryConfig);
  let errors: ComedorNewRequestFormErrors = {};
  let isSubmitting = false;
  let menuDelDiaState: MenuDelDiaPanelState = "idle";
  let menuDelDia: ComedorMenuDelDia | null = null;
  let menuDelDiaError: string | null = null;
  let menuDelDiaFechaIso: string | null = null;
  let menuDelDiaRequestToken = 0;
  let searchResults: readonly ComedorEmployeeOption[] = [];
  let isSearchingEmployees = false;
  let searchEmployeesError: string | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchToken = 0;
  const employeeSelectionCache = new Map<string, ComedorEmployeeOption>();
  let employeeOptions: readonly ComedorEmployeeOption[] = fixedEmployee ? [fixedEmployee] : [];
  let teamOnlyEmployeeOptions: readonly ComedorEmployeeOption[] = [];

  function isOpen(): boolean {
    return !overlayEl.classList.contains("hidden");
  }

  function beneficiarioUserId(): number | undefined {
    // Solo hay descansos que consultar para un empleado interno: una persona externa no
    // tiene turno en nómina.
    if (formState.personType !== "interno") return undefined;
    const emp = selectedEmployee();
    if (!emp) return undefined;
    const uid = Number.parseInt(emp.id, 10);
    return Number.isFinite(uid) ? uid : undefined;
  }

  function notifyBeneficiaryUserIdChange(): void {
    const uid = beneficiarioUserId();
    sincronizarBeneficiarioDescansos(uid);
    options.onBeneficiaryUserIdChange?.(uid);
  }

  function descansosCargados(): Set<string> {
    return descansosController.getLoadedDates();
  }

  /** Aplica al calendario vivo lo que ya se sabe, sin repintar el formulario.
   *
   * `renderForm()` reemplaza todo el body por `innerHTML`: repintar aquí cerraría el
   * popover del calendario y devolvería la vista al mes de la fecha seleccionada justo
   * cuando el usuario está navegando meses.
   */
  function aplicarDescansosAlCalendario(): void {
    const meses = mesesCargadosParaCalendario(
      descansosController.getState(),
      descansosController.getLoadedMonths(),
    );
    datePickerHandle?.setBlockedDates(descansosCargados());
    datePickerHandle?.setLoadedMonths(meses);
    const statusHost = bodyEl.querySelector("[data-comedor-modal-descansos-status]");
    if (statusHost) {
      statusHost.innerHTML = buildDescansosFeedback(
        descansosController.getState(),
        descansosController.getError(),
        [],
      ).loadHtml;
    }
  }

  function sincronizarBeneficiarioDescansos(uid: number | undefined): void {
    descansosController.setEmpleado(uid ?? null);
    if (uid == null) {
      aplicarDescansosAlCalendario();
      return;
    }
    const [year, monthIndex] = mesVisibleCalendario();
    void cargarDescansosMes(year, monthIndex);
  }

  function mesVisibleCalendario(): [number, number] {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(formState.fechaServicio);
    if (match) return [Number(match[1]), Number(match[2]) - 1];
    const hoy = new Date();
    return [hoy.getFullYear(), hoy.getMonth()];
  }

  /** Carga el mes visible y sus vecinos. El fallo no bloquea: degrada a calendario abierto. */
  async function cargarDescansosMes(year: number, monthIndex: number): Promise<void> {
    if (beneficiarioUserId() == null) return;
    try {
      await descansosController.loadVisibleMonths(year, monthIndex);
    } catch {
      // El controller ya dejó el estado en `error`; el aviso lo pinta el feedback.
    }
    aplicarDescansosAlCalendario();
  }

  function selectedEmployee(): ComedorEmployeeOption | null {
    if (supervisorBeneficiaryConfig && formState.supervisorRecipientScope === "personal") {
      return supervisorBeneficiaryConfig.self;
    }
    if (!allowEmployeeSearch && fixedEmployee) return fixedEmployee;
    if (!formState.selectedEmployeeId) return null;
    const option = employeeOptions.find((employee) => employee.id === formState.selectedEmployeeId);
    if (option) return option;
    const teamOption = teamOnlyEmployeeOptions.find(
      (employee) => employee.id === formState.selectedEmployeeId,
    );
    if (teamOption) return teamOption;
    return (
      searchResults.find((employee) => employee.id === formState.selectedEmployeeId) ??
      employeeSelectionCache.get(formState.selectedEmployeeId) ??
      null
    );
  }

  function renderForm(): void {
    if (!catalog) return;
    // Preservar foco + cursor del buscador de empleados: renderForm reemplaza todo
    // el HTML (innerHTML), y al re-renderizar durante la búsqueda (debounce) el input
    // se recrea y el usuario pierde el foco a mitad de escritura.
    const active = document.activeElement as HTMLInputElement | null;
    // Los dos buscadores se recrean en cada render: el global de RH y el del equipo.
    const focusedSearchSelector = active?.matches?.("[data-comedor-modal-employee-search]")
      ? "[data-comedor-modal-employee-search]"
      : active?.matches?.("[data-comedor-modal-team-search]")
        ? "[data-comedor-modal-team-search]"
        : null;
    const caret = focusedSearchSelector ? active?.selectionStart ?? null : null;
    bodyEl.innerHTML = buildComedorNewRequestFormHtml({
      state: formState,
      allowExternalPeople,
      allowEmployeeSearch,
      allowEmployeeSelection: !(fixedEmployee && !allowEmployeeSearch),
      errors,
      isSubmitting,
      menuOptions: catalog.menus,
      menuFieldLabel,
      fechaMinIso: fechaMinReservaIso,
      fechaMinHint,
      fechasBloqueadasCount: fechasBloqueadasSet?.size ?? 0,
      searchResults,
      employeeOptions,
      isSearchingEmployees,
      searchEmployeesError,
      selectedEmployee: selectedEmployee(),
      supervisorSelfOption: supervisorBeneficiaryConfig?.self ?? null,
      teamEmployeeOptions: supervisorBeneficiaryConfig ? teamOnlyEmployeeOptions : undefined,
      menuDelDiaState,
      menuDelDia,
      menuDelDiaError,
      menuDelDiaFechaIso,
      descansosState: descansosController.getState(),
      descansosError: descansosController.getError(),
    });
    bindInteractions();
    if (focusedSearchSelector) {
      const nextInput = bodyEl.querySelector<HTMLInputElement>(focusedSearchSelector);
      if (nextInput) {
        nextInput.focus();
        const pos = caret ?? nextInput.value.length;
        try {
          nextInput.setSelectionRange(pos, pos);
        } catch {
          /* setSelectionRange no aplica a algunos tipos de input */
        }
      }
    }
  }

  async function refreshMenuDelDia(fechaIso: string): Promise<void> {
    const trimmed = fechaIso.trim();
    menuDelDiaFechaIso = trimmed || null;
    if (!loadMenuDelDia || !trimmed) {
      menuDelDiaState = "idle";
      menuDelDia = null;
      menuDelDiaError = null;
      renderForm();
      return;
    }

    const requestToken = ++menuDelDiaRequestToken;
    menuDelDiaState = "loading";
    menuDelDia = null;
    menuDelDiaError = null;
    renderForm();

    try {
      const menu = await loadMenuDelDia(trimmed);
      if (requestToken !== menuDelDiaRequestToken) return;
      menuDelDia = menu;
      menuDelDiaState = menu ? "ready" : "empty";
    } catch {
      if (requestToken !== menuDelDiaRequestToken) return;
      menuDelDia = null;
      menuDelDiaState = "error";
      menuDelDiaError = "No fue posible consultar el menú planeado.";
    }
    renderForm();
  }

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    formState = initialState(defaultEmployeeId, supervisorBeneficiaryConfig);
    formState.personType = "interno";
    errors = {};
    isSubmitting = false;
    searchResults = [];
    isSearchingEmployees = false;
    searchEmployeesError = null;
    searchToken += 1;
    if (searchDebounceTimer != null) {
      window.clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    fechasBloqueadasSet = null;
    datePickerHandle?.destroy();
    datePickerHandle = null;
    descansosController.setEmpleado(null);
    menuDelDiaState = "idle";
    menuDelDia = null;
    menuDelDiaError = null;
    menuDelDiaFechaIso = null;
    menuDelDiaRequestToken += 1;
    bodyEl.innerHTML = "";
  }

  async function open(): Promise<void> {
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (!catalog) {
      bodyEl.innerHTML = `<div class="flex items-center gap-3 py-6 text-sm text-slate-500">
        <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Cargando formulario...
      </div>`;
      try {
        const menus = await options.loadMenuOptions();
        catalog = { menus };
        if (options.loadEmployeeOptions && !options.supervisorBeneficiaryConfig) {
          employeeOptions = await options.loadEmployeeOptions();
          for (const row of employeeOptions) {
            employeeSelectionCache.set(row.id, row);
          }
          if (!formState.selectedEmployeeId) {
            formState.selectedEmployeeId = defaultEmployeeId ?? employeeOptions[0]?.id ?? null;
          }
        }
      } catch {
        bodyEl.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          No fue posible cargar el formulario.
          <button type="button" data-comedor-modal-cancel class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Cerrar</button>
        </div>`;
        bindInteractions();
        return;
      }
    }
    if (supervisorBeneficiaryConfig) {
      try {
        teamOnlyEmployeeOptions = await supervisorBeneficiaryConfig.loadTeamOptions();
        for (const row of teamOnlyEmployeeOptions) {
          employeeSelectionCache.set(row.id, row);
        }
        employeeSelectionCache.set(supervisorBeneficiaryConfig.self.id, supervisorBeneficiaryConfig.self);
      } catch {
        teamOnlyEmployeeOptions = [];
      }
    }
    fechasBloqueadasSet = new Set();
    if (loadFechasBloqueadas) {
      try {
        const bloqueadas = await loadFechasBloqueadas();
        fechasBloqueadasSet = new Set(bloqueadas);
      } catch {
        fechasBloqueadasSet = new Set();
      }
    }
    formState = initialState(defaultEmployeeId, supervisorBeneficiaryConfig);
    errors = {};
    isSubmitting = false;
    searchResults = [];
    isSearchingEmployees = false;
    searchEmployeesError = null;
    renderForm();
    notifyBeneficiaryUserIdChange();
    if (formState.fechaServicio.trim()) {
      void refreshMenuDelDia(formState.fechaServicio);
    }
    window.requestAnimationFrame(() => {
      const focusSupervisor =
        bodyEl.querySelector<HTMLElement>("[data-comedor-modal-supervisor-scope='personal']");
      const focusInternoTab = bodyEl.querySelector<HTMLElement>(
        "[data-comedor-modal-person-type='interno']",
      );
      (focusSupervisor ?? focusInternoTab)?.focus();
    });
  }

  function trapFocus(event: KeyboardEvent): void {
    if (event.key !== "Tab" || !isOpen()) return;
    const elements = panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
    }
  }

  function bindInteractions(): void {
    const form = bodyEl.querySelector("#comedor-new-request-form");
    if (!(form instanceof HTMLFormElement)) return;

    form.querySelectorAll<HTMLButtonElement>("[data-comedor-modal-supervisor-scope]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!supervisorBeneficiaryConfig) return;
        const raw = button.getAttribute("data-comedor-modal-supervisor-scope");
        if (raw !== "personal" && raw !== "team") return;
        formState.supervisorRecipientScope = raw;
        if (raw === "personal") {
          formState.selectedEmployeeId = supervisorBeneficiaryConfig.self.id;
        } else {
          formState.selectedEmployeeId = null;
        }
        formState.employeeSearch = "";
        searchResults = [];
        isSearchingEmployees = false;
        searchEmployeesError = null;
        searchToken += 1;
        if (searchDebounceTimer != null) {
          window.clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        errors.employee = undefined;
        notifyBeneficiaryUserIdChange();
        renderForm();
      });
    });

    form.querySelectorAll<HTMLButtonElement>("[data-comedor-modal-person-type]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!allowExternalPeople) return;
        const raw = button.getAttribute("data-comedor-modal-person-type");
        if (raw !== "interno" && raw !== "externo") return;
        formState.personType = raw satisfies ComedorPersonType;
        if (raw === "externo") {
          formState.selectedEmployeeId = null;
          formState.employeeSearch = "";
        }
        if (raw === "interno") {
          formState.externalPeopleCount = "1";
        }
        errors.personType = undefined;
        errors.employee = undefined;
        errors.externalPeopleCount = undefined;
        renderForm();
      });
    });

    const searchInput = form.querySelector<HTMLInputElement>("[data-comedor-modal-employee-search]");
    searchInput?.addEventListener("input", () => {
      if (!allowEmployeeSearch) return;
      formState.employeeSearch = searchInput.value;
      if (!searchInput.value.trim()) {
        formState.selectedEmployeeId = null;
        searchResults = [];
        isSearchingEmployees = false;
        searchEmployeesError = null;
        if (searchDebounceTimer != null) {
          window.clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        renderForm();
        return;
      }
      const currentToken = ++searchToken;
      if (searchDebounceTimer != null) {
        window.clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = window.setTimeout(async () => {
        searchDebounceTimer = null;
        isSearchingEmployees = true;
        searchEmployeesError = null;
        renderForm();
        try {
          const rows = await options.searchEmployees(searchInput.value);
          if (currentToken !== searchToken) return;
          searchResults = rows;
          for (const row of rows) {
            employeeSelectionCache.set(row.id, row);
          }
        } catch (error) {
          if (currentToken !== searchToken) return;
          searchResults = [];
          // Se muestra el `detail` del backend en vez de un genérico: un 403 por permisos
          // se veía igual que un fallo de red, y dejaba el buscador «roto» sin decir por qué.
          searchEmployeesError = comedorErrorMessage(
            error,
            "No fue posible consultar empleados. Intenta de nuevo.",
          );
        } finally {
          if (currentToken !== searchToken) return;
          isSearchingEmployees = false;
          renderForm();
        }
      }, 250);
      errors.employee = undefined;
    });

    form.querySelectorAll<HTMLButtonElement>("[data-comedor-modal-employee-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const employeeId = button.getAttribute("data-comedor-modal-employee-id");
        if (!employeeId) return;
        formState.selectedEmployeeId = employeeId;
        const selected = searchResults.find((employee) => employee.id === employeeId);
        if (selected) employeeSelectionCache.set(employeeId, selected);
        errors.employee = undefined;
        notifyBeneficiaryUserIdChange();
        renderForm();
      });
    });

    const employeeSelect = form.querySelector<HTMLSelectElement>("[data-comedor-modal-employee-select]");
    employeeSelect?.addEventListener("change", () => {
      formState.selectedEmployeeId = employeeSelect.value || null;
      errors.employee = undefined;
      notifyBeneficiaryUserIdChange();
      renderForm();
    });

    // Buscador del integrante del equipo: filtra en memoria sobre el subárbol cargado, sin
    // debounce ni petición — la lista ya está cargada.
    const teamSearchInput = form.querySelector<HTMLInputElement>("[data-comedor-modal-team-search]");
    teamSearchInput?.addEventListener("input", () => {
      formState.employeeSearch = teamSearchInput.value;
      renderForm();
    });

    form.querySelectorAll<HTMLButtonElement>("[data-comedor-modal-team-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-comedor-modal-team-pick");
        if (!id) return;
        // Mismo efecto que elegir en el `select` que este buscador sustituye: al cambiar
        // de beneficiario hay que recalcular su comedor y sus descansos.
        formState.selectedEmployeeId = id;
        // Vaciar la búsqueda repliega la lista y deja ver la tarjeta del elegido.
        formState.employeeSearch = "";
        errors.employee = undefined;
        notifyBeneficiaryUserIdChange();
        renderForm();
      });
    });

    const menuSelect = form.querySelector<HTMLSelectElement>("[data-comedor-modal-menu]");
    menuSelect?.addEventListener("change", () => {
      formState.menuId = menuSelect.value;
      errors.menuId = undefined;
    });

    datePickerHandle?.destroy();
    datePickerHandle = null;
    const datePickerRoot = form.querySelector<HTMLElement>("[data-workday-date-picker]");
    if (datePickerRoot) {
      datePickerHandle = bindWorkdayDatePicker(datePickerRoot, {
        minDate: fechaMinReservaIso,
        blockedDates: descansosCargados(),
        loadedMonths:
          mesesCargadosParaCalendario(
            descansosController.getState(),
            descansosController.getLoadedMonths(),
          ) ?? undefined,
        onChange: (iso) => {
          formState.fechaServicio = iso;
          errors.fechaServicio = undefined;
          void refreshMenuDelDia(iso);
        },
        onMonthChange: (year, monthIndex) => cargarDescansosMes(year, monthIndex),
      });
    }

    const externalCountInput = form.querySelector<HTMLInputElement>("[data-comedor-modal-external-count]");
    externalCountInput?.addEventListener("input", () => {
      formState.externalPeopleCount = externalCountInput.value;
      errors.externalPeopleCount = undefined;
    });

    form.querySelector("[data-comedor-modal-cancel]")?.addEventListener("click", () => {
      close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowExternalPeople) {
        formState.personType = "interno";
      }
      errors = validateForm(
        formState,
        allowExternalPeople,
        allowEmployeeSearch,
        fixedEmployeeId,
        fechaMinReservaIso,
        fechasBloqueadasSet,
        supervisorBeneficiaryConfig,
        new Set(teamOnlyEmployeeOptions.map((row) => row.id)),
        fechaServicioMinMensaje,
        descansosCargados(),
      );
      if (Object.keys(errors).length > 0) {
        renderForm();
        const selector = firstInvalidSelector(
          errors,
          allowExternalPeople,
          allowEmployeeSearch,
          Boolean(
            supervisorBeneficiaryConfig &&
              formState.supervisorRecipientScope === "team" &&
              teamOnlyEmployeeOptions.length === 0,
          ),
          Boolean(
            supervisorBeneficiaryConfig &&
              formState.supervisorRecipientScope === "team" &&
              teamOnlyEmployeeOptions.length > 0,
          ),
        );
        if (selector) bodyEl.querySelector<HTMLElement>(selector)?.focus();
        return;
      }
      isSubmitting = true;
      renderForm();
      try {
        const employeeId =
          formState.personType === "interno"
            ? supervisorBeneficiaryConfig && formState.supervisorRecipientScope === "personal"
              ? supervisorBeneficiaryConfig.self.id
              : (formState.selectedEmployeeId || fixedEmployeeId)
            : null;
        const esRegistroPersonalSupervisor =
          Boolean(supervisorBeneficiaryConfig && formState.supervisorRecipientScope === "personal");

        const payload: ComedorCreateRequestPayload = {
          personType: formState.personType,
          employeeId: formState.personType === "interno" ? employeeId : null,
          externalPeopleCount:
            allowExternalPeople && formState.personType === "externo"
              ? Math.max(1, Number.parseInt(formState.externalPeopleCount, 10))
              : null,
          menuId: formState.menuId,
          fechas: [formState.fechaServicio],
          observaciones: "",
          ...(esRegistroPersonalSupervisor ? { supervisorSelfRegistration: true } : {}),
        };
        const result = await options.onSubmit(payload);
        await Promise.resolve(options.onSuccess?.(result, payload));
        showEmpleadosToast(options.toastContainer, "Solicitud de comida registrada correctamente.", "success");
        close();
      } catch (error: unknown) {
        isSubmitting = false;
        const msg = comedorErrorMessage(
          error,
          "No se pudo registrar la solicitud. Intenta de nuevo.",
        );
        showEmpleadosToast(options.toastContainer, msg, "error");
        renderForm();
      }
    });
  }

  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-comedor-modal-close]") || target.closest("[data-comedor-modal-cancel]")) {
      close();
    }
  });

  overlayEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event);
  });

  return {
    open,
    close,
    destroy: () => {
      if (searchDebounceTimer != null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      close();
      desuscribirDescansos();
      host.innerHTML = "";
    },
  };
}
