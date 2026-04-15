/**
 * Plantillas HTML — modal de detalle de solicitud resuelta (consulta).
 */

import { SR_COPY } from "../../solicitudes/rh/solicitudResueltaCopy.ts";
import type { SolicitudHistorialTipo, SolicitudResueltaDetalleVm } from "../../solicitudes/rh/solicitudResueltaTypes.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";


const CARD =
  "rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/[0.04] sm:p-5 [color-scheme:light]";
const CARD_TITLE = "text-[10px] font-bold uppercase tracking-wider text-slate-500";
const LBL = "text-xs text-slate-500";
const VAL = "text-sm font-semibold text-slate-900";

function timelineIcon(tipo: SolicitudHistorialTipo): { wrap: string; svg: string } {
  const base = "flex size-9 shrink-0 items-center justify-center rounded-full ring-2 ring-white";
  switch (tipo) {
    case "creada":
      return {
        wrap: `${base} bg-slate-100 text-slate-600`,
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true"><path stroke-linecap="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
      };
    case "revisada":
      return {
        wrap: `${base} bg-sky-100 text-sky-700`,
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`,
      };
    case "aprobada":
    case "finalizada":
      return {
        wrap: `${base} bg-emerald-100 text-emerald-700`,
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>`,
      };
    case "rechazada":
      return {
        wrap: `${base} bg-red-100 text-red-700`,
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true"><path stroke-linecap="round" d="M6 18 18 6M6 6l12 12"/></svg>`,
      };
    case "firma_pendiente":
      return {
        wrap: `${base} bg-amber-100 text-amber-800`,
        svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
      };
    default:
      return {
        wrap: `${base} bg-slate-100 text-slate-600`,
        svg: "",
      };
  }
}

function renderTimelineItem(
  item: SolicitudResueltaDetalleVm["historial"][0],
  isLatest: boolean,
  isLast: boolean,
): string {
  const { wrap, svg } = timelineIcon(item.tipo);
  const ring = isLatest ? "ring-2 ring-leoni-blue/35 ring-offset-2" : "";
  const comentario =
    item.comentario?.trim() ?
      `<blockquote class="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm italic text-slate-600">"${escapeHtml(item.comentario.trim())}"</blockquote>`
    : "";
  const rail =
    isLast ? "" : `<span class="mt-2 block w-0.5 flex-1 min-h-6 shrink-0 bg-slate-200" aria-hidden="true"></span>`;

  return `
    <li class="flex gap-4">
      <div class="flex flex-col items-center pt-0.5">
        <span class="${wrap} ${ring}" aria-hidden="true">${svg}</span>
        ${rail}
      </div>
      <div class="min-w-0 flex-1 pb-2">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p class="text-sm font-bold text-slate-900">${escapeHtml(item.titulo)}</p>
          <time class="shrink-0 text-xs text-slate-500">${escapeHtml(item.fecha_hora)}</time>
        </div>
        <p class="mt-1 text-xs text-slate-600">
          <span class="font-medium text-slate-700">${escapeHtml(item.actor_nombre)}</span>
          <span class="text-slate-400"> · </span>
          <span>${escapeHtml(item.actor_rol)}</span>
        </p>
        ${comentario}
      </div>
    </li>`;
}

export function solicitudResueltaShellHtml(): string {
  return `
    <div
      id="rh-sr-overlay"
      class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px] sm:p-6"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,920px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_56px_-12px_rgba(15,23,42,0.2)] [color-scheme:light] lg:max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-sr-title"
      >
        <header class="flex shrink-0 justify-end border-b border-slate-100 px-5 pt-4 sm:px-8 sm:pt-5">
          <button
            type="button"
            class="-m-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            data-rh-sr-close
            aria-label="${escapeHtml(SR_COPY.cerrarAria)}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="rh-sr-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-7"></div>
      </div>
    </div>`;
}

export function solicitudResueltaLoadingBodyHtml(): string {
  return `
    <div class="flex flex-col items-center justify-center gap-3 py-20 text-sm text-slate-500">
      <svg class="size-8 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      ${escapeHtml(SR_COPY.cargando)}
    </div>`;
}

export function solicitudResueltaErrorBodyHtml(message: string): string {
  return `
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800" role="alert">
      ${escapeHtml(message)}
    </div>
    <div class="mt-6 flex justify-center">
      <button type="button" data-rh-sr-close class="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        ${escapeHtml(SR_COPY.btnCerrar)}
      </button>
    </div>`;
}

export function solicitudResueltaEmptyBodyHtml(): string {
  return `
    <p class="py-16 text-center text-sm text-slate-500">${escapeHtml(SR_COPY.vacio)}</p>
    <div class="flex justify-center">
      <button type="button" data-rh-sr-close class="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        ${escapeHtml(SR_COPY.btnCerrar)}
      </button>
    </div>`;
}

function headerInnerHtml(vm: SolicitudResueltaDetalleVm): string {
  const badgeAprobada = `inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800`;
  const badgeRechazada = `inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-800`;
  const badgeCls = vm.estado_ui === "aprobada" ? badgeAprobada : badgeRechazada;
  const badgeTxt = vm.estado_ui === "aprobada" ? SR_COPY.badgeAprobado : SR_COPY.badgeRechazado;

  return `
    <div class="flex flex-wrap items-start justify-between gap-3 pr-2">
      <div class="min-w-0">
        <h2 id="rh-sr-title" class="text-xl font-bold tracking-tight text-leoni-blue sm:text-2xl">${escapeHtml(vm.titulo)}</h2>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(vm.id_etiqueta)}</p>
      </div>
      <span class="${badgeCls} shrink-0">${escapeHtml(badgeTxt)}</span>
    </div>`;
}

export function solicitudResueltaContentHtml(vm: SolicitudResueltaDetalleVm): string {
  const diasTxt = SR_COPY.diasLaborales(vm.total_dias);
  const n = vm.historial.length;
  const timelineItems = vm.historial
    .map((item, i) => renderTimelineItem(item, i === 0, i === n - 1))
    .join("");

  const rechazoBloque =
    vm.estado_ui === "rechazada" ?
      `<div class="rounded-xl border border-red-200/90 bg-red-50/80 p-4 sm:p-5">
        <h4 class="text-sm font-bold text-red-900">${escapeHtml(SR_COPY.bloqueRechazoTitulo)}</h4>
        <p class="mt-2 text-sm leading-relaxed text-red-900/90">${escapeHtml(vm.motivo_rechazo ?? "—")}</p>
        <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div><dt class="text-slate-600">${escapeHtml(SR_COPY.lblResponsable)}</dt><dd class="font-semibold text-slate-900">${escapeHtml(vm.rechazado_por ?? "—")}</dd></div>
          <div><dt class="text-slate-600">${escapeHtml(SR_COPY.lblFechaRechazo)}</dt><dd class="font-semibold text-slate-900">${escapeHtml(vm.fecha_rechazo ?? "—")}</dd></div>
        </dl>
        ${vm.comentario_rechazo_largo && vm.comentario_rechazo_largo !== vm.motivo_rechazo ? `<div id="rh-sr-rechazo-largo" class="mt-3 hidden rounded-lg border border-red-100 bg-white px-3 py-2 text-sm text-slate-700">${escapeHtml(vm.comentario_rechazo_largo)}</div>` : ""}
      </div>`
    : "";

  const footerAprobadaProceso =
    vm.estado_ui === "aprobada" && vm.proceso_completado ?
      `<div class="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-600">${escapeHtml(SR_COPY.procesoCompletado)}</p>
        <div class="flex flex-wrap justify-end gap-3">
          ${vm.comprobante_disponible ? `<button type="button" data-rh-sr-descargar class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">${escapeHtml(SR_COPY.btnDescargar)}</button>` : ""}
          <button type="button" data-rh-sr-close class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">${escapeHtml(SR_COPY.btnCerrar)}</button>
        </div>
      </div>`
    : "";

  const footerAprobadaActiva =
    vm.estado_ui === "aprobada" && !vm.proceso_completado ?
      `<div class="flex flex-col gap-4 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <p class="text-sm text-leoni-blue">
          <span class="mr-1 inline-block size-2 rounded-full bg-leoni-blue align-middle" aria-hidden="true"></span>
          <span class="font-semibold">${escapeHtml(SR_COPY.siguientePaso)}</span>
          ${vm.siguiente_paso ? ` ${escapeHtml(vm.siguiente_paso)}` : ""}
        </p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          ${vm.puede_cancelar ? `<button type="button" data-rh-sr-cancelar class="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">${escapeHtml(SR_COPY.btnCancelar)}</button>` : ""}
          ${vm.puede_firmar ? `<button type="button" data-rh-sr-firmar class="min-h-11 rounded-xl bg-leoni-blue px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-leoni-blue/20 hover:bg-leoni-blue-light">${escapeHtml(SR_COPY.btnFirmar)}</button>` : ""}
        </div>
      </div>`
    : "";

  const footerRechazada =
    vm.estado_ui === "rechazada" ?
      `<div class="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-wrap gap-2">
          ${vm.comentario_rechazo_largo && vm.comentario_rechazo_largo !== vm.motivo_rechazo ? `<button type="button" id="rh-sr-toggle-comentario" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">${escapeHtml(SR_COPY.btnVerComentario)}</button>` : ""}
          ${vm.comprobante_disponible ? `<button type="button" data-rh-sr-descargar class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">${escapeHtml(SR_COPY.btnDescargar)}</button>` : ""}
        </div>
        <button type="button" data-rh-sr-close class="min-h-11 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200">${escapeHtml(SR_COPY.btnCerrar)}</button>
      </div>`
    : "";

  return `
    <div id="rh-sr-scroll" class="space-y-6">
    <div class="border-b border-slate-100 pb-5">${headerInnerHtml(vm)}</div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="${CARD}">
          <h3 class="${CARD_TITLE}">${escapeHtml(SR_COPY.cardGeneral)}</h3>
          <dl class="mt-4 space-y-3">
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblEmpleado)}</dt><dd class="${VAL}">${escapeHtml(vm.empleado_nombre)}</dd></div>
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblTipoAusencia)}</dt><dd class="${VAL}">${escapeHtml(vm.tipo_ausencia)}</dd></div>
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblDepartamento)}</dt><dd class="${VAL}">${escapeHtml(vm.departamento)}</dd></div>
          </dl>
        </div>
        <div class="${CARD}">
          <h3 class="${CARD_TITLE}">${escapeHtml(SR_COPY.cardPeriodo)}</h3>
          <dl class="mt-4 space-y-3">
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblDesde)}</dt><dd class="${VAL}">${escapeHtml(vm.fecha_inicio)}</dd></div>
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblHasta)}</dt><dd class="${VAL}">${escapeHtml(vm.fecha_fin)}</dd></div>
            <div><dt class="${LBL}">${escapeHtml(SR_COPY.lblTotalDias)}</dt><dd class="text-lg font-bold tabular-nums text-leoni-blue">${escapeHtml(diasTxt)}</dd></div>
          </dl>
        </div>
      </div>

      ${rechazoBloque}

      <section class="border-t border-slate-100 pt-6" aria-labelledby="rh-sr-hist-title">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 id="rh-sr-hist-title" class="flex items-center gap-2 text-base font-bold text-slate-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-leoni-blue" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            ${escapeHtml(SR_COPY.seccionHistorial)}
          </h3>
          <p class="text-xs text-slate-500">${escapeHtml(SR_COPY.actualizado)}${vm.actualizado_relativo ? ` · ${escapeHtml(vm.actualizado_relativo)}` : ""}</p>
        </div>
        <ul class="space-y-0">
          ${timelineItems}
        </ul>
      </section>

      ${footerAprobadaProceso}
      ${footerAprobadaActiva}
      ${footerRechazada}
      <input type="hidden" id="rh-sr-solicitud-id" value="${escapeHtml(vm.id)}" />
    </div>`;
}
