/**
 * Navegación agrupada de Comedor: hub y visibilidad del botón lateral.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isEmpleadoFlatNavRol, isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import type { ShellHubAccessItem, ShellHubCategory } from "./shellHubPage.ts";

export type ComedorNavKey = "comedor" | "reportes";

type ComedorAccessItem = ShellHubAccessItem & {
  id: AppShellNavItemId;
  key: ComedorNavKey;
};

const COMEDOR_ITEMS: readonly ComedorAccessItem[] = [
  {
    id: "comedor",
    key: "comedor",
    href: "#/comedor",
    label: "Gestión Comedor",
    svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "reportes",
    key: "reportes",
    href: "#/comedor/reporte",
    label: "Reporte de comedor",
    svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const COMEDOR_SUB_NAV_KEYS: ReadonlySet<ComedorNavKey> = new Set(
  COMEDOR_ITEMS.map((item) => item.key),
);

export const COMEDOR_SIDEBAR_ITEM = {
  id: "comedor-menu" as const,
  key: "comedor" as const,
  href: "#/comedor/accesos",
  label: "Comedor",
  svgPaths: `<path d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 15.75h-6m6 0a3 3 0 1 1-6 0m6 0H9m6 0v1.125c0 .621-.504 1.125-1.125 1.125H9.375A1.125 1.125 0 0 1 8.25 16.875V15.75m6 0v-1.125A1.125 1.125 0 0 0 13.125 13.5H9.375" stroke-linecap="round" stroke-linejoin="round" />`,
};

function filterVisibleItems(rol: string | null): ShellHubAccessItem[] {
  return COMEDOR_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id)).map(
    ({ href, label, svgPaths }) => ({ href, label, svgPaths }),
  );
}

export function getVisibleComedorCategories(rol: string | null): ShellHubCategory[] {
  const items = filterVisibleItems(rol);
  if (items.length === 0) return [];
  return [{ id: "comedor", title: "Comedor", items }];
}

export function isComedorHubVisibleForRol(rol: string | null): boolean {
  if (isEmpleadoFlatNavRol(rol)) return false;
  return getVisibleComedorCategories(rol).length > 0;
}

export function isComedorSubNavKey(key: string | undefined): key is ComedorNavKey {
  return key != null && COMEDOR_SUB_NAV_KEYS.has(key as ComedorNavKey);
}

export function resolveComedorSidebarActiveNav(activeNav: string | undefined): string | undefined {
  if (activeNav === "comedor" || isComedorSubNavKey(activeNav)) {
    return "comedor";
  }
  return activeNav;
}
