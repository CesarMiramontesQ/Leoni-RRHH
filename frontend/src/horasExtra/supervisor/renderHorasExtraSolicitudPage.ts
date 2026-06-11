import type {
  HorasExtraEmpleadoOption,
  HorasExtraSolicitudListItem,
  HorasExtraSolicitudOpciones,
  HorasExtraSolicitudResponse,
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

export type HorasExtraSolicitudPageState = {
  opciones: HorasExtraSolicitudOpciones | null;
  opcionesStatus: "loading" | "ready" | "error";
  opcionesError?: string;
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
  empleadosFilas: HorasExtraEmpleadoFilaForm[];
  selectedEmpleadoIds: number[];
  empleadosSearch: string;
  solicitudModalOpen: boolean;
};

const FORM_SECTION_LABEL =
  "mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500";
const FORM_HINT = "mt-2 max-w-prose text-[13px] leading-relaxed text-slate-500";
const FORM_FIELD =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";
const FORM_TEXTAREA =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";
const FORM_SELECT_WRAP = "relative grid grid-cols-1";
const FORM_SELECT = `col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pr-9 pl-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.045)] focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25`;
const FORM_ALERT_ERROR =
  "rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800";

const DIAS = [
  ["lunes", "Lun"],
  ["martes", "Mar"],
  ["miercoles", "Mié"],
  ["jueves", "Jue"],
  ["viernes", "Vie"],
  ["sabado", "Sáb"],
  ["domingo", "Dom"],
] as const;

function estadoBadge(estado: string): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  if (estado === "cancelado") return badgeCancelled("Cancelado");
  if (estado === "borrador") return badgePending("Borrador");
  return badgePending("Pendiente");
}

function tipoLabel(tipo: string): string {
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

function renderSemanaOptions(semanaActual: number): string {
  return getSemanasPermitidas(semanaActual)
    .map(
      (n) =>
        `<option value="${n}"${n === semanaActual ? " selected" : ""}>Semana ${n}</option>`,
    )
    .join("");
}

function semanaLabel(numero: number): string {
  return `Semana ${numero}`;
}

export function filterEmpleadosElegibles(
  empleados: HorasExtraEmpleadoOption[],
  search: string,
): HorasExtraEmpleadoOption[] {
  const q = search.trim().toLowerCase();
  if (!q) return empleados;
  return empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(q) ||
      e.no_empleado.toLowerCase().includes(q),
  );
}

function empleadoIniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return nombre.slice(0, 2).toUpperCase();
}

export function renderEmpleadosPickerList(
  empleados: HorasExtraEmpleadoOption[],
  selectedIds: number[],
  search: string,
): string {
  if (!empleados.length) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No hay colaboradores operativos en tu equipo.</p>`;
  }
  if (search.trim() && !empleados.length) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No se encontraron coincidencias.</p>`;
  }
  const filtrados = filterEmpleadosElegibles(empleados, search);
  if (!filtrados.length) {
    return `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No se encontraron coincidencias.</p>`;
  }
  return `
    <ul class="space-y-2" id="he-sup-empleados-picker">
      ${filtrados
        .map((e) => {
          const isSelected = selectedIds.includes(e.id);
          return `
        <li>
          <button
            type="button"
            data-he-picker-empleado-id="${e.id}"
            aria-pressed="${isSelected ? "true" : "false"}"
            class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              isSelected
                ? "border-leoni-blue bg-leoni-blue/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }"
          >
            <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              ${escapeHtml(empleadoIniciales(e.nombre))}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-800">${escapeHtml(e.nombre)}</span>
              <span class="block truncate text-xs text-slate-500">${escapeHtml(e.no_empleado)}</span>
            </span>
            ${
              isSelected
                ? `<span class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-white" aria-hidden="true">
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

function renderSelectedEmpleadosCards(filas: HorasExtraEmpleadoFilaForm[]): string {
  if (!filas.length) {
    return `<p class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">Selecciona al menos un colaborador para capturar horas.</p>`;
  }
  return `
    <div class="mt-4 space-y-2" id="he-sup-empleados-seleccionados">
      <p class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        ${filas.length} seleccionado${filas.length === 1 ? "" : "s"}
      </p>
      <ul class="space-y-2">
        ${filas
          .map(
            (f) => `
          <li class="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/95 px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue/12 text-xs font-semibold uppercase text-leoni-blue">
              ${escapeHtml(empleadoIniciales(f.nombre))}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-900">${escapeHtml(f.nombre)}</span>
              <span class="block truncate text-xs text-slate-500">${escapeHtml(f.no_empleado)}</span>
            </span>
            <button
              type="button"
              data-he-quitar-empleado="${f.empleado_id}"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Quitar ${escapeHtml(f.nombre)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </li>`,
          )
          .join("")}
      </ul>
    </div>`;
}

function renderEmpleadosPickerSection(
  empleados: HorasExtraEmpleadoOption[],
  state: HorasExtraSolicitudPageState,
): string {
  const search = state.empleadosSearch;
  const pickerContent =
    search.trim().length === 0
      ? `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">Empieza escribiendo para buscar un colaborador.</p>`
      : renderEmpleadosPickerList(empleados, state.selectedEmpleadoIds, search);

  return `
    <section>
      <label for="he-sup-empleados-search" class="${FORM_SECTION_LABEL}">Colaboradores *</label>
      <input
        type="search"
        id="he-sup-empleados-search"
        value="${escapeHtml(search)}"
        placeholder="Nombre o número de empleado…"
        autocomplete="off"
        class="${FORM_FIELD}"
      />
      <p class="${FORM_HINT}">Busca y selecciona integrantes operativos de tu equipo. Deben compartir área y centro de costo.</p>
      <div class="mt-3 max-h-52 overflow-y-auto pr-1" id="he-sup-empleados-picker-wrap">
        ${pickerContent}
      </div>
      ${renderSelectedEmpleadosCards(state.empleadosFilas)}
    </section>`;
}

export function renderHorasGrid(filas: HorasExtraEmpleadoFilaForm[]): string {
  if (!filas.length) {
    return "";
  }
  let totalGeneral = 0;
  const body = filas
    .map((fila) => {
      const total = sumFila(fila);
      totalGeneral += total;
      return `
      <tr data-he-fila-empleado="${fila.empleado_id}">
        <td class="px-3 py-2 text-sm font-medium text-text-primary whitespace-nowrap">
          <div>${escapeHtml(fila.nombre)}</div>
          <div class="text-xs text-text-secondary">${escapeHtml(fila.no_empleado)}</div>
        </td>
        ${DIAS.map(
          ([key]) => `
          <td class="px-1 py-2">
            <input type="number" min="0" step="0.5" inputmode="decimal"
              data-he-dia="${key}" data-he-empleado="${fila.empleado_id}"
              class="w-full min-w-[3.25rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25"
              value="${escapeHtml(fila[key])}" />
          </td>`,
        ).join("")}
        <td class="px-3 py-2 text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap" data-he-total-empleado="${fila.empleado_id}">${total.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <table class="min-w-full divide-y divide-slate-200 text-left">
        <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2">Empleado</th>
            ${DIAS.map(([, label]) => `<th class="px-1 py-2 text-center">${label}</th>`).join("")}
            <th class="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${body}</tbody>
        <tfoot>
          <tr class="bg-slate-50">
            <td colspan="8" class="px-3 py-2 text-right text-sm font-semibold text-slate-500">Total general</td>
            <td class="px-3 py-2 text-right text-sm font-bold tabular-nums text-text-primary" id="he-sup-total-general">${totalGeneral.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function renderDetalleModal(state: HorasExtraSolicitudPageState): string {
  if (!state.detalleAbierto && state.detalleStatus !== "loading") return "";
  const det = state.detalleAbierto;
  return `
    <div id="he-sup-detalle-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="he-sup-detalle-title">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="he-sup-detalle-title" class="text-lg font-bold text-text-primary">Solicitud #${det ? det.id : "…"}</h2>
            ${det ? `<p class="text-sm text-text-secondary">${escapeHtml(det.departamento_nombre)} · ${escapeHtml(det.area_descripcion)}</p>` : ""}
          </div>
          <button type="button" id="he-sup-detalle-cerrar" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cerrar</button>
        </div>
        ${
          state.detalleStatus === "loading"
            ? `<p class="text-sm text-text-secondary">Cargando detalle…</p>`
            : state.detalleStatus === "error"
              ? `<p class="text-sm text-red-700">${escapeHtml(state.detalleError ?? "No se pudo cargar el detalle.")}</p>`
              : det
                ? `
          <div class="mb-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div><span class="text-text-secondary">Fecha:</span> <span class="font-medium">${formatFecha(det.fecha_solicitud)}</span></div>
            <div><span class="text-text-secondary">Semana:</span> <span class="font-medium">${semanaLabel(det.semana)}</span></div>
            <div><span class="text-text-secondary">Tipo:</span> <span class="font-medium">${tipoLabel(det.tipo)}</span></div>
            <div><span class="text-text-secondary">Estado:</span> ${estadoBadge(det.estado)}</div>
            <div><span class="text-text-secondary">Centro de costo:</span> <span class="font-medium">${escapeHtml(det.centrocosto_descripcion)}</span></div>
            <div class="sm:col-span-2"><span class="text-text-secondary">Motivo:</span> <span class="font-medium">${escapeHtml(det.motivo_descripcion)}</span></div>
          </div>
          ${renderHorasGrid(
            det.detalle.map((d) => ({
              empleado_id: d.empleado_id,
              no_empleado: d.no_empleado,
              nombre: d.nombre_empleado,
              lunes: String(d.lunes),
              martes: String(d.martes),
              miercoles: String(d.miercoles),
              jueves: String(d.jueves),
              viernes: String(d.viernes),
              sabado: String(d.sabado),
              domingo: String(d.domingo),
            })),
          )}`
                : ""
        }
      </div>
    </div>`;
}

function renderFormularioSolicitud(
  opciones: HorasExtraSolicitudOpciones,
  state: HorasExtraSolicitudPageState,
): string {
  const horasGrid = renderHorasGrid(state.empleadosFilas);

  return `
    <form id="he-sup-form" class="space-y-6" novalidate>
      <div class="grid gap-5 sm:grid-cols-2">
        <section>
          <label for="he-sup-semana" class="${FORM_SECTION_LABEL}">Semana *</label>
          <div class="${FORM_SELECT_WRAP}">
            <select id="he-sup-semana" name="semana" required class="${FORM_SELECT}">
              ${renderSemanaOptions(opciones.semana_actual)}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </section>
        <section>
          <label for="he-sup-tipo" class="${FORM_SECTION_LABEL}">Tipo de solicitud *</label>
          <div class="${FORM_SELECT_WRAP}">
            <select id="he-sup-tipo" name="tipo" required class="${FORM_SELECT}">
              <option value="planeado">Planeada</option>
              <option value="espontaneo">Espontánea</option>
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
            rows="3"
            maxlength="500"
            class="${FORM_TEXTAREA}"
            placeholder="Ej. Cubrir vacante, incremento de producción, soporte a inventario…"
          ></textarea>
        </section>
      </div>

      ${renderEmpleadosPickerSection(opciones.empleados, state)}

      ${
        horasGrid
          ? `<section>
              <span class="${FORM_SECTION_LABEL}">Horas por día</span>
              <div id="he-sup-horas-grid">${horasGrid}</div>
            </section>`
          : `<div id="he-sup-horas-grid" class="hidden"></div>`
      }

      ${
        state.formError
          ? `<p class="${FORM_ALERT_ERROR}" role="alert">${escapeHtml(state.formError)}</p>`
          : ""
      }

      <footer class="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-1 pt-4 pb-1 backdrop-blur-[2px] sm:flex-row sm:justify-end">
        <button type="button" id="he-sup-solicitud-cancelar" class="${BTN_SECONDARY} min-h-11 w-full justify-center sm:w-auto" ${state.submitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" class="${BTN_PRIMARY} min-h-11 w-full justify-center px-6 shadow-md disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[10rem] sm:w-auto" ${state.submitting ? "disabled" : ""}>
          ${state.submitting ? "Guardando…" : "Guardar solicitud"}
        </button>
      </footer>
    </form>`;
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

  return `
    <div id="he-sup-solicitud-modal" class="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]" role="presentation">
      <div
        class="scheme-light flex max-h-[min(94vh,920px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="he-sup-solicitud-modal-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100/95 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="he-sup-solicitud-modal-title" class="text-lg font-semibold leading-snug tracking-tight text-[#0A1628] sm:text-xl">Nueva solicitud de horas extra</h2>
            <p class="mt-1 text-[13px] leading-relaxed text-slate-500">Registra horas extra para colaboradores operativos de tu equipo.</p>
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
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/35 px-5 py-5 sm:px-6 sm:py-7">
          ${body}
        </div>
      </div>
    </div>`;
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
            <th class="px-3 py-3">Departamento / Área</th>
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
              <td class="px-3 py-3 text-sm text-text-primary">
                <div>${escapeHtml(row.departamento_nombre)}</div>
                <div class="text-xs text-text-secondary">${escapeHtml(row.area_descripcion)}</div>
              </td>
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

      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Mis solicitudes">
        <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-text-primary">Mis solicitudes registradas</h2>
          <p class="text-xs text-text-secondary">Solo se muestran solicitudes creadas por ti.</p>
        </div>
        ${renderListaTable(state)}
      </section>

      ${renderSolicitudModal(opciones, state)}
      ${renderDetalleModal(state)}
    </div>`;
}

