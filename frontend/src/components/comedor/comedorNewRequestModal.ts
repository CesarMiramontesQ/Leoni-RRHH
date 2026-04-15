import type {
  ComedorCreateRequestPayload,
  ComedorEmployeeOption,
  ComedorMenuOption,
  ComedorPersonType,
} from "../../comedor/rh/types.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  buildComedorNewRequestFormHtml,
  comedorNewRequestModalShellHtml,
  type ComedorNewRequestFormErrors,
  type ComedorNewRequestFormState,
} from "./comedorNewRequestModalUi.ts";

type Catalog = {
  menus: readonly ComedorMenuOption[];
};

export type ComedorNewRequestModalOptions = {
  toastContainer: HTMLElement;
  allowExternalPeople?: boolean;
  allowEmployeeSearch?: boolean;
  fixedEmployee?: ComedorEmployeeOption | null;
  loadMenuOptions: () => Promise<readonly ComedorMenuOption[]>;
  searchEmployees: (query: string) => Promise<readonly ComedorEmployeeOption[]>;
  onSubmit: (payload: ComedorCreateRequestPayload) => Promise<void> | void;
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

function initialState(fixedEmployeeId: string | null): ComedorNewRequestFormState {
  return {
    personType: "interno",
    employeeSearch: "",
    selectedEmployeeId: fixedEmployeeId,
    externalPeopleCount: "1",
    menuId: "",
    fecha: "",
    observaciones: "",
  };
}

function validateForm(
  state: ComedorNewRequestFormState,
  allowExternalPeople: boolean,
  allowEmployeeSearch: boolean,
  fixedEmployeeId: string | null,
): ComedorNewRequestFormErrors {
  const errors: ComedorNewRequestFormErrors = {};
  if (state.personType !== "interno" && state.personType !== "externo") {
    errors.personType = "Selecciona un tipo de persona.";
  }
  const effectiveSelectedEmployeeId =
    state.personType === "interno" && !allowEmployeeSearch ? fixedEmployeeId : state.selectedEmployeeId;
  if (state.personType === "interno" && !effectiveSelectedEmployeeId) {
    errors.employee = "Selecciona un empleado.";
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
  if (!state.fecha.trim()) {
    errors.fecha = "Selecciona una fecha.";
  }
  return errors;
}

function firstInvalidSelector(
  errors: ComedorNewRequestFormErrors,
  allowExternalPeople: boolean,
): string | null {
  if (errors.personType) return "[data-comedor-modal-person-type='interno']";
  if (errors.employee) return "#comedor-modal-employee-search";
  if (allowExternalPeople && errors.externalPeopleCount) return "#comedor-modal-external-count";
  if (errors.menuId) return "#comedor-modal-menu";
  if (errors.fecha) return "#comedor-modal-date";
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
  const fixedEmployeeId = fixedEmployee?.id ?? null;
  let catalog: Catalog | null = null;
  let formState = initialState(fixedEmployeeId);
  let errors: ComedorNewRequestFormErrors = {};
  let isSubmitting = false;
  let searchResults: readonly ComedorEmployeeOption[] = [];
  let isSearchingEmployees = false;
  let searchEmployeesError: string | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchToken = 0;
  const employeeSelectionCache = new Map<string, ComedorEmployeeOption>();

  function isOpen(): boolean {
    return !overlayEl.classList.contains("hidden");
  }

  function selectedEmployee(): ComedorEmployeeOption | null {
    if (!allowEmployeeSearch && fixedEmployee) return fixedEmployee;
    if (!formState.selectedEmployeeId) return null;
    return (
      searchResults.find((employee) => employee.id === formState.selectedEmployeeId) ??
      employeeSelectionCache.get(formState.selectedEmployeeId) ??
      null
    );
  }

  function renderForm(): void {
    if (!catalog) return;
    bodyEl.innerHTML = buildComedorNewRequestFormHtml({
      state: formState,
      allowExternalPeople,
      allowEmployeeSearch,
      errors,
      isSubmitting,
      menuOptions: catalog.menus,
      searchResults,
      isSearchingEmployees,
      searchEmployeesError,
      selectedEmployee: selectedEmployee(),
    });
    bindInteractions();
  }

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    formState = initialState(fixedEmployeeId);
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
      } catch {
        bodyEl.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          No fue posible cargar el formulario.
          <button type="button" data-comedor-modal-cancel class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Cerrar</button>
        </div>`;
        bindInteractions();
        return;
      }
    }
    formState = initialState(fixedEmployeeId);
    errors = {};
    isSubmitting = false;
    searchResults = [];
    isSearchingEmployees = false;
    searchEmployeesError = null;
    renderForm();
    window.requestAnimationFrame(() => {
      bodyEl.querySelector<HTMLElement>("[data-comedor-modal-person-type='interno']")?.focus();
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
        } catch {
          if (currentToken !== searchToken) return;
          searchResults = [];
          searchEmployeesError = "No fue posible consultar empleados. Intenta de nuevo.";
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
        renderForm();
      });
    });

    const menuSelect = form.querySelector<HTMLSelectElement>("[data-comedor-modal-menu]");
    menuSelect?.addEventListener("change", () => {
      formState.menuId = menuSelect.value;
      errors.menuId = undefined;
    });

    const dateInput = form.querySelector<HTMLInputElement>("[data-comedor-modal-date]");
    dateInput?.addEventListener("change", () => {
      formState.fecha = dateInput.value;
      errors.fecha = undefined;
    });

    const notesInput = form.querySelector<HTMLTextAreaElement>("[data-comedor-modal-observaciones]");
    const externalCountInput = form.querySelector<HTMLInputElement>("[data-comedor-modal-external-count]");
    externalCountInput?.addEventListener("input", () => {
      formState.externalPeopleCount = externalCountInput.value;
      errors.externalPeopleCount = undefined;
    });

    notesInput?.addEventListener("input", () => {
      formState.observaciones = notesInput.value;
    });

    form.querySelector("[data-comedor-modal-cancel]")?.addEventListener("click", () => {
      close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowExternalPeople) {
        formState.personType = "interno";
      }
      errors = validateForm(formState, allowExternalPeople, allowEmployeeSearch, fixedEmployeeId);
      if (Object.keys(errors).length > 0) {
        renderForm();
        const selector = firstInvalidSelector(errors, allowExternalPeople);
        if (selector) bodyEl.querySelector<HTMLElement>(selector)?.focus();
        return;
      }
      isSubmitting = true;
      renderForm();
      try {
        const employeeId =
          formState.personType === "interno" && !allowEmployeeSearch
            ? fixedEmployeeId
            : formState.selectedEmployeeId;
        await options.onSubmit({
          personType: formState.personType,
          employeeId: formState.personType === "interno" ? employeeId : null,
          externalPeopleCount:
            allowExternalPeople && formState.personType === "externo"
              ? Math.max(1, Number.parseInt(formState.externalPeopleCount, 10))
              : null,
          menuId: formState.menuId,
          fecha: formState.fecha,
          observaciones: formState.observaciones.trim(),
        });
        showEmpleadosToast(options.toastContainer, "Solicitud de comida registrada correctamente.", "success");
        close();
      } catch {
        isSubmitting = false;
        showEmpleadosToast(options.toastContainer, "No se pudo registrar la solicitud. Intenta de nuevo.", "error");
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
      host.innerHTML = "";
    },
  };
}
