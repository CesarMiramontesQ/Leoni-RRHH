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

export type NominasNavKey = "nominas" | "horas-extra" | "conciliacion";

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
  {
    id: "conciliacion",
    key: "conciliacion",
    href: "#/nominas/conciliacion",
    label: "Conciliación",
    svgPaths: `<path d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.126c.122.499-.106 1.028-.589 1.202a15.91 15.91 0 0 1-8.031 0 1.056 1.056 0 0 1-.59-1.202l2.62-10.126" stroke-linecap="round" stroke-linejoin="round" />`,
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
