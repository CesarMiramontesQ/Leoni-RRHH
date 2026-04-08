/**
 * Modal de detalle de incidencia (se abre al elegir una fila de la tabla).
 */

import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciaTablaFila } from "../../incidencias/rh/types.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";
import { renderRhIncidenciaDetalleModalBody } from "./rhIncidenciaAbiertaCard.ts";

export type RhIncidenciaDetalleModalHandle = {
  open: (row: RhIncidenciaTablaFila) => void;
  close: () => void;
  destroy: () => void;
};

export function mountRhIncidenciaDetalleModal(
  host: HTMLElement,
  options: { signal: AbortSignal },
): RhIncidenciaDetalleModalHandle {
  host.innerHTML = `
    <div
      id="rh-inc-detalle-overlay"
      class="fixed inset-0 z-[61] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)] [color-scheme:light]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-inc-detalle-title"
        data-rh-inc-detalle-panel
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="rh-inc-detalle-title" class="text-base font-bold text-slate-900 sm:text-lg">${escapeIncHtml(INC_COPY.detalleModalTitulo)}</h2>
          <button
            type="button"
            data-rh-inc-detalle-close
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="${escapeIncHtml(INC_COPY.detalleModalCerrar)}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="rh-inc-detalle-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-4 sm:py-4"></div>
      </div>
    </div>`;

  const overlayFound = host.querySelector("#rh-inc-detalle-overlay");
  const bodyFound = host.querySelector("#rh-inc-detalle-body");
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

  function open(row: RhIncidenciaTablaFila): void {
    bodyEl.innerHTML = renderRhIncidenciaDetalleModalBody(row);
    overlayEl.classList.remove("hidden");
    overlayEl.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function onOverlayClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.closest("[data-rh-inc-detalle-close]")) {
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
