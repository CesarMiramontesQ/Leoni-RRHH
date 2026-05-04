import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import {
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_SURFACE,
} from "./rhIncidenciasPageStyles.ts";

/** Encabezado de página: título, descripción, exportar y nueva incidencia (mismo lenguaje visual que Actas). */
export function renderRhIncidenciasHeader(): string {
  return `
    <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <h1 class="text-[28px] font-semibold leading-tight tracking-tight text-[#111827]">${escapeIncHtml(INC_COPY.tituloPagina)}</h1>
          <p class="mt-1 min-w-0 max-w-2xl text-sm leading-snug text-[#667085]">${escapeIncHtml(INC_COPY.subtitulo)}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-start gap-2 md:justify-end">
          <button
            type="button"
            id="rh-inc-export"
            class="${RH_LISTADO_BTN_SECONDARY}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            ${escapeIncHtml(INC_COPY.exportar)}
          </button>
          <button
            type="button"
            id="rh-inc-nueva"
            class="${RH_LISTADO_BTN_PRIMARY}"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z" /></svg>
            ${escapeIncHtml(INC_COPY.nueva)}
          </button>
        </div>
      </div>
    </section>`;
}
