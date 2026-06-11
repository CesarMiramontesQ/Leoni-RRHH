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
  selectedEmpleadoId: number | null;
  formSemana: number;
  solicitudModalOpen: boolean;
};

const FORM_SECTION_LABEL =
  "mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500";
const FORM_HINT = "mt-2 max-w-prose text-[13px] leading-relaxed text-slate-500";
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

export type DiaColumnaHoras = {
  key: (typeof DIAS)[number][0];
  label: string;
  labelCorto: string;
};

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
  "max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";
const HORAS_GRID_TABLE = "w-full min-w-[52rem] table-fixed divide-y divide-slate-200 text-left";
const HORAS_GRID_INPUT =
  "w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-center text-sm tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";

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
    const diaMes = fecha.getDate();
    return {
      key,
      label: `${NOMBRES_DIA[index]} ${diaMes}`,
      labelCorto: `${ABREV_DIA[index]} ${diaMes}`,
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

function renderEmpleadoSelectSection(
  empleados: HorasExtraEmpleadoOption[],
  selectedId: number | null,
): string {
  if (!empleados.length) {
    return `
      <section>
        <span class="${FORM_SECTION_LABEL}">Colaborador *</span>
        <p class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          No hay colaboradores operativos disponibles en tu equipo.
        </p>
      </section>`;
  }

  const options = empleados
    .map((e) => {
      const selected = selectedId === e.id ? " selected" : "";
      return `<option value="${e.id}"${selected}>${escapeHtml(e.nombre)} · ${escapeHtml(e.no_empleado)}</option>`;
    })
    .join("");

  return `
    <section class="sm:col-span-2 lg:col-span-3">
      <label for="he-sup-empleado" class="${FORM_SECTION_LABEL}">Colaborador *</label>
      <div class="${FORM_SELECT_WRAP}">
        <select id="he-sup-empleado" name="empleado_id" required class="${FORM_SELECT}">
          <option value="">Selecciona colaborador…</option>
          ${options}
        </select>
        ${SELECT_CHEVRON}
      </div>
      <p class="${FORM_HINT}">Solo puedes registrar horas extra para un colaborador operativo a la vez.</p>
    </section>`;
}

export function renderHorasGrid(
  filas: HorasExtraEmpleadoFilaForm[],
  diasColumnas: DiaColumnaHoras[],
): string {
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
        <td class="w-[11rem] px-2 py-1.5 text-sm font-medium text-text-primary">
          <div class="truncate" title="${escapeHtml(fila.nombre)}">${escapeHtml(fila.nombre)}</div>
          <div class="truncate text-xs text-text-secondary">${escapeHtml(fila.no_empleado)}</div>
        </td>
        ${diasColumnas
          .map(
            ({ key }) => `
          <td class="px-1 py-1.5">
            <input type="number" min="0" step="0.5" inputmode="decimal"
              data-he-dia="${key}" data-he-empleado="${fila.empleado_id}"
              class="${HORAS_GRID_INPUT}"
              value="${escapeHtml(fila[key])}" />
          </td>`,
          )
          .join("")}
        <td class="w-[4.25rem] px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap" data-he-total-empleado="${fila.empleado_id}">${total.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="${HORAS_GRID_SCROLL}">
      <table class="${HORAS_GRID_TABLE}">
        <colgroup>
          <col class="w-[11rem]" />
          ${diasColumnas.map(() => `<col />`).join("")}
          <col class="w-[4.25rem]" />
        </colgroup>
        <thead class="bg-slate-50 text-[11px] font-semibold text-slate-500">
          <tr>
            <th class="px-2 py-2 text-left uppercase tracking-wide">Empleado</th>
            ${diasColumnas
              .map(
                ({ label, labelCorto }) =>
                  `<th class="px-1 py-2 text-center whitespace-nowrap" title="${escapeHtml(label)}">${escapeHtml(labelCorto)}</th>`,
              )
              .join("")}
            <th class="px-2 py-2 text-right uppercase tracking-wide">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${body}</tbody>
        <tfoot>
          <tr class="bg-slate-50">
            <td colspan="8" class="px-2 py-2 text-right text-sm font-semibold text-slate-500">Total general</td>
            <td class="px-2 py-2 text-right text-sm font-bold tabular-nums text-text-primary" id="he-sup-total-general">${totalGeneral.toFixed(2)}</td>
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
            buildDiasColumnasHoras({ semanaInicio: det.semana_inicio }),
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
  const diasColumnas = buildDiasColumnasHoras({ semana: state.formSemana });
  const horasGrid = renderHorasGrid(state.empleadosFilas, diasColumnas);

  return `
    <form id="he-sup-form" class="space-y-5" novalidate>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <option value="planeado">Planeada</option>
              <option value="espontaneo">Espontánea</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </section>
        <section class="sm:col-span-2 lg:col-span-3">
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

      ${renderEmpleadoSelectSection(opciones.empleados, state.selectedEmpleadoId)}

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
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50/35 px-4 py-4 sm:px-6 sm:py-6">
          ${body}
        </div>
        ${showFooter ? renderSolicitudModalFooter(state) : ""}
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

