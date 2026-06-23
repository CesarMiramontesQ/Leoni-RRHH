import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import {
  FALTA_RETARDO_TIPOS,
  FALTA_RETARDO_TIPOS_RANGO,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type FaltaRetardoEmpleadoOption = {
  empleado_id: number;
  nombre: string;
  no_empleado: string;
};

export type NuevaFaltaRetardoFormData = {
  empleadoId: string;
  tipo: FaltaRetardoTipo | "";
  fechaEvento: string;
  fechaFin: string;
  observaciones: string;
};

export type NuevaFaltaRetardoFormErrors = Partial<
  Record<
    "empleadoId" | "tipo" | "fechaEvento" | "fechaFin" | "observaciones" | "form",
    string
  >
>;

export type NuevaFaltaRetardoSubmitPayload = {
  empleado_id: number;
  tipo: FaltaRetardoTipo;
  fecha_evento: string;
  fecha_fin?: string | null;
  observaciones?: string | null;
};

export type NuevaFaltaRetardoModalOptions = {
  empleados: readonly FaltaRetardoEmpleadoOption[];
  toastContainer: HTMLElement;
  onSubmit: (payload: NuevaFaltaRetardoSubmitPayload) => Promise<void>;
};

export type NuevaFaltaRetardoModalHandle = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

const FILTER_INPUT =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400";

function initialFormData(): NuevaFaltaRetardoFormData {
  return {
    empleadoId: "",
    tipo: "",
    fechaEvento: "",
    fechaFin: "",
    observaciones: "",
  };
}

function requiresRango(tipo: FaltaRetardoTipo | ""): boolean {
  return tipo !== "" && FALTA_RETARDO_TIPOS_RANGO.has(tipo);
}

function validateForm(data: NuevaFaltaRetardoFormData): NuevaFaltaRetardoFormErrors {
  const errors: NuevaFaltaRetardoFormErrors = {};
  if (!data.empleadoId.trim()) errors.empleadoId = "Seleccione un empleado";
  if (!data.tipo) errors.tipo = "Seleccione el tipo de evento";
  if (!data.fechaEvento.trim()) errors.fechaEvento = "Indique la fecha del evento";
  if (requiresRango(data.tipo)) {
    if (!data.fechaFin.trim()) errors.fechaFin = "Indique la fecha fin del rango";
    else if (data.fechaFin < data.fechaEvento) {
      errors.fechaFin = "La fecha fin no puede ser anterior a la fecha inicio";
    }
  }
  return errors;
}

function buildFormHtml(
  data: NuevaFaltaRetardoFormData,
  errors: NuevaFaltaRetardoFormErrors,
  empleados: readonly FaltaRetardoEmpleadoOption[],
  empleadoSearch: string,
  isSubmitting: boolean,
): string {
  const rango = requiresRango(data.tipo);
  const empleadoOptions = empleados
    .filter((e) => {
      const q = empleadoSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        e.nombre.toLowerCase().includes(q) ||
        e.no_empleado.toLowerCase().includes(q)
      );
    })
    .map(
      (e) =>
        `<option value="${e.empleado_id}" ${data.empleadoId === String(e.empleado_id) ? "selected" : ""}>${escapeHtml(e.no_empleado)} — ${escapeHtml(e.nombre)}</option>`,
    )
    .join("");

  const tipoOptions = FALTA_RETARDO_TIPOS.map(
    (t) =>
      `<option value="${t}" ${data.tipo === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`,
  ).join("");

  return `
    <form id="fr-nueva-form" class="space-y-4" novalidate>
      ${errors.form ? `<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(errors.form)}</p>` : ""}
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-empleado-search">Buscar empleado</label>
        <input id="fr-form-empleado-search" type="search" class="${FILTER_INPUT} ${FIELD_FOCUS}" placeholder="Nombre o número…" value="${escapeHtml(empleadoSearch)}" />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-empleado">Empleado *</label>
        <select id="fr-form-empleado" class="${FILTER_INPUT} ${SELECT_CHEVRON} ${FIELD_FOCUS}" required>
          <option value="">Seleccionar…</option>
          ${empleadoOptions}
        </select>
        ${errors.empleadoId ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.empleadoId)}</p>` : ""}
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-tipo">Tipo de evento *</label>
        <select id="fr-form-tipo" class="${FILTER_INPUT} ${SELECT_CHEVRON} ${FIELD_FOCUS}" required>
          <option value="">Seleccionar…</option>
          ${tipoOptions}
        </select>
        ${errors.tipo ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.tipo)}</p>` : ""}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-fecha">${rango ? "Fecha inicio *" : "Fecha del evento *"}</label>
          <input id="fr-form-fecha" type="date" class="${FILTER_INPUT} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaEvento)}" required />
          ${errors.fechaEvento ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.fechaEvento)}</p>` : ""}
        </div>
        <div id="fr-form-fecha-fin-wrap" class="${rango ? "" : "hidden"}">
          <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-fecha-fin">Fecha fin *</label>
          <input id="fr-form-fecha-fin" type="date" class="${FILTER_INPUT} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaFin)}" ${rango ? "required" : ""} />
          ${errors.fechaFin ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.fechaFin)}</p>` : ""}
        </div>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700" for="fr-form-obs">Observaciones</label>
        <textarea id="fr-form-obs" rows="3" class="${FILTER_INPUT} ${FIELD_FOCUS} resize-y" placeholder="Comentarios u observaciones…">${escapeHtml(data.observaciones)}</textarea>
      </div>
      <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" id="fr-form-cancel" class="rh-sol-btn-secondary min-h-[42px] rounded px-4 text-sm font-medium" ${isSubmitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" id="fr-form-submit" class="rh-sol-btn-primary min-h-[42px] rounded px-4 text-sm font-semibold" ${isSubmitting ? "disabled" : ""}>
          ${isSubmitting ? "Guardando…" : "Registrar evento"}
        </button>
      </div>
    </form>
  `;
}

export function mountNuevaFaltaRetardoModal(
  host: HTMLElement,
  options: NuevaFaltaRetardoModalOptions,
): NuevaFaltaRetardoModalHandle {
  host.innerHTML = `
    <div id="fr-nueva-modal-overlay" class="fixed inset-0 z-[80] hidden items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
      <div id="fr-nueva-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fr-nueva-modal-title"
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="fr-nueva-modal-title" class="text-lg font-semibold text-slate-900">Nuevo registro</h2>
          <button type="button" id="fr-nueva-modal-close" class="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">✕</button>
        </div>
        <div id="fr-nueva-modal-body" class="px-5 py-4"></div>
      </div>
    </div>
  `;

  const overlay = host.querySelector("#fr-nueva-modal-overlay") as HTMLElement;
  const body = host.querySelector("#fr-nueva-modal-body") as HTMLElement;
  const closeBtn = host.querySelector("#fr-nueva-modal-close") as HTMLButtonElement;

  let formData = initialFormData();
  let errors: NuevaFaltaRetardoFormErrors = {};
  let empleadoSearch = "";
  let isSubmitting = false;

  function render(): void {
    body.innerHTML = buildFormHtml(formData, errors, options.empleados, empleadoSearch, isSubmitting);
    bindForm();
  }

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    formData = initialFormData();
    errors = {};
    empleadoSearch = "";
    isSubmitting = false;
    body.innerHTML = "";
  }

  function open(): void {
    formData = initialFormData();
    errors = {};
    empleadoSearch = "";
    isSubmitting = false;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    render();
  }

  async function handleSubmit(): Promise<void> {
    errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      render();
      return;
    }
    isSubmitting = true;
    render();
    try {
      const payload: NuevaFaltaRetardoSubmitPayload = {
        empleado_id: Number.parseInt(formData.empleadoId, 10),
        tipo: formData.tipo as FaltaRetardoTipo,
        fecha_evento: formData.fechaEvento,
        observaciones: formData.observaciones.trim() || null,
      };
      if (requiresRango(formData.tipo)) {
        payload.fecha_fin = formData.fechaFin;
      }
      await options.onSubmit(payload);
      showEmpleadosToast(options.toastContainer, "El evento laboral se registró correctamente.", "success");
      close();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "No se pudo guardar el registro.";
      errors = { form: detail };
      isSubmitting = false;
      render();
      showEmpleadosToast(options.toastContainer, detail, "error");
    }
  }

  function bindForm(): void {
    const form = body.querySelector("#fr-nueva-form") as HTMLFormElement | null;
    const empleadoSel = body.querySelector("#fr-form-empleado") as HTMLSelectElement | null;
    const tipoSel = body.querySelector("#fr-form-tipo") as HTMLSelectElement | null;
    const fechaInp = body.querySelector("#fr-form-fecha") as HTMLInputElement | null;
    const fechaFinInp = body.querySelector("#fr-form-fecha-fin") as HTMLInputElement | null;
    const obsInp = body.querySelector("#fr-form-obs") as HTMLTextAreaElement | null;
    const searchInp = body.querySelector("#fr-form-empleado-search") as HTMLInputElement | null;
    const cancelBtn = body.querySelector("#fr-form-cancel") as HTMLButtonElement | null;

    searchInp?.addEventListener("input", () => {
      empleadoSearch = searchInp.value;
      render();
      const nextSearch = body.querySelector("#fr-form-empleado-search") as HTMLInputElement | null;
      nextSearch?.focus();
    });

    empleadoSel?.addEventListener("change", () => {
      formData = { ...formData, empleadoId: empleadoSel.value };
    });
    tipoSel?.addEventListener("change", () => {
      formData = { ...formData, tipo: tipoSel.value as FaltaRetardoTipo | "" };
      if (!requiresRango(formData.tipo)) formData = { ...formData, fechaFin: "" };
      render();
    });
    fechaInp?.addEventListener("change", () => {
      formData = { ...formData, fechaEvento: fechaInp.value };
    });
    fechaFinInp?.addEventListener("change", () => {
      formData = { ...formData, fechaFin: fechaFinInp.value };
    });
    obsInp?.addEventListener("input", () => {
      formData = { ...formData, observaciones: obsInp.value };
    });
    cancelBtn?.addEventListener("click", close);
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void handleSubmit();
    });
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
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
