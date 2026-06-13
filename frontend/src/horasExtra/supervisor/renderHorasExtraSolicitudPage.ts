import type {
  HorasExtraEmpleadoOption,
  HorasExtraSolicitudListItem,
  HorasExtraSolicitudOpciones,
  HorasExtraSolicitudResponse,
  HorasExtraTipoSolicitud,
} from "../../api/horasExtraSolicitud.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_PRIMARY,
  BTN_SECONDARY,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  renderHorasExtraDetalleModal,
  type HorasExtraDetalleAprobacionesState,
  type HorasExtraDetalleModalState,
} from "../shared/renderHorasExtraDetalleModal.ts";

export type HorasExtraEmpleadoFilaForm = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
  domingo: string;
};

export type HorasExtraSolicitudEstadisticasVm = {
  total_solicitudes: number;
  pendientes: number;
  aprobadas: number;
  total_horas: number;
};

export type HorasExtraSolicitudPageState = {
  opciones: HorasExtraSolicitudOpciones | null;
  opcionesStatus: "loading" | "ready" | "error";
  opcionesError?: string;
  estadisticas: HorasExtraSolicitudEstadisticasVm | null;
  estadisticasStatus: "loading" | "ready" | "error";
  estadisticasError?: string;
  lista: HorasExtraSolicitudListItem[];
  listaStatus: "loading" | "ready" | "error";
  listaError?: string;
  listaTotal: number;
  listaPage: number;
  listaPageSize: number;
  formError?: string;
  listaSuccess?: string;
  submitting: boolean;
  detalleAbierto: HorasExtraSolicitudResponse | null;
  detalleStatus: "idle" | "loading" | "error";
  detalleError?: string;
  detalleAprobaciones?: HorasExtraDetalleAprobacionesState;
  empleadosFilas: HorasExtraEmpleadoFilaForm[];
  selectedEmpleadoId: number | null;
  formSemana: number;
  formTipo: HorasExtraTipoSolicitud;
  formMotivo: string;
  solicitudModalOpen: boolean;
};

const FORM_SECTION_LABEL =
  "mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500";
const FORM_TEXTAREA =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";
const FORM_SELECT_WRAP = "relative grid grid-cols-1";
const FORM_SELECT = `col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25`;
const FORM_ALERT_ERROR =
  "rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800";
const FORM_SECTION_DIVIDER = "border-t border-slate-200/90";
const FORM_META_PANEL =
  "rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4";
const FORM_CAPTURE_PANEL =
  "rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)] sm:p-5";
const FORM_RESUMEN_CARD =
  "rounded-lg border border-slate-200/90 bg-slate-50/60 px-3.5 py-3 sm:px-4";

const DIAS = [
  ["lunes", "Lun"],
  ["martes", "Mar"],
  ["miercoles", "Mié"],
  ["jueves", "Jue"],
  ["viernes", "Vie"],
  ["sabado", "Sáb"],
  ["domingo", "Dom"],
] as const;

export type DiaColumnaHoras = {
  key: (typeof DIAS)[number][0];
  label: string;
  labelCorto: string;
  abrev: string;
  diaMes: string;
};

export type HorasGridVariant = "captura" | "consulta";

export function formatHorasCaptura(value: number): string {
  return value.toFixed(1);
}

const NOMBRES_DIA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

const ABREV_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const HORAS_GRID_SCROLL =
  "max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200/90 bg-white";
const HORAS_GRID_TABLE_CAPTURA = "w-full min-w-[36rem] table-fixed divide-y divide-slate-100 text-center";
const HORAS_GRID_TABLE_CONSULTA = "w-full min-w-[48rem] table-fixed divide-y divide-slate-100 text-left";
const HORAS_GRID_INPUT =
  "he-sup-hora-input w-full rounded border border-slate-200 bg-white px-1 py-2 text-center text-sm font-medium tabular-nums text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow] duration-150 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";
const HORAS_GRID_TOTAL_COL = "bg-slate-100/90";
const HORAS_GRID_TOTAL_CELL = "bg-slate-50/90 font-semibold text-[#0A1628]";

const HE_SUP_DETALLE_MODAL_CONFIG = {
  backdropId: "he-sup-detalle-backdrop",
  titleId: "he-sup-detalle-title",
  closeDataAttr: "he-detalle-cerrar",
} as const;

export function lunesDeSemanaIso(anio: number, semana: number): Date {
  const jan4 = new Date(anio, 0, 4);
  const diaSemana = jan4.getDay() || 7;
  const lunes = new Date(jan4);
  lunes.setDate(jan4.getDate() - (diaSemana - 1) + (semana - 1) * 7);
  return lunes;
}

export function buildDiasColumnasHoras(options: {
  semana?: number;
  anio?: number;
  semanaInicio?: string;
}): DiaColumnaHoras[] {
  let lunes: Date;
  if (options.semanaInicio) {
    const [y, m, d] = options.semanaInicio.split("-").map((v) => Number.parseInt(v, 10));
    lunes = new Date(y, (m ?? 1) - 1, d ?? 1);
  } else {
    const anio = options.anio ?? new Date().getFullYear();
    lunes = lunesDeSemanaIso(anio, options.semana ?? 1);
  }

  return DIAS.map(([key], index) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + index);
    const diaMes = String(fecha.getDate()).padStart(2, "0");
    return {
      key,
      label: `${NOMBRES_DIA[index]} ${diaMes}`,
      labelCorto: `${ABREV_DIA[index]} ${diaMes}`,
      abrev: ABREV_DIA[index]!,
      diaMes,
    };
  });
}

function estadoBadge(estado: string): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  if (estado === "cancelado") return badgeCancelled("Cancelado");
  if (estado === "borrador") return badgePending("Borrador");
  return badgePending("Pendiente");
}

export function tipoLabel(tipo: string): string {
  return tipo === "espontaneo" ? "Espontánea" : "Planeada";
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function sumFila(fila: HorasExtraEmpleadoFilaForm): number {
  return DIAS.reduce((acc, [key]) => acc + (Number.parseFloat(fila[key]) || 0), 0);
}

export function getSemanasPermitidas(semanaActual: number): number[] {
  const semanas: number[] = [];
  if (semanaActual > 1) {
    semanas.push(semanaActual - 1);
  }
  semanas.push(semanaActual);
  for (let offset = 1; offset <= 4; offset += 1) {
    const futura = semanaActual + offset;
    if (futura <= 53) semanas.push(futura);
  }
  return semanas;
}

function renderSemanaOptions(semanaActual: number, seleccionada: number): string {
  return getSemanasPermitidas(semanaActual)
    .map(
      (n) =>
        `<option value="${n}"${n === seleccionada ? " selected" : ""}>Semana ${n}</option>`,
    )
    .join("");
}

function semanaLabel(numero: number): string {
  return `Semana ${numero}`;
}

function renderEmpleadoMetaLinea(emp: HorasExtraEmpleadoOption): string {
  const partes: string[] = [];
  if (emp.area_descripcion) partes.push(`Área: ${emp.area_descripcion}`);
  if (emp.centrocosto_descripcion) partes.push(`Centro de costo: ${emp.centrocosto_descripcion}`);
  if (emp.turno) partes.push(`Turno: ${emp.turno}`);
  if (!partes.length) return "";
  return `<p class="mt-2 text-xs leading-relaxed text-slate-500">${escapeHtml(partes.join(" | "))}</p>`;
}

function renderEmpleadoPerfilCard(emp: HorasExtraEmpleadoOption | null): string {
  if (!emp) {
    return `<div id="he-sup-empleado-perfil" class="hidden" hidden></div>`;
  }
  return `
    <div id="he-sup-empleado-perfil" class="mt-3 rounded-lg border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 px-3.5 py-3">
      <div class="flex flex-wrap items-start gap-2">
        <p class="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-[#0A1628]">${escapeHtml(emp.nombre)}</p>
        <span class="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
          Empleado #${escapeHtml(emp.no_empleado)}
        </span>
      </div>
      ${renderEmpleadoMetaLinea(emp)}
    </div>`;
}

function renderEmpleadoSelectSection(
  empleados: HorasExtraEmpleadoOption[],
  selectedId: number | null,
): string {
  if (!empleados.length) {
    return `
      <section>
        <span class="${FORM_SECTION_LABEL}">Colaborador *</span>
        <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No hay colaboradores operativos disponibles en tu equipo.
        </p>
      </section>`;
  }

  const selected = empleados.find((e) => e.id === selectedId) ?? null;
  const options = empleados
    .map((e) => {
      const isSelected = selectedId === e.id ? " selected" : "";
      return `<option value="${e.id}"${isSelected}>${escapeHtml(e.nombre)} · ${escapeHtml(e.no_empleado)}</option>`;
    })
    .join("");

  return `
    <section>
      <label for="he-sup-empleado" class="${FORM_SECTION_LABEL}">Colaborador *</label>
      <div class="${FORM_SELECT_WRAP}">
        <select id="he-sup-empleado" name="empleado_id" required class="${FORM_SELECT}">
          <option value="">Selecciona colaborador…</option>
          ${options}
        </select>
        ${SELECT_CHEVRON}
      </div>
      ${renderEmpleadoPerfilCard(selected)}
    </section>`;
}

function renderResumenSolicitud(state: HorasExtraSolicitudPageState): string {
  const colaborador =
    state.empleadosFilas[0]?.nombre ??
    (state.selectedEmpleadoId ? "—" : "Sin seleccionar");
  const horas = state.empleadosFilas.length
    ? formatHorasCaptura(sumFila(state.empleadosFilas[0]!))
    : "0.0";

  return `
    <div id="he-sup-resumen" class="${FORM_RESUMEN_CARD}">
      <h3 class="text-sm font-semibold text-[#0A1628]">Resumen de solicitud</h3>
      <dl class="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Semana</dt>
          <dd id="he-sup-resumen-semana" class="mt-0.5 font-semibold tabular-nums text-slate-900">${state.formSemana}</dd>
        </div>
        <div>
          <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tipo</dt>
          <dd id="he-sup-resumen-tipo" class="mt-0.5 font-semibold text-slate-900">Planeada</dd>
        </div>
        <div class="col-span-2 sm:col-span-1">
          <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Colaborador</dt>
          <dd id="he-sup-resumen-colaborador" class="mt-0.5 truncate font-semibold text-slate-900" title="${escapeHtml(colaborador)}">${escapeHtml(colaborador)}</dd>
        </div>
        <div>
          <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Horas capturadas</dt>
          <dd id="he-sup-resumen-horas" class="mt-0.5 font-bold tabular-nums text-leoni-blue">${horas}</dd>
        </div>
      </dl>
      <p id="he-sup-estado-solicitud" class="mt-3 flex items-center gap-2 text-sm text-slate-600" role="status" aria-live="polite"></p>
    </div>`;
}

function renderDiaHeader({ abrev, diaMes, label }: DiaColumnaHoras): string {
  return `
    <th class="px-1 py-2 text-center font-normal" title="${escapeHtml(label)}">
      <span class="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">${escapeHtml(abrev)}</span>
      <span class="mt-0.5 block text-[10px] font-medium tabular-nums text-slate-400">${escapeHtml(diaMes)}</span>
    </th>`;
}

function renderHoraInputCell(
  fila: HorasExtraEmpleadoFilaForm,
  key: DiaColumnaHoras["key"],
  tabIndex: number,
): string {
  return `
    <td class="px-1 py-1.5 align-top">
      <input
        type="number"
        min="0"
        step="0.5"
        inputmode="decimal"
        tabindex="${tabIndex}"
        data-he-dia="${key}"
        data-he-empleado="${fila.empleado_id}"
        class="${HORAS_GRID_INPUT}"
        value="${escapeHtml(fila[key])}"
        aria-describedby="he-sup-error-${fila.empleado_id}-${key}"
      />
      <p id="he-sup-error-${fila.empleado_id}-${key}" class="he-sup-hora-error mt-0.5 hidden text-[10px] leading-tight text-red-600" role="alert"></p>
    </td>`;
}

export function renderHorasGrid(
  filas: HorasExtraEmpleadoFilaForm[],
  diasColumnas: DiaColumnaHoras[],
  variant: HorasGridVariant = "consulta",
): string {
  if (!filas.length) {
    return "";
  }

  const isCaptura = variant === "captura";
  const tableClass = isCaptura ? HORAS_GRID_TABLE_CAPTURA : HORAS_GRID_TABLE_CONSULTA;

  const body = filas
    .map((fila) => {
      const total = sumFila(fila);
      const empleadoCell = isCaptura
        ? ""
        : `
        <td class="w-[7.5rem] px-2 py-1.5 text-left align-middle">
          <div class="truncate text-sm font-medium text-text-primary" title="${escapeHtml(fila.nombre)}">${escapeHtml(fila.nombre)}</div>
          <div class="truncate text-[11px] text-text-secondary">${escapeHtml(fila.no_empleado)}</div>
        </td>`;

      return `
      <tr data-he-fila-empleado="${fila.empleado_id}">
        ${empleadoCell}
        ${diasColumnas
          .map(({ key }, index) => renderHoraInputCell(fila, key, index + 1))
          .join("")}
        <td class="${HORAS_GRID_TOTAL_CELL} w-[4.5rem] px-2 py-2 text-center text-sm tabular-nums whitespace-nowrap" data-he-total-empleado="${fila.empleado_id}">${formatHorasCaptura(total)}</td>
      </tr>`;
    })
    .join("");

  const empleadoHeader = isCaptura
    ? ""
    : `<th class="w-[7.5rem] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Empleado</th>`;

  const colgroup = isCaptura
    ? `
        <colgroup>
          ${diasColumnas.map(() => `<col class="w-[3.25rem]" />`).join("")}
          <col class="w-[4.5rem]" />
        </colgroup>`
    : `
        <colgroup>
          <col class="w-[7.5rem]" />
          ${diasColumnas.map(() => `<col class="w-[3.25rem]" />`).join("")}
          <col class="w-[4.5rem]" />
        </colgroup>`;

  return `
    <div class="${HORAS_GRID_SCROLL}">
      <table class="${tableClass}">
        ${colgroup}
        <thead class="bg-[#f8fafc]">
          <tr>
            ${empleadoHeader}
            ${diasColumnas.map((col) => renderDiaHeader(col)).join("")}
            <th class="${HORAS_GRID_TOTAL_COL} px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-700">Total</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function toDetalleModalState(state: HorasExtraSolicitudPageState): HorasExtraDetalleModalState {
  return {
    detalle: state.detalleAbierto,
    status: state.detalleStatus,
    error: state.detalleError,
    aprobaciones: state.detalleAprobaciones,
  };
}

function renderFormularioSolicitud(
  opciones: HorasExtraSolicitudOpciones,
  state: HorasExtraSolicitudPageState,
): string {
  const diasColumnas = buildDiasColumnasHoras({ semana: state.formSemana });
  const horasGrid = renderHorasGrid(state.empleadosFilas, diasColumnas, "captura");
  const tieneCaptura = Boolean(horasGrid);

  return `
    <form id="he-sup-form" class="space-y-4" novalidate>
      <div class="${FORM_META_PANEL}">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Datos generales</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <section>
            <label for="he-sup-semana" class="${FORM_SECTION_LABEL}">Semana *</label>
            <div class="${FORM_SELECT_WRAP}">
              <select id="he-sup-semana" name="semana" required class="${FORM_SELECT}">
                ${renderSemanaOptions(opciones.semana_actual, state.formSemana)}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </section>
          <section>
            <label for="he-sup-tipo" class="${FORM_SECTION_LABEL}">Tipo de solicitud *</label>
            <div class="${FORM_SELECT_WRAP}">
              <select id="he-sup-tipo" name="tipo" required class="${FORM_SELECT}">
                <option value="planeado"${state.formTipo === "planeado" ? " selected" : ""}>Planeada</option>
                <option value="espontaneo"${state.formTipo === "espontaneo" ? " selected" : ""}>Espontánea</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </section>
          <section class="sm:col-span-2">
            <label for="he-sup-motivo" class="${FORM_SECTION_LABEL}">Motivo *</label>
            <textarea
              id="he-sup-motivo"
              name="motivo"
              required
              rows="2"
              maxlength="500"
              class="${FORM_TEXTAREA}"
              placeholder="Ej. Cubrir vacante, incremento de producción, soporte a inventario…"
            >${escapeHtml(state.formMotivo)}</textarea>
            <p id="he-sup-motivo-error" class="mt-1 hidden text-xs text-red-600" role="alert"></p>
          </section>
        </div>
      </div>

      <div class="${FORM_SECTION_DIVIDER} pt-4">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Colaborador</p>
        ${renderEmpleadoSelectSection(opciones.empleados, state.selectedEmpleadoId)}
        <p id="he-sup-empleado-error" class="mt-2 hidden text-xs text-red-600" role="alert"></p>
      </div>

      <div class="${FORM_SECTION_DIVIDER} pt-4">
        <div class="${FORM_CAPTURE_PANEL}">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold text-[#0A1628]">Captura de horas</h3>
              <p class="mt-0.5 text-xs text-slate-500">Registra las horas extra por día de la semana seleccionada.</p>
            </div>
          </div>

          ${tieneCaptura ? renderResumenSolicitud(state) : ""}

          ${
            horasGrid
              ? `<div id="he-sup-horas-grid" class="mt-4">${horasGrid}</div>`
              : `<div id="he-sup-horas-grid" class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                   Selecciona un colaborador para capturar horas por día.
                 </div>`
          }
        </div>
      </div>

      ${
        state.formError
          ? `<p class="${FORM_ALERT_ERROR}" role="alert">${escapeHtml(state.formError)}</p>`
          : ""
      }
    </form>`;
}

function renderSolicitudModalFooter(state: HorasExtraSolicitudPageState): string {
  return `
    <footer class="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
      <button type="button" id="he-sup-solicitud-cancelar" class="${BTN_SECONDARY} min-h-11 w-full justify-center sm:w-auto" ${state.submitting ? "disabled" : ""}>Cancelar</button>
      <button type="submit" form="he-sup-form" class="${BTN_PRIMARY} min-h-11 w-full justify-center px-6 shadow-md disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[10rem] sm:w-auto" ${state.submitting ? "disabled" : ""}>
        ${state.submitting ? "Guardando…" : "Guardar solicitud"}
      </button>
    </footer>`;
}

function renderSolicitudModal(
  opciones: HorasExtraSolicitudOpciones | null,
  state: HorasExtraSolicitudPageState,
): string {
  if (!state.solicitudModalOpen) return "";

  const body =
    state.opcionesStatus === "loading"
      ? `<p class="text-sm text-text-secondary">Cargando catálogos…</p>`
      : state.opcionesStatus === "error"
        ? `<p class="text-sm text-red-700">${escapeHtml(state.opcionesError ?? "No se pudieron cargar los catálogos.")}</p>`
        : opciones
          ? renderFormularioSolicitud(opciones, state)
          : "";

  const showFooter = state.opcionesStatus === "ready" && Boolean(opciones);

  return `
    <div id="he-sup-solicitud-modal" class="fixed inset-0 z-90 flex items-center justify-center overflow-hidden bg-slate-900/45 p-3 sm:p-4 md:p-6 backdrop-blur-[2px]" role="presentation">
      <div
        class="scheme-light flex max-h-[min(94vh,920px)] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)] sm:w-[85vw] md:w-[82vw] lg:w-[78vw]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="he-sup-solicitud-modal-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100/95 bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="he-sup-solicitud-modal-title" class="text-lg font-semibold leading-snug tracking-tight text-[#0A1628] sm:text-xl">Nueva solicitud de horas extra</h2>
            <p class="mt-1 text-[13px] leading-relaxed text-slate-500">Captura rápida de horas extra para tu equipo operativo.</p>
          </div>
          <button
            type="button"
            id="he-sup-solicitud-cerrar"
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50/35 px-4 py-4 sm:px-6 sm:py-6">
          ${body}
        </div>
        ${showFooter ? renderSolicitudModalFooter(state) : ""}
      </div>
    </div>`;
}

const ICON_HE_KPI_SOLICITUDES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke-linecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`;
const ICON_HE_KPI_PENDIENTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_HE_KPI_APROBADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9"/></svg>`;
const ICON_HE_KPI_HORAS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9"/></svg>`;

function renderEstadisticasSkeleton(): string {
  return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Cargando estadísticas">
      ${Array.from({ length: 4 })
        .map(
          () => `
        <article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
          <div class="h-4 w-28 rounded bg-slate-200"></div>
          <div class="mt-4 h-8 w-16 rounded bg-slate-200"></div>
          <div class="mt-2 h-3 w-36 rounded bg-slate-100"></div>
        </article>`,
        )
        .join("")}
    </div>`;
}

function renderEstadisticasCards(state: HorasExtraSolicitudPageState): string {
  if (state.estadisticasStatus === "loading") {
    return renderEstadisticasSkeleton();
  }
  if (state.estadisticasStatus === "error") {
    return `
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        ${escapeHtml(state.estadisticasError ?? "No se pudieron cargar las estadísticas.")}
      </div>`;
  }
  const stats = state.estadisticas;
  if (!stats) return "";

  const cards = [
    {
      label: "Total solicitudes",
      value: String(stats.total_solicitudes),
      sub: "Registradas por ti",
      icon: ICON_HE_KPI_SOLICITUDES,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: "Pendientes",
      value: String(stats.pendientes),
      sub: "En espera de aprobación",
      icon: ICON_HE_KPI_PENDIENTE,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      valueClass: stats.pendientes > 0 ? "text-amber-700" : "",
    },
    {
      label: "Aprobadas",
      value: String(stats.aprobadas),
      sub: "Solicitudes autorizadas",
      icon: ICON_HE_KPI_APROBADA,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald",
      valueClass: stats.aprobadas > 0 ? "text-emerald-700" : "",
    },
    {
      label: "Horas registradas",
      value: formatHorasCaptura(stats.total_horas),
      sub: "Acumulado en tus solicitudes",
      icon: ICON_HE_KPI_HORAS,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
  ];

  return `
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Estadísticas de horas extra">
      ${cards
        .map(
          (card) => `
        <article class="rh-dash-kpi-card rounded-[18px] p-5">
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-semibold text-text-muted">${escapeHtml(card.label)}</p>
            <span class="${card.iconWrap} size-11 shrink-0 [&_svg]:size-5">${card.icon}</span>
          </div>
          <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary ${card.valueClass ?? ""}">${escapeHtml(card.value)}</p>
          <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(card.sub)}</p>
        </article>`,
        )
        .join("")}
    </section>`;
}

function renderListaTable(state: HorasExtraSolicitudPageState): string {
  if (state.listaStatus === "loading") {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">Cargando solicitudes…</p>`;
  }
  if (state.listaStatus === "error") {
    return `<p class="px-4 py-8 text-center text-sm text-red-700">${escapeHtml(state.listaError ?? "Error al cargar solicitudes.")}</p>`;
  }
  if (!state.lista.length) {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">Aún no has creado solicitudes de horas extra.</p>`;
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left">
        <thead class="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th class="px-3 py-3">Folio</th>
            <th class="px-3 py-3">Fecha</th>
            <th class="px-3 py-3">Semana</th>
            <th class="px-3 py-3">Área</th>
            <th class="px-3 py-3">Tipo</th>
            <th class="px-3 py-3 text-right">Total hrs</th>
            <th class="px-3 py-3">Estado</th>
            <th class="px-3 py-3">Creada</th>
            <th class="px-3 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${state.lista
            .map(
              (row) => `
            <tr>
              <td class="px-3 py-3 text-sm font-semibold text-text-primary">#${row.id}</td>
              <td class="px-3 py-3 text-sm text-text-primary whitespace-nowrap">${formatFecha(row.fecha_solicitud)}</td>
              <td class="px-3 py-3 text-sm text-text-primary whitespace-nowrap">${semanaLabel(row.semana)}</td>
              <td class="px-3 py-3 text-sm text-text-primary">${escapeHtml(row.area_descripcion)}</td>
              <td class="px-3 py-3 text-sm text-text-primary">${tipoLabel(row.tipo)}</td>
              <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary text-right">${Number(row.total_horas_general).toFixed(2)}</td>
              <td class="px-3 py-3">${estadoBadge(row.estado)}</td>
              <td class="px-3 py-3 text-sm text-text-secondary whitespace-nowrap">${formatDateTime(row.created_at)}</td>
              <td class="px-3 py-3">
                <button type="button" data-he-ver-id="${row.id}" class="text-sm font-semibold text-accent hover:underline">Ver</button>
              </td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

export function renderHorasExtraSolicitudPage(state: HorasExtraSolicitudPageState): string {
  const opciones = state.opciones;
  const puedeAbrirModal = state.opcionesStatus === "ready" && Boolean(opciones);

  return `
    <div id="horas-extra-solicitud-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <header class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Solicitud de horas extra</h1>
          <p class="mt-1 text-sm text-text-secondary">Consulta tus solicitudes registradas y captura nuevas para tu equipo operativo.</p>
        </div>
        <button
          type="button"
          id="he-sup-abrir-solicitud"
          class="${BTN_PRIMARY} shrink-0"
          ${puedeAbrirModal ? "" : "disabled"}
        >
          Nueva solicitud de horas extra
        </button>
      </header>

      ${
        state.listaSuccess
          ? `<p class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">${escapeHtml(state.listaSuccess)}</p>`
          : ""
      }

      <div class="mb-4">${renderEstadisticasCards(state)}</div>

      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Mis solicitudes">
        <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-text-primary">Mis solicitudes registradas</h2>
          <p class="text-xs text-text-secondary">Solo se muestran solicitudes creadas por ti.</p>
        </div>
        ${renderListaTable(state)}
      </section>

      ${renderSolicitudModal(opciones, state)}
      ${renderHorasExtraDetalleModal(toDetalleModalState(state), HE_SUP_DETALLE_MODAL_CONFIG)}
    </div>`;
}

