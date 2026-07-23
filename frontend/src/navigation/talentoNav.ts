/**
 * Navegación del grupo «Talento» para sidebar RH operativo: encuestas de
 * clima/pulso (módulo `encuestas-rh`, ver app/core/rh_module_registry.py).
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";

export type TalentoNavKey = "encuestas-rh" | "metas" | "ciclo-desempeno" | "historial-objetivo";

export type TalentoNavItem = {
  id: AppShellNavItemId;
  key: TalentoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const TALENTO_NAV_ITEMS: readonly TalentoNavItem[] = [
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

export const TALENTO_SIDEBAR_ITEM = {
  id: "encuestas-rh" as const,
  key: "encuestas-rh" as const,
  href: "#/talento/encuestas",
  label: "Talento",
  svgPaths: TALENTO_NAV_ITEMS[0]!.svgPaths,
};

export function getVisibleTalentoNavItems(rol: string | null): TalentoNavItem[] {
  return TALENTO_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function isTalentoSectionVisibleForRol(rol: string | null): boolean {
  return getVisibleTalentoNavItems(rol).length > 0;
}
