/**
 * Sección «Desarrollo» del sidebar RH: cómo se cierra la brecha.
 *
 * Cursos y sus sesiones, más la Gestión de PDI — que hasta ahora no tenía
 * entrada de menú pese a tener página propia y ser uno de los cinco bloques
 * del Dashboard de Talento: a `#/pdi-gestion` solo se llegaba por URL.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_CURSOS, LEVEL_UP_CURSOS_RH_SIDEBAR } from "./levelUpNav.ts";

export type CursosNavKey =
  | "pdi-gestion"
  | "cursos-seguimiento"
  | "cursos"
  | "sesiones"
  | "encuestas"
  | "cursos-ajustes"
  | "cursos-juntas";

export type CursosNavItem = {
  id: AppShellNavItemId;
  key: CursosNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

const PDI_GESTION: CursosNavItem = {
  id: "pdi-gestion",
  key: "pdi-gestion",
  href: "#/pdi-gestion",
  label: "Gestión PDI",
  svgPaths: `<path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const CURSOS_NAV_ITEMS: readonly CursosNavItem[] = [
  ...LEVEL_UP_CURSOS_RH_SIDEBAR.map((item) => ({
    id: item.id,
    key: item.key as CursosNavKey,
    href: item.href,
    label: item.label,
    svgPaths: item.svgPaths,
  })),
  PDI_GESTION,
];

export const CURSOS_SIDEBAR_ITEM = {
  id: "cursos" as const,
  key: "cursos" as const,
  href: "#/cursos",
  label: "Desarrollo",
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
