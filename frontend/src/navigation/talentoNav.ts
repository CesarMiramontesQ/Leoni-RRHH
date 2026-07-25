/**
 * Navegación del grupo «Talento» para sidebar RH operativo: encuestas de
 * clima/pulso (módulo `encuestas-rh`, ver app/core/rh_module_registry.py).
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";

export type TalentoNavKey = "dashboard-talento" | "encuestas-rh" | "metas" | "ciclo-desempeno" | "historial-objetivo";

export type TalentoNavItem = {
  id: AppShellNavItemId;
  key: TalentoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const TALENTO_NAV_ITEMS: readonly TalentoNavItem[] = [
  {
    id: "dashboard-talento",
    key: "dashboard-talento",
    href: "#/talento/dashboard",
    label: "Dashboard de Talento",
    svgPaths: `<path d="M3 13.5h5.25V21H3v-7.5Zm6.75-6h4.5V21h-4.5V7.5ZM16.5 3h4.5v18h-4.5V3Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "encuestas-rh",
    key: "encuestas-rh",
    href: "#/talento/encuestas",
    label: "Encuestas",
    svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "metas",
    key: "metas",
    href: "#/talento/metas",
    label: "Metas",
    svgPaths: `<path d="M3 3v18M3 8.25c1.75-1 3.75-1 5.5 0s3.75 1 5.5 0 3.75-1 5.5 0V15c-1.75 1-3.75 1-5.5 0s-3.75-1-5.5 0-3.75 1-5.5 0V8.25Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "ciclo-desempeno",
    key: "ciclo-desempeno",
    href: "#/talento/ciclo-desempeno",
    label: "Ciclo de Desempeño",
    svgPaths: `<path d="M9 17.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.5m-6 0h6m-6 0-.75-3m6.75 3 .75-3M9 14.25l1.5-6 1.5 3 1.5-4.5 1.5 7.5M4.5 8.25a7.5 7.5 0 1 1 15 0" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "historial-objetivo",
    key: "historial-objetivo",
    href: "#/cumplimiento/historial-objetivo",
    label: "Historial Objetivo",
    svgPaths: `<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

/** Icono original del hub «Talento» (encuestas de clima/pulso): fijo por id,
 * no por posicion -- `TALENTO_NAV_ITEMS[0]` cambia de icono cada vez que se
 * reordena la lista (p.ej. al insertar el Dashboard de Talento como primer
 * item), aunque `TALENTO_SIDEBAR_ITEM` siga apuntando a `encuestas-rh`. */
const ICONO_ENCUESTAS_RH = TALENTO_NAV_ITEMS.find((item) => item.id === "encuestas-rh")!.svgPaths;

export const TALENTO_SIDEBAR_ITEM = {
  id: "encuestas-rh" as const,
  key: "encuestas-rh" as const,
  href: "#/talento/encuestas",
  label: "Talento",
  svgPaths: ICONO_ENCUESTAS_RH,
};

export function getVisibleTalentoNavItems(rol: string | null): TalentoNavItem[] {
  return TALENTO_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function isTalentoSectionVisibleForRol(rol: string | null): boolean {
  return getVisibleTalentoNavItems(rol).length > 0;
}
