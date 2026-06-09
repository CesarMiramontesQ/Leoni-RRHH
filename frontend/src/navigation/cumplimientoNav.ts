/**
 * Navegación agrupada de Cumplimiento para sidebar RH operativo.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_CUMPLIMIENTO_RH_SIDEBAR } from "./levelUpNav.ts";

export type CumplimientoNavKey = "evaluaciones" | "opls" | "evidencias" | "sugerencias";

export type CumplimientoNavItem = {
  id: AppShellNavItemId;
  key: CumplimientoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const CUMPLIMIENTO_NAV_ITEMS: readonly CumplimientoNavItem[] =
  LEVEL_UP_CUMPLIMIENTO_RH_SIDEBAR.map((item) => ({
    id: item.id,
    key: item.key as CumplimientoNavKey,
    href: item.href,
    label: item.label,
    svgPaths: item.svgPaths,
  }));

export const CUMPLIMIENTO_SIDEBAR_ITEM = {
  id: "evaluaciones" as const,
  key: "evaluaciones" as const,
  href: "#/evaluaciones",
  label: "Cumplimiento",
  svgPaths: LEVEL_UP_CUMPLIMIENTO_RH_SIDEBAR[0]!.svgPaths,
};

export const CUMPLIMIENTO_SUB_NAV_KEYS: ReadonlySet<CumplimientoNavKey> = new Set(
  CUMPLIMIENTO_NAV_ITEMS.map((item) => item.key),
);

function filterVisibleItems(rol: string | null): CumplimientoNavItem[] {
  return CUMPLIMIENTO_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function getVisibleCumplimientoNavItems(rol: string | null): CumplimientoNavItem[] {
  return filterVisibleItems(rol);
}

export function isCumplimientoSectionVisibleForRol(rol: string | null): boolean {
  return getVisibleCumplimientoNavItems(rol).length > 0;
}

export function isCumplimientoSubNavKey(key: string | undefined): key is CumplimientoNavKey {
  return key != null && CUMPLIMIENTO_SUB_NAV_KEYS.has(key as CumplimientoNavKey);
}
