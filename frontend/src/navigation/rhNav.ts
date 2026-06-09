/**
 * Menú lateral estructurado para RH en modo operativo (secciones desplegables).
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
import { COMEDOR_SIDEBAR_ITEM, COMEDOR_NAV_ITEMS } from "./comedorNav.ts";
import { CURSOS_SIDEBAR_ITEM, getVisibleCursosNavItems } from "./cursosNav.ts";
import { LABORALES_SIDEBAR_ITEM, LABORALES_NAV_ITEMS } from "./laboralesNav.ts";
import { getVisibleLevelUpCategoriesForRhSidebar, LEVEL_UP_SIDEBAR_ITEM } from "./levelUpNav.ts";
import { PUESTOS_SIDEBAR_ITEM, getVisiblePuestosNavItems } from "./puestosNav.ts";

export type RhNavKey =
  | "dashboard"
  | "organigrama"
  | "laborales"
  | "metricas"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "reportes"
  | "level-up"
  | "puestos"
  | "puestos-ajustes"
  | "competencias"
  | "tareas-catalogo"
  | "evaluaciones"
  | "capacitaciones"
  | "capacidades"
  | "cursos"
  | "sesiones"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "encuestas"
  | "empleados";

export type RhNavItem = {
  id: AppShellNavItemId;
  key: RhNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export type RhNavSection = {
  id: string;
  title: string;
  sectionKey: RhNavKey;
  iconSvgPaths: string;
  items: readonly RhNavItem[];
};

export const RH_GENERAL_NAV_ITEMS: readonly RhNavItem[] = [
  {
    id: "dashboard",
    key: "dashboard",
    href: "#/",
    label: "Dashboard",
    svgPaths: `<path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "organigrama",
    key: "organigrama",
    href: "#/organigrama",
    label: "Organigrama",
    svgPaths: `<path d="M6 3.75A2.25 2.25 0 0 0 3.75 6v1.5A2.25 2.25 0 0 0 6 9.75h1.5A2.25 2.25 0 0 0 9.75 7.5V6A2.25 2.25 0 0 0 7.5 3.75H6Zm10.5 0A2.25 2.25 0 0 0 14.25 6v1.5a2.25 2.25 0 0 0 2.25 2.25H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-1.5ZM6 14.25A2.25 2.25 0 0 0 3.75 16.5V18A2.25 2.25 0 0 0 6 20.25h1.5A2.25 2.25 0 0 0 9.75 18v-1.5A2.25 2.25 0 0 0 7.5 14.25H6Zm10.5 0a2.25 2.25 0 0 0-2.25 2.25V18a2.25 2.25 0 0 0 2.25 2.25H18A2.25 2.25 0 0 0 20.25 18v-1.5A2.25 2.25 0 0 0 18 14.25h-1.5Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M9.75 6.75h4.5m-2.25 3v4.5m2.25-2.25h-4.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

function filterVisibleItems(rol: string | null, items: readonly RhNavItem[]): RhNavItem[] {
  return items.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

function buildLevelUpItems(rol: string | null): RhNavItem[] {
  return getVisibleLevelUpCategoriesForRhSidebar(rol).flatMap((category) =>
    category.items.map((item) => ({
      id: item.id,
      key: item.key as RhNavKey,
      href: item.href,
      label: item.label,
      svgPaths: item.svgPaths,
    })),
  );
}

export function getVisibleRhNavSections(rol: string | null): RhNavSection[] {
  const sections: RhNavSection[] = [];

  const laboralesItems = filterVisibleItems(rol, LABORALES_NAV_ITEMS);
  if (laboralesItems.length > 0) {
    sections.push({
      id: "laborales",
      title: LABORALES_SIDEBAR_ITEM.label,
      sectionKey: "laborales",
      iconSvgPaths: LABORALES_SIDEBAR_ITEM.svgPaths,
      items: laboralesItems,
    });
  }

  const comedorItems = filterVisibleItems(rol, COMEDOR_NAV_ITEMS);
  if (comedorItems.length > 0) {
    sections.push({
      id: "comedor",
      title: COMEDOR_SIDEBAR_ITEM.label,
      sectionKey: "comedor",
      iconSvgPaths: COMEDOR_SIDEBAR_ITEM.svgPaths,
      items: comedorItems,
    });
  }

  const cursosItems = getVisibleCursosNavItems(rol);
  if (cursosItems.length > 0) {
    sections.push({
      id: "cursos",
      title: CURSOS_SIDEBAR_ITEM.label,
      sectionKey: "cursos",
      iconSvgPaths: CURSOS_SIDEBAR_ITEM.svgPaths,
      items: cursosItems,
    });
  }

  const puestosItems = getVisiblePuestosNavItems(rol);
  if (puestosItems.length > 0) {
    sections.push({
      id: "puestos",
      title: PUESTOS_SIDEBAR_ITEM.label,
      sectionKey: "puestos",
      iconSvgPaths: PUESTOS_SIDEBAR_ITEM.svgPaths,
      items: puestosItems,
    });
  }

  const levelUpItems = buildLevelUpItems(rol);
  if (levelUpItems.length > 0) {
    sections.push({
      id: "level-up",
      title: LEVEL_UP_SIDEBAR_ITEM.label,
      sectionKey: "level-up",
      iconSvgPaths: LEVEL_UP_SIDEBAR_ITEM.svgPaths,
      items: levelUpItems,
    });
  }

  return sections;
}

export function getVisibleRhGeneralItems(rol: string | null): RhNavItem[] {
  return filterVisibleItems(rol, RH_GENERAL_NAV_ITEMS);
}

export function rhNavSectionContainsActiveKey(
  section: RhNavSection,
  activeNav: RhNavKey | undefined,
): boolean {
  if (activeNav == null) return false;
  return section.items.some((item) => item.key === activeNav);
}
