/**
 * Plantillas HTML del modal de detalle de solicitud pendiente (solo presentación).
 */

import type { SolicitudApiItem } from "../../api/solicitudes.ts";
import { SD_COPY } from "../../solicitudes/rh/solicitudDetalleCopy.ts";
import type { SolicitudDetallePendienteVm } from "../../solicitudes/rh/solicitudDetalleTypes.ts";
import { badgePending } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const SEC_HEAD =
  "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-leoni-blue";

const PANEL =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/40 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] sm:p-5 [color-scheme:light]";

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
    <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-baseline sm:gap-4">
      <dt class="${LABEL}">${escapeHtml(label)}</dt>
      <dd class="${valueClass} break-words">${escapeHtml(value)}</dd>
    </div>`;
}

export function solicitudDetalleShellHtml(): string {
  return `
    <div
      id="rh-sd-overlay"
      class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[5px] sm:p-6"
      role="presentation"
    >
      <div
        class="relative flex max-h-[min(94vh,920px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/40 shadow-[0_34px_80px_-20px_rgba(15,23,42,0.28)] [color-scheme:light] sm:max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-sd-title"
      >
        <header class="shrink-0 border-b border-slate-200/80 bg-white/80 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div class="min-w-0 pr-2">
              <h2 id="rh-sd-title" class="text-xl font-bold tracking-tight text-slate-900">${escapeHtml(SD_COPY.tituloModal)}</h2>
              <p id="rh-sd-subtitle" class="mt-2 text-sm leading-relaxed text-slate-500">${escapeHtml(SD_COPY.subtituloModal)}</p>
              <div class="mt-3">${badgePending("Pendiente")}</div>
            </div>
            <button
              type="button"
              class="-m-1 flex size-11 shrink-0 items-center justify-center self-end rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:self-start"
              data-rh-sd-close
              aria-label="Cerrar detalle de solicitud"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </header>
        <div id="rh-sd-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"></div>
        <div
          id="rh-sd-tress-loading"
          class="absolute inset-0 z-10 hidden flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <svg class="size-8 animate-spin text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p id="rh-sd-tress-loading-title" class="text-base font-semibold text-[var(--color-primary)]">${escapeHtml(SD_COPY.agregandoVacaciones)}</p>
          <p class="max-w-xs text-sm text-slate-500">${escapeHtml(SD_COPY.agregandoVacacionesHint)}</p>
        </div>
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
    alertaFlujo = `<p class="mt-3 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-white px-3.5 py-3 text-sm font-medium leading-relaxed text-emerald-900"><span class="mr-1.5 inline-block align-middle" aria-hidden="true">✓</span>${escapeHtml(
      SD_COPY.jerarquiaUnaSolaAprobacion,
    )}</p>`;
  } else {
    estadoSup = sinSup ? SD_COPY.supSinAsignar : api.supervisor_aprobo ? SD_COPY.supYaAprobo : SD_COPY.supEstadoCerrada;
    estadoGer = !gerNom ? SD_COPY.gerSinEnCadena : SD_COPY.gerEstadoCerrada;
    alertaFlujo = "";
  }

  return `
    <section class="space-y-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-5" aria-labelledby="rh-sd-jer-title">
      <h3 id="rh-sd-jer-title" class="${SEC_HEAD}">
        ${ICON_USER}
        ${escapeHtml(SD_COPY.seccionJerarquia)}
      </h3>
      <div class="${PANEL} space-y-3.5">
        ${kv(SD_COPY.lblSupervisorAsignado, sinSup ? "—" : supNom)}
        ${kv(SD_COPY.lblGerenteLinea, gerNom || "—")}
        ${kv(SD_COPY.lblEstadoSupervisor, estadoSup, "text-sm font-medium text-slate-700")}
        ${kv(SD_COPY.lblEstadoGerencia, estadoGer, "text-sm font-medium text-slate-700")}
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

  const badge = `<span class="inline-flex max-w-full items-center rounded-full border border-leoni-blue/20 bg-leoni-blue/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-leoni-blue">${escapeHtml(s.tipo_badge)}</span>`;

  const fmtSaldo = (n: number | null) => (n == null ? "—" : String(n));
  const saldoCards =
    soloLectura || s.tipo_codigo !== "vacaciones"
      ? ""
      : `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(SD_COPY.lblSaldoActual)}</p>
        <p class="mt-1 text-xl font-bold tabular-nums text-leoni-blue">${escapeHtml(fmtSaldo(s.saldo_actual))}</p>
      </div>
      <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/30 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(SD_COPY.lblRestante)}</p>
        <p class="mt-1 text-xl font-bold tabular-nums text-emerald-700">${escapeHtml(fmtSaldo(s.saldo_restante))}</p>
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
        <div class="${PANEL}">
          <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
            <div>
              <dt class="${LABEL}">${escapeHtml(SD_COPY.lblNombre)}</dt>
              <dd class="${VALUE} mt-1 break-words">${escapeHtml(e.nombre)}</dd>
            </div>
            <div>
              <dt class="${LABEL}">${escapeHtml(SD_COPY.lblIdEmpleado)}</dt>
              <dd class="${VALUE} mt-1 break-words">${escapeHtml(e.id_empleado)}</dd>
            </div>
            <div>
              <dt class="${LABEL}">${escapeHtml(SD_COPY.lblArea)}</dt>
              <dd class="${VALUE} mt-1 break-words">${escapeHtml(e.area)}</dd>
            </div>
            <div>
              <dt class="${LABEL}">${escapeHtml(SD_COPY.lblPuesto)}</dt>
              <dd class="${VALUE} mt-1 break-words">${escapeHtml(e.puesto)}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="${LABEL}">${escapeHtml(SD_COPY.lblSupervisor)}</dt>
              <dd class="${VALUE} mt-1 break-words text-leoni-blue">${escapeHtml(e.supervisor)}</dd>
            </div>
          </dl>
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
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <p class="${LABEL}">${escapeHtml(SD_COPY.lblFechaInicio)}</p>
              <p class="mt-1 text-base font-bold text-slate-900">${escapeHtml(s.fecha_inicio)}</p>
            </div>
            <div class="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <p class="${LABEL}">${escapeHtml(SD_COPY.lblFechaFin)}</p>
              <p class="mt-1 text-base font-bold text-slate-900">${escapeHtml(s.fecha_fin)}</p>
            </div>
          </div>
          <div class="rounded-xl border border-leoni-blue/15 bg-leoni-blue/[0.06] px-3.5 py-3">
            <span class="text-sm font-medium text-slate-600">${escapeHtml(SD_COPY.lblTotalDias)}</span>
            <p class="mt-1 text-2xl font-bold tabular-nums text-leoni-blue">${escapeHtml(diasTxt)}</p>
          </div>
          <div>
            <p class="${LABEL} mb-2">${escapeHtml(SD_COPY.lblComentarioEmpleado)}</p>
            <p class="rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-blue-50/40 px-3.5 py-3 text-sm leading-relaxed text-slate-700">${escapeHtml(s.comentario_empleado)}</p>
          </div>
          ${saldoCards}
        </div>
      </section>

      ${
        soloLectura || ocultarDecisionJerarquica
          ? ""
          : `<div class="space-y-3 border-t border-slate-200/80 pt-3">
        <button
          type="button"
          id="rh-sd-btn-aprobar"
          data-rh-sd-accion="aprobar"
          class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 text-sm font-bold text-white shadow-[0_10px_22px_rgba(30,64,175,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(30,64,175,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
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

      <div class="border-t border-slate-200/80 pt-4">
        <button
          type="button"
          id="rh-sd-toggle-internal"
          class="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-leoni-blue/30 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
          aria-expanded="false"
          aria-controls="rh-sd-internal-panel"
        >
          <span class="text-lg leading-none text-leoni-blue" aria-hidden="true">+</span>
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
