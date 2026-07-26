/**
 * Sección «Talento» del sidebar RH: quién es quién y qué sabe hacer.
 *
 * Reúne el dashboard, los perfiles de puesto y todo lo que se mide sobre
 * competencias. Antes estaba repartido entre tres secciones —«Puestos»,
 * «Level Up» y «Talento»— aunque Matriz de multihabilidades y Competencias
 * leen la misma tabla y Cobertura y polivalencia es el building block del
 * propio dashboard.
 *
 * Lo que se evalúa por ciclo vive en `desempenoNav.ts`; la capacitación, en
 * `cursosNav.ts`.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_CAPACIDADES, LEVEL_UP_OPERACIONES, LEVEL_UP_PUESTOS } from "./levelUpNav.ts";

export type TalentoNavKey =
  | "dashboard-talento"
  | "puestos"
  | "competencias"
  | "capacidades"
  | "operaciones"
  | "tareas-catalogo"
  | "puestos-ajustes"
  | "encuestas-rh";

export type TalentoNavItem = {
  id: AppShellNavItemId;
  key: TalentoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

const DASHBOARD_TALENTO: TalentoNavItem = {
  id: "dashboard-talento",
  key: "dashboard-talento",
  href: "#/talento/dashboard",
  label: "Dashboard de Talento",
  svgPaths: `<path d="M3 13.5h5.25V21H3v-7.5Zm6.75-6h4.5V21h-4.5V7.5ZM16.5 3h4.5v18h-4.5V3Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

const ENCUESTAS_RH: TalentoNavItem = {
  id: "encuestas-rh",
  key: "encuestas-rh",
  href: "#/talento/encuestas",
  label: "Encuestas",
  svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

const desde = (item: { id: AppShellNavItemId; key: string; href: string; label: string; svgPaths: string }): TalentoNavItem => ({
  id: item.id,
  key: item.key as TalentoNavKey,
  href: item.href,
  label: item.label,
  svgPaths: item.svgPaths,
});

/** El dashboard primero (es la entrada), luego el perfil de puesto y lo que se
 * mide sobre él, y al final la configuración. */
export const TALENTO_NAV_ITEMS: readonly TalentoNavItem[] = [
  DASHBOARD_TALENTO,
  ...LEVEL_UP_PUESTOS.filter((item) => item.key === "puestos" || item.key === "competencias").map(desde),
  desde(LEVEL_UP_CAPACIDADES),
  desde(LEVEL_UP_OPERACIONES),
  ...LEVEL_UP_PUESTOS.filter((item) => item.key === "tareas-catalogo" || item.key === "puestos-ajustes").map(desde),
  ENCUESTAS_RH,
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
