/**
 * Sidebar del app shell: estructura, secciones y render HTML.
 * La visibilidad por rol sigue en shellNavPolicy; aquí solo se compone la UI.
 */

import { getRolFromAccessToken } from "../auth/jwt.ts";
import {
  isComedorHubVisibleForRol,
  COMEDOR_SIDEBAR_ITEM,
} from "../navigation/comedorNav.ts";
import {
  isLaboralesHubVisibleForRol,
  LABORALES_SIDEBAR_ITEM,
} from "../navigation/laboralesNav.ts";
import {
  isLevelUpHubVisibleForRol,
  LEVEL_UP_SIDEBAR_ITEM,
} from "../navigation/levelUpNav.ts";
import { resolveShellSidebarActiveNav } from "../navigation/shellSidebarActiveNav.ts";
import { EMPLEADO_FLAT_NAV_ITEMS } from "../navigation/empleadoNav.ts";
import {
  SUPERVISOR_DASHBOARD_ITEM,
  SUPERVISOR_EMPLEADOS_ITEM,
  SUPERVISOR_NAV_SECTIONS,
} from "../navigation/supervisorNav.ts";
import {
  isEmpleadoFlatNavRol,
  isShellNavItemVisibleForRol,
  isSupervisorStructuredNavRol,
  type AppShellNavItemId,
} from "../navigation/shellNavPolicy.ts";
import {
  SHELL_NAV_ICON_ACTIVE,
  SHELL_NAV_ICON_INACTIVE,
  SHELL_NAV_LABEL,
  SHELL_NAV_LINK_ACTIVE,
  SHELL_NAV_LINK_INACTIVE,
  SHELL_NAV_LIST,
  SHELL_NAV_SECTION_DIVIDER,
  SHELL_NAV_SECTION_HEADING,
  SHELL_SIDEBAR_INNER,
  SHELL_SIDEBAR_LOGO_IMG,
  SHELL_SIDEBAR_LOGO_WRAP,
} from "../ui/uiTokens.ts";

export type ShellNavKey =
  | "dashboard"
  | "organigrama"
  | "empleados"
  | "laborales"
  | "metricas"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "reportes"
  | "puestos"
  | "puestos-ajustes"
  | "tareas-catalogo"
  | "competencias"
  | "evaluaciones"
  | "capacitaciones"
  | "capacidades"
  | "cursos"
  | "sesiones"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "encuestas"
  | "level-up";

type NavItemDef = {
  id: AppShellNavItemId;
  key: ShellNavKey | null;
  hrefFor: (rol: string | null) => string;
  label: string;
  svgPaths: string;
};

type NavSectionDef = {
  id: string;
  title: string;
  items: readonly NavItemDef[];
};

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAV_GENERAL: readonly NavItemDef[] = [
  {
    id: "dashboard",
    key: "dashboard",
    hrefFor: () => "#/",
    label: "Dashboard",
    svgPaths: `<path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "organigrama",
    key: "organigrama",
    hrefFor: () => "#/organigrama",
    label: "Organigrama",
    svgPaths: `<path d="M6 3.75A2.25 2.25 0 0 0 3.75 6v1.5A2.25 2.25 0 0 0 6 9.75h1.5A2.25 2.25 0 0 0 9.75 7.5V6A2.25 2.25 0 0 0 7.5 3.75H6Zm10.5 0A2.25 2.25 0 0 0 14.25 6v1.5a2.25 2.25 0 0 0 2.25 2.25H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-1.5ZM6 14.25A2.25 2.25 0 0 0 3.75 16.5V18A2.25 2.25 0 0 0 6 20.25h1.5A2.25 2.25 0 0 0 9.75 18v-1.5A2.25 2.25 0 0 0 7.5 14.25H6Zm10.5 0a2.25 2.25 0 0 0-2.25 2.25V18a2.25 2.25 0 0 0 2.25 2.25H18A2.25 2.25 0 0 0 20.25 18v-1.5A2.25 2.25 0 0 0 18 14.25h-1.5Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M9.75 6.75h4.5m-2.25 3v4.5m2.25-2.25h-4.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const NAV_EMPLEADOS: NavItemDef = {
  id: "empleados",
  key: "empleados",
  hrefFor: () => "#/empleados",
  label: "Empleados",
  svgPaths: `<path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

const NAV_LABORALES: NavItemDef = {
  id: LABORALES_SIDEBAR_ITEM.id,
  key: LABORALES_SIDEBAR_ITEM.key,
  hrefFor: () => LABORALES_SIDEBAR_ITEM.href,
  label: LABORALES_SIDEBAR_ITEM.label,
  svgPaths: LABORALES_SIDEBAR_ITEM.svgPaths,
};

const NAV_COMEDOR: NavItemDef = {
  id: COMEDOR_SIDEBAR_ITEM.id,
  key: COMEDOR_SIDEBAR_ITEM.key,
  hrefFor: () => COMEDOR_SIDEBAR_ITEM.href,
  label: COMEDOR_SIDEBAR_ITEM.label,
  svgPaths: COMEDOR_SIDEBAR_ITEM.svgPaths,
};

const NAV_LEVEL_UP: NavItemDef = {
  id: LEVEL_UP_SIDEBAR_ITEM.id,
  key: LEVEL_UP_SIDEBAR_ITEM.key,
  hrefFor: () => LEVEL_UP_SIDEBAR_ITEM.href,
  label: LEVEL_UP_SIDEBAR_ITEM.label,
  svgPaths: LEVEL_UP_SIDEBAR_ITEM.svgPaths,
};

function navItemLi(
  activeNav: ShellNavKey | undefined,
  rol: string | null,
  def: NavItemDef,
): string {
  if (!isShellNavItemVisibleForRol(rol, def.id)) return "";
  const href = def.hrefFor(rol);
  const isActive = def.key != null && activeNav === def.key;
  const linkCls = isActive ? SHELL_NAV_LINK_ACTIVE : SHELL_NAV_LINK_INACTIVE;
  const iconCls = isActive ? SHELL_NAV_ICON_ACTIVE : SHELL_NAV_ICON_INACTIVE;
  const escapedLabel = escapeHtmlText(def.label);
  const ariaCurrent = isActive ? ` aria-current="page"` : "";
  return `<li class="shell-sidebar__item">
    <a href="${href}" class="${linkCls}" data-shell-tooltip="${escapedLabel}"${ariaCurrent}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${iconCls}">
        ${def.svgPaths}
      </svg>
      <span class="${SHELL_NAV_LABEL}">${def.label}</span>
    </a>
  </li>`;
}

function buildModuleItems(rol: string | null): NavItemDef[] {
  const items: NavItemDef[] = [];
  if (isLaboralesHubVisibleForRol(rol)) items.push(NAV_LABORALES);
  if (isComedorHubVisibleForRol(rol)) items.push(NAV_COMEDOR);
  if (isLevelUpHubVisibleForRol(rol)) items.push(NAV_LEVEL_UP);
  return items;
}

function renderNavSection(
  section: NavSectionDef,
  activeNav: ShellNavKey | undefined,
  rol: string | null,
): string {
  const lis = section.items.map((def) => navItemLi(activeNav, rol, def)).filter(Boolean);
  if (lis.length === 0) return "";
  const headingId = `shell-nav-section-${section.id}`;
  return `
    <section class="shell-sidebar__section" aria-labelledby="${headingId}">
      <h2 id="${headingId}" class="${SHELL_NAV_SECTION_HEADING}">${escapeHtmlText(section.title)}</h2>
      <ul role="list" class="${SHELL_NAV_LIST}" aria-labelledby="${headingId}">
        ${lis.join("")}
      </ul>
    </section>`;
}

function renderAdminSection(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const li = navItemLi(activeNav, rol, NAV_EMPLEADOS);
  if (!li) return "";
  const headingId = "shell-nav-section-administracion";
  return `
    <section class="shell-sidebar__section shell-sidebar__section--secondary mt-auto" aria-labelledby="${headingId}">
      <div class="${SHELL_NAV_SECTION_DIVIDER}" role="presentation"></div>
      <h2 id="${headingId}" class="${SHELL_NAV_SECTION_HEADING}">Administración</h2>
      <ul role="list" class="${SHELL_NAV_LIST}" aria-labelledby="${headingId}">
        ${li}
      </ul>
    </section>`;
}

function renderEmpleadoFlatNavSection(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const items: NavItemDef[] = EMPLEADO_FLAT_NAV_ITEMS.map((item) => ({
    id: item.id,
    key: item.key,
    hrefFor: () => item.href,
    label: item.label,
    svgPaths: item.svgPaths,
  }));
  return renderNavSection({ id: "menu-principal", title: "Menú principal", items }, activeNav, rol);
}

function toNavItemDef(item: {
  id: AppShellNavItemId;
  key: ShellNavKey;
  href: string;
  label: string;
  svgPaths: string;
}): NavItemDef {
  return {
    id: item.id,
    key: item.key,
    hrefFor: () => item.href,
    label: item.label,
    svgPaths: item.svgPaths,
  };
}

function renderSupervisorDashboardItem(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const li = navItemLi(activeNav, rol, toNavItemDef(SUPERVISOR_DASHBOARD_ITEM));
  if (!li) return "";
  return `<section class="shell-sidebar__section" aria-label="Dashboard">
      <ul role="list" class="${SHELL_NAV_LIST}">${li}</ul>
    </section>`;
}

function renderSupervisorEmpleadosFooter(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const li = navItemLi(activeNav, rol, toNavItemDef(SUPERVISOR_EMPLEADOS_ITEM));
  if (!li) return "";
  return `<section class="shell-sidebar__section shell-sidebar__section--secondary mt-auto" aria-label="Empleados">
      <ul role="list" class="${SHELL_NAV_LIST}">${li}</ul>
    </section>`;
}

function renderSupervisorStructuredNav(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const dashboardSection = renderSupervisorDashboardItem(activeNav, rol);
  const moduleSections = SUPERVISOR_NAV_SECTIONS.map((section) =>
    renderNavSection(
      {
        id: section.id,
        title: section.title,
        items: section.items.map((item) => toNavItemDef(item)),
      },
      activeNav,
      rol,
    ),
  ).join("");
  const empleadosFooter = renderSupervisorEmpleadosFooter(activeNav, rol);
  return `${dashboardSection}${moduleSections}${empleadosFooter}`;
}

/** HTML interior del sidebar (compartido por drawer móvil, rail colapsado y columna expandida). */
export function renderShellSidebarBody(activeNav: ShellNavKey | undefined): string {
  const rol = getRolFromAccessToken();
  const sidebarActiveNav = resolveShellSidebarActiveNav(activeNav) as ShellNavKey | undefined;

  const structuredNav = isEmpleadoFlatNavRol(rol) || isSupervisorStructuredNavRol(rol);
  const generalSection = isEmpleadoFlatNavRol(rol)
    ? renderEmpleadoFlatNavSection(sidebarActiveNav, rol)
    : isSupervisorStructuredNavRol(rol)
      ? renderSupervisorStructuredNav(sidebarActiveNav, rol)
      : renderNavSection({ id: "general", title: "General", items: NAV_GENERAL }, sidebarActiveNav, rol);

  const moduleItems = structuredNav ? [] : buildModuleItems(rol);
  const modulesSection =
    moduleItems.length > 0
      ? renderNavSection(
          { id: "modulos", title: "Módulos", items: moduleItems },
          sidebarActiveNav,
          rol,
        )
      : "";

  const adminSection = structuredNav ? "" : renderAdminSection(sidebarActiveNav, rol);

  return `
    <div class="${SHELL_SIDEBAR_INNER}">
      <div class="${SHELL_SIDEBAR_LOGO_WRAP}">
        <img src="/leoni-logo.png" alt="Leoni" class="${SHELL_SIDEBAR_LOGO_IMG}" />
      </div>
      <nav class="shell-sidebar__nav relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-0.5 pb-3 pt-1 md:max-lg:px-0 lg:pt-2" aria-label="Navegación principal">
        ${generalSection}
        ${modulesSection}
        ${adminSection}
      </nav>
    </div>`;
}

/** Contenedor exterior del sidebar según breakpoint. */
export function shellSidebarPanelClass(variant: "drawer" | "rail" | "expanded"): string {
  const base = "shell-sidebar__panel flex h-full min-h-0 grow flex-col overflow-hidden bg-white";
  if (variant === "drawer") return `${base} shell-sidebar__panel--drawer`;
  if (variant === "rail") return `${base} shell-sidebar__panel--rail border-r border-border`;
  return `${base} shell-sidebar__panel--expanded border-r border-border`;
}
