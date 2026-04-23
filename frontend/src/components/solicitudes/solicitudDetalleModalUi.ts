/**
 * Plantillas HTML del modal de detalle de solicitud pendiente (solo presentación).
 */

import type { SolicitudApiItem } from "../../api/solicitudes.ts";
import { SD_COPY } from "../../solicitudes/rh/solicitudDetalleCopy.ts";
import type { SolicitudDetallePendienteVm } from "../../solicitudes/rh/solicitudDetalleTypes.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const SEC_HEAD =
  "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-leoni-blue";

const PANEL = "rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 [color-scheme:light]";

const LABEL = "text-xs font-medium text-slate-500";
const VALUE = "text-sm font-semibold text-slate-900";

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-leoni-blue" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
</svg>`;

const ICON_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-leoni-blue" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
</svg>`;

function kv(label: string, value: string, valueClass = VALUE): string {
  return `
    <div class="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-baseline sm:gap-4">
      <dt class="${LABEL}">${escapeHtml(label)}</dt>
      <dd class="${valueClass}">${escapeHtml(value)}</dd>
    </div>`;
}

export function solicitudDetalleShellHtml(): string {
  return `
    <div
      id="rh-sd-overlay"
      class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px] sm:p-6"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_56px_-12px_rgba(15,23,42,0.2)] [color-scheme:light] sm:max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-sd-title"
      >
        <header class="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-8 sm:pb-5 sm:pt-7">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <h2 id="rh-sd-title" class="text-xl font-bold tracking-tight text-slate-900">${escapeHtml(SD_COPY.tituloModal)}</h2>
              <p id="rh-sd-subtitle" class="mt-2 text-sm leading-relaxed text-slate-500">${escapeHtml(SD_COPY.subtituloModal)}</p>
            </div>
            <button
              type="button"
              class="-m-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              data-rh-sd-close
              aria-label="${escapeHtml(SD_COPY.cerrarAria)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </header>
        <div id="rh-sd-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-7"></div>
      </div>
    </div>`;
}

export function solicitudDetalleLoadingBodyHtml(): string {
  return `
    <div class="flex items-center gap-3 py-16 text-sm text-slate-500">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      ${escapeHtml(SD_COPY.cargandoDetalle)}
    </div>`;
}

export type SolicitudDetalleContentOpciones = {
  soloLectura?: boolean;
  /** Sin botones aprobar/rechazar/cambios (p. ej. solicitud propia de supervisor/gerente). */
  ocultarDecisionJerarquica?: boolean;
  /** Panel de organigrama / etapas (solo cuando el GET devuelve metadatos). */
  jerarquiaHtml?: string;
};

/** Panel informativo para supervisores, gerentes y RH a partir del GET enriquecido. */
export function solicitudDetalleJerarquiaHtml(api: SolicitudApiItem): string {
  const supNom =
    typeof api.lider_nombre === "string" && api.lider_nombre.trim() ? api.lider_nombre.trim() : "";
  const gerNom =
    typeof api.gerente_linea_nombre === "string" && api.gerente_linea_nombre.trim() ?
      api.gerente_linea_nombre.trim()
    : "";

  const sinSup = !supNom;
  const pending = api.estado === "pending";

  let estadoSup: string;
  let estadoGer: string;
  let alertaFlujo: string;

  if (pending) {
    estadoSup = sinSup ? SD_COPY.supSinAsignar : SD_COPY.supPuedeAprobarUnPaso;
    estadoGer = !gerNom ? SD_COPY.gerSinEnCadena : SD_COPY.gerPuedeAprobarUnPaso;
    alertaFlujo = `<p class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">${escapeHtml(
      SD_COPY.jerarquiaUnaSolaAprobacion,
    )}</p>`;
  } else {
    estadoSup = sinSup ? SD_COPY.supSinAsignar : api.supervisor_aprobo ? SD_COPY.supYaAprobo : SD_COPY.supEstadoCerrada;
    estadoGer = !gerNom ? SD_COPY.gerSinEnCadena : SD_COPY.gerEstadoCerrada;
    alertaFlujo = "";
  }

  return `
    <section class="space-y-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm" aria-labelledby="rh-sd-jer-title">
      <h3 id="rh-sd-jer-title" class="${SEC_HEAD}">
        ${ICON_USER}
        ${escapeHtml(SD_COPY.seccionJerarquia)}
      </h3>
      <div class="${PANEL} space-y-3">
        ${kv(SD_COPY.lblSupervisorAsignado, sinSup ? "—" : supNom)}
        ${kv(SD_COPY.lblGerenteLinea, gerNom || "—")}
        ${kv(SD_COPY.lblEstadoSupervisor, estadoSup)}
        ${kv(SD_COPY.lblEstadoGerencia, estadoGer)}
        ${alertaFlujo}
      </div>
    </section>`;
}

export function solicitudDetalleContentHtml(
  vm: SolicitudDetallePendienteVm,
  opciones?: SolicitudDetalleContentOpciones,
): string {
  const soloLectura = opciones?.soloLectura ?? false;
  const ocultarDecisionJerarquica = opciones?.ocultarDecisionJerarquica ?? false;
  const jerarquiaBlock = opciones?.jerarquiaHtml?.trim() ? opciones.jerarquiaHtml : "";
  const s = vm.solicitud;
  const e = vm.empleado;
  const diasTxt = `${s.total_dias} ${SD_COPY.diasUnidad}`;

  const badge = `<span class="inline-flex max-w-full items-center rounded-lg border border-leoni-blue/20 bg-leoni-blue/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-leoni-blue">${escapeHtml(s.tipo_badge)}</span>`;

  const saldoCards = soloLectura
    ? ""
    : `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(SD_COPY.lblSaldoActual)}</p>
        <p class="mt-1 text-xl font-bold tabular-nums text-leoni-blue">${escapeHtml(String(s.saldo_actual))}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(SD_COPY.lblRestante)}</p>
        <p class="mt-1 text-xl font-bold tabular-nums text-leoni-blue">${escapeHtml(String(s.saldo_restante))}</p>
      </div>
    </div>`;

  return `
    <div class="space-y-6">
      <p id="rh-sd-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"></p>
      <p id="rh-sd-busy-banner" class="hidden rounded-xl border border-leoni-blue/20 bg-leoni-blue/[0.06] px-4 py-3 text-center text-sm font-semibold text-leoni-blue" role="status" aria-live="polite"></p>

      ${jerarquiaBlock}

      ${
        ocultarDecisionJerarquica && !soloLectura ?
          `<p class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-950">${escapeHtml(SD_COPY.avisoAutopaprobacionBloqueada)}</p>`
        : ""
      }

      <section class="space-y-3" aria-labelledby="rh-sd-sec-emp">
        <h3 id="rh-sd-sec-emp" class="${SEC_HEAD}">
          ${ICON_USER}
          ${escapeHtml(SD_COPY.seccionEmpleado)}
        </h3>
        <div class="${PANEL} space-y-3">
          ${kv(SD_COPY.lblNombre, e.nombre)}
          ${kv(SD_COPY.lblIdEmpleado, e.id_empleado)}
          ${kv(SD_COPY.lblArea, e.area)}
          ${kv(SD_COPY.lblPuesto, e.puesto)}
          ${kv(SD_COPY.lblSupervisor, e.supervisor, `${VALUE} text-leoni-blue`)}
        </div>
      </section>

      <section class="space-y-3" aria-labelledby="rh-sd-sec-sol">
        <h3 id="rh-sd-sec-sol" class="${SEC_HEAD}">
          ${ICON_CAL}
          ${escapeHtml(SD_COPY.seccionSolicitud)}
        </h3>
        <div class="${PANEL} space-y-5">
          <div>
            <p class="${LABEL} mb-2">${escapeHtml(SD_COPY.lblTipoSolicitud)}</p>
            ${badge}
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p class="${LABEL}">${escapeHtml(SD_COPY.lblFechaInicio)}</p>
              <p class="mt-1 text-base font-bold text-slate-900">${escapeHtml(s.fecha_inicio)}</p>
            </div>
            <div>
              <p class="${LABEL}">${escapeHtml(SD_COPY.lblFechaFin)}</p>
              <p class="mt-1 text-base font-bold text-slate-900">${escapeHtml(s.fecha_fin)}</p>
            </div>
          </div>
          <div class="flex flex-col gap-1 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span class="text-sm font-medium text-slate-600">${escapeHtml(SD_COPY.lblTotalDias)}</span>
            <span class="text-2xl font-bold tabular-nums text-leoni-blue">${escapeHtml(diasTxt)}</span>
          </div>
          <div>
            <p class="${LABEL} mb-2">${escapeHtml(SD_COPY.lblComentarioEmpleado)}</p>
            <p class="rounded-lg border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-600">${escapeHtml(s.comentario_empleado)}</p>
          </div>
          ${saldoCards}
        </div>
      </section>

      ${
        soloLectura || ocultarDecisionJerarquica
          ? ""
          : `<div class="space-y-3 border-t border-slate-100 pt-2">
        <button
          type="button"
          id="rh-sd-btn-aprobar"
          data-rh-sd-accion="aprobar"
          class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-leoni-blue px-4 text-sm font-bold text-white shadow-md shadow-leoni-blue/20 transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5 shrink-0" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          ${escapeHtml(SD_COPY.accionAprobar)}
        </button>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            id="rh-sd-btn-cambios"
            data-rh-sd-accion="cambios"
            class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-leoni-blue bg-white px-4 text-sm font-bold text-leoni-blue transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            ${escapeHtml(SD_COPY.accionCambios)}
          </button>
          <button
            type="button"
            id="rh-sd-btn-rechazar"
            data-rh-sd-accion="rechazar"
            class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            ${escapeHtml(SD_COPY.accionRechazar)}
          </button>
        </div>
      </div>

      <div class="border-t border-slate-100 pt-4">
        <button
          type="button"
          id="rh-sd-toggle-internal"
          class="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto sm:px-4"
          aria-expanded="false"
          aria-controls="rh-sd-internal-panel"
        >
          <span class="text-lg leading-none" aria-hidden="true">+</span>
          ${escapeHtml(SD_COPY.toggleComentarioInterno)}
        </button>
        <div id="rh-sd-internal-panel" class="mt-3 hidden space-y-2">
          <label for="rh-sd-internal-ta" class="sr-only">${escapeHtml(SD_COPY.toggleComentarioInterno)}</label>
          <textarea
            id="rh-sd-internal-ta"
            rows="4"
            class="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25"
            placeholder="${escapeHtml(SD_COPY.placeholderComentarioInterno)}"
          ></textarea>
          <p class="text-xs text-slate-500">${escapeHtml(SD_COPY.ayudaComentarioInterno)}</p>
        </div>
      </div>`
      }
    </div>
    <input type="hidden" id="rh-sd-solicitud-id" value="${escapeHtml(vm.id)}" />`;
}
