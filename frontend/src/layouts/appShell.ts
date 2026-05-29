import {
  canAccessEmpleadoPersonalDashboard,
  getRolFromAccessToken,
  getUserDisplayNameFromAccessToken,
  getUserInitialsFromAccessToken,
} from "../auth/jwt.ts";
import { isShellNavItemVisibleForRol, type AppShellNavItemId } from "../navigation/shellNavPolicy.ts";
import { clearAuth } from "../auth/session.ts";
import { tituloDesdeHash } from "../navigation/pageTitles.ts";
import { marcarNotificacionLeida, type NotificacionApiItem } from "../api/notificaciones.ts";
import {
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
  | "metricas"
  | "solicitudes"
  | "incidencias"
  | "actas"
  | "comedor"
  | "reportes"
  | "puestos"
  | "tareas-catalogo"
  | "competencias"
  | "evaluaciones"
  | "capacitaciones"
  | "capacidades"
  | "habilidades"
  | "cursos"
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
  labelWrapClass?: string;
  svgPaths: string;
};

type NavGroupDef = {
  id: string;
  label: string;
  children: readonly NavItemDef[];
};

/** Encabezado de sección del sidebar (mismo criterio visual que «Talento»). */
const navSectionHeadingClass =
  "text-[11px] font-semibold uppercase tracking-wider text-text-muted md:max-lg:hidden";

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

function navSectionFromGroup(activeNav: ShellNavKey | undefined, rol: string | null, def: NavGroupDef): string {
  const visibleChildren = def.children.filter((child) => isShellNavItemVisibleForRol(rol, child.id));
  if (visibleChildren.length === 0) return "";
  const childHtml = visibleChildren.map((child) => navItemLi(activeNav, rol, child)).join("");
  const escapedLabel = escapeHtmlText(def.label);
  const headingId = `shell-nav-section-${def.id}`;
  return `<li>
    <div id="${headingId}" class="${navSectionHeadingClass}">${escapedLabel}</div>
    <ul role="list" class="-mx-2 mt-2 space-y-1 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${headingId}">
      ${childHtml}
    </ul>
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

const NAV_LABORALES: readonly NavItemDef[] = [
  {
    id: "metricas",
    key: "metricas",
    hrefFor: () => "#/metricas",
    label: "Métricas",
    svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "solicitudes",
    key: "solicitudes",
    hrefFor: () => "#/solicitudes",
    label: "Solicitudes",
    svgPaths: `<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "incidencias",
    key: "incidencias",
    hrefFor: () => "#/incidencias",
    label: "Incidencias",
    svgPaths: `<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "actas",
    key: "actas",
    hrefFor: () => "#/actas",
    label: "Actas",
    svgPaths: `<path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const NAV_COMEDOR: readonly NavItemDef[] = [
  {
    id: "comedor",
    key: "comedor",
    hrefFor: (rol) =>
      rol === "empleado" || rol === "rh" || rol === "supervisor" || rol === "gerente"
        ? "#/comedor"
        : "#",
    label: "Gestión Comedor",
    svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "reportes",
    key: "reportes",
    hrefFor: (rol) =>
      rol === "rh" || rol === "gerente" || rol === "director"
        ? "#/comedor/reporte"
        : "#",
    label: "Reporte de comedor",
    svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const NAV_GROUPS: readonly NavGroupDef[] = [
  {
    id: "laborales",
    label: "Laborales",
    children: NAV_LABORALES,
  },
  {
    id: "comedor-group",
    label: "Comedor",
    children: NAV_COMEDOR,
  },
];

const NAV_EMPLEADOS: NavItemDef = {
  id: "empleados",
  key: "empleados",
  hrefFor: () => "#/empleados",
  label: "Empleados",
  svgPaths: `<path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

const NAV_TALENTO: readonly NavItemDef[] = [
  {
    id: "puestos",
    key: "puestos",
    hrefFor: () => "#/puestos",
    label: "Perfiles de Puesto",
    svgPaths: `<path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "competencias",
    key: "competencias",
    hrefFor: () => "#/competencias",
    label: "Matriz de Competencias",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h2.25m-2.25 0a1.125 1.125 0 0 1-1.125 1.125M13.125 12c-.621 0-1.125.504-1.125 1.125m0 0v1.5c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-2.25-1.125c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M10.875 15.75h2.25m-2.25 0a1.125 1.125 0 0 1-1.125 1.125M13.125 15.75c-.621 0-1.125.504-1.125 1.125m1.125-1.125c.621 0 1.125.504 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 18.375h-1.125m2.25 0h7.5m-9.75 0c-.621 0-1.125-.504-1.125-1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0-3.75h-7.5m7.5 0c.621 0 1.125.504 1.125 1.125M20.625 15.75c.621 0 1.125.504 1.125 1.125v1.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "tareas-catalogo",
    key: "tareas-catalogo",
    hrefFor: () => "#/tareas-catalogo",
    label: "Catalogo de Tareas",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 3h1A2.25 2.25 0 0 1 16.65 3.836m-5.8 0c-.376.023-.75.05-1.124.08C8.095 4.01 7.25 4.973 7.25 6.108V8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "evaluaciones",
    key: "evaluaciones",
    hrefFor: () => "#/evaluaciones",
    label: "Evaluaciones",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "capacitaciones",
    key: "capacitaciones",
    hrefFor: () => "#/capacitaciones",
    label: "Capacitaciones",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const NAV_FORMACION: readonly NavItemDef[] = [
  {
    id: "capacidades",
    key: "capacidades",
    hrefFor: () => "#/capacidades",
    label: "Matriz de Capacidades",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "habilidades",
    key: "habilidades",
    hrefFor: () => "#/habilidades",
    label: "Matriz de Habilidades",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0 4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 4.5L21.75 16.5 12 21.75 2.25 16.5l4.179-2.25m11.142 0L12 16.5l-5.571-2.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "cursos",
    key: "cursos",
    hrefFor: () => "#/cursos",
    label: "Manejo de Cursos",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "opls",
    key: "opls",
    hrefFor: () => "#/opls",
    label: "Manejo de OPLs",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const NAV_CUMPLIMIENTO: readonly NavItemDef[] = [
  {
    id: "evidencias",
    key: "evidencias",
    hrefFor: () => "#/evidencias",
    label: "Motor de Evidencias",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "sugerencias",
    key: "sugerencias",
    hrefFor: () => "#/sugerencias",
    label: "Motor de Sugerencias",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "encuestas",
    key: "encuestas",
    hrefFor: () => "#/encuestas",
    label: "Encuestas Post Curso",
    labelWrapClass: "truncate",
    svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

function footerGestionHtml(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const empleadosLi = navItemLi(activeNav, rol, NAV_EMPLEADOS);
  if (empleadosLi.trim() === "") return "";
  return `<li class="mt-auto pt-6">
    <ul role="list" class="-mx-2 space-y-1 md:max-lg:-mx-0">
      ${empleadosLi}
    </ul>
  </li>`;
}

/** Sidebar interior (móvil + desktop idénticos). */
function sidebarBody(activeNav: ShellNavKey | undefined): string {
  const rol = getRolFromAccessToken();
  const primaryLis = NAV_PRIMARY.map((d) => navItemLi(activeNav, rol, d)).join("");
  const groupSectionLis = NAV_GROUPS.map((g) => navSectionFromGroup(activeNav, rol, g)).join("");

  const talentoLis = NAV_TALENTO.map((d) => navItemLi(activeNav, rol, d)).join("");
  const talentoHeadingId = "shell-nav-section-talento";
  const talentoBlock =
    talentoLis.trim() === "" ?
      ""
    : `<li>
          <div id="${talentoHeadingId}" class="${navSectionHeadingClass}">Talento</div>
          <ul role="list" class="-mx-2 mt-2 space-y-1 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${talentoHeadingId}">
            ${talentoLis}
          </ul>
        </li>`;

  const menuPrincipalHeadingId = "shell-nav-section-menu-principal";

  const formacionLis = NAV_FORMACION.map((d) => navItemLi(activeNav, rol, d)).join("");
  const formacionHeadingId = "shell-nav-section-formacion";
  const formacionBlock =
    formacionLis.trim() === "" ?
      ""
    : `<li>
          <div id="${formacionHeadingId}" class="${navSectionHeadingClass}">Formación</div>
          <ul role="list" class="-mx-2 mt-2 space-y-1 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${formacionHeadingId}">
            ${formacionLis}
          </ul>
        </li>`;

  const cumplimientoLis = NAV_CUMPLIMIENTO.map((d) => navItemLi(activeNav, rol, d)).join("");
  const cumplimientoHeadingId = "shell-nav-section-cumplimiento";
  const cumplimientoBlock =
    cumplimientoLis.trim() === "" ?
      ""
    : `<li>
          <div id="${cumplimientoHeadingId}" class="${navSectionHeadingClass}">Cumplimiento</div>
          <ul role="list" class="-mx-2 mt-2 space-y-1 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${cumplimientoHeadingId}">
            ${cumplimientoLis}
          </ul>
        </li>`;
  return `
    <div class="flex shrink-0 items-center lg:pb-5 md:max-lg:flex md:max-lg:flex-col md:max-lg:items-center md:max-lg:pb-4 lg:items-start lg:pt-6">
      <img src="/leoni-logo.png" alt="Leoni" class="h-7 w-auto max-w-[11rem] object-contain object-left md:max-lg:h-[1.5rem] md:max-lg:max-w-[4.75rem]" />
    </div>
    <nav class="relative flex flex-1 flex-col">
      <ul role="list" class="flex flex-1 flex-col gap-y-5">
        <li>
          <div id="${menuPrincipalHeadingId}" class="${navSectionHeadingClass}">Menú principal</div>
          <ul role="list" class="-mx-2 mt-2 space-y-1 md:max-lg:-mx-0 md:max-lg:mt-3" aria-labelledby="${menuPrincipalHeadingId}">
            ${primaryLis}
          </ul>
        </li>
        ${groupSectionLis}
        ${talentoBlock}
        ${formacionBlock}
        ${cumplimientoBlock}
        ${footerGestionHtml(activeNav, rol)}
      </ul>
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
    rawRol && !canAccessEmpleadoPersonalDashboard() ?
      `<span class="hidden max-w-[12rem] truncate text-start text-xs font-normal capitalize text-text-muted xl:block">${escapeHtmlText(formatRolLabel(rawRol))}</span>`
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
      <div class="flex shrink-0 items-center gap-x-6 sm:gap-x-10">
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
              <h2 id="notif-dropdown-heading" class="notif-dropdown-header__title">Notificaciones</h2>
              <span id="app-shell-notifications-count" class="notif-dropdown-header-badge">0 no leídas</span>
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
          <el-menu anchor="bottom end" popover class="w-40 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-black/5 transition transition-discrete [--anchor-gap:--spacing(2.5)] data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in">
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
  let notifPanelOpen = false;
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

  const applyNotificacionesSnapshot = (): void => {
    if (!notifList || !notifBadgeHost || !notifCount) return;
    const snap = getNotificacionesResumenSnapshot();
    recientes = snap.recientes;
    notifBadgeHost.innerHTML = renderNotificacionBadge(snap.unreadCount);
    notifCount.textContent = `${snap.unreadCount} no leídas`;
    if (snap.status === "error" && snap.errorMessage) {
      notifList.innerHTML = `<p class="notif-dropdown-error" role="alert">${escapeHtmlText(snap.errorMessage)}</p>`;
      return;
    }
    renderNotifDropdown(snap.recientes);
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
}
