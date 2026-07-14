import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import {
  FALTA_RETARDO_TIPOS_NUEVO_REGISTRO,
  FALTA_RETARDO_TIPOS_RANGO,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import {
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhFaltasRetardosPageStyles.ts";

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

const FR_FILTER_CONTROL =
  "rh-sol-filter-input min-h-11 w-full rounded-[12px] border border-[rgba(148,163,184,0.34)] bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(37,99,235,0.38)] hover:bg-[#fafbfc]";

const SELECT_FILTER_EXTRA =
  "rh-sol-filter-select min-h-11 rounded-[12px] border-[rgba(148,163,184,0.34)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]";

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
  if (data.tipo === "suspension") {
    const motivo = data.observaciones.trim();
    if (!motivo) errors.observaciones = FR_COPY.modalObsRequeridaSuspension;
    else if (motivo.length > 30) errors.observaciones = FR_COPY.modalObsMaxSuspension;
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
  const esSuspension = data.tipo === "suspension";
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

  const tipoOptions = FALTA_RETARDO_TIPOS_NUEVO_REGISTRO.map(
    (t) =>
      `<option value="${t}" ${data.tipo === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`,
  ).join("");

  return `
    <form id="fr-nueva-form" class="space-y-4" novalidate>
      ${errors.form ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">${escapeHtml(errors.form)}</p>` : ""}
      <div>
        <label class="${RH_LISTADO_LABEL}" for="fr-form-empleado-search">${escapeHtml(FR_COPY.filtroBusqueda)}</label>
        <input id="fr-form-empleado-search" type="text" inputmode="search" autocomplete="off" dir="ltr" class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}" placeholder="${escapeHtml(FR_COPY.placeholderBusqueda)}" value="${escapeHtml(empleadoSearch)}" />
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="fr-form-empleado">Empleado *</label>
        <div class="grid grid-cols-1">
          <select id="fr-form-empleado" class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}" required>
            <option value="">Seleccionar…</option>
            ${empleadoOptions}
          </select>
          ${SELECT_CHEVRON}
        </div>
        ${errors.empleadoId ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.empleadoId)}</p>` : ""}
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="fr-form-tipo">${escapeHtml(FR_COPY.filtroTipo)} *</label>
        <div class="grid grid-cols-1">
          <select id="fr-form-tipo" class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}" required>
            <option value="">Seleccionar…</option>
            ${tipoOptions}
          </select>
          ${SELECT_CHEVRON}
        </div>
        ${errors.tipo ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.tipo)}</p>` : ""}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="${RH_LISTADO_LABEL}" for="fr-form-fecha">${rango ? "Fecha inicio *" : "Fecha del evento *"}</label>
          <input id="fr-form-fecha" type="date" class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaEvento)}" required />
          ${errors.fechaEvento ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.fechaEvento)}</p>` : ""}
        </div>
        <div id="fr-form-fecha-fin-wrap" class="${rango ? "" : "hidden"}">
          <label class="${RH_LISTADO_LABEL}" for="fr-form-fecha-fin">Fecha fin *</label>
          <input id="fr-form-fecha-fin" type="date" class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaFin)}" ${rango ? "required" : ""} />
          ${errors.fechaFin ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.fechaFin)}</p>` : ""}
        </div>
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="fr-form-obs">${escapeHtml(FR_COPY.colObservaciones)}${esSuspension ? " *" : ""}</label>
        <textarea
          id="fr-form-obs"
          rows="3"
          class="${FR_FILTER_CONTROL} ${FIELD_FOCUS} resize-y"
          placeholder="${esSuspension ? escapeHtml(FR_COPY.modalObsHintSuspension) : "Comentarios u observaciones…"}"
          ${esSuspension ? 'maxlength="30"' : ""}
          ${isSubmitting ? "disabled" : ""}
        >${escapeHtml(data.observaciones)}</textarea>
        ${esSuspension ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(FR_COPY.modalObsHintSuspension)}${data.observaciones.trim() ? ` · ${data.observaciones.trim().length}/30` : ""}</p>` : ""}
        ${errors.observaciones ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.observaciones)}</p>` : ""}
      </div>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" id="fr-form-cancel" class="rh-sol-btn-secondary min-h-11 rounded px-4 text-sm font-medium" ${isSubmitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" id="fr-form-submit" class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 px-4 text-sm font-semibold" ${isSubmitting ? "disabled" : ""}>
          ${isSubmitting ? escapeHtml(FR_COPY.modalGuardando) : escapeHtml(FR_COPY.modalGuardar)}
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
    <div id="fr-nueva-modal-overlay" class="fixed inset-0 z-[61] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6 backdrop-blur-[2px]" role="presentation">
      <div id="fr-nueva-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fr-nueva-modal-title"
        class="relative flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)] [color-scheme:light]">
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="fr-nueva-modal-title" class="text-base font-bold text-slate-900 sm:text-lg">${escapeHtml(FR_COPY.modalTitulo)}</h2>
          <button type="button" id="fr-nueva-modal-close" class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2" aria-label="${escapeHtml(FR_COPY.modalCerrar)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </header>
        <div id="fr-nueva-modal-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"></div>
        <div
          id="fr-nueva-insertando"
          class="absolute inset-0 z-10 hidden flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="false"
        >
          <svg class="size-8 animate-spin text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p id="fr-nueva-insertando-title" class="text-base font-semibold text-[var(--color-primary)]">${escapeHtml(FR_COPY.modalInsertandoTitulo)}</p>
          <p id="fr-nueva-insertando-hint" class="max-w-xs text-sm text-slate-500">${escapeHtml(FR_COPY.modalInsertandoHint)}</p>
        </div>
      </div>
    </div>
  `;

  const overlay = host.querySelector("#fr-nueva-modal-overlay") as HTMLElement;
  const body = host.querySelector("#fr-nueva-modal-body") as HTMLElement;
  const closeBtn = host.querySelector("#fr-nueva-modal-close") as HTMLButtonElement;
  const insertandoEl = host.querySelector("#fr-nueva-insertando") as HTMLElement;
  const insertandoTitle = host.querySelector("#fr-nueva-insertando-title") as HTMLElement;
  const insertandoHint = host.querySelector("#fr-nueva-insertando-hint") as HTMLElement;

  let formData = initialFormData();
  let errors: NuevaFaltaRetardoFormErrors = {};
  let empleadoSearch = "";
  let isSubmitting = false;

  function setInsertandoOverlay(on: boolean): void {
    insertandoEl.classList.toggle("hidden", !on);
    insertandoEl.classList.toggle("flex", on);
    insertandoEl.setAttribute("aria-busy", on ? "true" : "false");
    closeBtn.disabled = on;
    if (on) {
      insertandoTitle.textContent = FR_COPY.modalInsertandoTitulo;
      insertandoHint.textContent =
        formData.tipo === "suspension"
          ? FR_COPY.modalInsertandoHintSuspension
          : FR_COPY.modalInsertandoHint;
    }
  }

  function render(): void {
    body.innerHTML = buildFormHtml(formData, errors, options.empleados, empleadoSearch, isSubmitting);
    bindForm();
    setInsertandoOverlay(isSubmitting);
  }

  function close(): void {
    if (isSubmitting) return;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    formData = initialFormData();
    errors = {};
    empleadoSearch = "";
    isSubmitting = false;
    setInsertandoOverlay(false);
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
    if (isSubmitting) return;
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
      showEmpleadosToast(options.toastContainer, FR_COPY.modalExito, "success");
      isSubmitting = false;
      setInsertandoOverlay(false);
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
      const start = searchInp.selectionStart ?? empleadoSearch.length;
      const end = searchInp.selectionEnd ?? empleadoSearch.length;
      const dir =
        searchInp.selectionDirection === "backward"
          ? "backward"
          : searchInp.selectionDirection === "none"
            ? "none"
            : "forward";
      render();
      const nextSearch = body.querySelector("#fr-form-empleado-search") as HTMLInputElement | null;
      if (!nextSearch) return;
      nextSearch.focus();
      try {
        nextSearch.setSelectionRange(start, end, dir);
      } catch {
        /* noop: algunos navegadores restringen setSelectionRange en type=search */
      }
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
      if (formData.tipo === "suspension") {
        const hint = obsInp.parentElement?.querySelector("p.text-slate-500");
        if (hint) {
          const len = formData.observaciones.trim().length;
          hint.textContent = len
            ? `${FR_COPY.modalObsHintSuspension} · ${len}/30`
            : FR_COPY.modalObsHintSuspension;
        }
      }
    });
    cancelBtn?.addEventListener("click", () => {
      if (!isSubmitting) close();
    });
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void handleSubmit();
    });
  }

  closeBtn.addEventListener("click", () => {
    if (!isSubmitting) close();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && !isSubmitting) close();
  });

  return {
    open,
    close,
    destroy: () => {
      isSubmitting = false;
      close();
      host.innerHTML = "";
    },
  };
}
