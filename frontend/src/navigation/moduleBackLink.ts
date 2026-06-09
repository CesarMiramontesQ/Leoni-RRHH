/**
 * Enlace estándar «Volver» reutilizable entre hubs de módulos (Level Up, Comedor, Laborales).
 */

const ICON_BACK = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;

export const MODULE_BACK_LINK_CLASS =
  "module-back-link inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40";

export function renderModuleBackLink(href: string, ariaLabel: string): string {
  return `<a href="${href}" class="${MODULE_BACK_LINK_CLASS}" aria-label="${ariaLabel}">${ICON_BACK}Volver</a>`;
}

export function renderModuleBackBar(href: string, ariaLabel: string): string {
  return `<div class="mb-4">${renderModuleBackLink(href, ariaLabel)}</div>`;
}
