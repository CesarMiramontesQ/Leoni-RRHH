import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

/** Encabezado: título, subtítulo, exportar y nueva incidencia. */
export function renderRhIncidenciasHeader(): string {
  return `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeIncHtml(INC_COPY.tituloPagina)}</h1>
        <p class="mt-2 max-w-2xl text-sm text-text-muted">${escapeIncHtml(INC_COPY.subtitulo)}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
        <button
          type="button"
          id="rh-inc-export"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          ${escapeIncHtml(INC_COPY.exportar)}
        </button>
        <button
          type="button"
          id="rh-inc-nueva"
          class="inline-flex items-center gap-2 rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
        >
          <span class="flex size-5 items-center justify-center rounded-full bg-white/20 text-base leading-none" aria-hidden="true">+</span>
          ${escapeIncHtml(INC_COPY.nueva)}
        </button>
      </div>
    </div>`;
}
