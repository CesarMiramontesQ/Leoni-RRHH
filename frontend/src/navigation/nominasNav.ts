/**
 * Navegación agrupada de Nóminas: hub y visibilidad del botón lateral.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { hasExplicitModuleGrant, isModulosRhEnrolled } from "../auth/rhModulePermissions.ts";
import { isRhOperativoUiMode } from "../auth/rhUiMode.ts";
import {
  isEmpleadoFlatNavRol,
  isShellNavItemVisibleForRol,
  isSupervisorStructuredNavRol,
} from "./shellNavPolicy.ts";
import type { ShellHubAccessItem, ShellHubCategory } from "./shellHubPage.ts";

export type NominasNavKey =
  | "nominas"
  | "horas-extra"
  | "horas-extra-aprobaciones"
  | "conciliacion"
  | "nominas-ajustes";

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
    id: "horas-extra-aprobaciones",
    key: "horas-extra-aprobaciones",
    href: "#/nominas/horas-extra/aprobaciones",
    label: "Aprobación de Horas Extra",
    svgPaths: `<path d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "conciliacion",
    key: "conciliacion",
    href: "#/nominas/conciliacion",
    label: "Conciliación",
    svgPaths: `<path d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.126c.122.499-.106 1.028-.589 1.202a15.91 15.91 0 0 1-8.031 0 1.056 1.056 0 0 1-.59-1.202l2.62-10.126" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "nominas-ajustes",
    key: "nominas-ajustes",
    href: "#/nominas/ajustes",
    label: "Ajustes de Nóminas",
    svgPaths: `<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
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

/** Grant explícito de Nóminas para un usuario de otro rol inscrito por RH. */
export function hasNominasGrant(rol: string | null): boolean {
  return rol !== "rh" && isModulosRhEnrolled() && hasExplicitModuleGrant("nominas");
}

export function isNominasHubVisibleForRol(rol: string | null): boolean {
  if (hasNominasGrant(rol)) return getVisibleNominasCategories(rol).length > 0;
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
