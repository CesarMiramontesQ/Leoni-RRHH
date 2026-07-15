import { getEmpleadosPage } from "../../api/empleados.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import {
  FALTA_RETARDO_TIPOS_GOCE,
  FALTA_RETARDO_TIPOS_NUEVO_REGISTRO,
  FALTA_RETARDO_TIPOS_RANGO,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  calcularRangoDefuncion,
  calcularRangoPaternidad,
  sumarDiasIso,
} from "../../solicitudes/rh/rhNewRequestDays.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import { esEmpleadoAdministrativo } from "../../utils/empleadoClasificacion.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import {
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "./rhFaltasRetardosPageStyles.ts";

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

const SEARCH_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400">
  <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/>
</svg>`;

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

function fechaFinFijaAuto(tipo: FaltaRetardoTipo | ""): boolean {
  return tipo === "matrimonio" || tipo === "defuncion" || tipo === "paternidad";
}

function applyRangoGoce(
  data: NuevaFaltaRetardoFormData,
  administrativo: boolean,
): NuevaFaltaRetardoFormData {
  if (!data.fechaEvento.trim()) return { ...data, fechaFin: "" };
  if (data.tipo === "matrimonio") {
    return { ...data, fechaFin: sumarDiasIso(data.fechaEvento, 1) };
  }
  if (data.tipo === "defuncion") {
    const rango = calcularRangoDefuncion(data.fechaEvento, administrativo);
    if (!rango) return data;
    return { ...data, fechaEvento: rango.fechaInicio, fechaFin: rango.fechaFin };
  }
  if (data.tipo === "paternidad") {
    const rango = calcularRangoPaternidad(data.fechaEvento);
    if (!rango) return data;
    return { ...data, fechaEvento: rango.fechaInicio, fechaFin: rango.fechaFin };
  }
  return data;
}

function hintRangoGoce(tipo: FaltaRetardoTipo | "", administrativo: boolean): string {
  if (tipo === "matrimonio") return "Matrimonio: duración fija de 2 días con goce de sueldo.";
  if (tipo === "defuncion") {
    return administrativo
      ? "Defunción: 3 días hábiles con goce. Si cruza fin de semana, se ajustan días hábiles."
      : "Defunción: duración fija de 3 días con goce de sueldo.";
  }
  if (tipo === "paternidad") {
    return "Paternidad: 7 días hábiles con goce. Si el inicio cae en fin de semana, se ajusta.";
  }
  if (tipo === "incapacidad_interna") {
    return "Incapacidad interna: indique el rango completo (fecha fin editable).";
  }
  return "";
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

function buildEmpleadoListboxHtml(opts: {
  items: readonly UsuarioListItem[];
  selectedId: string;
  highlightIndex: number;
  loading: boolean;
  query: string;
  open: boolean;
}): string {
  if (!opts.open) {
    return `<ul id="fr-empleado-listbox" role="listbox" hidden class="hidden" aria-label="Resultados de empleados"></ul>`;
  }
  const q = opts.query.trim();
  let body: string;
  if (q.length < 1) {
    body = `<li class="px-3 py-2.5 text-xs text-slate-500" role="presentation">Escribe al menos un carácter para buscar.</li>`;
  } else if (opts.loading) {
    body = `<li class="px-3 py-2.5 text-xs text-slate-500" role="presentation">Buscando…</li>`;
  } else if (opts.items.length === 0) {
    body = `<li class="px-3 py-2.5 text-xs text-slate-500" role="presentation">No se encontraron coincidencias.</li>`;
  } else {
    body = opts.items
      .map((u, i) => {
        const v = String(u.id);
        const active = i === opts.highlightIndex;
        const selected = v === opts.selectedId;
        const name = formatNombreEmpleadoUi(u.nombre).trim() || u.nombre.trim() || "Sin nombre";
        const no = formatNoEmpleadoDisplay(u.no_empleado);
        const area = u.area?.descripcion?.trim() || "—";
        const rowCls =
          active || selected
            ? "bg-leoni-blue/[0.08] text-slate-900"
            : "text-slate-800 hover:bg-slate-50";
        return `
        <li role="option" id="fr-empleado-opt-${i}" aria-selected="${active || selected ? "true" : "false"}">
          <button
            type="button"
            data-fr-empleado-pick="${escapeHtml(v)}"
            data-option-index="${i}"
            class="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${rowCls}"
          >
            <span class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
              ${escapeHtml(name.slice(0, 2).toUpperCase())}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">${escapeHtml(name)}</span>
              <span class="mt-0.5 block truncate text-xs text-slate-500">${escapeHtml(no)} · ${escapeHtml(area)}</span>
            </span>
            ${
              selected
                ? `<span class="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-white" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="currentColor" class="size-3"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.42-.007l-4-4a1 1 0 0 1 1.414-1.414l3.293 3.294 7.293-7.294a1 1 0 0 1 1.414.007Z" clip-rule="evenodd"/></svg>
                  </span>`
                : ""
            }
          </button>
        </li>`;
      })
      .join("");
  }
  return `
    <ul
      id="fr-empleado-listbox"
      role="listbox"
      aria-label="Resultados de empleados"
      class="absolute left-0 right-0 z-30 mt-1.5 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-md shadow-slate-900/10"
    >${body}</ul>`;
}

function buildEmpleadoSeleccionadoCardHtml(u: UsuarioListItem | null): string {
  if (!u) return "";
  const name = formatNombreEmpleadoUi(u.nombre).trim() || u.nombre.trim() || "Sin nombre";
  const no = formatNoEmpleadoDisplay(u.no_empleado);
  const area = u.area?.descripcion?.trim() || "—";
  return `
    <div class="flex items-start gap-3 rounded-xl border border-leoni-blue/25 bg-leoni-blue/[0.04] px-3.5 py-3" data-fr-empleado-selected>
      <span class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue/15 text-xs font-semibold text-leoni-blue">
        ${escapeHtml(name.slice(0, 2).toUpperCase())}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(name)}</p>
        <p class="mt-0.5 truncate text-xs text-slate-500">${escapeHtml(no)} · ${escapeHtml(area)}</p>
      </div>
      <button
        type="button"
        data-fr-empleado-clear
        class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
      >Cambiar</button>
    </div>`;
}

function buildFormHtml(
  data: NuevaFaltaRetardoFormData,
  errors: NuevaFaltaRetardoFormErrors,
  opts: {
    empleadoSearchQ: string;
    empleadosCache: readonly UsuarioListItem[];
    selectedEmpleado: UsuarioListItem | null;
    listboxOpen: boolean;
    highlightIndex: number;
    searchLoading: boolean;
    isSubmitting: boolean;
    empleadoAdministrativo?: boolean;
  },
): string {
  const rango = requiresRango(data.tipo);
  const esSuspension = data.tipo === "suspension";
  const esGoce = data.tipo !== "" && FALTA_RETARDO_TIPOS_GOCE.has(data.tipo);
  const finReadonly = fechaFinFijaAuto(data.tipo);
  const goceHint = hintRangoGoce(data.tipo, opts.empleadoAdministrativo === true);
  const tipoOptions = FALTA_RETARDO_TIPOS_NUEVO_REGISTRO.map(
    (t) =>
      `<option value="${t}" ${data.tipo === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`,
  ).join("");

  const listboxHtml = buildEmpleadoListboxHtml({
    items: opts.empleadosCache,
    selectedId: data.empleadoId,
    highlightIndex: opts.highlightIndex,
    loading: opts.searchLoading,
    query: opts.empleadoSearchQ,
    open: opts.listboxOpen,
  });
  const selectedCardHtml = buildEmpleadoSeleccionadoCardHtml(opts.selectedEmpleado);
  const activeDescendant =
    opts.listboxOpen && opts.highlightIndex >= 0
      ? ` aria-activedescendant="fr-empleado-opt-${opts.highlightIndex}"`
      : "";

  return `
    <form id="fr-nueva-form" class="space-y-4" novalidate>
      ${errors.form ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">${escapeHtml(errors.form)}</p>` : ""}
      <div class="space-y-3">
        <p class="text-xs text-slate-500">${escapeHtml(FR_COPY.modalEmpleadoAyuda)}</p>
        <div>
          <label class="${RH_LISTADO_LABEL}" for="fr-form-empleado-q">${escapeHtml(FR_COPY.filtroBusqueda)}</label>
          <div class="relative" data-fr-empleado-combobox>
            ${SEARCH_ICON}
            <input
              id="fr-form-empleado-q"
              type="search"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="${opts.listboxOpen ? "true" : "false"}"
              aria-controls="fr-empleado-listbox"
              ${activeDescendant}
              data-fr-empleado-search
              placeholder="${escapeHtml(FR_COPY.placeholderBusqueda)}"
              value="${escapeHtml(opts.empleadoSearchQ)}"
              class="${FR_FILTER_CONTROL} ${FIELD_FOCUS} pl-10"
              ${opts.isSubmitting ? "disabled" : ""}
            />
            ${listboxHtml}
          </div>
        </div>
        ${selectedCardHtml}
        <input type="hidden" name="empleado_id" id="fr-form-empleado-id" value="${escapeHtml(data.empleadoId)}" required />
        ${errors.empleadoId ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.empleadoId)}</p>` : ""}
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="fr-form-tipo">${escapeHtml(FR_COPY.filtroTipo)} *</label>
        <div class="grid grid-cols-1">
          <select id="fr-form-tipo" class="${RH_LISTADO_SELECT} ${SELECT_FILTER_EXTRA} ${FIELD_FOCUS}" required ${opts.isSubmitting ? "disabled" : ""}>
            <option value="">Seleccionar…</option>
            ${tipoOptions}
          </select>
          ${SELECT_CHEVRON}
        </div>
        ${errors.tipo ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.tipo)}</p>` : ""}
        ${esGoce && goceHint ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(goceHint)}</p>` : ""}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="${RH_LISTADO_LABEL}" for="fr-form-fecha">${rango ? "Fecha inicio *" : "Fecha del evento *"}</label>
          <input id="fr-form-fecha" type="date" class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaEvento)}" required ${opts.isSubmitting ? "disabled" : ""} />
          ${errors.fechaEvento ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.fechaEvento)}</p>` : ""}
        </div>
        <div id="fr-form-fecha-fin-wrap" class="${rango ? "" : "hidden"}">
          <label class="${RH_LISTADO_LABEL}" for="fr-form-fecha-fin">Fecha fin *</label>
          <input id="fr-form-fecha-fin" type="date" class="${FR_FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(data.fechaFin)}" ${rango ? "required" : ""} ${opts.isSubmitting || finReadonly ? "disabled" : ""} />
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
          ${opts.isSubmitting ? "disabled" : ""}
        >${escapeHtml(data.observaciones)}</textarea>
        ${esSuspension ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(FR_COPY.modalObsHintSuspension)}${data.observaciones.trim() ? ` · ${data.observaciones.trim().length}/30` : ""}</p>` : ""}
        ${errors.observaciones ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(errors.observaciones)}</p>` : ""}
      </div>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" id="fr-form-cancel" class="rh-sol-btn-secondary min-h-11 rounded px-4 text-sm font-medium" ${opts.isSubmitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" id="fr-form-submit" class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 px-4 text-sm font-semibold" ${opts.isSubmitting ? "disabled" : ""}>
          ${opts.isSubmitting ? escapeHtml(FR_COPY.modalGuardando) : escapeHtml(FR_COPY.modalGuardar)}
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
  let isSubmitting = false;

  let empleadosCache: UsuarioListItem[] = [];
  let selectedEmpleado: UsuarioListItem | null = null;
  let empleadoSearchQ = "";
  let empleadoListboxOpen = false;
  let empleadoHighlightIndex = -1;
  let empleadoSearchLoading = false;
  let empleadoSearchSeq = 0;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  const docListeners = new AbortController();

  function clearSearchTimer(): void {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
  }

  function resetEmpleadoCombobox(): void {
    clearSearchTimer();
    empleadosCache = [];
    selectedEmpleado = null;
    empleadoSearchQ = "";
    empleadoListboxOpen = false;
    empleadoHighlightIndex = -1;
    empleadoSearchLoading = false;
    empleadoSearchSeq += 1;
  }

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

  function syncEmpleadoListboxDom(): void {
    const wrap = body.querySelector("[data-fr-empleado-combobox]");
    const input = body.querySelector("#fr-form-empleado-q") as HTMLInputElement | null;
    if (!wrap) return;
    const html = buildEmpleadoListboxHtml({
      items: empleadosCache,
      selectedId: formData.empleadoId,
      highlightIndex: empleadoHighlightIndex,
      loading: empleadoSearchLoading,
      query: empleadoSearchQ,
      open: empleadoListboxOpen,
    });
    const existing = wrap.querySelector("#fr-empleado-listbox");
    if (existing) existing.outerHTML = html;
    else wrap.insertAdjacentHTML("beforeend", html);

    if (input) {
      input.setAttribute("aria-expanded", empleadoListboxOpen ? "true" : "false");
      if (empleadoListboxOpen && empleadoHighlightIndex >= 0) {
        input.setAttribute("aria-activedescendant", `fr-empleado-opt-${empleadoHighlightIndex}`);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }
  }

  function restoreEmpleadoSearchFocus(): void {
    const input = body.querySelector("#fr-form-empleado-q") as HTMLInputElement | null;
    input?.focus();
  }

  async function loadEmpleados(q: string): Promise<void> {
    const pg = await getEmpleadosPage({
      page: 1,
      page_size: 100,
      q: q.trim(),
      activo: true,
    });
    empleadosCache = pg.items;
  }

  function empleadoAdmin(): boolean {
    return esEmpleadoAdministrativo(selectedEmpleado?.clasificacion);
  }

  function render(): void {
    body.innerHTML = buildFormHtml(formData, errors, {
      empleadoSearchQ,
      empleadosCache,
      selectedEmpleado,
      listboxOpen: empleadoListboxOpen,
      highlightIndex: empleadoHighlightIndex,
      searchLoading: empleadoSearchLoading,
      isSubmitting,
      empleadoAdministrativo: empleadoAdmin(),
    });
    bindForm();
    setInsertandoOverlay(isSubmitting);
  }

  function onClearEmpleado(): void {
    formData = { ...formData, empleadoId: "" };
    selectedEmpleado = null;
    empleadoSearchQ = "";
    empleadoListboxOpen = false;
    empleadoHighlightIndex = -1;
    empleadoSearchSeq += 1;
    clearSearchTimer();
    if (errors.empleadoId) {
      const { empleadoId: _drop, ...rest } = errors;
      errors = rest;
    }
    render();
    restoreEmpleadoSearchFocus();
  }

  function aplicarSeleccionEmpleado(empleadoIdRaw: string): void {
    if (!empleadoIdRaw.trim()) {
      formData = { ...formData, empleadoId: "" };
      selectedEmpleado = null;
      render();
      return;
    }
    const id = Number.parseInt(empleadoIdRaw, 10);
    const picked =
      empleadosCache.find((u) => u.id === id) ??
      (selectedEmpleado?.id === id ? selectedEmpleado : null);
    formData = { ...formData, empleadoId: empleadoIdRaw };
    selectedEmpleado = picked;
    if (fechaFinFijaAuto(formData.tipo)) {
      formData = applyRangoGoce(formData, esEmpleadoAdministrativo(picked?.clasificacion));
    }
    empleadoSearchQ = "";
    empleadoListboxOpen = false;
    empleadoHighlightIndex = -1;
    if (errors.empleadoId) {
      const { empleadoId: _drop, ...rest } = errors;
      errors = rest;
    }
    render();
  }

  function close(): void {
    if (isSubmitting) return;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    formData = initialFormData();
    errors = {};
    isSubmitting = false;
    resetEmpleadoCombobox();
    setInsertandoOverlay(false);
    body.innerHTML = "";
  }

  function open(): void {
    formData = initialFormData();
    errors = {};
    isSubmitting = false;
    resetEmpleadoCombobox();
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
    const tipoSel = body.querySelector("#fr-form-tipo") as HTMLSelectElement | null;
    const fechaInp = body.querySelector("#fr-form-fecha") as HTMLInputElement | null;
    const fechaFinInp = body.querySelector("#fr-form-fecha-fin") as HTMLInputElement | null;
    const obsInp = body.querySelector("#fr-form-obs") as HTMLTextAreaElement | null;
    const qInput = body.querySelector("#fr-form-empleado-q") as HTMLInputElement | null;
    const cancelBtn = body.querySelector("#fr-form-cancel") as HTMLButtonElement | null;

    if (qInput) {
      qInput.addEventListener("input", () => {
        empleadoSearchQ = qInput.value;
        const q = qInput.value;
        empleadoListboxOpen = q.trim().length >= 1;
        empleadoHighlightIndex = -1;
        clearSearchTimer();
        if (!empleadoListboxOpen) {
          empleadoSearchLoading = false;
          empleadoSearchSeq += 1;
          syncEmpleadoListboxDom();
          return;
        }
        empleadoSearchLoading = true;
        syncEmpleadoListboxDom();
        const seq = ++empleadoSearchSeq;
        searchTimer = setTimeout(async () => {
          try {
            await loadEmpleados(q);
            if (seq !== empleadoSearchSeq) return;
            const live =
              (body.querySelector("#fr-form-empleado-q") as HTMLInputElement | null)?.value ?? "";
            if (live !== q) return;
            empleadoSearchLoading = false;
            empleadoListboxOpen = live.trim().length >= 1;
            empleadoHighlightIndex = empleadosCache.length > 0 ? 0 : -1;
            syncEmpleadoListboxDom();
          } catch {
            if (seq !== empleadoSearchSeq) return;
            empleadoSearchLoading = false;
            syncEmpleadoListboxDom();
            showEmpleadosToast(
              options.toastContainer,
              "No se pudo cargar el listado de empleados.",
              "error",
            );
          }
        }, 300);
      });

      qInput.addEventListener("keydown", (e: KeyboardEvent) => {
        const pool = empleadosCache;
        if (e.key === "Escape") {
          if (!empleadoListboxOpen) return;
          e.preventDefault();
          e.stopPropagation();
          empleadoListboxOpen = false;
          empleadoHighlightIndex = -1;
          syncEmpleadoListboxDom();
          return;
        }
        if (!empleadoListboxOpen || pool.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          empleadoHighlightIndex =
            empleadoHighlightIndex < 0
              ? 0
              : Math.min(pool.length - 1, empleadoHighlightIndex + 1);
          syncEmpleadoListboxDom();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          empleadoHighlightIndex =
            empleadoHighlightIndex <= 0 ? 0 : empleadoHighlightIndex - 1;
          syncEmpleadoListboxDom();
          return;
        }
        if (e.key === "Enter") {
          if (empleadoHighlightIndex < 0 || empleadoHighlightIndex >= pool.length) return;
          e.preventDefault();
          const picked = pool[empleadoHighlightIndex];
          if (!picked) return;
          aplicarSeleccionEmpleado(String(picked.id));
        }
      });

      const comboboxWrap = body.querySelector("[data-fr-empleado-combobox]");
      comboboxWrap?.addEventListener("mousedown", (e) => {
        const btn = (e.target as HTMLElement | null)?.closest?.(
          "[data-fr-empleado-pick]",
        ) as HTMLElement | null;
        if (!btn) return;
        e.preventDefault();
        const id = btn.getAttribute("data-fr-empleado-pick") ?? "";
        if (!id) return;
        aplicarSeleccionEmpleado(id);
      });
    }

    body.querySelector("[data-fr-empleado-clear]")?.addEventListener("click", onClearEmpleado);

    tipoSel?.addEventListener("change", () => {
      formData = { ...formData, tipo: tipoSel.value as FaltaRetardoTipo | "" };
      if (!requiresRango(formData.tipo)) formData = { ...formData, fechaFin: "" };
      else if (fechaFinFijaAuto(formData.tipo)) {
        formData = applyRangoGoce(formData, empleadoAdmin());
      }
      render();
    });
    fechaInp?.addEventListener("change", () => {
      formData = { ...formData, fechaEvento: fechaInp.value };
      if (fechaFinFijaAuto(formData.tipo)) {
        formData = applyRangoGoce(formData, empleadoAdmin());
        render();
      }
    });
    fechaFinInp?.addEventListener("change", () => {
      if (fechaFinFijaAuto(formData.tipo)) return;
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
  document.addEventListener(
    "mousedown",
    (e: MouseEvent) => {
      if (!empleadoListboxOpen) return;
      const wrap = body.querySelector("[data-fr-empleado-combobox]");
      if (!wrap || wrap.contains(e.target as Node)) return;
      empleadoListboxOpen = false;
      empleadoHighlightIndex = -1;
      syncEmpleadoListboxDom();
    },
    { signal: docListeners.signal },
  );

  return {
    open,
    close,
    destroy: () => {
      isSubmitting = false;
      clearSearchTimer();
      docListeners.abort();
      close();
      host.innerHTML = "";
    },
  };
}
