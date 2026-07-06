/**
 * Navegación del submenú de primer nivel «Personal Externo» para el sidebar RH.
 *
 * Agrupa las subpáginas de capacitación de personal externo (Contratistas,
 * Cursos externos, Vencimientos), antes planas dentro de Cursos. Espejo de
 * `cursosNav.ts`: mismo tipo de ítem y misma lógica de visibilidad por rol.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { LEVEL_UP_PERSONAL_EXTERNO_SIDEBAR } from "./levelUpNav.ts";

export type PersonalExternoNavKey =
  | "cursos-proveedores"
  | "cursos-externos"
  | "cursos-vencimientos";

export type PersonalExternoNavItem = {
  id: AppShellNavItemId;
  key: PersonalExternoNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

/** Encabezado (título + ícono) del acordeón «Personal Externo» en el sidebar. */
export const PERSONAL_EXTERNO_SIDEBAR_ITEM = {
  label: "Personal Externo",
  svgPaths: `<path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const PERSONAL_EXTERNO_NAV_ITEMS: readonly PersonalExternoNavItem[] =
  LEVEL_UP_PERSONAL_EXTERNO_SIDEBAR.map((item) => ({
    id: item.id,
    key: item.key as PersonalExternoNavKey,
    href: item.href,
    label: item.label,
    svgPaths: item.svgPaths,
  }));

export const PERSONAL_EXTERNO_SUB_NAV_KEYS: ReadonlySet<PersonalExternoNavKey> = new Set(
  PERSONAL_EXTERNO_NAV_ITEMS.map((item) => item.key),
);

export function getVisiblePersonalExternoNavItems(rol: string | null): PersonalExternoNavItem[] {
  return PERSONAL_EXTERNO_NAV_ITEMS.filter((item) =>
    isShellNavItemVisibleForRol(rol, item.id),
  );
}

export function isPersonalExternoSectionVisibleForRol(rol: string | null): boolean {
  return getVisiblePersonalExternoNavItems(rol).length > 0;
}

export function isPersonalExternoSubNavKey(key: string | undefined): key is PersonalExternoNavKey {
  return key != null && PERSONAL_EXTERNO_SUB_NAV_KEYS.has(key as PersonalExternoNavKey);
}
