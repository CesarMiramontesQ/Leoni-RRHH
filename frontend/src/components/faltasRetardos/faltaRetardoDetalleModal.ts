/**
 * Modal de detalle de un evento de faltas/retardos (abre al elegir una fila).
 */

import type { FaltaRetardoListItem } from "../../api/faltasRetardos.ts";
import {
  badgeClassFaltaRetardoTipo,
  formatFaltaRetardoFechas,
  labelFaltaRetardoTipo,
} from "../../faltasRetardos/rh/constants.ts";
import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import { escapeHtml, fmtFechaCorta, fmtTablaCelda } from "../../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";

export type FaltaRetardoDetalleModalHandle = {
  open: (row: FaltaRetardoListItem) => void;
  close: () => void;
  destroy: () => void;
};

function detailRow(label: string, valueHtml: string): string {
  return `<div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(label)}</dt><dd class="mt-1 text-sm text-slate-900">${valueHtml}</dd></div>`;
}

function labelOrigen(origen: string | null | undefined): string {
  if (!origen?.trim()) return "—";
  const map: Record<string, string> = {
    manual: FR_COPY.detalleOrigenManual,
    ausencia: FR_COPY.detalleOrigenAusencia,
    permiso: FR_COPY.detalleOrigenPermiso,
    importadas_historico: "Historial de asistencia (importadas)",
    ponderaciones: "Ponderaciones",
    evaluacion_historica: "Evaluación histórica",
  };
  return map[origen] ?? origen;
}

function renderDetalleBody(row: FaltaRetardoListItem): string {
  const nombre = formatNombreEmpleadoUi(row.empleado_nombre ?? "") || "—";
  const noEmp = formatNoEmpleadoDisplay(row.numero_empleado) || "—";
  const fechas = formatFaltaRetardoFechas(
    fmtFechaCorta(row.fecha_evento),
    row.fecha_fin ? fmtFechaCorta(row.fecha_fin) : null,
  );
  const tipoLabel = labelFaltaRetardoTipo(row.tipo);
  const tipoCls = badgeClassFaltaRetardoTipo(row.tipo);
  const tipoBadge = `<span class="rh-inc-type-pill ${tipoCls}">${escapeHtml(tipoLabel)}</span>`;
  const registrador = row.registrado_por_nombre
    ? formatNombreEmpleadoUi(row.registrado_por_nombre)
    : "—";
  const obs = fmtTablaCelda(row.observaciones ?? "");

  return `
    <div class="mb-4">${tipoBadge}</div>
    <dl class="grid gap-4 sm:grid-cols-2">
      ${detailRow(FR_COPY.colNoEmpleado, escapeHtml(noEmp))}
      ${detailRow(FR_COPY.colNombre, escapeHtml(nombre))}
      ${detailRow(FR_COPY.colTipo, escapeHtml(tipoLabel))}
      ${detailRow(FR_COPY.colFechas, escapeHtml(fechas))}
      ${detailRow(FR_COPY.colObservaciones, `<span class="whitespace-pre-wrap break-words">${escapeHtml(obs)}</span>`)}
      ${detailRow(FR_COPY.colRegistrado, escapeHtml(fmtFechaCorta(row.created_at)))}
      ${detailRow(FR_COPY.colUsuario, escapeHtml(registrador))}
      ${detailRow(FR_COPY.detalleColOrigen, escapeHtml(labelOrigen(row.origen)))}
    </dl>`;
}

export function mountFaltaRetardoDetalleModal(
  host: HTMLElement,
  options: { signal: AbortSignal },
): FaltaRetardoDetalleModalHandle {
  host.innerHTML = `
    <div
      id="rh-fr-detalle-overlay"
      class="fixed inset-0 z-[61] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)] [color-scheme:light]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-fr-detalle-title"
        data-rh-fr-detalle-panel
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="rh-fr-detalle-title" class="text-base font-bold text-slate-900 sm:text-lg">${escapeHtml(FR_COPY.detalleModalTitulo)}</h2>
          <button
            type="button"
            data-rh-fr-detalle-close
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="${escapeHtml(FR_COPY.detalleModalCerrar)}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="rh-fr-detalle-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"></div>
      </div>
    </div>`;

  const overlayFound = host.querySelector("#rh-fr-detalle-overlay");
  const bodyFound = host.querySelector("#rh-fr-detalle-body");
  if (!(overlayFound instanceof HTMLElement) || !(bodyFound instanceof HTMLElement)) {
    return { open: () => {}, close: () => {}, destroy: () => void (host.innerHTML = "") };
  }
  const overlayEl = overlayFound;
  const bodyEl = bodyFound;

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    bodyEl.innerHTML = "";
  }

  function open(row: FaltaRetardoListItem): void {
    bodyEl.innerHTML = renderDetalleBody(row);
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function onOverlayClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.closest("[data-rh-fr-detalle-close]")) {
      e.preventDefault();
      close();
      return;
    }
    if (t === overlayEl) {
      e.preventDefault();
      close();
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    if (overlayEl.classList.contains("hidden")) return;
    e.preventDefault();
    close();
  }

  overlayEl.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onKeydown, { signal: options.signal });

  return {
    open,
    close,
    destroy: () => {
      overlayEl.removeEventListener("click", onOverlayClick);
      close();
      host.innerHTML = "";
    },
  };
}
