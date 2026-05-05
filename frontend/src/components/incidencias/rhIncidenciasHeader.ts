import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import { escapeHtml as escapeIncHtml } from "../../ui/uiUtils.ts";
import {
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
} from "./rhIncidenciasPageStyles.ts";

/** Encabezado de página alineado al hero de Solicitudes (mismas clases y botones). */
export function renderRhIncidenciasHeader(): string {
  const exportBtn = `<button
            type="button"
            id="rh-inc-export"
            class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary order-2 w-full sm:w-auto sm:shrink-0 md:order-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-slate-600" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            ${escapeIncHtml(INC_COPY.exportar)}
          </button>`;

  const nuevaBtn = `<button
            type="button"
            id="rh-inc-nueva"
            class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary order-1 w-full sm:w-auto sm:shrink-0 md:order-2"
          >
            <span aria-hidden="true">+</span> ${escapeIncHtml(INC_COPY.nueva)}
          </button>`;

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
      <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
          <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">${escapeIncHtml(INC_COPY.tituloPagina)}</h1>
          <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">${escapeIncHtml(INC_COPY.subtitulo)}</p>
        </div>
        <div class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-2.5">${exportBtn}${nuevaBtn}</div>
      </div>
    </section>`;
}
