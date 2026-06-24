import { mountAppShell } from "../layouts/appShell.ts";
import { getAccessToken } from "../auth/session.ts";
import { hasRhModule } from "../auth/rhModulePermissions.ts";

import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  badgeApproved,
  badgeChangesRequested,
  badgePending,
  FIELD_FOCUS,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import { deletePerfilAsignacion, getAsignacionGap, getAsignacionTareasExtra } from "../api/puestos.ts";
import { getCursosPuesto, getCursosExtra } from "../api/cursos.ts";
import { mountAsignarEmpleadoModal } from "../components/puestos/asignarEmpleadoModal.ts";
import { mountTareasExtraModal } from "../components/puestos/tareasExtraModal.ts";
import { mountCursosExtraModal } from "../components/puestos/cursosExtraModal.ts";
import { mountEvaluarCualificacionesModal } from "../components/puestos/evaluarCualificacionesModal.ts";
import { mountEvaluarCompetenciasModal } from "../components/puestos/evaluarCompetenciasModal.ts";

// ── Tipos (misma forma de respuesta API) ────────────────────────────────

interface AsignacionItem {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  departamento: string | null;
  activo: boolean;
  fecha_firma_superior: string | null;
  fecha_firma_empleado: string | null;
}

interface PerfilHeader {
  id: number;
  codigo: string;
  nombre: string;
  area_nombre: string;
  nivel: string;
}

type AcuseEstado = "completo" | "parcial" | "pendiente";

type FilterState = {
  search: string;
  estado: "all" | AcuseEstado;
};

type PageMetrics = {
  total: number;
  acuseCompleto: number;
  acusePendiente: number;
  inactivos: number;
};

type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 10;

const ICON_BACK = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;
const ICON_BUILDING = `<svg class="size-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-2.25-18v18m-7.5-15v15m-7.5-12v12"/></svg>`;
const ICON_USERS = `<svg class="size-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_USERS_KPI = ICON_USERS.replace('class="size-4', 'class="size-6');
const ICON_CLIPBOARD_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const ICON_PLUS = `<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;
const ICON_CHEVRON = `<svg class="size-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>`;
const ICON_SEARCH = `<svg class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z"/></svg>`;

/** Gestión de puestos: RH con el módulo o no-RH con el módulo `puestos` otorgado. */
function canGestionarPuestos(): boolean {
  return hasRhModule("puestos");
}

function nivelLabel(nivel: string): string {
  const map: Record<string, string> = {
    operativo: "Operativo",
    mando_medio: "Mando Medio",
    gerencial: "Gerencial",
    directivo: "Directivo",
  };
  return map[nivel] ?? nivel;
}

function formatNoEmpleado(no: string | null): string {
  if (!no) return "";
  const n = parseInt(no, 10);
  return String(Number.isNaN(n) ? no : n);
}

function deriveAcuseEstado(a: AsignacionItem): AcuseEstado {
  const sup = Boolean(a.fecha_firma_superior);
  const emp = Boolean(a.fecha_firma_empleado);
  if (sup && emp) return "completo";
  if (sup || emp) return "parcial";
  return "pendiente";
}

function acuseBadge(estado: AcuseEstado): string {
  if (estado === "completo") return badgeApproved("Acuse completo");
  if (estado === "parcial") return badgeChangesRequested("Acuse parcial");
  return badgePending("Acuse pendiente");
}

function computeMetrics(items: AsignacionItem[]): PageMetrics {
  let acuseCompleto = 0;
  let acusePendiente = 0;
  let inactivos = 0;
  for (const a of items) {
    if (!a.activo) {
      inactivos += 1;
      continue;
    }
    const est = deriveAcuseEstado(a);
    if (est === "completo") acuseCompleto += 1;
    else acusePendiente += 1;
  }
  return {
    total: items.filter((a) => a.activo).length,
    acuseCompleto,
    acusePendiente,
    inactivos,
  };
}

function paginateList<T>(items: readonly T[], page: number): PaginatedList<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
  };
}

function filterAsignaciones(items: AsignacionItem[], filters: FilterState): AsignacionItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((a) => {
    if (filters.estado !== "all" && deriveAcuseEstado(a) !== filters.estado) return false;
    if (!q) return true;
    const nombre = (a.nombre_empleado ?? "").toLowerCase();
    const no = formatNoEmpleado(a.no_empleado).toLowerCase();
    return nombre.includes(q) || no.includes(q);
  });
}

const PPE_MODAL_ROOT_ID = "ppe-modal-root";
const PPE_ACTIONS_MENU_PORTAL_ID = "ppe-actions-menu-portal";

let activeMenuScrollCloser: (() => void) | null = null;

function detachMenuScrollListener(): void {
  if (!activeMenuScrollCloser) return;
  window.removeEventListener("scroll", activeMenuScrollCloser, true);
  window.removeEventListener("resize", activeMenuScrollCloser);
  activeMenuScrollCloser = null;
}

function ensureActionsMenuPortal(): HTMLElement {
  let portal = document.getElementById(PPE_ACTIONS_MENU_PORTAL_ID);
  if (!portal) {
    portal = document.createElement("div");
    portal.id = PPE_ACTIONS_MENU_PORTAL_ID;
    portal.className = "ppe-page";
    document.body.appendChild(portal);
  }
  return portal;
}

function collectActionMenus(root: HTMLElement): HTMLElement[] {
  const portal = document.getElementById(PPE_ACTIONS_MENU_PORTAL_ID);
  const inRoot = Array.from(root.querySelectorAll(".ppe-actions-menu"));
  const inPortal = portal ? Array.from(portal.querySelectorAll(".ppe-actions-menu")) : [];
  return [...inRoot, ...inPortal] as HTMLElement[];
}

function restoreActionMenu(menu: HTMLElement, root: HTMLElement): void {
  const wrapId = menu.dataset.ppeActionsWrapId;
  if (!wrapId) return;
  const wrap = root.querySelector(`.ppe-actions-wrap[data-asignacion-id="${wrapId}"]`);
  if (wrap) wrap.appendChild(menu);
  delete menu.dataset.ppeActionsWrapId;
}

function ensurePpeModalHost(hostId: string): HTMLElement {
  let root = document.getElementById(PPE_MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PPE_MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    root.appendChild(host);
  }
  return host;
}

function closeAllActionMenus(root: HTMLElement): void {
  detachMenuScrollListener();
  collectActionMenus(root).forEach((menu) => {
    menu.classList.add("hidden");
    menu.classList.remove("ppe-actions-menu--floating", "ppe-actions-menu--open-up");
    menu.style.top = "";
    menu.style.left = "";
    menu.style.maxHeight = "";
    restoreActionMenu(menu, root);
  });
  root.querySelectorAll(".ppe-actions-trigger").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function positionAndShowActionsMenu(trigger: HTMLElement, menu: HTMLElement, root: HTMLElement): void {
  const wrap = trigger.closest(".ppe-actions-wrap") as HTMLElement | null;
  const wrapId = wrap?.dataset.asignacionId;
  if (wrapId) menu.dataset.ppeActionsWrapId = wrapId;

  ensureActionsMenuPortal().appendChild(menu);
  menu.classList.remove("hidden");
  menu.classList.add("ppe-actions-menu--floating");

  const margin = 8;
  const gap = 4;
  const rect = trigger.getBoundingClientRect();
  const menuWidth = menu.offsetWidth > 0 ? menu.offsetWidth : 216;
  let left = rect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

  const placeMenu = (): void => {
    const menuHeight = menu.scrollHeight;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    menu.classList.toggle("ppe-actions-menu--open-up", openUp);

    if (openUp) {
      const maxHeight = Math.max(120, spaceAbove);
      const height = Math.min(menuHeight, maxHeight);
      menu.style.maxHeight = `${maxHeight}px`;
      menu.style.top = `${Math.max(margin, rect.top - gap - height)}px`;
    } else {
      menu.style.maxHeight = `${Math.max(120, spaceBelow)}px`;
      menu.style.top = `${rect.bottom + gap}px`;
    }

    menu.style.left = `${left}px`;
  };

  placeMenu();
  requestAnimationFrame(placeMenu);

  detachMenuScrollListener();
  activeMenuScrollCloser = () => closeAllActionMenus(root);
  requestAnimationFrame(() => {
    if (!activeMenuScrollCloser) return;
    window.addEventListener("scroll", activeMenuScrollCloser, true);
    window.addEventListener("resize", activeMenuScrollCloser);
  });
}

// ── Render ──────────────────────────────────────────────────────────────

function renderLoading(): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER} ppe-page" aria-busy="true">
    <div class="h-8 w-40 animate-pulse rounded-lg bg-slate-200/90"></div>
    <div class="h-36 animate-pulse rounded-2xl bg-white shadow-sm"></div>
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${"<div class=\"h-28 animate-pulse rounded-2xl bg-white\"></div>".repeat(4)}
    </div>
    <div class="h-64 animate-pulse rounded-2xl bg-white"></div>
  </div>`;
}

function renderHero(perfil: PerfilHeader, metrics: PageMetrics, showAsignar: boolean): string {
  return `
  <header class="${RH_LISTADO_SURFACE} ppe-hero overflow-hidden">
    <div class="border-b border-slate-100/90 bg-gradient-to-br from-slate-50/80 via-white to-blue-50/30 px-4 py-5 sm:px-6 sm:py-6">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <button type="button" id="ppe-btn-volver" class="ppe-back-link inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e40af] transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2">
            ${ICON_BACK}<span>Volver</span>
          </button>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">${escapeHtml(perfil.codigo)}</span>
          </div>
          <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(perfil.nombre)}</h1>
          <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-secondary">
            <span class="inline-flex items-center gap-1.5">${ICON_BUILDING}<span><strong class="font-semibold text-text-primary">${escapeHtml(perfil.area_nombre)}</strong> · ${escapeHtml(nivelLabel(perfil.nivel))}</span></span>
            <span class="inline-flex items-center gap-1.5">${ICON_USERS}<span><strong class="font-semibold tabular-nums text-text-primary">${metrics.total}</strong> empleado${metrics.total !== 1 ? "s" : ""} asignado${metrics.total !== 1 ? "s" : ""}</span></span>
          </div>
        </div>
        ${
          showAsignar
            ? `<div class="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
          <button type="button" id="ppe-btn-asignar" class="${RH_LISTADO_BTN_PRIMARY} ppe-btn-asignar justify-center">${ICON_PLUS}<span>Asignar empleado</span></button>
        </div>`
            : ""
        }
      </div>
    </div>
  </header>`;
}

function renderKpis(metrics: PageMetrics): string {
  const kpis = [
    {
      label: "Empleados asignados",
      value: String(metrics.total),
      sub: "Activos en este perfil",
      icon: ICON_USERS_KPI,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
    {
      label: "Acuse documentado",
      value: String(metrics.acuseCompleto),
      sub: "Firmas RH y empleado registradas",
      icon: ICON_CLIPBOARD_CHECK,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: "Acuse pendiente",
      value: String(metrics.acusePendiente),
      sub: "Sin acuse completo",
      icon: ICON_CLOCK,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      valueClass: metrics.acusePendiente > 0 ? "text-amber-700" : "",
    },
    ...(metrics.inactivos > 0
      ? [
          {
            label: "Asignaciones inactivas",
            value: String(metrics.inactivos),
            sub: "Historial desactivado",
            icon: ICON_USERS_KPI,
            iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
          },
        ]
      : []),
  ];

  const cols = kpis.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3";

  return `
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 ${cols}" role="group" aria-label="Indicadores de empleados">
    ${kpis
      .map(
        (k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary ${k.valueClass ?? ""}">${k.value}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`,
      )
      .join("")}
  </div>`;
}

function renderFilters(filters: FilterState, visible: number, total: number): string {
  const hasFilters = filters.search.trim() !== "" || filters.estado !== "all";
  return `
  <section class="${RH_LISTADO_SURFACE} ppe-filters p-4 sm:p-5" aria-label="Búsqueda y filtros">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_minmax(12rem,16rem)_auto] lg:items-end">
      <div class="min-w-0">
        <label for="ppe-search" class="${RH_LISTADO_LABEL}">Buscar colaborador</label>
        <div class="relative">
          ${ICON_SEARCH}
          <input
            id="ppe-search"
            type="search"
            autocomplete="off"
            placeholder="Nombre o número de empleado…"
            value="${escapeHtml(filters.search)}"
            class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
          />
        </div>
      </div>
      <div class="min-w-0">
        <label for="ppe-filter-estado" class="${RH_LISTADO_LABEL}">Estado de acuse</label>
        <div class="grid grid-cols-1">
          <select id="ppe-filter-estado" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="all" ${filters.estado === "all" ? "selected" : ""}>Todos</option>
            <option value="completo" ${filters.estado === "completo" ? "selected" : ""}>Acuse completo</option>
            <option value="parcial" ${filters.estado === "parcial" ? "selected" : ""}>Acuse parcial</option>
            <option value="pendiente" ${filters.estado === "pendiente" ? "selected" : ""}>Acuse pendiente</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      ${
        hasFilters
          ? `<button type="button" data-ppe-action="clear-filters" class="${RH_LISTADO_BTN_GHOST} w-full text-xs lg:mb-0.5 lg:w-auto">Limpiar filtros</button>`
          : `<p class="text-xs text-text-muted lg:mb-2.5 lg:text-right" aria-live="polite">${visible} de ${total} colaborador${total !== 1 ? "es" : ""}</p>`
      }
    </div>
    ${
      hasFilters
        ? `<p class="mt-3 text-xs text-text-muted" aria-live="polite">Mostrando ${visible} de ${total} colaborador${total !== 1 ? "es" : ""}</p>`
        : ""
    }
  </section>`;
}

function renderActionMenu(a: AsignacionItem, showRhActions: boolean): string {
  const nombre = escapeHtml(a.nombre_empleado ?? "");
  const menuItems: string[] = [];

  menuItems.push(`
    <button type="button" role="menuitem" class="ppe-menu-item" data-ppe-action="ver-detalle" data-id="${a.id}" data-nombre="${nombre}">
      Ver detalle
    </button>`);

  if (showRhActions && a.activo) {
    menuItems.push(`
      <button type="button" role="menuitem" class="ppe-menu-item" data-ppe-action="evaluar-cual" data-id="${a.id}" data-nombre="${nombre}">
        Evaluar calificaciones
      </button>
      <button type="button" role="menuitem" class="ppe-menu-item" data-ppe-action="evaluar-comp" data-id="${a.id}" data-nombre="${nombre}">
        Evaluar competencias
      </button>
      <button type="button" role="menuitem" class="ppe-menu-item" data-ppe-action="tareas-extra" data-id="${a.id}" data-nombre="${nombre}">
        Administrar tareas extra
      </button>
      <button type="button" role="menuitem" class="ppe-menu-item" data-ppe-action="cursos-extra" data-id="${a.id}" data-nombre="${nombre}">
        Administrar cursos extra
      </button>
      <div class="my-1 border-t border-slate-100" role="separator"></div>
      <button type="button" role="menuitem" class="ppe-menu-item ppe-menu-item--danger" data-ppe-action="desasignar" data-id="${a.id}">
        Desasignar empleado
      </button>`);
  }

  return `
  <div class="ppe-actions-wrap relative flex justify-end" data-asignacion-id="${a.id}">
    <button
      type="button"
      class="ppe-actions-trigger ${RH_LISTADO_BTN_GHOST} !px-3 !py-2 text-xs"
      aria-haspopup="menu"
      aria-expanded="false"
      data-ppe-action="toggle-menu"
      data-id="${a.id}"
    >
      <span>Acciones</span>
      ${ICON_CHEVRON}
    </button>
    <div class="ppe-actions-menu hidden" role="menu" aria-label="Acciones del empleado">
      ${menuItems.join("")}
    </div>
  </div>`;
}

function renderTableRows(items: AsignacionItem[], showRhActions: boolean): string {
  return items
    .map((a) => {
      const estado = deriveAcuseEstado(a);
      const noFmt = formatNoEmpleado(a.no_empleado);
      return `
    <tr class="ppe-table-row" data-asignacion-id="${a.id}">
      <td class="px-4 py-4 align-middle">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary">${escapeHtml(a.nombre_empleado ?? `Empleado #${a.empleado_id}`)}</p>
          ${noFmt ? `<p class="mt-0.5 text-xs tabular-nums text-text-muted">No. ${escapeHtml(noFmt)}</p>` : ""}
          ${a.departamento ? `<p class="mt-1 text-xs text-text-secondary">${escapeHtml(a.departamento)}</p>` : ""}
        </div>
      </td>
      <td class="hidden px-4 py-4 align-middle md:table-cell">
        ${acuseBadge(estado)}
        ${!a.activo ? `<span class="mt-1 block">${badgePending("Inactivo")}</span>` : ""}
      </td>
      <td class="px-3 py-3 align-middle text-right">
        ${renderActionMenu(a, showRhActions)}
      </td>
    </tr>`;
    })
    .join("");
}

function renderEmptyAssigned(showAsignar: boolean): string {
  return `
  <div class="${RH_LISTADO_SURFACE} ppe-empty px-6 py-12 text-center">
    <p class="text-base font-semibold text-text-primary">Sin empleados asignados</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Aún no hay colaboradores vinculados a este perfil de puesto. Asigna empleados para gestionar evaluaciones, tareas extra y acuses.
    </p>
    ${
      showAsignar
        ? `<button type="button" data-ppe-action="asignar" class="${RH_LISTADO_BTN_PRIMARY} ppe-btn-asignar mx-auto mt-6">${ICON_PLUS}<span>Asignar empleado</span></button>`
        : ""
    }
  </div>`;
}

function renderTableFooter(pg: PaginatedList<AsignacionItem>): string {
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.pageSize + 1;
  const to = Math.min(pg.page * pg.pageSize, pg.total);

  const pageButtons = paginationRange(pg.totalPages, pg.page)
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm" aria-hidden="true">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "ppe-page-btn ppe-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
        : "ppe-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-ppe-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
    })
    .join("");

  return `
  <footer class="ppe-table-footer flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
    <p class="text-xs font-medium text-slate-600 sm:text-sm">
      Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span> colaborador${pg.total !== 1 ? "es" : ""}
      <span class="text-text-muted"> · ${PAGE_SIZE} por página</span>
    </p>
  ${
    pg.totalPages > 1
      ? `<nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación de colaboradores">
      <button type="button" data-ppe-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
        class="ppe-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página anterior</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
      </button>
      ${pageButtons}
      <button type="button" data-ppe-page="${pg.page + 1}" ${pg.page >= pg.totalPages ? "disabled" : ""}
        class="ppe-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página siguiente</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
      </button>
    </nav>`
      : ""
  }
  </footer>`;
}

function renderNoResults(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} ppe-empty px-6 py-10 text-center">
    <p class="text-sm font-semibold text-text-primary">Sin resultados</p>
    <p class="mt-1.5 text-xs text-text-muted">Ajusta la búsqueda o los filtros para ver colaboradores.</p>
    <button type="button" data-ppe-action="clear-filters" class="${RH_LISTADO_BTN_GHOST} mx-auto mt-4 text-xs">Limpiar filtros</button>
  </div>`;
}

function renderTableSection(
  filtered: AsignacionItem[],
  allCount: number,
  filters: FilterState,
  listPage: number,
  showRhActions: boolean,
): string {
  if (allCount === 0) return renderEmptyAssigned(showRhActions);
  if (filtered.length === 0) {
    return `<div class="ppe-content-stack">${renderFilters(filters, 0, allCount)}${renderNoResults()}</div>`;
  }

  const pg = paginateList(filtered, listPage);

  return `
  <div class="ppe-content-stack">
  ${renderFilters(filters, filtered.length, allCount)}
  <section class="${RH_LISTADO_SURFACE} ppe-table-section overflow-hidden p-0 flex flex-col" aria-label="Colaboradores asignados">
    <div class="ppe-table-scroll overflow-x-auto">
      <table class="ppe-table min-w-[640px] w-full border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Colaborador</th>
            <th scope="col" class="hidden px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted md:table-cell">Estado</th>
            <th scope="col" class="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${renderTableRows(pg.items, showRhActions)}</tbody>
      </table>
    </div>
    ${renderTableFooter(pg)}
  </section>
  </div>`;
}

function renderPage(
  perfil: PerfilHeader,
  asignaciones: AsignacionItem[],
  filters: FilterState,
  listPage: number,
  showRhActions: boolean,
): string {
  const metrics = computeMetrics(asignaciones);
  const filtered = filterAsignaciones(asignaciones, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(1, listPage), totalPages);

  return `
  <div class="${RH_LISTADO_PAGE_OUTER} ppe-page">
    ${renderHero(perfil, metrics, showRhActions)}
    ${asignaciones.length > 0 ? renderKpis(metrics) : ""}
    <div id="ppe-main">${renderTableSection(filtered, asignaciones.length, filters, safePage, showRhActions)}</div>
  </div>`;
}

// ── Mount ─────────────────────────────────────────────────────────────────

export function mountPuestoEmpleados(container: HTMLElement, perfilId: number): void {
  mountAppShell(container, {
    pageTitle: "Empleados del Puesto",
    mainHtml: `<div id="puesto-empleados-root">${renderLoading()}</div>`,
  });

  const rootEl = container.querySelector("#puesto-empleados-root");
  if (!(rootEl instanceof HTMLElement)) return;
  const pageRoot: HTMLElement = rootEl;

  let perfil: PerfilHeader | null = null;
  let asignaciones: AsignacionItem[] = [];
  let filters: FilterState = { search: "", estado: "all" };
  let listPage = 1;
  const showRhActions = canGestionarPuestos();

  let asignarModal: { open: () => void } | null = null;

  function openAsignar(): void {
    asignarModal?.open();
  }

  function clampListPage(filteredCount: number): number {
    const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE) || 1);
    listPage = Math.min(Math.max(1, listPage), totalPages);
    return listPage;
  }

  function refreshView(opts?: { scrollToTable?: boolean }): void {
    if (!perfil) return;
    const filteredCount = filterAsignaciones(asignaciones, filters).length;
    clampListPage(filteredCount);
    pageRoot.innerHTML = renderPage(perfil, asignaciones, filters, listPage, showRhActions);
    bindModalHosts();
    wireAsignarButton();
    if (opts?.scrollToTable) {
      pageRoot.querySelector("#ppe-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function wireAsignarButton(): void {
    pageRoot.querySelector("#ppe-btn-volver")?.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.hash = `#/puestos/${perfilId}`;
    });
    pageRoot.querySelector("#ppe-btn-asignar")?.addEventListener("click", openAsignar);
    pageRoot.querySelector('[data-ppe-action="asignar"]')?.addEventListener("click", openAsignar);
  }

  function bindModalHosts(): void {
    if (!showRhActions) return;
    const modalHost = ensurePpeModalHost("modal-host-asignar");
    asignarModal = mountAsignarEmpleadoModal(modalHost, {
      perfilId,
      onSuccess: () => void loadData(),
    });
  }

  async function handleDesasignar(asignacionId: number): Promise<void> {
    const confirmed = confirm("¿Desasignar a este empleado del perfil? La asignación se desactivará.");
    if (!confirmed) return;
    try {
      await deletePerfilAsignacion(perfilId, asignacionId);
      closeAllActionMenus(pageRoot);
      await loadData();
    } catch {
      alert("Error al desasignar empleado.");
    }
  }

  function handleMenuAction(btn: HTMLElement): void {
    const action = btn.dataset.ppeAction;
    const asignacionId = Number(btn.dataset.id);
    const nombreEmpleado = btn.dataset.nombre ?? "";

    if (action === "toggle-menu") {
      const wrap = btn.closest(".ppe-actions-wrap");
      const menu = wrap?.querySelector(".ppe-actions-menu");
      const wasOpen = menu && !menu.classList.contains("hidden");
      closeAllActionMenus(pageRoot);
      if (menu && wrap && !wasOpen) {
        positionAndShowActionsMenu(btn, menu as HTMLElement, pageRoot);
        btn.setAttribute("aria-expanded", "true");
      }
      return;
    }

    closeAllActionMenus(pageRoot);

    if (action === "ver-detalle") {
      void openDetalleModal(ensurePpeModalHost("modal-host-detalle"), perfilId, asignacionId, nombreEmpleado);
      return;
    }

    if (!showRhActions) return;

    const tareasHost = ensurePpeModalHost("modal-host-tareas-extra");
    const cualHost = ensurePpeModalHost("modal-host-evaluar-cual");
    const compHost = ensurePpeModalHost("modal-host-evaluar-comp");

    if (action === "tareas-extra") {
      mountTareasExtraModal(tareasHost, { perfilId, asignacionId, nombreEmpleado }).open();
    } else if (action === "cursos-extra") {
      const cursosHost = ensurePpeModalHost("modal-host-cursos-extra");
      mountCursosExtraModal(cursosHost, { perfilId, asignacionId, nombreEmpleado }).open();
    } else if (action === "evaluar-cual") {
      mountEvaluarCualificacionesModal(cualHost, { perfilId, asignacionId, nombreEmpleado }).open();
    } else if (action === "evaluar-comp") {
      mountEvaluarCompetenciasModal(compHost, { perfilId, asignacionId, nombreEmpleado }).open();
    } else if (action === "desasignar") {
      void handleDesasignar(asignacionId);
    }
  }

  pageRoot.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const pageBtn = target.closest<HTMLElement>("[data-ppe-page]");
    if (pageBtn && pageRoot.contains(pageBtn) && !pageBtn.hasAttribute("disabled")) {
      const next = Number(pageBtn.dataset.ppePage);
      if (!Number.isNaN(next) && next >= 1) {
        listPage = next;
        refreshView({ scrollToTable: true });
      }
      return;
    }

    const btn = target.closest<HTMLElement>("[data-ppe-action]");
    if (!btn || !pageRoot.contains(btn)) return;

    const action = btn.dataset.ppeAction;
    if (action === "clear-filters") {
      filters = { search: "", estado: "all" };
      listPage = 1;
      refreshView();
      return;
    }
    if (action === "toggle-menu") {
      e.stopPropagation();
    }
    if (action) handleMenuAction(btn);
  });

  pageRoot.addEventListener("input", (e) => {
    const el = e.target as HTMLElement;
    if (el.id === "ppe-search") {
      filters = { ...filters, search: (el as HTMLInputElement).value };
      listPage = 1;
      refreshView();
    }
  });

  pageRoot.addEventListener("change", (e) => {
    const el = e.target as HTMLElement;
    if (el.id === "ppe-filter-estado") {
      filters = { ...filters, estado: (el as HTMLSelectElement).value as FilterState["estado"] };
      listPage = 1;
      refreshView();
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ppe-actions-wrap") || t.closest(".ppe-actions-menu")) return;
    if (pageRoot.isConnected) closeAllActionMenus(pageRoot);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllActionMenus(pageRoot);
  });

  async function loadData(): Promise<void> {
    const token = getAccessToken();
    if (!token) {
      pageRoot.innerHTML = `<p class="text-sm text-red-600">No autenticado</p>`;
      return;
    }

    try {
      const [perfilRes, asigRes] = await Promise.all([
        fetch(`/api/v1/puestos-perfil/${perfilId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/v1/perfiles/${perfilId}/asignaciones`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (perfilRes.status === 404 || asigRes.status === 404) {
        pageRoot.innerHTML = `<p class="text-sm text-text-muted">Perfil no encontrado.</p>`;
        return;
      }

      if (!perfilRes.ok || !asigRes.ok) {
        pageRoot.innerHTML = `<p class="text-sm text-red-600">Error al cargar la información.</p>`;
        return;
      }

      const perfilJson = await perfilRes.json();
      perfil = {
        id: perfilJson.id,
        codigo: perfilJson.codigo ?? "",
        nombre: perfilJson.nombre ?? "",
        area_nombre: perfilJson.area_nombre ?? "",
        nivel: perfilJson.nivel ?? "",
      };

      asignaciones = await asigRes.json();
      refreshView();
    } catch {
      pageRoot.innerHTML = `<p class="text-sm text-red-600">Error de conexión</p>`;
    }
  }

  void loadData();
}

// ── Modal detalle (misma lógica, estilos alineados) ───────────────────────

async function openDetalleModal(
  host: HTMLElement,
  perfilId: number,
  asignacionId: number,
  nombreEmpleado: string,
): Promise<void> {
  host.innerHTML = `
    <div id="detalle-overlay" class="ppe-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div class="ppe-modal-panel w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)] max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="detalle-title">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div>
            <h2 id="detalle-title" class="text-lg font-semibold text-text-primary">Detalle del empleado</h2>
            <p class="text-xs text-text-muted mt-0.5">${escapeHtml(nombreEmpleado)}</p>
          </div>
          <button type="button" id="detalle-close" class="${RH_LISTADO_BTN_GHOST} !p-1.5" aria-label="Cerrar">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div id="detalle-body" class="flex-1 overflow-y-auto px-5 py-4">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;

  const overlay = host.querySelector("#detalle-overlay") as HTMLElement;
  const body = host.querySelector("#detalle-body") as HTMLElement;

  function close(): void {
    host.innerHTML = "";
    document.body.style.overflow = "";
  }

  document.body.style.overflow = "hidden";

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  host.querySelector("#detalle-close")!.addEventListener("click", close);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      document.removeEventListener("keydown", esc);
    }
  });

  try {
    const [gap, tareasExtra, cursosAsignados, cursosExtra] = await Promise.all([
      getAsignacionGap(perfilId, asignacionId),
      getAsignacionTareasExtra(perfilId, asignacionId),
      getCursosPuesto(perfilId),
      getCursosExtra(perfilId, asignacionId),
    ]);

    const r = gap.resumen;
    const cualRows = gap.gap_cualificaciones
      .map((g) => {
        let badge: string;
        if (g.cumple === true) badge = `<span class="text-emerald-600 text-xs font-medium">Cumple</span>`;
        else if (g.cumple === false) badge = `<span class="text-red-600 text-xs font-medium">No cumple</span>`;
        else badge = `<span class="text-amber-600 text-xs font-medium">Pendiente</span>`;
        return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(g.situacion_deseada)}</td><td class="py-1.5 text-right">${badge}</td></tr>`;
      })
      .join("");

    const compRows = gap.gap_competencias
      .map((g) => {
        const nivel = g.evaluado && g.situacion_actual ? parseInt(g.situacion_actual, 10) : 0;
        const nivelDisplay = Number.isNaN(nivel)
          ? g.situacion_actual === "cumple"
            ? "4"
            : "0"
          : String(nivel);
        return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(g.competencia_nombre)}</td><td class="py-1.5 text-right text-xs font-medium text-slate-600">${g.evaluado ? `${nivelDisplay}/4` : '<span class="text-amber-600">Pendiente</span>'}</td></tr>`;
      })
      .join("");

    const tareasRows = tareasExtra
      .map((t) => `<li class="text-sm text-text-primary">${escapeHtml(t.tarea_catalogo_nombre)}</li>`)
      .join("");

    const cursosRows = cursosAsignados
      .map((c) => {
        const oblig = c.obligatorio ? `<span class="ml-2 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200/70">Obligatorio</span>` : "";
        const sesion = c.sesion_fecha ? `<span class="ml-2 inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200/70">${escapeHtml(new Date(c.sesion_fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }))}</span>` : "";
        return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(c.curso_nombre ?? `Curso #${c.curso_id}`)}${oblig}${sesion}</td></tr>`;
      })
      .join("");

    const cursosExtraRows = cursosExtra
      .map((c) => {
        const sesion = c.sesion_fecha ? `<span class="ml-2 inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200/70">${escapeHtml(new Date(c.sesion_fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }))}</span>` : "";
        return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(c.curso_nombre ?? `Curso #${c.curso_id}`)}${sesion}</td></tr>`;
      })
      .join("");

    body.innerHTML = `
      <div class="space-y-5">
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Cualificaciones</h3>
          <p class="text-xs text-slate-500 mb-2">${r.evaluadas_cualificaciones}/${r.total_cualificaciones} evaluadas</p>
          ${cualRows ? `<table class="w-full">${cualRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin cualificaciones</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Competencias</h3>
          <p class="text-xs text-slate-500 mb-2">${r.evaluadas_competencias}/${r.total_competencias} evaluadas</p>
          ${compRows ? `<table class="w-full">${compRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin competencias</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Cursos del puesto</h3>
          <p class="text-xs text-slate-500 mb-2">${cursosAsignados.length} curso${cursosAsignados.length !== 1 ? "s" : ""}</p>
          ${cursosRows ? `<table class="w-full">${cursosRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin cursos asignados al puesto</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Cursos extra (individual)</h3>
          <p class="text-xs text-slate-500 mb-2">${cursosExtra.length} curso${cursosExtra.length !== 1 ? "s" : ""} extra</p>
          ${cursosExtraRows ? `<table class="w-full">${cursosExtraRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin cursos extra asignados</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Tareas extra</h3>
          ${tareasRows ? `<ul class="list-disc pl-4 space-y-1">${tareasRows}</ul>` : `<p class="text-xs text-slate-400 italic">Sin tareas extra asignadas</p>`}
        </div>
      </div>`;
  } catch {
    body.innerHTML = `<p class="text-sm text-red-600">Error al cargar detalle</p>`;
  }
}
