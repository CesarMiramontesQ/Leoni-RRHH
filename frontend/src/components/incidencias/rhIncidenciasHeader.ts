import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../../ui/uiTokens.ts";

/** Encabezado: descripción breve, exportar y nueva incidencia. */
export function renderRhIncidenciasHeader(): string {
  return `
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="min-w-0 max-w-2xl text-xs leading-snug text-text-muted sm:max-w-none sm:text-sm">${escapeIncHtml(INC_COPY.subtitulo)}</h1>
      </div>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
        <button
          type="button"
          id="rh-inc-export"
          class="${BTN_SECONDARY}"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          ${escapeIncHtml(INC_COPY.exportar)}
        </button>
        <button
          type="button"
          id="rh-inc-nueva"
          class="${BTN_PRIMARY}"
        >
          <span aria-hidden="true">+</span> ${escapeIncHtml(INC_COPY.nueva)}
        </button>
      </div>
    </div>`;
}
