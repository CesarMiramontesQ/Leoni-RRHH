/**
 * Enlace estándar «Volver» reutilizable entre hubs de módulos (Level Up, Comedor, Laborales).
 */

import { getRolFromAccessToken } from "../auth/jwt.ts";
import { isSupervisorStructuredNavRol } from "./shellNavPolicy.ts";

export const MODULE_BACK_LINK_CLASS =
  "module-back-link inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40";

/** Gestores con menú estructurado (supervisor/gerente) no muestran «Volver» al hub. */
export function shouldShowModuleBackLink(): boolean {
  return !isSupervisorStructuredNavRol(getRolFromAccessToken());
}

/** Envuelve HTML de enlace «Volver» personalizado; vacío si el rol no debe verlo. */
export function whenModuleBackLinkVisible(html: string): string {
  return shouldShowModuleBackLink() ? html : "";
}

export function renderModuleBackLink(_href: string, _ariaLabel: string): string {
  return "";
}

export function renderModuleBackBar(_href: string, _ariaLabel: string): string {
  return "";
}
