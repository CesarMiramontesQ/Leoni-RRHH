import {
  fetchRhModulosCatalogo,
  fetchRhUsuariosPermisos,
  updateRhUsuarioPermisos,
  type RhModuloCatalogItem,
  type RhUsuarioPermisosItem,
} from "../api/rhPermisos.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_FOCUS,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

type AccessLevel = "full" | "partial" | "none";
type AccessFilter = "all" | AccessLevel;
type SortField = "nombre" | "permisos" | "updated_at";
type SortDir = "asc" | "desc";

type PageState = {
  loading: boolean;
  savingId: number | null;
  error: string | null;
  success: string | null;
  catalog: RhModuloCatalogItem[];
  usuarios: RhUsuarioPermisosItem[];
  draftByEmpleadoId: Map<number, Record<string, boolean>>;
  lastUpdatedAtByEmpleadoId: Map<number, number>;
  filterQuery: string;
  accessFilter: AccessFilter;
  sortField: SortField;
  sortDir: SortDir;
  page: number;
  pageSize: number;
  editingEmpleadoId: number | null;
  drawerExpandedGroups: Set<string>;
};

const CHEVRON_SVG = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-4 shrink-0 text-text-muted transition-transform duration-200"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;

const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-2.5 text-left text-[13px] font-bold tracking-tight text-[#334155] sm:px-4";

const TABLE_TD = "px-3 py-2.5 align-middle text-sm text-text-primary sm:px-4";

const FILTER_INPUT =
  "rh-emp-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

const FILTER_SELECT =
  "col-start-1 row-start-1 w-full min-h-[42px] appearance-none rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-2.5 pr-8 pl-3 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)]";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Tabla: primer nombre + primer apellido (título). */
function formatNombreTablaRh(nombre: string): string {
  return formatNombreEmpleadoUi(nombre, { titulo: true, omitirSegundoApellido: true }) || nombre.trim();
}

/** Drawer: nombre completo reordenado y capitalizado. */
function formatNombreCompletoRh(nombre: string): string {
  return formatNombreEmpleadoUi(nombre, { titulo: true, omitirSegundoApellido: false }) || nombre.trim();
}

function formatNoEmpleadoRh(noEmpleado: string): string {
  return formatNoEmpleadoDisplay(noEmpleado) || noEmpleado.trim();
}

function renderNombreSublinea(user: RhUsuarioPermisosItem): string {
  const parts = ["RH"];
  if (user.puede_administrar_permisos_rh) parts.push("Administrador de permisos");
  return `<p class="mt-0.5 text-xs text-[#64748b]">${escapeHtml(parts.join(" · "))}</p>`;
}

function countActiveModules(modulos: Record<string, boolean>): number {
  return Object.values(modulos).filter(Boolean).length;
}

function groupCatalog(catalog: RhModuloCatalogItem[]): Map<string, RhModuloCatalogItem[]> {
  const groups = new Map<string, RhModuloCatalogItem[]>();
  for (const item of catalog) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return groups;
}

function getDraft(state: PageState, user: RhUsuarioPermisosItem): Record<string, boolean> {
  return state.draftByEmpleadoId.get(user.empleado_id) ?? user.modulos;
}

function getAccessLevel(user: RhUsuarioPermisosItem, draft: Record<string, boolean>): AccessLevel {
  if (!user.permisos_personalizados) return "full";
  const active = countActiveModules(draft);
  const total = Object.keys(draft).length;
  if (active === 0) return "none";
  if (active === total) return "full";
  return "partial";
}

function accessLevelLabel(level: AccessLevel): string {
  if (level === "full") return "Acceso completo";
  if (level === "partial") return "Acceso parcial";
  return "Sin permisos";
}

function renderAccessBadge(level: AccessLevel): string {
  if (level === "full") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${accessLevelLabel(level)}</span>`;
  }
  if (level === "partial") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>${accessLevelLabel(level)}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"><span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>${accessLevelLabel(level)}</span>`;
}

function groupBadgeClass(active: number, total: number, userFullAccess: boolean): string {
  if (userFullAccess || active === total) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (active === 0) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function renderModuleBadges(
  user: RhUsuarioPermisosItem,
  draft: Record<string, boolean>,
  catalogGroups: Map<string, RhModuloCatalogItem[]>,
): string {
  const userFullAccess = !user.permisos_personalizados;
  return [...catalogGroups.entries()]
    .map(([group, items]) => {
      const active = items.filter((m) => draft[m.key] === true).length;
      const cls = groupBadgeClass(active, items.length, userFullAccess);
      return `<span class="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}" title="${escapeHtml(group)}">${escapeHtml(group)} (${active}/${items.length})</span>`;
    })
    .join("");
}

function matchesSearch(user: RhUsuarioPermisosItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    user.nombre.toLowerCase().includes(q) ||
    user.no_empleado.toLowerCase().includes(q) ||
    (user.email ?? "").toLowerCase().includes(q)
  );
}

function computeStats(
  usuarios: RhUsuarioPermisosItem[],
  draftByEmpleadoId: Map<number, Record<string, boolean>>,
): { total: number; full: number; partial: number; none: number } {
  let full = 0;
  let partial = 0;
  let none = 0;
  for (const user of usuarios) {
    const level = getAccessLevel(user, getDraftFromMap(draftByEmpleadoId, user));
    if (level === "full") full += 1;
    else if (level === "partial") partial += 1;
    else none += 1;
  }
  return { total: usuarios.length, full, partial, none };
}

function getDraftFromMap(
  draftByEmpleadoId: Map<number, Record<string, boolean>>,
  user: RhUsuarioPermisosItem,
): Record<string, boolean> {
  return draftByEmpleadoId.get(user.empleado_id) ?? user.modulos;
}

function filterAndSortUsuarios(state: PageState): RhUsuarioPermisosItem[] {
  let list = state.usuarios.filter((user) => {
    if (!matchesSearch(user, state.filterQuery)) return false;
    if (state.accessFilter === "all") return true;
    const level = getAccessLevel(user, getDraft(state, user));
    return level === state.accessFilter;
  });

  const dir = state.sortDir === "asc" ? 1 : -1;
  list = [...list].sort((a, b) => {
    if (state.sortField === "nombre") {
      return dir * a.nombre.localeCompare(b.nombre, "es");
    }
    if (state.sortField === "permisos") {
      const ca = countActiveModules(getDraft(state, a));
      const cb = countActiveModules(getDraft(state, b));
      return dir * (ca - cb) || a.nombre.localeCompare(b.nombre, "es");
    }
    const ta = state.lastUpdatedAtByEmpleadoId.get(a.empleado_id) ?? 0;
    const tb = state.lastUpdatedAtByEmpleadoId.get(b.empleado_id) ?? 0;
    return dir * (ta - tb) || a.nombre.localeCompare(b.nombre, "es");
  });
  return list;
}

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageSize: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
  };
}

function iconSearchInput(): string {
  return `<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.125rem]"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
  </span>`;
}

function renderStatCard(label: string, value: number, tone: "default" | "success" | "warning" | "muted"): string {
  const tones: Record<typeof tone, string> = {
    default: "border-[rgba(148,163,184,0.22)] from-white to-[#f8fbff]",
    success: "border-emerald-200/80 from-emerald-50/40 to-white",
    warning: "border-amber-200/80 from-amber-50/40 to-white",
    muted: "border-slate-200/80 from-slate-50/60 to-white",
  };
  return `
    <div class="rounded-[14px] border bg-linear-to-br p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${tones[tone]}">
      <p class="text-xs font-semibold uppercase tracking-wide text-[#64748b]">${escapeHtml(label)}</p>
      <p class="mt-2 text-2xl font-bold tabular-nums text-[#0f172a]">${value}</p>
    </div>`;
}

function renderStatsHeader(state: PageState): string {
  const stats = computeStats(state.usuarios, state.draftByEmpleadoId);
  return `
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Estadísticas de permisos RH">
      ${renderStatCard("Total usuarios RH", stats.total, "default")}
      ${renderStatCard("Acceso completo", stats.full, "success")}
      ${renderStatCard("Acceso parcial", stats.partial, "warning")}
      ${renderStatCard("Sin permisos", stats.none, "muted")}
    </section>`;
}

function renderFilterChip(value: AccessFilter, label: string, active: AccessFilter): string {
  const isActive = value === active;
  const cls = isActive
    ? "border-[#2563eb] bg-[rgba(219,234,254,0.55)] text-[#1e40af]"
    : "border-slate-200 bg-white text-slate-700 hover:border-[#2563eb]/35 hover:bg-slate-50";
  return `<button type="button" data-rh-perm-access-filter="${value}" class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${cls}">${escapeHtml(label)}</button>`;
}

function renderToolbar(state: PageState, visibleTotal: number): string {
  const pageSizeOpts = PAGE_SIZE_OPTIONS.map(
    (n) => `<option value="${n}" ${n === state.pageSize ? "selected" : ""}>${n}</option>`,
  ).join("");

  return `
    <section class="${RH_LISTADO_SURFACE} space-y-4 p-4 sm:p-5" aria-label="Filtros y búsqueda">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Administración de permisos</h2>
          <p class="mt-1 text-sm text-[#64748b]">
            <span class="font-semibold text-[#0f172a]">${visibleTotal}</span> usuario${visibleTotal === 1 ? "" : "s"} visible${visibleTotal === 1 ? "" : "s"}
          </p>
        </div>
        <div class="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <label class="block min-w-[10rem]">
            <span class="${RH_LISTADO_LABEL}">Ordenar por</span>
            <div class="grid grid-cols-1">
              <select id="rh-perm-sort-field" class="${FILTER_SELECT} ${FIELD_FOCUS}">
                <option value="nombre" ${state.sortField === "nombre" ? "selected" : ""}>Nombre</option>
                <option value="permisos" ${state.sortField === "permisos" ? "selected" : ""}>Cantidad de permisos</option>
                <option value="updated_at" ${state.sortField === "updated_at" ? "selected" : ""}>Fecha de actualización</option>
              </select>
            </div>
          </label>
          <label class="block min-w-[8rem]">
            <span class="${RH_LISTADO_LABEL}">Dirección</span>
            <div class="grid grid-cols-1">
              <select id="rh-perm-sort-dir" class="${FILTER_SELECT} ${FIELD_FOCUS}">
                <option value="asc" ${state.sortDir === "asc" ? "selected" : ""}>Ascendente</option>
                <option value="desc" ${state.sortDir === "desc" ? "selected" : ""}>Descendente</option>
              </select>
            </div>
          </label>
        </div>
      </div>
      <div class="relative">
        <span class="${RH_LISTADO_LABEL}">Buscar</span>
        <div class="relative mt-1">
          ${iconSearchInput()}
          <input
            id="rh-perm-filter-input"
            type="search"
            class="${FILTER_INPUT} ${FIELD_FOCUS}"
            placeholder="Nombre, no. empleado o correo"
            value="${escapeHtml(state.filterQuery)}"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros rápidos de acceso">
        ${renderFilterChip("all", "Todos", state.accessFilter)}
        ${renderFilterChip("full", "Acceso completo", state.accessFilter)}
        ${renderFilterChip("partial", "Acceso parcial", state.accessFilter)}
        ${renderFilterChip("none", "Sin permisos", state.accessFilter)}
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <label for="rh-perm-page-size" class="text-xs font-medium text-[#64748b]">Registros por página</label>
        <select id="rh-perm-page-size" class="min-h-[38px] rounded-[10px] border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-sm font-medium text-slate-800 shadow-sm ${FIELD_FOCUS}">
          ${pageSizeOpts}
        </select>
      </div>
    </section>`;
}

function renderTableRow(
  user: RhUsuarioPermisosItem,
  draft: Record<string, boolean>,
  catalogGroups: Map<string, RhModuloCatalogItem[]>,
  saving: boolean,
): string {
  const level = getAccessLevel(user, draft);
  const disabledEdit = !user.editable || saving;

  return `
    <tr class="rh-sol-tbody-row hover:bg-[#f8fafc]/80" data-empleado-id="${user.empleado_id}">
      <td class="${TABLE_TD}">
        <div class="min-w-[9rem] max-w-[14rem]">
          <p class="truncate font-semibold text-[#0f172a]">${escapeHtml(formatNombreTablaRh(user.nombre))}</p>
          ${renderNombreSublinea(user)}
          ${
            !user.activo
              ? `<span class="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Inactivo</span>`
              : ""
          }
        </div>
      </td>
      <td class="${TABLE_TD} tabular-nums whitespace-nowrap text-[#334155]">${escapeHtml(formatNoEmpleadoRh(user.no_empleado))}</td>
      <td class="${TABLE_TD} whitespace-nowrap">${renderAccessBadge(level)}</td>
      <td class="${TABLE_TD} min-w-[18rem]">
        <div class="flex flex-nowrap gap-1 overflow-x-auto pb-0.5">${renderModuleBadges(user, draft, catalogGroups)}</div>
      </td>
      <td class="${TABLE_TD} text-right whitespace-nowrap">
        <button
          type="button"
          class="rh-permiso-editar ${BTN_GHOST} min-h-9 px-3 py-1.5 text-xs"
          data-empleado-id="${user.empleado_id}"
          ${disabledEdit ? "disabled" : ""}
        >
          Editar permisos
        </button>
        ${
          !user.editable
            ? `<p class="mt-1 text-[11px] text-amber-700">No editable</p>`
            : ""
        }
      </td>
    </tr>`;
}

function renderPaginationFooter(pg: ReturnType<typeof paginate<RhUsuarioPermisosItem>>): string {
  if (pg.total === 0) return "";
  const totalPages = Math.max(1, Math.ceil(pg.total / pg.pageSize));
  const from = (pg.page - 1) * pg.pageSize + 1;
  const to = Math.min(pg.page * pg.pageSize, pg.total);
  const pageButtons = paginationRange(totalPages, pg.page)
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40";
      return `<button type="button" data-rh-perm-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span>
      </p>
      <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
        <button type="button" data-rh-perm-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
          class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FIELD_FOCUS}">
          <span class="sr-only">Anterior</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
        </button>
        ${pageButtons}
        <button type="button" data-rh-perm-page="${pg.page + 1}" ${pg.page >= totalPages ? "disabled" : ""}
          class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FIELD_FOCUS}">
          <span class="sr-only">Siguiente</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
        </button>
      </div>
    </div>`;
}

function renderTable(state: PageState, filtered: RhUsuarioPermisosItem[]): string {
  const catalogGroups = groupCatalog(state.catalog);
  const pg = paginate(filtered, state.page, state.pageSize);

  if (state.usuarios.length === 0) {
    return `<p class="text-sm text-text-muted">No hay usuarios con rol RH registrados en el sistema.</p>`;
  }
  if (filtered.length === 0) {
    return `<p class="text-sm text-text-muted">Ningún usuario RH coincide con los filtros aplicados.</p>`;
  }

  const rows = pg.items
    .map((user) =>
      renderTableRow(
        user,
        getDraft(state, user),
        catalogGroups,
        state.savingId === user.empleado_id,
      ),
    )
    .join("");

  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Listado de permisos RH">
      <div class="max-h-[min(68vh,720px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[780px] w-full table-fixed text-left">
          <colgroup>
            <col class="w-[17%]" />
            <col class="w-[10%]" />
            <col class="w-[15%]" />
            <col class="w-[44%]" />
            <col class="w-[14%]" />
          </colgroup>
          <thead class="rh-sol-thead">
            <tr>
              <th scope="col" class="${TABLE_TH}">Nombre</th>
              <th scope="col" class="${TABLE_TH}">No. empleado</th>
              <th scope="col" class="${TABLE_TH}">Estado de acceso</th>
              <th scope="col" class="${TABLE_TH}">Módulos</th>
              <th scope="col" class="${TABLE_TH} text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      ${renderPaginationFooter(pg)}
    </section>`;
}

function renderDrawerGroupCard(
  group: string,
  items: RhModuloCatalogItem[],
  draft: Record<string, boolean>,
  expanded: boolean,
  disabled: boolean,
): string {
  const groupActive = items.filter((m) => draft[m.key] === true).length;
  const checks = items
    .map((mod) => {
      const checked = draft[mod.key] === true;
      return `
        <label class="inline-flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            class="rh-permiso-modulo size-4 rounded border-border text-accent focus:ring-accent/30"
            data-modulo-key="${escapeHtml(mod.key)}"
            ${checked ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span>${escapeHtml(mod.label)}</span>
        </label>`;
    })
    .join("");

  return `
    <details class="group/rh-drawer-grp rounded-lg border border-border/80 bg-surface/40" ${expanded ? "open" : ""} data-drawer-group="${escapeHtml(group)}">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span class="flex min-w-0 items-center gap-2">
          <span class="text-text-muted transition-transform duration-200 group-open/rh-drawer-grp:rotate-180">${CHEVRON_SVG}</span>
          <span class="truncate text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(group)}</span>
          <span class="rounded-full border px-2 py-0.5 text-[11px] font-semibold ${groupBadgeClass(groupActive, items.length, false)}">${groupActive}/${items.length}</span>
        </span>
        ${
          disabled
            ? ""
            : `<button type="button" class="rh-permiso-grupo-todo shrink-0 text-xs font-semibold text-accent hover:underline" data-group="${escapeHtml(group)}">Todo</button>`
        }
      </summary>
      <div class="grid gap-2 border-t border-border/60 px-3 pb-3 pt-2 sm:grid-cols-2">${checks}</div>
    </details>`;
}

function renderDrawer(state: PageState): string {
  if (state.editingEmpleadoId === null) return "";
  const user = state.usuarios.find((u) => u.empleado_id === state.editingEmpleadoId);
  if (!user) return "";

  const draft = getDraft(state, user);
  const catalogGroups = groupCatalog(state.catalog);
  const saving = state.savingId === user.empleado_id;
  const disabled = !user.editable || saving;
  const level = getAccessLevel(user, draft);

  const groupsHtml = [...catalogGroups.entries()]
    .map(([group, items]) =>
      renderDrawerGroupCard(group, items, draft, state.drawerExpandedGroups.has(group), disabled),
    )
    .join("");

  return `
    <div id="rh-perm-drawer-root" class="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" id="rh-perm-drawer-backdrop" class="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" aria-label="Cerrar panel"></button>
      <aside
        id="rh-perm-drawer-panel"
        class="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.16)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-perm-drawer-title"
      >
        <header class="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="rh-perm-drawer-title" class="text-lg font-semibold leading-snug text-[#0f172a]">${escapeHtml(formatNombreCompletoRh(user.nombre))}</h2>
              <p class="mt-1 text-sm tabular-nums text-[#64748b]">No. ${escapeHtml(formatNoEmpleadoRh(user.no_empleado))}</p>
              ${user.email ? `<p class="mt-0.5 truncate text-sm text-[#64748b]" title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</p>` : ""}
              <div class="mt-2">${renderAccessBadge(level)}</div>
            </div>
            <button type="button" id="rh-perm-drawer-close" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar">Cerrar</button>
          </div>
          ${
            user.editable
              ? `<div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button type="button" id="rh-perm-drawer-expand-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Expandir módulos</button>
                  <button type="button" id="rh-perm-drawer-select-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Seleccionar todo</button>
                  <button type="button" id="rh-perm-drawer-deselect-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Deseleccionar todo</button>
                  <button type="button" id="rh-perm-drawer-save" class="${BTN_PRIMARY} ml-auto text-xs" ${disabled ? "disabled" : ""}>
                    ${saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>`
              : `<p class="mt-3 text-sm text-amber-700">No puedes modificar tus propios permisos.</p>`
          }
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" data-empleado-id="${user.empleado_id}">
          <div class="grid gap-3">${groupsHtml}</div>
        </div>
      </aside>
    </div>`;
}

function renderPage(state: PageState): string {
  if (state.loading) {
    return `<p class="text-sm text-text-muted">Cargando permisos…</p>`;
  }
  if (state.error && state.usuarios.length === 0) {
    return `<p class="text-sm text-red-600" role="alert">${escapeHtml(state.error)}</p>`;
  }

  const filtered = filterAndSortUsuarios(state);

  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="${RH_LISTADO_SURFACE} p-4 sm:p-6">
        <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Permisos RH</h1>
        <p class="mt-2 max-w-3xl text-sm leading-relaxed text-[#64748b]">
          Vista administrativa compacta de usuarios con rol RH. Los permisos aplican en <strong class="font-medium text-[#334155]">Modo RH</strong>;
          solicitudes y comedor personales siguen disponibles con el toggle <strong class="font-medium text-[#334155]">Modo empleado</strong>.
        </p>
      </header>
      ${
        state.error
          ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">${escapeHtml(state.error)}</p>`
          : ""
      }
      ${
        state.success
          ? `<p class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">${escapeHtml(state.success)}</p>`
          : ""
      }
      ${renderStatsHeader(state)}
      ${renderToolbar(state, filtered.length)}
      ${renderTable(state, filtered)}
      ${renderDrawer(state)}
    </div>`;
}

export function mountAjustesPermisosRh(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessRhPermisosAdmin()) {
    mountAppShell(container, {
      mainHtml: htmlAccessDenied({
        title: "Acceso restringido",
        description: "Solo los administradores de permisos RH pueden acceder a esta sección.",
        linkHref: "#/",
        linkLabel: "Volver al inicio",
      }),
    });
    return;
  }

  const state: PageState = {
    loading: true,
    savingId: null,
    error: null,
    success: null,
    catalog: [],
    usuarios: [],
    draftByEmpleadoId: new Map(),
    lastUpdatedAtByEmpleadoId: new Map(),
    filterQuery: "",
    accessFilter: "all",
    sortField: "nombre",
    sortDir: "asc",
    page: 1,
    pageSize: 25,
    editingEmpleadoId: null,
    drawerExpandedGroups: new Set<string>(),
  };

  const paint = (opts?: { preserveFilterFocus?: boolean }): void => {
    mountAppShell(container, {
      mainHtml: renderPage(state),
      onSignOut: () => {
        clearAuth();
        import("../shellRouter.ts").then((m) => m.abortAuthenticatedShell());
        import("./login.ts").then((m) => m.mountLogin(container));
      },
    });
    bindEvents();
    if (opts?.preserveFilterFocus) {
      const next = container.querySelector<HTMLInputElement>("#rh-perm-filter-input");
      next?.focus();
    }
  };

  const readDraftFromDrawer = (): Record<string, boolean> | null => {
    if (state.editingEmpleadoId === null) return null;
    const body = container.querySelector("#rh-perm-drawer-panel [data-empleado-id]");
    if (!body) return state.draftByEmpleadoId.get(state.editingEmpleadoId) ?? null;
    const empleadoId = Number.parseInt(body.getAttribute("data-empleado-id") ?? "", 10);
    if (!Number.isFinite(empleadoId)) return null;
    const draft = { ...(state.draftByEmpleadoId.get(empleadoId) ?? {}) };
    body.querySelectorAll<HTMLInputElement>(".rh-permiso-modulo").forEach((input) => {
      const key = input.dataset.moduloKey;
      if (key) draft[key] = input.checked;
    });
    return draft;
  };

  const syncDraftFromDrawer = (): void => {
    const draft = readDraftFromDrawer();
    if (draft && state.editingEmpleadoId !== null) {
      state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
    }
  };

  const closeDrawer = (): void => {
    state.editingEmpleadoId = null;
    state.drawerExpandedGroups.clear();
    paint();
  };

  const openDrawer = (empleadoId: number): void => {
    state.editingEmpleadoId = empleadoId;
    state.drawerExpandedGroups.clear();
    paint();
  };

  const bindEvents = (): void => {
    const filterInput = container.querySelector<HTMLInputElement>("#rh-perm-filter-input");
    filterInput?.addEventListener(
      "input",
      () => {
        const start = filterInput.selectionStart;
        const end = filterInput.selectionEnd;
        state.filterQuery = filterInput.value;
        state.page = 1;
        paint({ preserveFilterFocus: true });
        const next = container.querySelector<HTMLInputElement>("#rh-perm-filter-input");
        if (next) {
          next.focus();
          if (start !== null && end !== null) next.setSelectionRange(start, end);
        }
      },
      { signal },
    );

    container.querySelector<HTMLSelectElement>("#rh-perm-sort-field")?.addEventListener(
      "change",
      (ev) => {
        state.sortField = (ev.target as HTMLSelectElement).value as SortField;
        state.page = 1;
        paint({ preserveFilterFocus: true });
      },
      { signal },
    );

    container.querySelector<HTMLSelectElement>("#rh-perm-sort-dir")?.addEventListener(
      "change",
      (ev) => {
        state.sortDir = (ev.target as HTMLSelectElement).value as SortDir;
        state.page = 1;
        paint({ preserveFilterFocus: true });
      },
      { signal },
    );

    container.querySelector<HTMLSelectElement>("#rh-perm-page-size")?.addEventListener(
      "change",
      (ev) => {
        state.pageSize = Number.parseInt((ev.target as HTMLSelectElement).value, 10) || 25;
        state.page = 1;
        paint();
      },
      { signal },
    );

    container.querySelectorAll<HTMLButtonElement>("[data-rh-perm-access-filter]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          state.accessFilter = (btn.dataset.rhPermAccessFilter ?? "all") as AccessFilter;
          state.page = 1;
          paint();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLButtonElement>("[data-rh-perm-page]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const nextPage = Number.parseInt(btn.dataset.rhPermPage ?? "", 10);
          if (!Number.isFinite(nextPage)) return;
          state.page = nextPage;
          paint();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-editar").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          openDrawer(empleadoId);
        },
        { signal },
      );
    });

    container.querySelector("#rh-perm-drawer-close")?.addEventListener("click", closeDrawer, { signal });
    container.querySelector("#rh-perm-drawer-backdrop")?.addEventListener("click", closeDrawer, { signal });

    container.querySelector("#rh-perm-drawer-expand-all")?.addEventListener(
      "click",
      () => {
        syncDraftFromDrawer();
        for (const item of state.catalog) {
          state.drawerExpandedGroups.add(item.group);
        }
        paint();
      },
      { signal },
    );

    container.querySelector("#rh-perm-drawer-select-all")?.addEventListener(
      "click",
      () => {
        if (state.editingEmpleadoId === null) return;
        const draft = readDraftFromDrawer() ?? {};
        for (const mod of state.catalog) {
          draft[mod.key] = true;
        }
        state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
        paint();
      },
      { signal },
    );

    container.querySelector("#rh-perm-drawer-deselect-all")?.addEventListener(
      "click",
      () => {
        if (state.editingEmpleadoId === null) return;
        const draft = readDraftFromDrawer() ?? {};
        for (const mod of state.catalog) {
          draft[mod.key] = false;
        }
        state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
        paint();
      },
      { signal },
    );

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-grupo-todo").forEach((btn) => {
      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (state.editingEmpleadoId === null) return;
          const group = btn.dataset.group;
          if (!group) return;
          const draft = readDraftFromDrawer() ?? {};
          for (const mod of state.catalog.filter((m) => m.group === group)) {
            draft[mod.key] = true;
          }
          state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
          state.drawerExpandedGroups.add(group);
          paint();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLInputElement>(".rh-permiso-modulo").forEach((input) => {
      input.addEventListener(
        "change",
        () => {
          syncDraftFromDrawer();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLDetailsElement>("[data-drawer-group]").forEach((details) => {
      details.addEventListener(
        "toggle",
        () => {
          const group = details.dataset.drawerGroup;
          if (!group) return;
          if (details.open) state.drawerExpandedGroups.add(group);
          else state.drawerExpandedGroups.delete(group);
        },
        { signal },
      );
    });

    container.querySelector("#rh-perm-drawer-save")?.addEventListener(
      "click",
      async () => {
        if (state.editingEmpleadoId === null) return;
        const empleadoId = state.editingEmpleadoId;
        syncDraftFromDrawer();
        const modulos = state.draftByEmpleadoId.get(empleadoId) ?? {};
        state.savingId = empleadoId;
        state.error = null;
        state.success = null;
        paint();
        try {
          const updated = await updateRhUsuarioPermisos(empleadoId, modulos);
          state.usuarios = state.usuarios.map((u) => (u.empleado_id === empleadoId ? updated : u));
          state.draftByEmpleadoId.set(empleadoId, { ...updated.modulos });
          state.lastUpdatedAtByEmpleadoId.set(empleadoId, Date.now());
          state.success = `Permisos actualizados para ${formatNombreTablaRh(updated.nombre)}. El usuario debe volver a iniciar sesión para aplicar cambios en API.`;
        } catch (err) {
          state.error = err instanceof Error ? err.message : "No se pudieron guardar los permisos.";
        } finally {
          state.savingId = null;
          paint();
        }
      },
      { signal },
    );

    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Escape" && state.editingEmpleadoId !== null) {
          ev.preventDefault();
          closeDrawer();
        }
      },
      { signal },
    );
  };

  void (async () => {
    try {
      const [catalog, usuarios] = await Promise.all([
        fetchRhModulosCatalogo(),
        fetchRhUsuariosPermisos(),
      ]);
      state.catalog = catalog;
      state.usuarios = usuarios;
      for (const user of usuarios) {
        state.draftByEmpleadoId.set(user.empleado_id, { ...user.modulos });
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Error al cargar permisos.";
    } finally {
      state.loading = false;
      paint();
    }
  })();
}

export function mountRhModuleAccessDenied(container: HTMLElement): void {
  mountAppShell(container, {
    mainHtml: htmlAccessDenied({
      title: "Acceso no autorizado",
      description: "No tienes permiso para acceder a este módulo. Contacta al administrador de RH si necesitas acceso.",
      linkHref: "#/",
      linkLabel: "Volver al inicio",
    }),
  });
}

export function mountRhSinPermisosDisponibles(container: HTMLElement): void {
  mountAppShell(container, {
    mainHtml: htmlAccessDenied({
      title: "Sin permisos disponibles",
      description:
        "Tu cuenta RH no tiene módulos asignados. Contacta al administrador de permisos para solicitar acceso.",
      linkHref: "#/",
      linkLabel: "Volver al inicio",
    }),
  });
}
