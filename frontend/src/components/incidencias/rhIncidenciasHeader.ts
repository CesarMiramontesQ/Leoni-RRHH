import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import {
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "./rhIncidenciasPageStyles.ts";

/** Encabezado compacto: título, descripción y acciones alineadas a la derecha en escritorio. */
export function renderRhIncidenciasHeader(): string {
  const exportBtn = `<button
            type="button"
            id="rh-inc-export"
            class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary w-full shrink-0 sm:w-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-[color:var(--color-text-secondary)]" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            ${escapeIncHtml(INC_COPY.exportar)}
          </button>`;

  const nuevaBtn = `<button
            type="button"
            id="rh-inc-nueva"
            class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary w-full shrink-0 sm:w-auto"
          >
            <span aria-hidden="true">+</span> ${escapeIncHtml(INC_COPY.nueva)}
          </button>`;

  return `
    <section class="${RH_LISTADO_SURFACE} rh-inc-page-header rounded-lg border border-[color:var(--color-border)] px-4 py-3 shadow-sm sm:px-5 sm:py-3.5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold leading-tight tracking-tight text-[color:var(--color-text-primary)] sm:text-xl">${escapeIncHtml(INC_COPY.tituloPagina)}</h1>
          <p class="mt-1 max-w-2xl text-pretty text-xs leading-snug text-[color:var(--color-text-secondary)] sm:text-sm sm:leading-relaxed">${escapeIncHtml(INC_COPY.subtitulo)}</p>
        </div>
        <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2">
          ${exportBtn}
          ${nuevaBtn}
        </div>
      </div>
    </section>`;
}
