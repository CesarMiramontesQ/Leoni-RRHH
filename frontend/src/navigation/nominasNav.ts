/**
 * Navegación agrupada de Nóminas: hub y visibilidad del botón lateral.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isRhOperativoUiMode } from "../auth/rhUiMode.ts";
import {
  isEmpleadoFlatNavRol,
  isShellNavItemVisibleForRol,
  isSupervisorStructuredNavRol,
} from "./shellNavPolicy.ts";
import type { ShellHubAccessItem, ShellHubCategory } from "./shellHubPage.ts";

export type NominasNavKey = "nominas" | "horas-extra";

type NominasAccessItem = ShellHubAccessItem & {
  id: AppShellNavItemId;
  key: NominasNavKey;
};

export const NOMINAS_NAV_ITEMS: readonly NominasAccessItem[] = [
  {
    id: "horas-extra",
    key: "horas-extra",
    href: "#/nominas/horas-extra",
    label: "Horas Extra",
    svgPaths: `<path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const NOMINAS_SUB_NAV_KEYS: ReadonlySet<NominasNavKey> = new Set(
  NOMINAS_NAV_ITEMS.map((item) => item.key),
);

export const NOMINAS_SIDEBAR_ITEM = {
  id: "nominas" as const,
  key: "nominas" as const,
  href: "#/nominas/horas-extra",
  label: "Nóminas",
  svgPaths: `<path d="M2.25 8.25h19.5M2.25 12h19.5m-19.5 3.75h19.5M3.75 6.75h16.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

function filterVisibleItems(rol: string | null): ShellHubAccessItem[] {
  return NOMINAS_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id)).map(
    ({ href, label, svgPaths }) => ({ href, label, svgPaths }),
  );
}

export function getVisibleNominasCategories(rol: string | null): ShellHubCategory[] {
  const items = filterVisibleItems(rol);
  if (items.length === 0) return [];
  return [{ id: "nominas", title: "Nóminas", items }];
}

export function isNominasHubVisibleForRol(rol: string | null): boolean {
  if (isEmpleadoFlatNavRol(rol) || isSupervisorStructuredNavRol(rol)) return false;
  if (rol === "rh" && isRhOperativoUiMode()) return false;
  return getVisibleNominasCategories(rol).length > 0;
}

export function isNominasSubNavKey(key: string | undefined): key is NominasNavKey {
  return key != null && NOMINAS_SUB_NAV_KEYS.has(key as NominasNavKey);
}

export function resolveNominasSidebarActiveNav(activeNav: string | undefined): string | undefined {
  if (activeNav === "nominas" || isNominasSubNavKey(activeNav)) {
    return "nominas";
  }
  return activeNav;
}
