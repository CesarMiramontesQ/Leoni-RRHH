import { getEmpleadosPage } from "../../api/empleados.ts";
import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import {
  FALTA_RETARDO_TIPOS_GOCE,
  FALTA_RETARDO_TIPOS_NUEVO_REGISTRO,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import {
  calcularRangoDefuncion,
  calcularRangoMatrimonio,
  calcularRangoPaternidad,
  rangoIncluyeFinDeSemana,
  resumirRangoSinDescansos,
  sumarDiasIso,
} from "../../solicitudes/rh/rhNewRequestDays.ts";
import {
  buildDescansosFeedback,
  createDescansosEmpleadoController,
  tipoRequiereCalendarioDescansos,
  type DescansosLoadState,
} from "../../solicitudes/rh/descansosEmpleado.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "../../ui/uiTokens.ts";
import {
  bindWorkdayDatePicker,
  buildWorkdayDatePickerHtml,
  type WorkdayDatePickerHandle,
} from "../../ui/workdayDatePicker.ts";
import { esEmpleadoAdministrativo } from "../../utils/empleadoClasificacion.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";

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

/** Título de bloque (mismo lenguaje que Nueva solicitud). */
const SEC_TITLE = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500";

const SEC_BOX =
  "rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 shadow-sm shadow-slate-900/[0.02]";

const LABEL =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500";

const CONTROL =
  "h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/70 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";

const CONTROL_TEXTAREA =
  "min-h-[5.5rem] w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/70 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25 resize-y";

const CONTROL_INVALID = "border-red-400/90 focus:border-red-500 focus:ring-red-500/20";

const NR_SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2.5 size-4 self-center justify-self-end text-slate-400">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

const SEARCH_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400">
  <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/>
</svg>`;

function ctrlClass(invalid: boolean, extra = ""): string {
  return `${CONTROL} ${invalid ? CONTROL_INVALID : ""} ${extra}`.trim();
}

function textareaClass(invalid: boolean): string {
  return `${CONTROL_TEXTAREA} ${invalid ? CONTROL_INVALID : ""}`.trim();
}

function initialFormData(): NuevaFaltaRetardoFormData {
  return {
    empleadoId: "",
    tipo: "",
    fechaEvento: "",
    fechaFin: "",
    observaciones: "",
  };
}

function fechaFinFijaAuto(tipo: FaltaRetardoTipo | ""): boolean {
  return tipo === "matrimonio" || tipo === "defuncion" || tipo === "paternidad";
}

function applyRangoGoce(
  data: NuevaFaltaRetardoFormData,
  administrativo: boolean,
  descansos: ReadonlySet<string> = new Set(),
): NuevaFaltaRetardoFormData {
  if (!data.fechaEvento.trim()) return { ...data, fechaFin: "" };
  if (data.tipo === "matrimonio") {
    const rango = calcularRangoMatrimonio(data.fechaEvento, descansos);
    return rango
      ? { ...data, fechaEvento: rango.fechaInicio, fechaFin: rango.fechaFin }
      : { ...data, fechaFin: "" };
  }
  if (data.tipo === "defuncion") {
    const rango = calcularRangoDefuncion(data.fechaEvento, administrativo, descansos);
    if (!rango) return data;
    return { ...data, fechaEvento: rango.fechaInicio, fechaFin: rango.fechaFin };
  }
  if (data.tipo === "paternidad") {
    const rango = calcularRangoPaternidad(data.fechaEvento, descansos);
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

function fechaIsoEsFinDeSemana(iso: string): boolean {
  const t = iso.trim();
  if (!t) return false;
  return rangoIncluyeFinDeSemana(t, t);
}

/** Suspensión / incapacidad interna: admin no puede cruzar fin de semana. Goce fijo no: el rango se calcula y puede abarcar sáb/dom. */
function debeValidarFinDeSemanaAdmin(tipo: FaltaRetardoTipo | ""): boolean {
  return tipo !== "" && !fechaFinFijaAuto(tipo);
}

export function debeBloquearFinSemanaEnPicker(
  tipo: FaltaRetardoTipo | "",
  administrativo: boolean,
): boolean {
  return administrativo && debeValidarFinDeSemanaAdmin(tipo);
}

function formatFechaDisplay(iso: string): string {
  const t = iso.trim();
  if (!t) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function validateForm(
  data: NuevaFaltaRetardoFormData,
  administrativo: boolean,
  descansosState: DescansosLoadState = "ready",
  descansos: ReadonlySet<string> = new Set(),
): NuevaFaltaRetardoFormErrors {
  const errors: NuevaFaltaRetardoFormErrors = {};
  if (!data.empleadoId.trim()) errors.empleadoId = "Seleccione un empleado";
  if (!data.tipo) errors.tipo = "Seleccione el tipo de evento";
  if (!data.fechaEvento.trim()) errors.fechaEvento = "Indique la fecha de inicio";
  const requiereDescansos = tipoRequiereCalendarioDescansos(data.tipo);
  if (requiereDescansos && data.fechaEvento.trim() && descansos.has(data.fechaEvento)) {
    errors.fechaEvento = "La fecha inicial no puede ser un descanso.";
  }
  if (requiereDescansos && data.empleadoId.trim() && descansosState !== "ready") {
    errors.form =
      descansosState === "error"
        ? "No se pudieron consultar los descansos. Intenta de nuevo."
        : "Espera a que termine la consulta de descansos.";
  }
  if (fechaFinFijaAuto(data.tipo)) {
    if (data.fechaEvento.trim() && !data.fechaFin.trim()) {
      errors.fechaEvento = "No se pudo calcular la fecha fin; revise la fecha de inicio";
    }
  } else if (!data.fechaFin.trim()) {
    errors.fechaFin = "Indique la fecha fin del rango";
  } else if (data.fechaEvento.trim() && data.fechaFin < data.fechaEvento) {
    errors.fechaFin = "La fecha fin no puede ser anterior a la fecha inicio";
  }
  if (
    administrativo &&
    debeValidarFinDeSemanaAdmin(data.tipo) &&
    data.fechaEvento.trim() &&
    data.fechaFin.trim() &&
    !errors.fechaEvento &&
    !errors.fechaFin &&
    rangoIncluyeFinDeSemana(data.fechaEvento, data.fechaFin)
  ) {
    errors.fechaEvento = FR_COPY.modalFechasErrorFinDeSemana;
    errors.fechaFin = FR_COPY.modalFechasErrorFinDeSemana;
  }
  if (data.tipo === "suspension") {
    const motivo = data.observaciones.trim();
    if (!motivo) errors.observaciones = FR_COPY.modalObsRequeridaSuspension;
    else if (motivo.length > 30) errors.observaciones = FR_COPY.modalObsMaxSuspension;
  }
  if (
    (data.tipo === "suspension" || data.tipo === "incapacidad_interna") &&
    data.fechaEvento &&
    data.fechaFin &&
    descansosState === "ready" &&
    resumirRangoSinDescansos(data.fechaEvento, data.fechaFin, descansos).fechasEfectivas.length === 0
  ) {
    errors.fechaEvento = "El rango está compuesto únicamente por descansos.";
    errors.fechaFin = "El rango está compuesto únicamente por descansos.";
  }
  return errors;
}

function buildTipoSelectOptions(selected: FaltaRetardoTipo | ""): string {
  const disciplina = FALTA_RETARDO_TIPOS_NUEVO_REGISTRO.filter((t) => t === "suspension");
  const goce = FALTA_RETARDO_TIPOS_NUEVO_REGISTRO.filter((t) => FALTA_RETARDO_TIPOS_GOCE.has(t));
  const opt = (t: FaltaRetardoTipo) =>
    `<option value="${t}" ${selected === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`;
  return `
    <option value="">${escapeHtml(FR_COPY.modalTipoPlaceholder)}</option>
    ${
      disciplina.length > 0
        ? `<optgroup label="${escapeHtml(FR_COPY.modalOptgroupDisciplina)}">${disciplina.map(opt).join("")}</optgroup>`
        : ""
    }
    ${
      goce.length > 0
        ? `<optgroup label="${escapeHtml(FR_COPY.modalOptgroupGoce)}">${goce.map(opt).join("")}</optgroup>`
        : ""
    }
  `;
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

function buildFormFieldsHtml(
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
    descansosState: DescansosLoadState;
    descansosError: string;
    fechasDescansoExcluidas: readonly string[];
  },
): string {
  const esSuspension = data.tipo === "suspension";
  const esGoce = data.tipo !== "" && FALTA_RETARDO_TIPOS_GOCE.has(data.tipo);
  const finReadonly = fechaFinFijaAuto(data.tipo);
  const goceHint = hintRangoGoce(data.tipo, opts.empleadoAdministrativo === true);
  const requiereDescansos = tipoRequiereCalendarioDescansos(data.tipo);
  const descansosFeedback = requiereDescansos
    ? buildDescansosFeedback(
        opts.descansosState,
        opts.descansosError,
        opts.fechasDescansoExcluidas,
      )
    : buildDescansosFeedback("ready", "", []);

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
  const searchHidden = opts.selectedEmpleado != null;

  return `
    ${
      errors.form
        ? `<p class="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="assertive">${escapeHtml(errors.form)}</p>`
        : ""
    }

    <section class="${SEC_BOX} space-y-4" aria-labelledby="fr-nr-sec-empleado" data-fr-empleado-section>
      <h3 id="fr-nr-sec-empleado" class="${SEC_TITLE}">${escapeHtml(FR_COPY.modalSecEmpleado)}</h3>
      <p class="text-xs leading-relaxed text-slate-500">${escapeHtml(FR_COPY.modalEmpleadoAyuda)}</p>
      <div class="${searchHidden ? "hidden" : ""}">
        <label class="${LABEL}" for="fr-form-empleado-q">${escapeHtml(FR_COPY.filtroBusqueda)}</label>
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
            aria-invalid="${errors.empleadoId ? "true" : "false"}"
            ${activeDescendant}
            data-fr-empleado-search
            placeholder="${escapeHtml(FR_COPY.placeholderBusqueda)}"
            value="${escapeHtml(opts.empleadoSearchQ)}"
            class="${ctrlClass(Boolean(errors.empleadoId), "pl-10")}"
            ${opts.isSubmitting ? "disabled" : ""}
          />
          ${listboxHtml}
        </div>
      </div>
      ${selectedCardHtml}
      <input type="hidden" name="empleado_id" id="fr-form-empleado-id" value="${escapeHtml(data.empleadoId)}" required />
      ${errors.empleadoId ? `<p class="text-xs text-red-600">${escapeHtml(errors.empleadoId)}</p>` : ""}
    </section>

    <section class="space-y-3" aria-labelledby="fr-nr-sec-tipo">
      <h3 id="fr-nr-sec-tipo" class="${SEC_TITLE}">${escapeHtml(FR_COPY.modalSecTipo)}</h3>
      <div>
        <label class="${LABEL}" for="fr-form-tipo">${escapeHtml(FR_COPY.filtroTipo)}</label>
        <div class="grid grid-cols-1">
          <select
            id="fr-form-tipo"
            class="col-start-1 row-start-1 ${ctrlClass(Boolean(errors.tipo))} cursor-pointer appearance-none pr-10 font-medium"
            required
            aria-invalid="${errors.tipo ? "true" : "false"}"
            ${opts.isSubmitting ? "disabled" : ""}
          >
            ${buildTipoSelectOptions(data.tipo)}
          </select>
          ${NR_SELECT_CHEVRON}
        </div>
        ${errors.tipo ? `<p class="mt-1.5 text-xs text-red-600">${escapeHtml(errors.tipo)}</p>` : ""}
        ${
          esGoce && goceHint
            ? `<p class="mt-1.5 text-xs leading-relaxed text-slate-500">${escapeHtml(goceHint)}</p>`
            : ""
        }
      </div>
    </section>

    <section class="${SEC_BOX} space-y-4" aria-labelledby="fr-nr-sec-fechas">
      <div>
        <h3 id="fr-nr-sec-fechas" class="${SEC_TITLE}">${escapeHtml(FR_COPY.modalSecFechasRango)}</h3>
        <p class="mt-1.5 text-xs leading-relaxed text-slate-500">${escapeHtml(
          finReadonly ? FR_COPY.modalFechasHintGoceFijo : FR_COPY.modalFechasHintRango,
        )}</p>
        ${
          opts.empleadoAdministrativo === true && !finReadonly
            ? `<p class="mt-1.5 text-xs font-medium leading-relaxed text-slate-600">${escapeHtml(FR_COPY.modalFechasHintAdmin)}</p>`
            : ""
        }
      </div>
      <div data-fr-descansos-load-status>${descansosFeedback.loadHtml}</div>
      <div data-fr-descansos-effective-summary>${descansosFeedback.effectiveSummaryHtml}</div>
      <div class="grid grid-cols-1 gap-5 ${finReadonly ? "" : "sm:grid-cols-2 sm:gap-6"}">
        <div>
          <label class="${LABEL}" for="fr-form-fecha-trigger">Fecha inicio</label>
          ${buildWorkdayDatePickerHtml({
            inputId: "fr-form-fecha",
            value: data.fechaEvento,
            disabled: opts.isSubmitting,
            blockWeekends: debeBloquearFinSemanaEnPicker(
              data.tipo,
              opts.empleadoAdministrativo === true,
            ),
            invalid: Boolean(errors.fechaEvento),
            describedBy: errors.fechaEvento ? "fr-form-fecha-error" : undefined,
            align: "start",
          })}
          ${errors.fechaEvento ? `<p id="fr-form-fecha-error" class="mt-1.5 text-xs text-red-600">${escapeHtml(errors.fechaEvento)}</p>` : ""}
        </div>
        ${
          finReadonly
            ? `<div>
          <p class="${LABEL}">${escapeHtml(FR_COPY.modalFechaFinCalculada)}</p>
          <div class="flex h-11 items-center rounded-xl border border-slate-200/70 bg-slate-50/90 px-3.5 text-sm font-medium text-slate-700">
            ${escapeHtml(formatFechaDisplay(data.fechaFin))}
          </div>
          <input type="hidden" id="fr-form-fecha-fin" value="${escapeHtml(data.fechaFin)}" />
        </div>`
            : `<div id="fr-form-fecha-fin-wrap">
          <label class="${LABEL}" for="fr-form-fecha-fin-trigger">Fecha fin</label>
          ${buildWorkdayDatePickerHtml({
            inputId: "fr-form-fecha-fin",
            value: data.fechaFin,
            disabled: opts.isSubmitting,
            blockWeekends: debeBloquearFinSemanaEnPicker(
              data.tipo,
              opts.empleadoAdministrativo === true,
            ),
            invalid: Boolean(errors.fechaFin),
            describedBy: errors.fechaFin ? "fr-form-fecha-fin-error" : undefined,
            align: "end",
          })}
          ${errors.fechaFin ? `<p id="fr-form-fecha-fin-error" class="mt-1.5 text-xs text-red-600">${escapeHtml(errors.fechaFin)}</p>` : ""}
        </div>`
        }
      </div>
    </section>

    <section class="space-y-3" aria-labelledby="fr-nr-sec-obs">
      <div class="flex items-baseline justify-between gap-3">
        <h3 id="fr-nr-sec-obs" class="${SEC_TITLE} !mb-0">${escapeHtml(FR_COPY.modalSecObservaciones)}</h3>
        ${esSuspension ? `<span class="text-[11px] font-medium text-slate-400">Requerido</span>` : ""}
      </div>
      <div>
        <label class="sr-only" for="fr-form-obs">${escapeHtml(FR_COPY.colObservaciones)}</label>
        <textarea
          id="fr-form-obs"
          rows="3"
          class="${textareaClass(Boolean(errors.observaciones))}"
          placeholder="${esSuspension ? escapeHtml(FR_COPY.modalObsHintSuspension) : escapeHtml(FR_COPY.modalObsPlaceholder)}"
          aria-invalid="${errors.observaciones ? "true" : "false"}"
          ${esSuspension ? 'maxlength="30"' : ""}
          ${opts.isSubmitting ? "disabled" : ""}
        >${escapeHtml(data.observaciones)}</textarea>
        ${
          esSuspension
            ? `<p data-fr-obs-hint class="mt-1.5 text-xs text-slate-500">${escapeHtml(FR_COPY.modalObsHintSuspension)}${
                data.observaciones.trim() ? ` · ${data.observaciones.trim().length}/30` : ""
              }</p>`
            : ""
        }
        ${errors.observaciones ? `<p class="mt-1.5 text-xs text-red-600">${escapeHtml(errors.observaciones)}</p>` : ""}
      </div>
    </section>
  `;
}

function buildFooterHtml(isSubmitting: boolean, descansosBloquean: boolean): string {
  return `
    <button type="button" id="fr-form-cancel" class="${RH_SOLICITUDES_BTN_SECONDARY} min-h-11 px-4" ${isSubmitting ? "disabled" : ""}>${escapeHtml(FR_COPY.modalCancelar)}</button>
    <button type="submit" id="fr-form-submit" class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-11 px-5" ${isSubmitting || descansosBloquean ? "disabled" : ""}>
      ${isSubmitting ? escapeHtml(FR_COPY.modalGuardando) : escapeHtml(FR_COPY.modalGuardar)}
    </button>
  `;
}

export function mountNuevaFaltaRetardoModal(
  host: HTMLElement,
  options: NuevaFaltaRetardoModalOptions,
): NuevaFaltaRetardoModalHandle {
  host.innerHTML = `
    <div id="fr-nueva-modal-overlay" class="fixed inset-0 z-[61] hidden items-center justify-center bg-slate-900/40 p-4 sm:p-5 backdrop-blur-[3px]" role="presentation">
      <div id="fr-nueva-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fr-nueva-modal-title" aria-describedby="fr-nueva-modal-subtitle"
        class="relative flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] [color-scheme:light]">
        <header class="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <h2 id="fr-nueva-modal-title" class="text-xl font-bold tracking-tight text-slate-900">${escapeHtml(FR_COPY.modalTitulo)}</h2>
              <p id="fr-nueva-modal-subtitle" class="mt-2 max-w-md text-sm leading-relaxed text-slate-500">${escapeHtml(FR_COPY.modalSubtitulo)}</p>
            </div>
            <button type="button" id="fr-nueva-modal-close" class="-m-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2" aria-label="${escapeHtml(FR_COPY.modalCerrar)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </div>
        </header>
        <form id="fr-nueva-form" class="flex min-h-0 flex-1 flex-col overflow-hidden" novalidate>
          <div id="fr-nueva-modal-body" class="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6 sm:py-7"></div>
          <div id="fr-nueva-modal-footer" class="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6"></div>
        </form>
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
  const footer = host.querySelector("#fr-nueva-modal-footer") as HTMLElement;
  const formEl = host.querySelector("#fr-nueva-form") as HTMLFormElement;
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
  let datePickerListeners = new AbortController();
  const descansosController = createDescansosEmpleadoController();

  function descansosCargados(): Set<string> {
    return descansosController.getLoadedDates();
  }

  function fechasDescansoExcluidas(): string[] {
    if (
      !formData.fechaEvento ||
      !formData.fechaFin ||
      (formData.tipo !== "suspension" && formData.tipo !== "incapacidad_interna")
    ) {
      return [];
    }
    return resumirRangoSinDescansos(
      formData.fechaEvento,
      formData.fechaFin,
      descansosCargados(),
    ).fechasExcluidas;
  }

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
    const requiereDescansos = tipoRequiereCalendarioDescansos(formData.tipo);
    body.innerHTML = buildFormFieldsHtml(formData, errors, {
      empleadoSearchQ,
      empleadosCache,
      selectedEmpleado,
      listboxOpen: empleadoListboxOpen,
      highlightIndex: empleadoHighlightIndex,
      searchLoading: empleadoSearchLoading,
      isSubmitting,
      empleadoAdministrativo: empleadoAdmin(),
      descansosState: requiereDescansos ? descansosController.getState() : "ready",
      descansosError: descansosController.getError(),
      fechasDescansoExcluidas: fechasDescansoExcluidas(),
    });
    footer.innerHTML = buildFooterHtml(
      isSubmitting,
      requiereDescansos &&
        formData.empleadoId.trim() !== "" &&
        descansosController.getState() !== "ready",
    );
    bindForm();
    setInsertandoOverlay(isSubmitting);
  }

  function onClearEmpleado(): void {
    formData = { ...formData, empleadoId: "", fechaEvento: "", fechaFin: "" };
    descansosController.setEmpleado(null);
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
    formData = { ...formData, empleadoId: empleadoIdRaw, fechaEvento: "", fechaFin: "" };
    descansosController.setEmpleado(Number.isFinite(id) ? id : null);
    selectedEmpleado = picked;
    const admin = esEmpleadoAdministrativo(picked?.clasificacion);
    if (admin && debeValidarFinDeSemanaAdmin(formData.tipo)) {
      const nextErrors: NuevaFaltaRetardoFormErrors = { ...errors };
      if (fechaIsoEsFinDeSemana(formData.fechaEvento)) {
        formData = { ...formData, fechaEvento: "", fechaFin: "" };
        nextErrors.fechaEvento = FR_COPY.modalFechasErrorFinDeSemana;
      } else if (
        formData.fechaEvento.trim() &&
        formData.fechaFin.trim() &&
        rangoIncluyeFinDeSemana(formData.fechaEvento, formData.fechaFin)
      ) {
        formData = { ...formData, fechaEvento: "", fechaFin: "" };
        nextErrors.fechaEvento = FR_COPY.modalFechasErrorFinDeSemana;
        nextErrors.fechaFin = FR_COPY.modalFechasErrorFinDeSemana;
      }
      errors = nextErrors;
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
    descansosController.setEmpleado(null);
    errors = {};
    isSubmitting = false;
    resetEmpleadoCombobox();
    setInsertandoOverlay(false);
    body.innerHTML = "";
    footer.innerHTML = "";
  }

  function open(): void {
    formData = initialFormData();
    descansosController.setEmpleado(null);
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
    if (fechaFinFijaAuto(formData.tipo)) {
      formData = applyRangoGoce(formData, empleadoAdmin(), descansosCargados());
    }
    errors = validateForm(
      formData,
      empleadoAdmin(),
      descansosController.getState(),
      descansosCargados(),
    );
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
      payload.fecha_fin = fechaFinFijaAuto(formData.tipo)
        ? applyRangoGoce(formData, empleadoAdmin(), new Set()).fechaFin
        : formData.fechaFin;
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
    datePickerListeners.abort();
    datePickerListeners = new AbortController();
    const dateSignal = datePickerListeners.signal;

    const tipoSel = body.querySelector("#fr-form-tipo") as HTMLSelectElement | null;
    const obsInp = body.querySelector("#fr-form-obs") as HTMLTextAreaElement | null;
    const qInput = body.querySelector("#fr-form-empleado-q") as HTMLInputElement | null;
    const cancelBtn = footer.querySelector("#fr-form-cancel") as HTMLButtonElement | null;

    let inicioHandle: WorkdayDatePickerHandle | null = null;
    let finHandle: WorkdayDatePickerHandle | null = null;

    function syncDescansosDom(): void {
      const requiereDescansos = tipoRequiereCalendarioDescansos(formData.tipo);
      const dates = requiereDescansos ? descansosCargados() : new Set<string>();
      inicioHandle?.setBlockedDates(dates);
      finHandle?.setBlockedDates(dates);
      if (requiereDescansos) {
        const loadedMonths = descansosController.getLoadedMonths();
        inicioHandle?.setLoadedMonths(loadedMonths);
        finHandle?.setLoadedMonths(loadedMonths);
      }
      const status = body.querySelector(
        "[data-fr-descansos-load-status]",
      ) as HTMLElement | null;
      const state = requiereDescansos ? descansosController.getState() : "ready";
      if (status) {
        status.innerHTML = buildDescansosFeedback(
          state,
          descansosController.getError(),
          [],
        ).loadHtml;
      }
      const submit = footer.querySelector("#fr-form-submit") as HTMLButtonElement | null;
      if (submit && !isSubmitting) {
        submit.disabled =
          requiereDescansos && formData.empleadoId.trim() !== "" && state !== "ready";
      }
    }

    async function cargarMes(
      year: number,
      monthIndex: number,
      handle: WorkdayDatePickerHandle | null,
    ): Promise<void> {
      if (!tipoRequiereCalendarioDescansos(formData.tipo)) return;
      if (!formData.empleadoId) return;
      const request = descansosController.loadVisibleMonths(year, monthIndex);
      syncDescansosDom();
      try {
        await request;
        handle?.setBlockedDates(descansosCargados());
      } catch {
        // El estado y mensaje inline quedan en el controlador.
      }
      syncDescansosDom();
    }

    async function onFechaInicioChange(next: string): Promise<void> {
      if (
        empleadoAdmin() &&
        debeValidarFinDeSemanaAdmin(formData.tipo) &&
        fechaIsoEsFinDeSemana(next)
      ) {
        formData = {
          ...formData,
          fechaEvento: "",
          fechaFin: formData.fechaFin,
        };
        errors = { ...errors, fechaEvento: FR_COPY.modalFechasErrorFinDeSemana };
        render();
        return;
      }
      formData = { ...formData, fechaEvento: next };
      if (!tipoRequiereCalendarioDescansos(formData.tipo)) {
        render();
        return;
      }
      const empleadoAlIniciar = formData.empleadoId;
      const fechaHorizonte = fechaFinFijaAuto(formData.tipo)
        ? sumarDiasIso(next, 365)
        : next;
      const request = descansosController.loadRange(next, fechaHorizonte || next);
      syncDescansosDom();
      try {
        await request;
      } catch {
        if (formData.empleadoId === empleadoAlIniciar) render();
        return;
      }
      if (formData.empleadoId !== empleadoAlIniciar || formData.fechaEvento !== next) return;
      if (descansosCargados().has(next)) {
        formData = { ...formData, fechaEvento: "", fechaFin: "" };
        errors = { ...errors, fechaEvento: "La fecha inicial no puede ser un descanso." };
        render();
        return;
      }
      if (fechaFinFijaAuto(formData.tipo)) {
        formData = applyRangoGoce(formData, empleadoAdmin(), descansosCargados());
      }
      if (
        empleadoAdmin() &&
        debeValidarFinDeSemanaAdmin(formData.tipo) &&
        formData.fechaEvento.trim() &&
        formData.fechaFin.trim() &&
        rangoIncluyeFinDeSemana(formData.fechaEvento, formData.fechaFin)
      ) {
        errors = {
          ...errors,
          fechaEvento: FR_COPY.modalFechasErrorFinDeSemana,
          fechaFin: FR_COPY.modalFechasErrorFinDeSemana,
        };
        render();
        return;
      }
      if (
        errors.fechaEvento === FR_COPY.modalFechasErrorFinDeSemana ||
        errors.fechaFin === FR_COPY.modalFechasErrorFinDeSemana
      ) {
        const nextErr = { ...errors };
        delete nextErr.fechaEvento;
        delete nextErr.fechaFin;
        errors = nextErr;
      }
      render();
    }

    async function onFechaFinChange(next: string): Promise<void> {
      if (fechaFinFijaAuto(formData.tipo)) return;
      if (empleadoAdmin() && fechaIsoEsFinDeSemana(next)) {
        formData = { ...formData, fechaFin: "" };
        errors = { ...errors, fechaFin: FR_COPY.modalFechasErrorFinDeSemana };
        render();
        return;
      }
      formData = { ...formData, fechaFin: next };
      if (
        tipoRequiereCalendarioDescansos(formData.tipo) &&
        formData.fechaEvento &&
        next >= formData.fechaEvento
      ) {
        const empleadoAlIniciar = formData.empleadoId;
        const request = descansosController.loadRange(formData.fechaEvento, next);
        syncDescansosDom();
        try {
          await request;
        } catch {
          if (formData.empleadoId === empleadoAlIniciar) render();
          return;
        }
        if (formData.empleadoId !== empleadoAlIniciar || formData.fechaFin !== next) return;
      }
      if (
        empleadoAdmin() &&
        formData.fechaEvento.trim() &&
        formData.fechaFin.trim() &&
        rangoIncluyeFinDeSemana(formData.fechaEvento, formData.fechaFin)
      ) {
        errors = {
          ...errors,
          fechaEvento: FR_COPY.modalFechasErrorFinDeSemana,
          fechaFin: FR_COPY.modalFechasErrorFinDeSemana,
        };
        render();
        return;
      }
      if (
        errors.fechaFin === FR_COPY.modalFechasErrorFinDeSemana ||
        errors.fechaEvento === FR_COPY.modalFechasErrorFinDeSemana
      ) {
        const nextErr = { ...errors };
        delete nextErr.fechaFin;
        delete nextErr.fechaEvento;
        errors = nextErr;
      }
      render();
    }

    const pickers = body.querySelectorAll<HTMLElement>("[data-workday-date-picker]");
    const inicioPicker = pickers[0];
    const finPicker = pickers[1];
    const requiereDescansosPicker = tipoRequiereCalendarioDescansos(formData.tipo);
    const blockedForPicker = requiereDescansosPicker ? descansosCargados() : new Set<string>();
    if (inicioPicker) {
      inicioHandle = bindWorkdayDatePicker(inicioPicker, {
        onChange: (iso) => void onFechaInicioChange(iso),
        blockedDates: blockedForPicker,
        ...(requiereDescansosPicker
          ? { loadedMonths: descansosController.getLoadedMonths() }
          : {}),
        onMonthChange: (year, monthIndex) => cargarMes(year, monthIndex, inicioHandle),
        signal: dateSignal,
      });
    }
    if (finPicker && !fechaFinFijaAuto(formData.tipo)) {
      finHandle = bindWorkdayDatePicker(finPicker, {
        onChange: (iso) => void onFechaFinChange(iso),
        blockedDates: blockedForPicker,
        ...(requiereDescansosPicker
          ? { loadedMonths: descansosController.getLoadedMonths() }
          : {}),
        onMonthChange: (year, monthIndex) => cargarMes(year, monthIndex, finHandle),
        signal: dateSignal,
      });
    }

    if (requiereDescansosPicker && formData.empleadoId.trim()) {
      const now = new Date();
      void cargarMes(now.getFullYear(), now.getMonth(), inicioHandle);
    }

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
      if (fechaFinFijaAuto(formData.tipo)) {
        formData = applyRangoGoce(formData, empleadoAdmin(), descansosCargados());
      }
      render();
    });
    obsInp?.addEventListener("input", () => {
      formData = { ...formData, observaciones: obsInp.value };
      if (formData.tipo === "suspension") {
        const hint = body.querySelector("[data-fr-obs-hint]");
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
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    void handleSubmit();
  });

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
      datePickerListeners.abort();
      docListeners.abort();
      close();
      host.innerHTML = "";
    },
  };
}
