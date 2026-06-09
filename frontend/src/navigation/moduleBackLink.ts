/**
 * Enlace estándar «Volver» reutilizable entre hubs de módulos (Level Up, Comedor, Laborales).
 */

import { getRolFromAccessToken } from "../auth/jwt.ts";

const ICON_BACK = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;

export const MODULE_BACK_LINK_CLASS =
  "module-back-link inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40";

/** Supervisor tiene las secciones en el menú principal; no muestra «Volver» al hub. */
export function shouldShowModuleBackLink(): boolean {
  return getRolFromAccessToken() !== "supervisor";
}

/** Envuelve HTML de enlace «Volver» personalizado; vacío si el rol no debe verlo. */
export function whenModuleBackLinkVisible(html: string): string {
  return shouldShowModuleBackLink() ? html : "";
}

export function renderModuleBackLink(href: string, ariaLabel: string): string {
  if (!shouldShowModuleBackLink()) return "";
  return `<a href="${href}" class="${MODULE_BACK_LINK_CLASS}" aria-label="${ariaLabel}">${ICON_BACK}Volver</a>`;
}

export function renderModuleBackBar(href: string, ariaLabel: string): string {
  if (!shouldShowModuleBackLink()) return "";
  return `<div class="mb-4">${renderModuleBackLink(href, ariaLabel)}</div>`;
}
