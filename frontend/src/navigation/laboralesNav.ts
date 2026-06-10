/**
 * Navegación agrupada de Laborales: hub y visibilidad del botón lateral.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isRhOperativoUiMode } from "../auth/rhUiMode.ts";
import { isEmpleadoFlatNavRol, isShellNavItemVisibleForRol, isSupervisorStructuredNavRol } from "./shellNavPolicy.ts";
import type { ShellHubAccessItem, ShellHubCategory } from "./shellHubPage.ts";

export type LaboralesNavKey = "laborales" | "metricas" | "solicitudes" | "incidencias" | "actas";

type LaboralesAccessItem = ShellHubAccessItem & {
  id: AppShellNavItemId;
  key: LaboralesNavKey;
};

export const LABORALES_NAV_ITEMS: readonly LaboralesAccessItem[] = [
  {
    id: "metricas",
    key: "metricas",
    href: "#/metricas",
    label: "Métricas",
    svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "solicitudes",
    key: "solicitudes",
    href: "#/solicitudes",
    label: "Solicitudes",
    svgPaths: `<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "incidencias",
    key: "incidencias",
    href: "#/incidencias",
    label: "Incidencias",
    svgPaths: `<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "actas",
    key: "actas",
    href: "#/actas",
    label: "Actas",
    svgPaths: `<path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const LABORALES_SUB_NAV_KEYS: ReadonlySet<LaboralesNavKey> = new Set(
  LABORALES_NAV_ITEMS.map((item) => item.key),
);

export const LABORALES_SIDEBAR_ITEM = {
  id: "laborales" as const,
  key: "laborales" as const,
  href: "#/laborales",
  label: "Laborales",
  svgPaths: `<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 3h1A2.25 2.25 0 0 1 16.65 3.836m-5.8 0c-.376.023-.75.05-1.124.08C8.095 4.01 7.25 4.973 7.25 6.108V8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75" stroke-linecap="round" stroke-linejoin="round" />`,
};

function filterVisibleItems(rol: string | null): ShellHubAccessItem[] {
  return LABORALES_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id)).map(
    ({ href, label, svgPaths }) => ({ href, label, svgPaths }),
  );
}

export function getVisibleLaboralesCategories(rol: string | null): ShellHubCategory[] {
  const items = filterVisibleItems(rol);
  if (items.length === 0) return [];
  return [{ id: "laborales", title: "Laborales", items }];
}

export function isLaboralesHubVisibleForRol(rol: string | null): boolean {
  if (isEmpleadoFlatNavRol(rol) || isSupervisorStructuredNavRol(rol)) return false;
  if (rol === "rh" && isRhOperativoUiMode()) return false;
  return getVisibleLaboralesCategories(rol).length > 0;
}

export function isLaboralesSubNavKey(key: string | undefined): key is LaboralesNavKey {
  return key != null && LABORALES_SUB_NAV_KEYS.has(key as LaboralesNavKey);
}

export function resolveLaboralesSidebarActiveNav(
  activeNav: string | undefined,
  rol?: string | null,
): string | undefined {
  if (isSupervisorStructuredNavRol(rol ?? null)) return activeNav;
  if (activeNav === "laborales" || isLaboralesSubNavKey(activeNav)) {
    return "laborales";
  }
  return activeNav;
}
