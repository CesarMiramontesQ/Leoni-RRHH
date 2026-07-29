/**
 * Sección «Puestos» del sidebar RH: cómo está definido el puesto.
 *
 * Perfiles, las competencias que el perfil exige, el catálogo de tareas y la
 * configuración de todo ello. Es la definición; lo que se mide sobre la gente
 * frente a esa definición vive en `talentoNav.ts`.
 *
 * Los ítems salen de `LEVEL_UP_PUESTOS` para que el hub `#/level-up` y el menú
 * no puedan divergir.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_PUESTOS } from "./levelUpNav.ts";

export type PuestosNavKey =
  | "puestos"
  | "wtw"
  | "competencias"
  | "tareas-catalogo"
  | "puestos-ajustes";

export type PuestosNavItem = {
  id: AppShellNavItemId;
  key: PuestosNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const PUESTOS_NAV_ITEMS: readonly PuestosNavItem[] = LEVEL_UP_PUESTOS.map((item) => ({
  id: item.id,
  key: item.key as PuestosNavKey,
  href: item.href,
  label: item.label,
  svgPaths: item.svgPaths,
}));

export const PUESTOS_SIDEBAR_ITEM = {
  id: "puestos" as const,
  key: "puestos" as const,
  href: "#/puestos",
  label: "Puestos",
  svgPaths: LEVEL_UP_PUESTOS[0]!.svgPaths,
};

export const PUESTOS_SUB_NAV_KEYS: ReadonlySet<PuestosNavKey> = new Set(
  PUESTOS_NAV_ITEMS.map((item) => item.key),
);

function filterVisibleItems(rol: string | null): PuestosNavItem[] {
  return PUESTOS_NAV_ITEMS.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function getVisiblePuestosNavItems(rol: string | null): PuestosNavItem[] {
  return filterVisibleItems(rol);
}

export function isPuestosSectionVisibleForRol(rol: string | null): boolean {
  return getVisiblePuestosNavItems(rol).length > 0;
}

export function isPuestosSubNavKey(key: string | undefined): key is PuestosNavKey {
  return key != null && PUESTOS_SUB_NAV_KEYS.has(key as PuestosNavKey);
}
