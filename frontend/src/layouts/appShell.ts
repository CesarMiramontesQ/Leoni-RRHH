import {
  canAccessEmpleadoPersonalDashboard,
  getRolFromAccessToken,
  getUserDisplayNameFromAccessToken,
  getUserInitialsFromAccessToken,
} from "../auth/jwt.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { getRhUiModeLabel, isRhEmpleadoUiMode, isRhToggleOn, toggleRhUiMode } from "../auth/rhUiMode.ts";
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
import {
  isNominasHubVisibleForRol,
  NOMINAS_SIDEBAR_ITEM,
} from "../navigation/nominasNav.ts";
import { resolveShellSidebarActiveNav } from "../navigation/shellSidebarActiveNav.ts";
import { EMPLEADO_FLAT_NAV_ITEMS } from "../navigation/empleadoNav.ts";
import {
  SUPERVISOR_DASHBOARD_ITEM,
  SUPERVISOR_EMPLEADOS_ITEM,
  SUPERVISOR_NAV_SECTIONS,
} from "../navigation/supervisorNav.ts";
import {
  isEmpleadoFlatNavRol,
  isRhStructuredNavRol,
  isShellNavItemVisibleForRol,
  isSupervisorStructuredNavRol,
  type AppShellNavItemId,
} from "../navigation/shellNavPolicy.ts";
import {
  getVisibleRhGeneralItems,
  getVisibleRhNavSections,
  rhNavSectionContainsActiveKey,
  type RhNavItem,
  type RhNavKey,
  type RhNavSection,
} from "../navigation/rhNav.ts";
import { clearAuth } from "../auth/session.ts";
import { tituloDesdeHash } from "../navigation/pageTitles.ts";
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type NotificacionApiItem,
  type NotificacionesFetchError,
} from "../api/notificaciones.ts";
import {
  applyMarcarTodasLeidasLocal,
  getNotificacionesResumenSnapshot,
  refreshNotificacionesResumen,
} from "../notificaciones/notificacionesResumenStore.ts";
import { renderNotificationsDropdownEmpty } from "../notificaciones/emptyNotificationsState.ts";
import { renderNotificacionBadge, renderNotificacionListItem } from "../notificaciones/ui.ts";

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRolLabel(rol: string | null): string {
  if (!rol) return "";
  const labels: Record<string, string> = {
    empleado: "Empleado",
    supervisor: "Supervisor",
    rh: "RH",
    director: "Director",
    gerente: "Gerente",
  };
  return labels[rol] ?? rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase();
}

/** Contenedor de enlace: altura estable, paddings coherentes entre drawer / rail / ancho completo. */
const navLinkBase =
  "group/nav relative flex min-h-11 w-full items-center gap-x-3 rounded px-3 py-2 text-sm leading-snug outline-none transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:max-lg:justify-center md:max-lg:px-2 lg:justify-start";

const navInactive =
  `${navLinkBase} border border-transparent font-semibold text-text-primary hover:bg-shell-hover hover:text-text-primary`;

const navIconInactive =
  "size-5 shrink-0 text-text-muted transition-colors duration-150 group-hover/nav:text-text-primary md:max-lg:mx-auto";

const navActive =
  `${navLinkBase} border border-transparent bg-shell-active-ring font-bold text-text-primary before:pointer-events-none before:absolute before:start-0 before:top-1/2 before:h-[1.875rem] before:w-[3px] before:-translate-y-1/2 before:rounded-e before:bg-accent`;

const navIconActive = "size-5 shrink-0 text-text-primary md:max-lg:mx-auto";
let shellUiAbortController: AbortController | null = null;

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
  | "evaluacion-360"
  | "capacitaciones"
  | "capacidades"
  | "cursos"
  | "sesiones"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "encuestas"
  | "level-up"
  | "nominas"
  | "horas-extra"
  | "horas-extra-solicitud"
  | "conciliacion"
  | "nominas-ajustes";

type NavItemDef = {
  id: AppShellNavItemId;
  key: ShellNavKey | null;
  hrefFor: (rol: string | null) => string;
  label: string;
  labelWrapClass?: string;
  svgPaths: string;
};

/** Encabezado de sección del sidebar (mismo criterio visual que «Talento»). */
const navSectionHeadingClass =
  "text-[11px] font-semibold uppercase tracking-wider text-text-muted md:max-lg:hidden";

const rhPrimaryLabelClass = "min-w-0 flex-1 truncate md:max-lg:sr-only";

/** Reserva el ancho del chevron para alinear filas con y sin submenú. */
const rhPrimaryChevronSpacer =
  `<span class="size-5 shrink-0 md:max-lg:hidden" aria-hidden="true"></span>`;

const rhPrimaryChevronIcon = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 shrink-0 text-text-muted transition-transform duration-150 group-open/rh-nav-section:rotate-180 md:max-lg:hidden">
          <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
        </svg>`;

const rhSectionSummaryClass =
  `${navLinkBase} list-none cursor-pointer justify-between [&::-webkit-details-marker]:hidden group-open/rh-nav-section:bg-shell-hover/50`;

const rhSubNavLinkBase =
  "group/rh-sub relative flex min-h-11 w-full items-center gap-x-3 rounded px-3 py-2 text-sm leading-snug outline-none transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:max-lg:justify-center md:max-lg:px-2 lg:justify-start";

const rhSubNavInactive =
  `${rhSubNavLinkBase} border border-transparent font-medium text-text-primary hover:bg-shell-hover hover:text-text-primary`;

const rhSubNavActive =
  `${rhSubNavLinkBase} border border-transparent bg-shell-active-ring font-semibold text-text-primary before:pointer-events-none before:absolute before:start-0 before:top-1/2 before:h-[1.875rem] before:w-[3px] before:-translate-y-1/2 before:rounded-e before:bg-accent`;

const RH_PRIMARY_LIST_CLASS = "-mx-2 flex flex-col space-y-0.5 md:max-lg:-mx-0";

function rhPrimaryIcon(svgPaths: string, isActive: boolean): string {
  const ic = isActive ? navIconActive : navIconInactive;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${ic}">${svgPaths}</svg>`;
}

function renderRhPrimaryLinkLi(
  item: Pick<RhNavItem, "id" | "key" | "href" | "label" | "svgPaths">,
  activeNav: RhNavKey | undefined,
  rol: string | null,
): string {
  if (!isShellNavItemVisibleForRol(rol, item.id)) return "";
  const isActive = activeNav === item.key;
  const cls = isActive ? navActive : navInactive;
  const escapedLabel = escapeHtmlText(item.label);
  const ariaCurrent = isActive ? ` aria-current="page"` : "";
  return `<li>
    <a href="${item.href}" class="${cls}" title="${escapedLabel}"${ariaCurrent}>
      ${rhPrimaryIcon(item.svgPaths, isActive)}
      <span class="${rhPrimaryLabelClass}">${item.label}</span>
      ${rhPrimaryChevronSpacer}
    </a>
  </li>`;
}

function rhSubNavItemLi(activeNav: RhNavKey | undefined, rol: string | null, item: RhNavItem): string {
  if (!isShellNavItemVisibleForRol(rol, item.id)) return "";
  const isActive = activeNav === item.key;
  const cls = isActive ? rhSubNavActive : rhSubNavInactive;
  const escapedLabel = escapeHtmlText(item.label);
  const ariaCurrent = isActive ? ` aria-current="page"` : "";
  const ic = isActive ? navIconActive : navIconInactive;
  return `<li>
    <a href="${item.href}" class="${cls}" title="${escapedLabel}"${ariaCurrent}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${ic}">
        ${item.svgPaths}
      </svg>
      <span class="md:max-lg:sr-only">${item.label}</span>
    </a>
  </li>`;
}

function renderRhCollapsibleSection(
  section: RhNavSection,
  activeNav: RhNavKey | undefined,
  rol: string | null,
): string {
  const subLis = section.items.map((item) => rhSubNavItemLi(activeNav, rol, item)).filter(Boolean);
  if (subLis.length === 0) return "";

  const isOpen = rhNavSectionContainsActiveKey(section, activeNav);
  const panelId = `shell-rh-nav-panel-${section.id}`;

  return `<li>
    <details class="group/rh-nav-section" ${isOpen ? "open" : ""}>
      <summary class="${rhSectionSummaryClass} ${navInactive}" aria-controls="${panelId}">
        <span class="flex min-w-0 flex-1 items-center gap-x-3">
          ${rhPrimaryIcon(section.iconSvgPaths, false)}
          <span class="${rhPrimaryLabelClass}">${section.title}</span>
        </span>
        ${rhPrimaryChevronIcon}
      </summary>
      <ul id="${panelId}" role="list" class="space-y-0.5 py-0.5 pl-9 md:max-lg:pl-0 lg:border-l lg:border-shell-active-ring/80 lg:ml-5 lg:pl-2">
        ${subLis.join("")}
      </ul>
    </details>
  </li>`;
}

function renderRhEmpleadosFooter(activeNav: RhNavKey | undefined, rol: string | null): string {
  const empleadosLi = renderRhPrimaryLinkLi(
    {
      id: "empleados",
      key: "empleados",
      href: "#/empleados",
      label: NAV_EMPLEADOS.label,
      svgPaths: NAV_EMPLEADOS.svgPaths,
    },
    activeNav,
    rol,
  );
  if (empleadosLi.trim() === "") return "";
  return `<ul role="list" class="${RH_PRIMARY_LIST_CLASS} mt-auto pt-4">
    ${empleadosLi}
  </ul>`;
}

function renderRhStructuredSidebarSections(activeNav: RhNavKey | undefined, rol: string | null): string {
  const primaryLis = getVisibleRhGeneralItems(rol)
    .map((item) => renderRhPrimaryLinkLi(item, activeNav, rol))
    .filter(Boolean)
    .join("");

  const sectionLis = getVisibleRhNavSections(rol)
    .map((section) => renderRhCollapsibleSection(section, activeNav, rol))
    .join("");

  const empleadosFooter = renderRhEmpleadosFooter(activeNav, rol);

  return `<div class="flex min-h-0 flex-1 flex-col">
    <ul role="list" class="${RH_PRIMARY_LIST_CLASS}">
      ${primaryLis}
      ${sectionLis}
    </ul>
    ${empleadosFooter}
  </div>`;
}

function navItemLi(activeNav: ShellNavKey | undefined, rol: string | null, def: NavItemDef): string {
  if (!isShellNavItemVisibleForRol(rol, def.id)) return "";
  const href = def.hrefFor(rol);
  const isActive = def.key != null && activeNav === def.key;
  const cls = isActive ? navActive : navInactive;
  const ic = isActive ? navIconActive : navIconInactive;
  const escapedLabel = escapeHtmlText(def.label);
  const ariaCurrent = isActive ? ` aria-current="page"` : "";
  const labelWrap =
    def.labelWrapClass != null ?
      `<span class="${def.labelWrapClass} md:max-lg:sr-only">${def.label}</span>`
    : `<span class="md:max-lg:sr-only">${def.label}</span>`;
  return `<li>
    <a href="${href}" class="${cls}" title="${escapedLabel}"${ariaCurrent}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${ic}">
        ${def.svgPaths}
      </svg>
      ${labelWrap}
    </a>
  </li>`;
}

const NAV_PRIMARY: readonly NavItemDef[] = [
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

const NAV_NOMINAS: NavItemDef = {
  id: NOMINAS_SIDEBAR_ITEM.id,
  key: NOMINAS_SIDEBAR_ITEM.key,
  hrefFor: () => NOMINAS_SIDEBAR_ITEM.href,
  label: NOMINAS_SIDEBAR_ITEM.label,
  svgPaths: NOMINAS_SIDEBAR_ITEM.svgPaths,
};

function footerGestionHtml(activeNav: ShellNavKey | undefined, rol: string | null): string {
  if (isRhStructuredNavRol(rol)) return "";
  const empleadosDef: NavItemDef = isSupervisorStructuredNavRol(rol)
    ? {
        id: SUPERVISOR_EMPLEADOS_ITEM.id,
        key: SUPERVISOR_EMPLEADOS_ITEM.key,
        hrefFor: () => SUPERVISOR_EMPLEADOS_ITEM.href,
        label: SUPERVISOR_EMPLEADOS_ITEM.label,
        svgPaths: SUPERVISOR_EMPLEADOS_ITEM.svgPaths,
      }
    : NAV_EMPLEADOS;
  const empleadosLi = navItemLi(activeNav, rol, empleadosDef);
  if (empleadosLi.trim() === "") return "";
  return `<li class="mt-auto pt-6">
    <ul role="list" class="-mx-2 space-y-1 md:max-lg:-mx-0">
      ${empleadosLi}
    </ul>
  </li>`;
}

function renderSupervisorNavSection(
  sectionId: string,
  title: string,
  items: readonly { id: AppShellNavItemId; key: ShellNavKey; href: string; label: string; svgPaths: string }[],
  activeNav: ShellNavKey | undefined,
  rol: string | null,
): string {
  const lis = items
    .map((item) =>
      navItemLi(activeNav, rol, {
        id: item.id,
        key: item.key,
        hrefFor: () => item.href,
        label: item.label,
        svgPaths: item.svgPaths,
      }),
    )
    .filter((li) => li.trim() !== "")
    .join("");
  if (lis.trim() === "") return "";
  const headingId = `shell-nav-section-${sectionId}`;
  return `<li>
    <div id="${headingId}" class="${navSectionHeadingClass}">${escapeHtmlText(title)}</div>
    <ul role="list" class="-mx-2 mt-2 space-y-0.5 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${headingId}">
      ${lis}
    </ul>
  </li>`;
}

function renderSupervisorSidebarSections(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const dashboardLi = navItemLi(activeNav, rol, {
    id: SUPERVISOR_DASHBOARD_ITEM.id,
    key: SUPERVISOR_DASHBOARD_ITEM.key,
    hrefFor: () => SUPERVISOR_DASHBOARD_ITEM.href,
    label: SUPERVISOR_DASHBOARD_ITEM.label,
    svgPaths: SUPERVISOR_DASHBOARD_ITEM.svgPaths,
  });
  const sectionLis = SUPERVISOR_NAV_SECTIONS.map((section) =>
    renderSupervisorNavSection(section.id, section.title, section.items, activeNav, rol),
  ).join("");
  return `${dashboardLi ? `<li><ul role="list" class="-mx-2 space-y-0.5 md:max-lg:-mx-0">${dashboardLi}</ul></li>` : ""}${sectionLis}`;
}

/** Sidebar interior (móvil + desktop idénticos). */
function sidebarBody(activeNav: ShellNavKey | undefined): string {
  const rol = getRolFromAccessToken();
  const sidebarActiveNav = resolveShellSidebarActiveNav(activeNav) as ShellNavKey | undefined;

  const menuPrincipalHeadingId = "shell-nav-section-menu-principal";

  const supervisorSidebar = isSupervisorStructuredNavRol(rol);
  const rhStructuredSidebar = isRhStructuredNavRol(rol);
  const mainMenuLis = isEmpleadoFlatNavRol(rol)
    ? EMPLEADO_FLAT_NAV_ITEMS.map((d) =>
        navItemLi(sidebarActiveNav, rol, {
          id: d.id,
          key: d.key,
          hrefFor: () => d.href,
          label: d.label,
          svgPaths: d.svgPaths,
        }),
      ).join("")
    : supervisorSidebar
      ? renderSupervisorSidebarSections(sidebarActiveNav, rol)
      : (() => {
          const primaryLis = NAV_PRIMARY.map((d) => navItemLi(sidebarActiveNav, rol, d)).join("");
          const laboralesLi = isLaboralesHubVisibleForRol(rol) ? navItemLi(sidebarActiveNav, rol, NAV_LABORALES) : "";
          const comedorLi = isComedorHubVisibleForRol(rol) ? navItemLi(sidebarActiveNav, rol, NAV_COMEDOR) : "";
          const levelUpLi = isLevelUpHubVisibleForRol(rol) ? navItemLi(sidebarActiveNav, rol, NAV_LEVEL_UP) : "";
          const nominasLi = isNominasHubVisibleForRol(rol) ? navItemLi(sidebarActiveNav, rol, NAV_NOMINAS) : "";
          return [primaryLis, laboralesLi, comedorLi, levelUpLi, nominasLi].filter((li) => li.trim() !== "").join("");
        })();

  const navContent = rhStructuredSidebar
    ? renderRhStructuredSidebarSections(sidebarActiveNav as RhNavKey | undefined, rol)
    : (() => {
        const mainMenuBlock = supervisorSidebar
          ? mainMenuLis
          : `<li>
          <div id="${menuPrincipalHeadingId}" class="${navSectionHeadingClass}">Menú principal</div>
          <ul role="list" class="-mx-2 mt-2 space-y-0.5 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${menuPrincipalHeadingId}">
            ${mainMenuLis}
          </ul>
        </li>`;
        return `<ul role="list" class="flex flex-1 flex-col gap-y-5">
        ${mainMenuBlock}
        ${footerGestionHtml(sidebarActiveNav, rol)}
      </ul>`;
      })();

  return `
    <div class="flex shrink-0 items-center lg:pb-5 md:max-lg:flex md:max-lg:flex-col md:max-lg:items-center md:max-lg:pb-4 lg:items-start lg:pt-6">
      <img src="/leoni-logo.png" alt="Leoni" class="h-7 w-auto max-w-[11rem] object-contain object-left md:max-lg:h-[1.5rem] md:max-lg:max-w-[4.75rem]" />
    </div>
    <nav class="relative flex flex-1 flex-col">
      ${navContent}
    </nav>`;
}

export type AppShellOptions = {
  mainHtml: string;
  pageTitle?: string;
  /** Resalta el ítem del sidebar acorde a la ruta hash. */
  activeNav?: ShellNavKey;
  /** Si se omite, se elimina `access_token` y se llama a `mountLogin`. Si lo defines, encárgate tú de limpiar sesión y navegar. */
  onSignOut?: () => void;
  /** Clases del `<main>`; por defecto `py-10` (páginas densas pueden usar p. ej. `py-5 sm:py-6`). */
  mainClass?: string;
};

export function mountAppShell(container: HTMLElement, options: AppShellOptions): void {
  shellUiAbortController?.abort();
  shellUiAbortController = new AbortController();
  const { signal } = shellUiAbortController;

  const tituloPagina = options.pageTitle ?? tituloDesdeHash(window.location.hash);
  document.title = `${tituloPagina} — Plataforma RH`;
  const tituloNavbar = escapeHtmlText(tituloPagina);
  const mainClass = options.mainClass ?? "py-10";
  const body = sidebarBody(options.activeNav);
  const userName = escapeHtmlText(getUserDisplayNameFromAccessToken());
  const userInitials = escapeHtmlText(getUserInitialsFromAccessToken());
  const rawRol = getRolFromAccessToken();
  const userRolLine =
    rawRol === "rh" ?
      `<span class="hidden max-w-[12rem] truncate text-start text-xs font-normal text-text-muted xl:block">${escapeHtmlText(getRhUiModeLabel())}</span>`
    : rawRol && !canAccessEmpleadoPersonalDashboard() ?
      `<span class="hidden max-w-[12rem] truncate text-start text-xs font-normal capitalize text-text-muted xl:block">${escapeHtmlText(formatRolLabel(rawRol))}</span>`
    : "";
  const rhModeToggleHtml =
    rawRol === "rh"
      ? `<div class="hidden items-center gap-2 sm:flex" id="rh-ui-mode-toggle-wrap">
          <span class="text-xs font-medium text-text-muted" id="rh-ui-mode-toggle-label">${escapeHtmlText(getRhUiModeLabel())}</span>
          <button
            type="button"
            id="rh-ui-mode-toggle"
            role="switch"
            aria-checked="${isRhToggleOn() ? "true" : "false"}"
            aria-labelledby="rh-ui-mode-toggle-label"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-border bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 ${isRhToggleOn() ? "bg-accent" : ""}"
          >
            <span class="pointer-events-none inline-block size-5 translate-x-0.5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform ${isRhToggleOn() ? "translate-x-[1.375rem]" : ""}"></span>
          </button>
        </div>`
      : "";
  const permisosRhMenuItem = canAccessRhPermisosAdmin() && !isRhEmpleadoUiMode()
    ? `<a href="#/ajustes/permisos-rh" class="block px-3 py-1 text-sm/6 text-text-primary focus:bg-surface focus:outline-none">Permisos RH</a>`
    : "";

  container.innerHTML = `
<el-dialog>
  <dialog id="sidebar" class="backdrop:bg-transparent md:hidden">
    <el-dialog-backdrop class="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-closed:opacity-0"></el-dialog-backdrop>

    <div tabindex="0" class="fixed inset-0 flex focus:outline-none">
      <el-dialog-panel class="group/dialog-panel relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full">
        <div class="absolute top-0 left-full flex w-16 justify-center pt-5 duration-300 ease-in-out group-data-closed/dialog-panel:opacity-0">
          <button type="button" command="close" commandfor="sidebar" class="-m-2.5 p-2.5">
            <span class="sr-only">Cerrar menú</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-white">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <div class="relative flex grow flex-col gap-y-4 overflow-y-auto bg-white px-5 pb-5 pt-2">
          ${body}
        </div>
      </el-dialog-panel>
    </div>
  </dialog>
</el-dialog>

<div class="relative z-40 hidden md:fixed md:inset-y-0 md:flex md:w-[4.75rem] md:flex-col lg:hidden">
  <div class="flex grow flex-col gap-y-4 overflow-y-auto border-r border-border bg-white px-2 pb-4 pt-1">
    ${body}
  </div>
</div>

<div class="relative z-40 hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
  <div class="flex grow flex-col gap-y-4 overflow-y-auto border-r border-border bg-white px-6 pb-4 pt-1">
    ${body}
  </div>
</div>

<div class="min-h-full bg-surface md:pl-[4.75rem] lg:pl-72">
  <div class="sticky top-0 z-40 flex min-h-[3.75rem] shrink-0 items-center gap-x-3 border-b border-border bg-white px-4 py-2 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.06)] sm:gap-x-5 sm:px-6 lg:px-8">
    <button type="button" command="show-modal" commandfor="sidebar" class="flex items-center rounded-lg p-2 text-text-muted transition-colors hover:bg-shell-hover hover:text-text-primary md:hidden">
      <span class="sr-only">Abrir menú</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 shrink-0">
        <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div aria-hidden="true" class="flex h-6 w-px shrink-0 bg-text-primary/10 md:hidden"></div>

    <div class="flex min-w-0 flex-1 flex-row items-center gap-x-5 sm:gap-x-8">
      <p
        id="app-shell-page-title"
        class="min-w-0 flex-1 truncate text-lg font-semibold leading-tight tracking-tight text-text-primary sm:text-xl"
        title="${tituloNavbar}"
      >
        ${tituloNavbar}
      </p>
      <div class="flex shrink-0 items-center gap-x-4 sm:gap-x-6">
        ${rhModeToggleHtml}
        <div id="app-shell-notifications-wrapper" class="relative flex shrink-0 items-center">
          <button
            type="button"
            id="app-shell-notifications"
            class="relative flex size-10 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-shell-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2"
            aria-expanded="false"
            aria-haspopup="true"
            aria-controls="app-shell-notifications-panel"
          >
            <span class="sr-only">Ver notificaciones</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 shrink-0">
              <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span id="app-shell-notifications-badge"></span>
          </button>
          <div
            id="app-shell-notifications-panel"
            class="notif-dropdown-panel"
            role="region"
            aria-labelledby="notif-dropdown-heading"
          >
            <header class="notif-dropdown-header">
              <div class="notif-dropdown-header__row">
                <h2 id="notif-dropdown-heading" class="notif-dropdown-header__title">Notificaciones</h2>
                <span id="app-shell-notifications-count" class="notif-dropdown-header-badge">0 no leídas</span>
              </div>
              <button
                type="button"
                id="app-shell-notifications-mark-all"
                class="notif-dropdown-mark-all-btn"
                disabled
                aria-busy="false"
                aria-label="Marcar todas las notificaciones como leídas"
              >
                Marcar todas como leídas
              </button>
              <p
                id="app-shell-notifications-mark-all-feedback"
                class="notif-dropdown-mark-all-feedback"
                role="status"
                aria-live="polite"
                hidden
              ></p>
            </header>
            <div id="app-shell-notifications-list" class="notif-dropdown-list">
              <p class="notif-dropdown-loading">Cargando...</p>
            </div>
            <footer class="notif-dropdown-footer">
              <a href="#/notificaciones" class="notif-dropdown-footer-link">Ver todas →</a>
            </footer>
          </div>
        </div>

        <div aria-hidden="true" class="hidden h-6 w-px shrink-0 bg-text-primary/10 sm:block"></div>

        <el-dropdown class="relative flex items-center">
          <button
            type="button"
            class="relative z-10 flex max-w-[18rem] items-center gap-3 rounded-lg border border-transparent py-1.5 pl-1 pr-2 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border hover:bg-shell-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 sm:gap-4 sm:pl-2"
            title="${userName}"
            aria-label="Menú de usuario de ${userName}"
          >
            <span class="sr-only">Menú de usuario de ${userName}</span>
            <span class="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-[0.6875rem] font-semibold text-white shadow-sm ring-[1px] ring-black/10 ring-inset">${userInitials}</span>
            <span class="hidden min-w-0 flex-col leading-tight lg:flex lg:items-start">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-start text-sm font-semibold text-text-primary">${userName}</span>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 shrink-0 text-text-muted">
                  <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
              </span>
              ${userRolLine}
            </span>
          </button>
          <el-menu anchor="bottom end" popover class="w-48 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-black/5 transition transition-discrete [--anchor-gap:--spacing(2.5)] data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in">
            ${permisosRhMenuItem}
            <button type="button" id="app-shell-sign-out" class="block w-full px-3 py-1 text-left text-sm/6 text-text-primary focus:bg-surface focus:outline-none">Cerrar sesión</button>
          </el-menu>
        </el-dropdown>
      </div>
    </div>
  </div>

  <main class="${mainClass}">
    <div class="px-4 sm:px-6 lg:px-8">
      ${options.mainHtml}
    </div>
  </main>
</div>
`;
  container.querySelector("#rh-ui-mode-toggle")?.addEventListener(
    "click",
    () => {
      toggleRhUiMode();
    },
    { signal },
  );

  container.querySelector("#app-shell-sign-out")?.addEventListener("click", () => {
    if (options.onSignOut) {
      options.onSignOut();
      return;
    }
    clearAuth();
    void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
      abortAuthenticatedShell();
      void import("../pages/login.ts").then(({ mountLogin }) => mountLogin(container));
    });
  }, { signal });

  const notifWrapper = container.querySelector<HTMLElement>("#app-shell-notifications-wrapper");
  const notifButton = container.querySelector<HTMLButtonElement>("#app-shell-notifications");
  const notifPanel = container.querySelector<HTMLElement>("#app-shell-notifications-panel");
  const notifBadgeHost = container.querySelector<HTMLElement>("#app-shell-notifications-badge");
  const notifList = container.querySelector<HTMLElement>("#app-shell-notifications-list");
  const notifCount = container.querySelector<HTMLElement>("#app-shell-notifications-count");
  const notifMarkAllBtn = container.querySelector<HTMLButtonElement>("#app-shell-notifications-mark-all");
  const notifMarkAllFeedback = container.querySelector<HTMLElement>("#app-shell-notifications-mark-all-feedback");
  let notifPanelOpen = false;
  let notifMarkingAll = false;
  let notifMarkAllFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let recientes: NotificacionApiItem[] = [];

  const mountLoginPage = (): void => {
    clearAuth();
    void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
      abortAuthenticatedShell();
      void import("../pages/login.ts").then(({ mountLogin }) => mountLogin(container));
    });
  };

  const setNotifPanelState = (open: boolean): void => {
    notifPanelOpen = open;
    if (!notifPanel) return;
    notifPanel.classList.toggle("notif-dropdown-panel--open", open);
    notifButton?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const renderNotifDropdown = (items: NotificacionApiItem[]): void => {
    if (!notifList) return;
    if (items.length === 0) {
      notifList.innerHTML = renderNotificationsDropdownEmpty();
      return;
    }
    notifList.innerHTML = items.map((item) => renderNotificacionListItem(item, { compact: true })).join("");
  };

  const clearNotifMarkAllFeedback = (): void => {
    if (notifMarkAllFeedbackTimer) {
      clearTimeout(notifMarkAllFeedbackTimer);
      notifMarkAllFeedbackTimer = null;
    }
    if (!notifMarkAllFeedback) return;
    notifMarkAllFeedback.hidden = true;
    notifMarkAllFeedback.textContent = "";
    notifMarkAllFeedback.classList.remove(
      "notif-dropdown-mark-all-feedback--success",
      "notif-dropdown-mark-all-feedback--error",
    );
  };

  const showNotifMarkAllFeedback = (message: string, kind: "success" | "error"): void => {
    if (!notifMarkAllFeedback) return;
    clearNotifMarkAllFeedback();
    notifMarkAllFeedback.textContent = message;
    notifMarkAllFeedback.classList.add(
      kind === "success" ? "notif-dropdown-mark-all-feedback--success" : "notif-dropdown-mark-all-feedback--error",
    );
    notifMarkAllFeedback.hidden = false;
    if (kind === "success") {
      notifMarkAllFeedbackTimer = setTimeout(() => clearNotifMarkAllFeedback(), 3000);
    }
  };

  const updateNotifMarkAllButton = (): void => {
    if (!notifMarkAllBtn) return;
    const snap = getNotificacionesResumenSnapshot();
    const hasUnread = snap.unreadCount > 0;
    notifMarkAllBtn.disabled = notifMarkingAll || !hasUnread;
    notifMarkAllBtn.setAttribute("aria-busy", notifMarkingAll ? "true" : "false");
    notifMarkAllBtn.textContent = notifMarkingAll ? "Marcando..." : "Marcar todas como leídas";
  };

  const applyNotificacionesSnapshot = (): void => {
    if (!notifList || !notifBadgeHost || !notifCount) return;
    const snap = getNotificacionesResumenSnapshot();
    recientes = snap.recientes;
    notifBadgeHost.innerHTML = renderNotificacionBadge(snap.unreadCount);
    notifCount.textContent = `${snap.unreadCount} no leídas`;
    updateNotifMarkAllButton();
    if (snap.status === "error" && snap.errorMessage) {
      notifList.innerHTML = `<p class="notif-dropdown-error" role="alert">${escapeHtmlText(snap.errorMessage)}</p>`;
      return;
    }
    renderNotifDropdown(snap.recientes);
  };

  const marcarTodasNotificaciones = async (): Promise<void> => {
    if (notifMarkingAll) return;
    const snap = getNotificacionesResumenSnapshot();
    if (snap.unreadCount <= 0) return;

    notifMarkingAll = true;
    clearNotifMarkAllFeedback();
    updateNotifMarkAllButton();

    try {
      const marcadas = await marcarTodasLeidas();
      if (marcadas > 0) {
        applyMarcarTodasLeidasLocal();
      }
      notifMarkingAll = false;
      applyNotificacionesSnapshot();
      showNotifMarkAllFeedback(
        marcadas > 0 ?
          "Todas las notificaciones fueron marcadas como leídas."
        : "No había notificaciones pendientes.",
        "success",
      );
    } catch (error: unknown) {
      if (typeof error === "object" && error != null && "status" in error && (error as { status?: unknown }).status === 401) {
        mountLoginPage();
        return;
      }
      notifMarkingAll = false;
      updateNotifMarkAllButton();
      const detail =
        typeof error === "object" && error != null && "detail" in error ?
          (error as NotificacionesFetchError).detail
        : "";
      showNotifMarkAllFeedback(detail || "No se pudo marcar las notificaciones como leídas.", "error");
    }
  };

  const loadNotificaciones = async (): Promise<void> => {
    if (!notifList || !notifBadgeHost || !notifCount) return;
    if (notifPanelOpen) {
      notifList.innerHTML = `<p class="notif-dropdown-loading">Cargando...</p>`;
    }
    const antes = getNotificacionesResumenSnapshot();
    if (antes.status === "idle") {
      notifBadgeHost.innerHTML = `<span class="absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full bg-leoni-blue/50" aria-hidden="true"></span>`;
      notifCount.textContent = "…";
    }
    const result = await refreshNotificacionesResumen();
    if (!result.ok && result.unauthorized) {
      mountLoginPage();
      return;
    }
    applyNotificacionesSnapshot();
  };

  notifButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const open = !notifPanelOpen;
    setNotifPanelState(open);
    if (open) void loadNotificaciones();
  }, { signal });

  notifMarkAllBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void marcarTodasNotificaciones();
  }, { signal });

  notifList?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-notif-id]");
    if (!row) return;
    const rawId = row.getAttribute("data-notif-id");
    const id = rawId ? Number.parseInt(rawId, 10) : NaN;
    if (!Number.isFinite(id)) return;
    const selected = recientes.find((item) => item.id === id);
    if (!selected) return;

    const goTo = (): void => {
      setNotifPanelState(false);
      window.location.hash = selected.target_url || "#/notificaciones";
    };

    if (selected.is_read) {
      goTo();
      return;
    }

    void marcarNotificacionLeida(id)
      .then(() => loadNotificaciones())
      .then(() => goTo())
      .catch((error: unknown) => {
        if (typeof error === "object" && error != null && "status" in error && (error as { status?: unknown }).status === 401) {
          mountLoginPage();
          return;
        }
        goTo();
      });
  }, { signal });

  document.addEventListener("click", (event) => {
    if (!notifPanelOpen || !notifWrapper) return;
    if (!notifWrapper.contains(event.target as Node)) setNotifPanelState(false);
  }, { signal });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && notifPanelOpen) setNotifPanelState(false);
  }, { signal });

  void loadNotificaciones();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void import("../charts/index.ts").then(({ retryPendingChartMounts }) => {
        retryPendingChartMounts(container);
      });
    });
  });
}
