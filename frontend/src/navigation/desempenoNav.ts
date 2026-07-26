/**
 * Sección «Desempeño» del sidebar RH: lo que se mide por ciclo.
 *
 * Metas, Evaluación 360° y el Ciclo que las combina estaban en tres secciones
 * distintas («Talento», «Level Up», «Cumplimiento») pese a que la 360 y las
 * metas son literalmente las dos señales que el ciclo pondera, y el Historial
 * Objetivo es la tercera cuando `peso_historial > 0`.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_CUMPLIMIENTO, LEVEL_UP_EVALUACION_360 } from "./levelUpNav.ts";

export type DesempenoNavKey =
  | "ciclo-desempeno"
  | "metas"
  | "evaluacion-360"
  | "evaluaciones"
  | "historial-objetivo";

export type DesempenoNavItem = {
  id: AppShellNavItemId;
  key: DesempenoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

const EVALUACIONES = LEVEL_UP_CUMPLIMIENTO.find((item) => item.key === "evaluaciones")!;

/** El ciclo primero: es el que consolida a los demás. */
export const DESEMPENO_NAV_ITEMS: readonly DesempenoNavItem[] = [
  {
    id: "ciclo-desempeno",
    key: "ciclo-desempeno",
    href: "#/talento/ciclo-desempeno",
    label: "Ciclo de Desempeño",
    svgPaths: `<path d="M9 17.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.5m-6 0h6m-6 0-.75-3m6.75 3 .75-3M9 14.25l1.5-6 1.5 3 1.5-4.5 1.5 7.5M4.5 8.25a7.5 7.5 0 1 1 15 0" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "metas",
    key: "metas",
    href: "#/talento/metas",
    label: "Metas",
    svgPaths: `<path d="M3 3v18M3 8.25c1.75-1 3.75-1 5.5 0s3.75 1 5.5 0 3.75-1 5.5 0V15c-1.75 1-3.75 1-5.5 0s-3.75-1-5.5 0-3.75 1-5.5 0V8.25Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: LEVEL_UP_EVALUACION_360.id,
    key: "evaluacion-360",
    href: LEVEL_UP_EVALUACION_360.href,
    label: LEVEL_UP_EVALUACION_360.label,
    svgPaths: LEVEL_UP_EVALUACION_360.svgPaths,
  },
  {
    id: EVALUACIONES.id,
    key: "evaluaciones",
    href: EVALUACIONES.href,
    label: EVALUACIONES.label,
    svgPaths: EVALUACIONES.svgPaths,
  },
  {
    id: "historial-objetivo",
    key: "historial-objetivo",
    href: "#/cumplimiento/historial-objetivo",
    label: "Historial Objetivo",
    svgPaths: `<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const DESEMPENO_SIDEBAR_ITEM = {
  id: "ciclo-desempeno" as const,
  key: "ciclo-desempeno" as const,
  href: "#/talento/ciclo-desempeno",
  label: "Desempeño",
  svgPaths: DESEMPENO_NAV_ITEMS[0]!.svgPaths,
};

export function getVisibleDesempenoNavItems(rol: string | null): DesempenoNavItem[] {
  return DESEMPENO_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}
