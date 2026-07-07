import type { ViajeLaboralListItem, ViajeLaboralPayload } from "../../api/viajesLaborales.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  FIELD_INPUT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhViajesLaboralesPageStyles.ts";

export type ViajeLaboralEmpleadoOption = {
  empleado_id: number;
  nombre: string;
  no_empleado: string;
};

type FormData = {
  empleadoId: string;
  fechaSalida: string;
  fechaRegreso: string;
  lugarOrigen: string;
  lugarDestino: string;
  motivo: string;
  descripcion: string;
  medioTransporte: string;
  hospedaje: string;
  viaticos: string;
};

type FormErrors = Partial<Record<keyof FormData | "form", string>>;

export type ViajeLaboralModalOptions = {
  empleados: readonly ViajeLaboralEmpleadoOption[];
  toastContainer: HTMLElement;
  onSubmit: (payload: ViajeLaboralPayload, viajeId?: number) => Promise<void>;
};

export type ViajeLaboralModalHandle = {
  openCreate: () => void;
  openEdit: (viaje: ViajeLaboralListItem) => void;
  close: () => void;
  destroy: () => void;
};

const FILTER_CONTROL = `${FIELD_INPUT} min-h-11 w-full`;

function emptyForm(): FormData {
  return {
    empleadoId: "",
    fechaSalida: "",
    fechaRegreso: "",
    lugarOrigen: "",
    lugarDestino: "",
    motivo: "",
    descripcion: "",
    medioTransporte: "",
    hospedaje: "",
    viaticos: "",
  };
}

function formFromViaje(v: ViajeLaboralListItem): FormData {
  return {
    empleadoId: String(v.empleado_id),
    fechaSalida: v.fecha_salida,
    fechaRegreso: v.fecha_regreso,
    lugarOrigen: v.lugar_origen,
    lugarDestino: v.lugar_destino,
    motivo: v.motivo,
    descripcion: v.descripcion ?? "",
    medioTransporte: v.medio_transporte,
    hospedaje: v.hospedaje ?? "",
    viaticos: v.viaticos_estimados != null ? String(v.viaticos_estimados) : "",
  };
}

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.empleadoId.trim()) errors.empleadoId = "Seleccione un empleado";
  if (!data.fechaSalida.trim()) errors.fechaSalida = "Indique la fecha de salida";
  if (!data.fechaRegreso.trim()) errors.fechaRegreso = "Indique la fecha de regreso";
  else if (data.fechaRegreso < data.fechaSalida) {
    errors.fechaRegreso = "La fecha de regreso no puede ser anterior a la de salida";
  }
  if (!data.lugarOrigen.trim()) errors.lugarOrigen = "Indique el lugar de origen";
  if (!data.lugarDestino.trim()) errors.lugarDestino = "Indique el lugar de destino";
  if (!data.motivo.trim()) errors.motivo = "Indique el motivo del viaje";
  if (!data.medioTransporte.trim()) errors.medioTransporte = "Indique el medio de transporte";
  if (data.viaticos.trim()) {
    const n = Number(data.viaticos);
    if (Number.isNaN(n) || n < 0) errors.viaticos = "Viáticos inválidos";
  }
  return errors;
}

function buildHtml(
  data: FormData,
  errors: FormErrors,
  empleados: readonly ViajeLaboralEmpleadoOption[],
  title: string,
  isSubmitting: boolean,
): string {
  const empleadoOptions = empleados
    .map(
      (e) =>
        `<option value="${e.empleado_id}" ${data.empleadoId === String(e.empleado_id) ? "selected" : ""}>${escapeHtml(e.no_empleado)} — ${escapeHtml(e.nombre)}</option>`,
    )
    .join("");

  const field = (
    id: string,
    label: string,
    value: string,
    err?: string,
    type: "text" | "date" | "number" = "text",
    required = false,
  ) => `
    <div>
      <label class="${RH_LISTADO_LABEL}" for="${id}">${escapeHtml(label)}${required ? " *" : ""}</label>
      <input id="${id}" type="${type}" class="${FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(value)}" ${required ? "required" : ""} />
      ${err ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(err)}</p>` : ""}
    </div>`;

  return `
    <form id="vl-form" class="space-y-4" novalidate>
      ${errors.form ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(errors.form)}</p>` : ""}
      <div>
        <label class="${RH_LISTADO_LABEL}" for="vl-form-empleado">Empleado *</label>
        <div class="grid grid-cols-1">
          <select id="vl-form-empleado" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS}" required>
            <option value="">Seleccionar…</option>
            ${empleadoOptions}
          </select>
          ${SELECT_CHEVRON}
        </div>
        ${errors.empleadoId ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.empleadoId)}</p>` : ""}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        ${field("vl-form-salida", "Fecha de salida", data.fechaSalida, errors.fechaSalida, "date", true)}
        ${field("vl-form-regreso", "Fecha de regreso", data.fechaRegreso, errors.fechaRegreso, "date", true)}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        ${field("vl-form-origen", "Lugar de origen", data.lugarOrigen, errors.lugarOrigen, "text", true)}
        ${field("vl-form-destino", "Lugar de destino", data.lugarDestino, errors.lugarDestino, "text", true)}
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="vl-form-motivo">Motivo del viaje *</label>
        <textarea id="vl-form-motivo" rows="2" class="${FILTER_CONTROL} ${FIELD_FOCUS} resize-y" required>${escapeHtml(data.motivo)}</textarea>
        ${errors.motivo ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.motivo)}</p>` : ""}
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="vl-form-descripcion">Descripción o comentarios</label>
        <textarea id="vl-form-descripcion" rows="2" class="${FILTER_CONTROL} ${FIELD_FOCUS} resize-y">${escapeHtml(data.descripcion)}</textarea>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        ${field("vl-form-transporte", "Medio de transporte", data.medioTransporte, errors.medioTransporte, "text", true)}
        ${field("vl-form-hospedaje", "Hospedaje", data.hospedaje, errors.hospedaje)}
      </div>
      ${field("vl-form-viaticos", "Viáticos estimados (MXN)", data.viaticos, errors.viaticos, "number")}
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" id="vl-form-cancel" class="rh-sol-btn-secondary min-h-11 rounded px-4 text-sm font-medium" ${isSubmitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" class="${RH_SOLICITUDES_BTN_PRIMARY} min-h-11 px-4 text-sm font-semibold" ${isSubmitting ? "disabled" : ""}>
          ${isSubmitting ? escapeHtml(VL_COPY.modalGuardando) : escapeHtml(VL_COPY.modalGuardar)}
        </button>
      </div>
    </form>`;
}

export function mountViajeLaboralModal(
  host: HTMLElement,
  options: ViajeLaboralModalOptions,
): ViajeLaboralModalHandle {
  host.innerHTML = `
    <div id="vl-modal-overlay" class="${MODAL_OVERLAY} hidden items-center justify-center p-3 sm:p-6">
      <div id="vl-modal-panel" role="dialog" aria-modal="true" class="${MODAL_PANEL} max-w-2xl">
        <header class="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="vl-modal-title" class="text-base font-bold text-slate-900 sm:text-lg"></h2>
          <button type="button" id="vl-modal-close" class="size-10 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="${escapeHtml(VL_COPY.modalCerrar)}">×</button>
        </header>
        <div id="vl-modal-body" class="overflow-y-auto px-4 py-4 sm:px-5"></div>
      </div>
    </div>`;

  const overlay = host.querySelector("#vl-modal-overlay") as HTMLElement;
  const body = host.querySelector("#vl-modal-body") as HTMLElement;
  const titleEl = host.querySelector("#vl-modal-title") as HTMLElement;
  const closeBtn = host.querySelector("#vl-modal-close") as HTMLButtonElement;

  let formData = emptyForm();
  let errors: FormErrors = {};
  let isSubmitting = false;
  let editId: number | undefined;

  function readFormFromDom(): void {
    const get = (id: string) => (body.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? "";
    formData = {
      empleadoId: get("vl-form-empleado"),
      fechaSalida: get("vl-form-salida"),
      fechaRegreso: get("vl-form-regreso"),
      lugarOrigen: get("vl-form-origen"),
      lugarDestino: get("vl-form-destino"),
      motivo: get("vl-form-motivo"),
      descripcion: get("vl-form-descripcion"),
      medioTransporte: get("vl-form-transporte"),
      hospedaje: get("vl-form-hospedaje"),
      viaticos: get("vl-form-viaticos"),
    };
  }

  function render(title: string): void {
    titleEl.textContent = title;
    body.innerHTML = buildHtml(formData, errors, options.empleados, title, isSubmitting);
    body.querySelector("#vl-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void submit();
    });
    body.querySelector("#vl-form-cancel")?.addEventListener("click", close);
  }

  function open(title: string, data: FormData, viajeId?: number): void {
    editId = viajeId;
    formData = data;
    errors = {};
    isSubmitting = false;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    render(title);
  }

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    editId = undefined;
    body.innerHTML = "";
  }

  async function submit(): Promise<void> {
    readFormFromDom();
    errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      render(editId ? VL_COPY.modalTituloEditar : VL_COPY.modalTituloNuevo);
      return;
    }
    isSubmitting = true;
    render(editId ? VL_COPY.modalTituloEditar : VL_COPY.modalTituloNuevo);
    const payload: ViajeLaboralPayload = {
      empleado_id: Number.parseInt(formData.empleadoId, 10),
      fecha_salida: formData.fechaSalida,
      fecha_regreso: formData.fechaRegreso,
      lugar_origen: formData.lugarOrigen.trim(),
      lugar_destino: formData.lugarDestino.trim(),
      motivo: formData.motivo.trim(),
      descripcion: formData.descripcion.trim() || null,
      medio_transporte: formData.medioTransporte.trim(),
      hospedaje: formData.hospedaje.trim() || null,
      viaticos_estimados: formData.viaticos.trim() ? Number(formData.viaticos) : null,
    };
    try {
      await options.onSubmit(payload, editId);
      showEmpleadosToast(
        options.toastContainer,
        editId ? VL_COPY.modalExitoEditar : VL_COPY.modalExitoCrear,
        "success",
      );
      close();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "No se pudo guardar el viaje.";
      errors = { form: detail };
      isSubmitting = false;
      render(editId ? VL_COPY.modalTituloEditar : VL_COPY.modalTituloNuevo);
    }
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return {
    openCreate: () => open(VL_COPY.modalTituloNuevo, emptyForm()),
    openEdit: (viaje) => open(VL_COPY.modalTituloEditar, formFromViaje(viaje), viaje.id),
    close,
    destroy: () => {
      close();
      host.innerHTML = "";
    },
  };
}
