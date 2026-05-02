import {
  createNuevaActaInitialData,
  fillEmployeeSnapshot,
  validateNuevaActaForm,
  type NuevaActaEmpleadoOption,
  type NuevaActaFormData,
  type NuevaActaSelectOption,
  type NuevaActaFormErrors as FormErrors,
  type NuevaActaFormData as FormData,
} from "../../actas/nuevaActaModalConfig.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { buildNuevaActaFormHtml, nuevaActaModalShellHtml } from "./nuevaActaModalUi.ts";

export type NuevaActaSubmitPayload = {
  formData: NuevaActaFormData;
};

export type NuevaActaModalOptions = {
  empleados: readonly NuevaActaEmpleadoOption[];
  responsablesRh: readonly NuevaActaSelectOption[];
  toastContainer: HTMLElement;
  onSubmit: (payload: NuevaActaSubmitPayload) => Promise<void> | void;
};

export type NuevaActaModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

type ControlledField =
  | "areaDepartamento"
  | "supervisorDirecto"
  | "tipoFalta"
  | "fundamentoLegal"
  | "articuloInciso"
  | "fechaEvento"
  | "lugarIncidente"
  | "descripcionHechos"
  | "personasInvolucradas"
  | "testigos"
  | "responsableRhId";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function cloneFiles(files: readonly File[]): File[] {
  return files.map((file) => file);
}

function dedupeFiles(files: readonly File[]): File[] {
  const uniq = new Map<string, File>();
  for (const file of files) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!uniq.has(key)) uniq.set(key, file);
  }
  return Array.from(uniq.values());
}

function firstInvalidSelector(errors: FormErrors): string | null {
  if (errors.empleadoId) return "#rh-actas-form-empleado";
  if (errors.numeroEmpleado) return "#rh-actas-form-numero";
  if (errors.areaDepartamento) return "#rh-actas-form-area";
  if (errors.supervisorDirecto) return "#rh-actas-form-supervisor";
  if (errors.tipoFalta) return "#rh-actas-form-tipo-falta";
  if (errors.fundamentoLegal) return "#rh-actas-form-fundamento-legal";
  if (errors.articuloInciso) return "#rh-actas-form-articulo-inciso";
  if (errors.fechaEvento) return "#rh-actas-form-fecha-evento";
  if (errors.lugarIncidente) return "#rh-actas-form-lugar";
  if (errors.descripcionHechos) return "#rh-actas-form-descripcion";
  if (errors.evidencias) return "[data-rh-actas-select-files]";
  if (errors.responsableRhId) return "#rh-actas-form-responsable-rh";
  return null;
}

export function mountNuevaActaModal(host: HTMLElement, options: NuevaActaModalOptions): NuevaActaModalHandle {
  host.innerHTML = nuevaActaModalShellHtml();
  const overlay = host.querySelector("#rh-actas-nueva-modal-overlay");
  const panel = host.querySelector("#rh-actas-nueva-modal-panel");
  const body = host.querySelector("#rh-actas-nueva-modal-body");

  if (!(overlay instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(body instanceof HTMLElement)) {
    return {
      open: () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }
  const overlayEl = overlay;
  const panelEl = panel;
  const bodyEl = body;

  let formData: FormData = createNuevaActaInitialData();
  let errors: FormErrors = {};
  let isSubmitting = false;
  let dragActive = false;
  let empleadoSearchQ = "";

  function isOpen(): boolean {
    return !overlayEl.classList.contains("hidden");
  }

  function resetForm(): void {
    formData = createNuevaActaInitialData();
    if (options.responsablesRh.length > 0) {
      formData = {
        ...formData,
        responsableRhId: options.responsablesRh[0]!.id,
      };
    }
    errors = {};
    isSubmitting = false;
    dragActive = false;
    empleadoSearchQ = "";
  }

  function renderForm(): void {
    bodyEl.innerHTML = buildNuevaActaFormHtml({
      formData,
      errors,
      empleados: options.empleados,
      empleadoSearchQ,
      responsablesRh: options.responsablesRh,
      isSubmitting,
      dragActive,
    });
    bindFormInteractions();
  }

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    resetForm();
    bodyEl.innerHTML = "";
  }

  function open(): void {
    resetForm();
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
    renderForm();
    window.requestAnimationFrame(() => {
      const first = bodyEl.querySelector<HTMLElement>("#rh-actas-form-empleado-busqueda");
      first?.focus();
    });
  }

  function updateFilesWith(newFiles: readonly File[]): void {
    const next = dedupeFiles([...cloneFiles(formData.evidencias), ...newFiles]);
    formData = {
      ...formData,
      evidencias: next,
    };
    errors = {
      ...errors,
      evidencias: undefined,
    };
    dragActive = false;
    renderForm();
  }

  function bindDropzone(dropzone: HTMLElement, input: HTMLInputElement): void {
    const prevent = (event: DragEvent): void => {
      event.preventDefault();
      event.stopPropagation();
    };

    dropzone.addEventListener("dragenter", (event) => {
      prevent(event);
      dragActive = true;
      renderForm();
    });

    dropzone.addEventListener("dragover", prevent);

    dropzone.addEventListener("dragleave", (event) => {
      prevent(event);
      if ((event.target as HTMLElement) === dropzone) {
        dragActive = false;
        renderForm();
      }
    });

    dropzone.addEventListener("drop", (event) => {
      prevent(event);
      const list = event.dataTransfer?.files;
      if (!list || list.length === 0) {
        dragActive = false;
        renderForm();
        return;
      }
      updateFilesWith(Array.from(list));
    });

    input.addEventListener("change", () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      updateFilesWith(Array.from(files));
    });
  }

  function bindFormInteractions(): void {
    const form = bodyEl.querySelector("#rh-actas-nueva-form");
    if (!(form instanceof HTMLFormElement)) return;

    const empleadoSearchInput = form.querySelector("[data-rh-actas-form-empleado-search]");
    const empleadoSelect = form.querySelector("[data-rh-actas-form-empleado]");

    if (empleadoSearchInput instanceof HTMLInputElement) {
      empleadoSearchInput.addEventListener("input", () => {
        empleadoSearchQ = empleadoSearchInput.value;
        const start = empleadoSearchInput.selectionStart ?? empleadoSearchQ.length;
        const end = empleadoSearchInput.selectionEnd ?? empleadoSearchQ.length;
        const dir =
          empleadoSearchInput.selectionDirection === "backward"
            ? "backward"
            : empleadoSearchInput.selectionDirection === "none"
              ? "none"
              : "forward";
        renderForm();
        const nextInput = bodyEl.querySelector<HTMLInputElement>("[data-rh-actas-form-empleado-search]");
        if (!nextInput) return;
        nextInput.focus();
        try {
          nextInput.setSelectionRange(start, end, dir);
        } catch {
          /* noop */
        }
      });
    }

    if (empleadoSelect instanceof HTMLSelectElement) {
      empleadoSelect.addEventListener("change", () => {
        const selectedId = empleadoSelect.value;
        const empleado = options.empleados.find((item) => item.id === selectedId) ?? null;
        if (empleado) empleadoSearchQ = empleado.nombre;
        formData = fillEmployeeSnapshot({ ...formData, empleadoId: selectedId }, empleado);
        errors = {
          ...errors,
          empleadoId: undefined,
          numeroEmpleado: undefined,
          areaDepartamento: undefined,
          supervisorDirecto: undefined,
        };
        renderForm();
      });
    }

    form.querySelectorAll("[data-rh-actas-form-field]").forEach((el) => {
      const key = el.getAttribute("data-rh-actas-form-field") as ControlledField | null;
      if (!key) return;
      const onInput = (): void => {
        const target = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const value = target.value;
        formData = { ...formData, [key]: value };
        if (errors[key]) errors = { ...errors, [key]: undefined };
      };
      el.addEventListener("input", onInput);
      el.addEventListener("change", onInput);
    });

    const fileInput = form.querySelector("[data-rh-actas-file-input]");
    const dropzone = form.querySelector("[data-rh-actas-dropzone]");
    const fileSelectBtn = form.querySelector("[data-rh-actas-select-files]");
    if (fileInput instanceof HTMLInputElement && dropzone instanceof HTMLElement) {
      bindDropzone(dropzone, fileInput);
      fileSelectBtn?.addEventListener("click", () => fileInput.click());
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const validation = validateNuevaActaForm(formData);
      errors = validation;
      if (Object.keys(validation).length > 0) {
        renderForm();
        const selector = firstInvalidSelector(validation);
        if (selector) {
          const target = bodyEl.querySelector<HTMLElement>(selector);
          target?.focus();
        }
        return;
      }

      isSubmitting = true;
      renderForm();
      try {
        await options.onSubmit({ formData });
        showEmpleadosToast(options.toastContainer, "Acta guardada correctamente.", "success");
        close();
      } catch {
        isSubmitting = false;
        showEmpleadosToast(options.toastContainer, "No se pudo guardar el acta. Intenta de nuevo.", "error");
        renderForm();
      }
    });

    form.querySelector("[data-rh-actas-modal-cancel]")?.addEventListener("click", () => {
      close();
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

  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-rh-actas-modal-close]")) close();
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
      close();
      host.innerHTML = "";
    },
  };
}
