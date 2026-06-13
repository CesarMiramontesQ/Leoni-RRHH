import type { HorasExtraAprobacionDetalle, HorasExtraHistorialEvento } from "../../api/horasExtraAprobacion.ts";
import type { HorasExtraSolicitudResponse } from "../../api/horasExtraSolicitud.ts";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { buildDiasColumnasHoras } from "../supervisor/renderHorasExtraSolicitudPage.ts";
import {
  renderDetalleHorasGrid,
  renderDetalleResumenCard,
} from "./renderHorasExtraDetalleModal.ts";
import {
  renderHorasExtraAprobacionesSection,
  renderHorasExtraHistorialSection,
} from "./renderHorasExtraAprobacionesSection.ts";

export type HorasExtraAprobacionDetalleModalState = {
  status: "idle" | "loading" | "error";
  detalle: HorasExtraAprobacionDetalle | null;
  error?: string;
  acting?: boolean;
};

const DETALLE_SECTION_CARD =
  "rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5";

const HE_APROB_DETALLE_MODAL_CONFIG = {
  backdropId: "he-aprob-detalle-backdrop",
  titleId: "he-aprob-detalle-title",
  closeDataAttr: "he-aprob-detalle-cerrar",
} as const;

function mapAprobacionToSolicitud(det: HorasExtraAprobacionDetalle): HorasExtraSolicitudResponse {
  const estado =
    det.estado_consolidado === "aprobado"
      ? "aprobado"
      : det.estado_consolidado === "rechazado"
        ? "rechazado"
        : "pendiente";

  return {
    id: det.solicitud_id,
    fecha_solicitud: det.fecha_solicitud,
    semana: det.semana,
    semana_inicio: det.semana_inicio,
    tipo: det.tipo === "espontaneo" ? "espontaneo" : "planeado",
    area_id: 0,
    area_descripcion: det.area_descripcion ?? "—",
    subarea_id: 0,
    subarea_descripcion: det.subarea_descripcion ?? "—",
    centrocosto_id: 0,
    centrocosto_descripcion: det.centrocosto_descripcion ?? "—",
    motivo_id: 0,
    motivo_descripcion: det.motivo ?? "—",
    comentarios: det.comentarios,
    estado,
    total_horas_general: det.total_horas,
    total_empleados: det.total_empleados,
    created_at: det.created_at,
    detalle: det.empleados.map((emp, index) => ({
      id: index,
      empleado_id: emp.empleado_id,
      no_empleado: emp.no_empleado,
      nombre_empleado: emp.nombre,
      lunes: emp.lunes,
      martes: emp.martes,
      miercoles: emp.miercoles,
      jueves: emp.jueves,
      viernes: emp.viernes,
      sabado: emp.sabado,
      domingo: emp.domingo,
      total_horas: emp.total_horas,
    })),
  };
}

function renderEmpleadosHorasPorDia(det: HorasExtraAprobacionDetalle): string {
  if (!det.empleados.length) {
    return `<p class="text-sm text-text-secondary">Sin colaboradores registrados.</p>`;
  }

  const diasColumnas = buildDiasColumnasHoras({ semanaInicio: det.semana_inicio });

  return det.empleados
    .map((emp) => {
      const fila = {
        lunes: String(emp.lunes),
        martes: String(emp.martes),
        miercoles: String(emp.miercoles),
        jueves: String(emp.jueves),
        viernes: String(emp.viernes),
        sabado: String(emp.sabado),
        domingo: String(emp.domingo),
      };
      return `
      <article class="${det.empleados.length > 1 ? "border-t border-slate-100 pt-4 first:border-t-0 first:pt-0" : ""}">
        <div class="mb-3">
          <h4 class="text-sm font-semibold text-[#0A1628]">${escapeHtml(emp.nombre)}</h4>
          <p class="mt-0.5 text-xs text-text-secondary">
            Empleado #${escapeHtml(emp.no_empleado)} · ${emp.total_horas} h total
          </p>
        </div>
        ${renderDetalleHorasGrid([fila], diasColumnas)}
      </article>`;
    })
    .join("");
}

function renderHistorial(eventos: HorasExtraHistorialEvento[]): string {
  return renderHorasExtraHistorialSection(eventos);
}

function renderModalBody(state: HorasExtraAprobacionDetalleModalState): string {
  if (state.status === "loading") {
    return `<p class="text-sm text-text-secondary">Cargando detalle…</p>`;
  }
  if (state.status === "error") {
    return `<p class="text-sm text-red-700">${escapeHtml(state.error ?? "No se pudo cargar el detalle.")}</p>`;
  }
  const det = state.detalle;
  if (!det) return "";

  const solicitud = mapAprobacionToSolicitud(det);

  return `
    <div class="space-y-4">
      ${renderDetalleResumenCard(solicitud)}
      <section class="${DETALLE_SECTION_CARD}">
        <div class="mb-3">
          <h3 class="text-sm font-semibold text-[#0A1628]">Captura de horas</h3>
          <p class="mt-0.5 text-xs text-text-secondary">Horas registradas por día de la semana.</p>
        </div>
        <div class="space-y-4">${renderEmpleadosHorasPorDia(det)}</div>
      </section>
      ${renderHorasExtraAprobacionesSection(det.firmas)}
      ${renderHistorial(det.historial)}
    </div>`;
}

function renderModalFooter(state: HorasExtraAprobacionDetalleModalState): string {
  const det = state.detalle;
  const acting = Boolean(state.acting);
  const acciones =
    det && (det.puede_aprobar || det.puede_rechazar)
      ? `
        <button type="button" class="${BTN_PRIMARY}" data-he-aprob-aprobar ${acting ? "disabled" : ""}>
          ${acting ? "Procesando…" : "Aprobar"}
        </button>
        <button type="button" class="${BTN_DANGER}" data-he-aprob-rechazar ${acting ? "disabled" : ""}>Rechazar</button>`
      : "";

  return `
    <footer class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
      ${acciones}
      <button type="button" data-${HE_APROB_DETALLE_MODAL_CONFIG.closeDataAttr} class="${BTN_SECONDARY} min-h-10 px-5">
        Cerrar
      </button>
    </footer>`;
}

export function renderHorasExtraAprobacionDetalleModal(
  state: HorasExtraAprobacionDetalleModalState,
): string {
  if (!state.detalle && state.status !== "loading") return "";

  const det = state.detalle;
  const showFooter = state.status === "idle" && Boolean(det);

  return `
    <div id="${HE_APROB_DETALLE_MODAL_CONFIG.backdropId}" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${HE_APROB_DETALLE_MODAL_CONFIG.titleId}"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="${HE_APROB_DETALLE_MODAL_CONFIG.titleId}" class="text-lg font-semibold text-[#0A1628]">
            ${det ? `Solicitud #${det.solicitud_id}` : "Detalle de solicitud"}
          </h2>
          <button
            type="button"
            data-${HE_APROB_DETALLE_MODAL_CONFIG.closeDataAttr}
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50/35 px-5 py-4">
          ${renderModalBody(state)}
        </div>
        ${showFooter ? renderModalFooter(state) : ""}
      </div>
    </div>`;
}

export function renderHorasExtraAprobacionDetalleModalSlot(
  state: HorasExtraAprobacionDetalleModalState,
): string {
  return `<div id="he-aprob-detalle-modal">${renderHorasExtraAprobacionDetalleModal(state)}</div>`;
}

export function renderHorasExtraAprobacionRechazoModal(opts: {
  comentario: string;
  submitting: boolean;
  error?: string;
}): string {
  return `
    <div id="he-aprob-rechazo-backdrop" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 class="text-base font-semibold text-slate-800">Confirmar rechazo</h3>
        <p class="mt-1 text-sm text-slate-500">El comentario es obligatorio y quedará en el historial.</p>
        <textarea id="he-aprob-rechazo-comentario" rows="4"
          class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue"
          placeholder="Motivo del rechazo…">${escapeHtml(opts.comentario)}</textarea>
        ${opts.error ? `<div class="mt-2 text-sm text-red-600">${escapeHtml(opts.error)}</div>` : ""}
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="${BTN_SECONDARY}" data-he-aprob-rechazo-cancelar>Cancelar</button>
          <button type="button" class="${BTN_DANGER}" data-he-aprob-rechazo-confirmar ${opts.submitting ? "disabled" : ""}>
            ${opts.submitting ? "Enviando…" : "Confirmar rechazo"}
          </button>
        </div>
      </div>
    </div>`;
}
