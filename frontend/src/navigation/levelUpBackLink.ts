/**
 * Enlace estándar «Volver» al hub principal de Level Up (#/level-up).
 */

export const LEVEL_UP_HUB_HREF = "#/level-up";

const ICON_BACK = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;

const LEVEL_UP_BACK_LINK_CLASS =
  "level-up-back-link inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40";

/** Botón/enlace «Volver» al menú principal de Level Up. */
export function renderLevelUpBackLink(): string {
  return `<a href="${LEVEL_UP_HUB_HREF}" class="${LEVEL_UP_BACK_LINK_CLASS}" aria-label="Volver a Level Up">${ICON_BACK}Volver</a>`;
}

/** Contenedor con margen inferior para ubicar el enlace antes del encabezado de página. */
export function renderLevelUpBackBar(): string {
  return `<div class="mb-4">${renderLevelUpBackLink()}</div>`;
}
