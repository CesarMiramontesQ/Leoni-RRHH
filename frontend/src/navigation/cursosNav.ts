/**
 * Navegación agrupada de Cursos para sidebar RH operativo.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_CURSOS, LEVEL_UP_CURSOS_RH_SIDEBAR } from "./levelUpNav.ts";

export type CursosNavKey = "cursos" | "sesiones" | "capacitaciones" | "encuestas";

export type CursosNavItem = {
  id: AppShellNavItemId;
  key: CursosNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const CURSOS_NAV_ITEMS: readonly CursosNavItem[] = LEVEL_UP_CURSOS_RH_SIDEBAR.map((item) => ({
  id: item.id,
  key: item.key as CursosNavKey,
  href: item.href,
  label: item.label,
  svgPaths: item.svgPaths,
}));

export const CURSOS_SIDEBAR_ITEM = {
  id: "cursos" as const,
  key: "cursos" as const,
  href: "#/cursos",
  label: "Cursos",
  svgPaths: LEVEL_UP_CURSOS[0]!.svgPaths,
};

export const CURSOS_SUB_NAV_KEYS: ReadonlySet<CursosNavKey> = new Set(
  CURSOS_NAV_ITEMS.map((item) => item.key),
);

function filterVisibleItems(rol: string | null): CursosNavItem[] {
  return CURSOS_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function getVisibleCursosNavItems(rol: string | null): CursosNavItem[] {
  return filterVisibleItems(rol);
}

export function isCursosSectionVisibleForRol(rol: string | null): boolean {
  return getVisibleCursosNavItems(rol).length > 0;
}

export function isCursosSubNavKey(key: string | undefined): key is CursosNavKey {
  return key != null && CURSOS_SUB_NAV_KEYS.has(key as CursosNavKey);
}
