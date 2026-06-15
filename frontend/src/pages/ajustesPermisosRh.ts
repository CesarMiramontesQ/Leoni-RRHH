import {
  agregarEmpleadoPermisos,
  buscarEmpleadosParaPermisos,
  deleteRhUsuarioPermisos,
  fetchRhModulosCatalogo,
  fetchRhUsuariosPermisos,
  updateRhUsuarioPermisos,
  type RhEmpleadoBusquedaItem,
  type RhModuloCatalogItem,
  type RhUsuarioPermisosItem,
} from "../api/rhPermisos.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  badgeRejected,
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
  modalExpandedGroups: Set<string>;
  addModalOpen: boolean;
  addQuery: string;
  addLoading: boolean;
  addError: string | null;
  addResults: RhEmpleadoBusquedaItem[];
  addingId: number | null;
  confirmDeleteId: number | null;
  deletingId: number | null;
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

const ROL_LABELS: Record<string, string> = {
  empleado: "Empleado",
  supervisor: "Supervisor",
  rh: "RH",
  director: "Director",
  gerente: "Gerente",
};

function formatRol(rol: string): string {
  return ROL_LABELS[rol] ?? rol.charAt(0).toUpperCase() + rol.slice(1);
}

/** Tabla: primer nombre + primer apellido (título). */
function formatNombreTablaRh(nombre: string): string {
  return formatNombreEmpleadoUi(nombre, { titulo: true, omitirSegundoApellido: true }) || nombre.trim();
}

/** Modal: nombre completo reordenado y capitalizado. */
function formatNombreCompletoRh(nombre: string): string {
  return formatNombreEmpleadoUi(nombre, { titulo: true, omitirSegundoApellido: false }) || nombre.trim();
}

function formatNoEmpleadoRh(noEmpleado: string): string {
  return formatNoEmpleadoDisplay(noEmpleado) || noEmpleado.trim();
}

function renderNombreSublinea(user: RhUsuarioPermisosItem): string {
  const parts = [formatRol(user.rol_nombre)];
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
      ${renderStatCard("Total usuarios", stats.total, "default")}
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
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button type="button" id="rh-perm-add-open" class="${BTN_PRIMARY} h-[42px] shrink-0 self-stretch text-xs sm:self-end">
            + Agregar empleado
          </button>
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
        <div class="flex items-center justify-end gap-2">
          ${
            user.editable
              ? `<button
                  type="button"
                  class="rh-permiso-editar ${BTN_GHOST} min-h-9 px-3 py-1.5 text-xs"
                  data-empleado-id="${user.empleado_id}"
                  ${saving ? "disabled" : ""}
                >
                  Editar permisos
                </button>`
              : badgeRejected("No editable")
          }
          ${
            user.editable && !user.puede_administrar_permisos_rh
              ? `<button
                  type="button"
                  class="rh-permiso-eliminar ${BTN_DANGER} min-h-9 px-3 py-1.5 text-xs"
                  data-empleado-id="${user.empleado_id}"
                  ${saving ? "disabled" : ""}
                  title="Quitar de la administración de permisos"
                >
                  Eliminar
                </button>`
              : ""
          }
        </div>
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
    return `<p class="text-sm text-text-muted">No hay usuarios en la administración de permisos. Usa “Agregar empleado” para registrar uno.</p>`;
  }
  if (filtered.length === 0) {
    return `<p class="text-sm text-text-muted">Ningún usuario coincide con los filtros aplicados.</p>`;
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

function renderModalGroupCard(
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
    <details class="group/rh-modal-grp rounded-lg border border-border/80 bg-surface/40" ${expanded ? "open" : ""} data-modal-group="${escapeHtml(group)}">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span class="flex min-w-0 items-center gap-2">
          <span class="text-text-muted transition-transform duration-200 group-open/rh-modal-grp:rotate-180">${CHEVRON_SVG}</span>
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

function renderEditModal(state: PageState): string {
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
      renderModalGroupCard(group, items, draft, state.modalExpandedGroups.has(group), disabled),
    )
    .join("");

  const footerActions = user.editable
    ? `<div class="flex flex-wrap items-center gap-2">
        <button type="button" id="rh-perm-modal-select-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Seleccionar todo</button>
        <button type="button" id="rh-perm-modal-deselect-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Deseleccionar todo</button>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button type="button" id="rh-perm-modal-cancel" class="${BTN_SECONDARY} text-xs">Cancelar</button>
        <button type="button" id="rh-perm-modal-save" class="${BTN_PRIMARY} text-xs" ${disabled ? "disabled" : ""}>
          ${saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>`
    : `<p class="text-sm text-amber-700">No puedes modificar tus propios permisos.</p>
      <button type="button" id="rh-perm-modal-cancel" class="${BTN_SECONDARY} ml-auto text-xs">Cancelar</button>`;

  return `
    <div id="rh-perm-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        id="rh-perm-modal-panel"
        data-rh-perm-modal-inner
        class="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-perm-modal-title"
      >
        <header class="shrink-0 border-b border-slate-100 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <h2 id="rh-perm-modal-title" class="text-lg font-semibold text-text-primary">Editar permisos</h2>
              <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt class="text-xs font-medium text-text-muted">Nombre</dt>
                  <dd class="mt-0.5 font-medium text-text-primary">${escapeHtml(formatNombreCompletoRh(user.nombre))}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-text-muted">No. empleado</dt>
                  <dd class="mt-0.5 tabular-nums text-text-primary">${escapeHtml(formatNoEmpleadoRh(user.no_empleado))}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-text-muted">Correo</dt>
                  <dd class="mt-0.5 truncate text-text-primary" title="${escapeHtml(user.email ?? "")}">${escapeHtml(user.email ?? "—")}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-text-muted">Rol</dt>
                  <dd class="mt-0.5 text-text-primary">${escapeHtml(formatRol(user.rol_nombre))}</dd>
                </div>
              </dl>
              <div class="mt-3">${renderAccessBadge(level)}</div>
            </div>
            <button type="button" id="rh-perm-modal-close" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar">
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4" data-empleado-id="${user.empleado_id}">
          ${
            user.editable
              ? `<div class="mb-3 flex justify-end">
                  <button type="button" id="rh-perm-modal-expand-all" class="${BTN_GHOST} text-xs" ${disabled ? "disabled" : ""}>Expandir módulos</button>
                </div>`
              : ""
          }
          <div class="grid gap-3">${groupsHtml}</div>
        </div>
        <footer class="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          ${footerActions}
        </footer>
      </div>
    </div>`;
}

function renderAddResultRow(emp: RhEmpleadoBusquedaItem, alreadyAdded: boolean, adding: boolean): string {
  return `
    <li class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-[#0f172a]">${escapeHtml(formatNombreCompletoRh(emp.nombre))}</p>
        <p class="mt-0.5 truncate text-xs text-[#64748b]">
          <span class="tabular-nums">${escapeHtml(formatNoEmpleadoRh(emp.no_empleado))}</span>
          · ${escapeHtml(formatRol(emp.rol_nombre))}${emp.email ? ` · ${escapeHtml(emp.email)}` : ""}
        </p>
      </div>
      ${
        alreadyAdded
          ? `<span class="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Ya agregado</span>`
          : `<button
              type="button"
              class="rh-perm-add-confirm ${BTN_SECONDARY} shrink-0 px-3 py-1.5 text-xs"
              data-empleado-id="${emp.empleado_id}"
              ${adding ? "disabled" : ""}
            >${adding ? "Agregando…" : "Agregar"}</button>`
      }
    </li>`;
}

function renderAddModalResults(state: PageState): string {
  if (state.addLoading) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Buscando…</p>`;
  }
  if (state.addError) {
    return `<p class="px-1 py-6 text-center text-sm text-red-600" role="alert">${escapeHtml(state.addError)}</p>`;
  }
  if (state.addQuery.trim().length < 2) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Escribe al menos 2 caracteres para buscar.</p>`;
  }
  if (state.addResults.length === 0) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Sin coincidencias para “${escapeHtml(state.addQuery.trim())}”.</p>`;
  }
  const existing = new Set(state.usuarios.map((u) => u.empleado_id));
  const rows = state.addResults
    .map((emp) => renderAddResultRow(emp, existing.has(emp.empleado_id), state.addingId === emp.empleado_id))
    .join("");
  return `<ul class="space-y-2">${rows}</ul>`;
}

function renderAddModal(state: PageState): string {
  if (!state.addModalOpen) return "";
  return `
    <div id="rh-perm-add-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        id="rh-perm-add-panel"
        class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-perm-add-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="rh-perm-add-title" class="text-lg font-semibold text-text-primary">Agregar empleado a permisos</h2>
            <p class="mt-1 text-sm text-[#64748b]">Busca cualquier empleado activo por nombre, no. empleado o correo.</p>
          </div>
          <button type="button" id="rh-perm-add-close" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </header>
        <div class="shrink-0 px-6 pt-4">
          <div class="relative">
            ${iconSearchInput()}
            <input
              id="rh-perm-add-input"
              type="search"
              class="${FILTER_INPUT} ${FIELD_FOCUS}"
              placeholder="Nombre, no. empleado o correo"
              value="${escapeHtml(state.addQuery)}"
              autocomplete="off"
            />
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          ${renderAddModalResults(state)}
        </div>
        <footer class="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" id="rh-perm-add-done" class="${BTN_SECONDARY} text-xs">Cerrar</button>
        </footer>
      </div>
    </div>`;
}

function renderConfirmDeleteModal(state: PageState): string {
  if (state.confirmDeleteId === null) return "";
  const user = state.usuarios.find((u) => u.empleado_id === state.confirmDeleteId);
  if (!user) return "";
  const deleting = state.deletingId === user.empleado_id;
  const esRh = user.rol_nombre === "rh";
  return `
    <div id="rh-perm-del-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        id="rh-perm-del-panel"
        class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-perm-del-title"
      >
        <header class="border-b border-slate-100 px-6 py-4">
          <h2 id="rh-perm-del-title" class="text-lg font-semibold text-text-primary">Eliminar de la administración de permisos</h2>
        </header>
        <div class="space-y-3 px-6 py-5">
          <p class="text-sm leading-relaxed text-[#475569]">
            Se quitará a <strong class="font-semibold text-[#0f172a]">${escapeHtml(formatNombreCompletoRh(user.nombre))}</strong>
            de la administración de permisos y se eliminarán todos los accesos otorgados desde este módulo.
          </p>
          <p class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#475569]">
            No se elimina su cuenta ni se modifica su rol${user.rol_nombre ? ` (${escapeHtml(formatRol(user.rol_nombre))})` : ""}.
            ${esRh ? "Conservará su rol RH pero pasará a la vista de empleado hasta que se le vuelva a otorgar acceso." : "Solo se retiran los permisos de este módulo."}
          </p>
        </div>
        <footer class="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" id="rh-perm-del-cancel" class="${BTN_SECONDARY} min-h-10 justify-center text-xs">Cancelar</button>
          <button type="button" id="rh-perm-del-confirm" class="${BTN_DANGER} min-h-10 justify-center text-xs disabled:cursor-not-allowed disabled:opacity-70" ${deleting ? "disabled" : ""}>
            ${deleting ? "Eliminando…" : "Eliminar permisos"}
          </button>
        </footer>
      </div>
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
          Administra los accesos por módulo de usuarios RH y de cualquier empleado que agregues.
          En usuarios RH los permisos aplican en <strong class="font-medium text-[#334155]">Modo RH</strong>;
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
      ${renderEditModal(state)}
      ${renderAddModal(state)}
      ${renderConfirmDeleteModal(state)}
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
    modalExpandedGroups: new Set<string>(),
    addModalOpen: false,
    addQuery: "",
    addLoading: false,
    addError: null,
    addResults: [],
    addingId: null,
    confirmDeleteId: null,
    deletingId: null,
  };

  const setBodyScrollLocked = (locked: boolean): void => {
    document.body.style.overflow = locked ? "hidden" : "";
  };

  signal?.addEventListener("abort", () => setBodyScrollLocked(false));

  const anyModalOpen = (): boolean =>
    state.editingEmpleadoId !== null || state.addModalOpen || state.confirmDeleteId !== null;

  const paint = (opts?: { preserveFilterFocus?: boolean; focusAddInput?: boolean }): void => {
    mountAppShell(container, {
      mainHtml: renderPage(state),
      onSignOut: () => {
        setBodyScrollLocked(false);
        clearAuth();
        import("../shellRouter.ts").then((m) => m.abortAuthenticatedShell());
        import("./login.ts").then((m) => m.mountLogin(container));
      },
    });
    setBodyScrollLocked(anyModalOpen());
    bindEvents();
    if (opts?.preserveFilterFocus) {
      const next = container.querySelector<HTMLInputElement>("#rh-perm-filter-input");
      next?.focus();
    }
    if (opts?.focusAddInput) {
      const input = container.querySelector<HTMLInputElement>("#rh-perm-add-input");
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
  };

  const readDraftFromModal = (): Record<string, boolean> | null => {
    if (state.editingEmpleadoId === null) return null;
    const body = container.querySelector("#rh-perm-modal-panel [data-empleado-id]");
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

  const syncDraftFromModal = (): void => {
    const draft = readDraftFromModal();
    if (draft && state.editingEmpleadoId !== null) {
      state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
    }
  };

  const closeModal = (): void => {
    state.editingEmpleadoId = null;
    state.modalExpandedGroups.clear();
    paint();
  };

  const openModal = (empleadoId: number): void => {
    state.editingEmpleadoId = empleadoId;
    state.modalExpandedGroups.clear();
    paint();
  };

  let addSearchTimer: ReturnType<typeof setTimeout> | undefined;
  let addSearchSeq = 0;

  const runAddSearch = async (): Promise<void> => {
    const q = state.addQuery.trim();
    if (q.length < 2) {
      state.addLoading = false;
      state.addError = null;
      state.addResults = [];
      paint({ focusAddInput: true });
      return;
    }
    const seq = ++addSearchSeq;
    state.addLoading = true;
    state.addError = null;
    paint({ focusAddInput: true });
    try {
      const results = await buscarEmpleadosParaPermisos(q);
      if (seq !== addSearchSeq) return; // resultado obsoleto
      state.addResults = results;
    } catch (err) {
      if (seq !== addSearchSeq) return;
      state.addError = err instanceof Error ? err.message : "No se pudo realizar la búsqueda.";
      state.addResults = [];
    } finally {
      if (seq === addSearchSeq) {
        state.addLoading = false;
        paint({ focusAddInput: true });
      }
    }
  };

  const openAddModal = (): void => {
    state.addModalOpen = true;
    state.addQuery = "";
    state.addResults = [];
    state.addError = null;
    state.addLoading = false;
    state.error = null;
    state.success = null;
    paint({ focusAddInput: true });
  };

  const closeAddModal = (): void => {
    if (addSearchTimer) clearTimeout(addSearchTimer);
    addSearchSeq += 1; // invalida búsquedas en vuelo
    state.addModalOpen = false;
    state.addingId = null;
    paint();
  };

  const addEmpleado = async (empleadoId: number): Promise<void> => {
    if (state.usuarios.some((u) => u.empleado_id === empleadoId)) return;
    state.addingId = empleadoId;
    state.addError = null;
    paint({ focusAddInput: true });
    try {
      const nuevo = await agregarEmpleadoPermisos(empleadoId);
      state.usuarios = [...state.usuarios, nuevo];
      state.draftByEmpleadoId.set(nuevo.empleado_id, { ...nuevo.modulos });
      state.lastUpdatedAtByEmpleadoId.set(nuevo.empleado_id, Date.now());
      state.success = `${formatNombreTablaRh(nuevo.nombre)} se agregó a la administración de permisos.`;
    } catch (err) {
      state.addError = err instanceof Error ? err.message : "No se pudo agregar el empleado.";
    } finally {
      state.addingId = null;
      paint({ focusAddInput: true });
    }
  };

  const askDelete = (empleadoId: number): void => {
    state.confirmDeleteId = empleadoId;
    state.error = null;
    state.success = null;
    paint();
  };

  const cancelDelete = (): void => {
    state.confirmDeleteId = null;
    paint();
  };

  const confirmDelete = async (): Promise<void> => {
    const empleadoId = state.confirmDeleteId;
    if (empleadoId === null) return;
    state.deletingId = empleadoId;
    state.error = null;
    paint();
    try {
      await deleteRhUsuarioPermisos(empleadoId);
      const removed = state.usuarios.find((u) => u.empleado_id === empleadoId);
      state.usuarios = state.usuarios.filter((u) => u.empleado_id !== empleadoId);
      state.draftByEmpleadoId.delete(empleadoId);
      state.lastUpdatedAtByEmpleadoId.delete(empleadoId);
      state.confirmDeleteId = null;
      state.success = removed
        ? `${formatNombreTablaRh(removed.nombre)} se eliminó de la administración de permisos.`
        : "Usuario eliminado de la administración de permisos.";
    } catch (err) {
      state.error = err instanceof Error ? err.message : "No se pudo eliminar al usuario.";
    } finally {
      state.deletingId = null;
      paint();
    }
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
          openModal(empleadoId);
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-eliminar").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          askDelete(empleadoId);
        },
        { signal },
      );
    });

    // ── Modal: agregar empleado ──
    container.querySelector("#rh-perm-add-open")?.addEventListener("click", openAddModal, { signal });

    const addInput = container.querySelector<HTMLInputElement>("#rh-perm-add-input");
    addInput?.addEventListener(
      "input",
      () => {
        state.addQuery = addInput.value;
        if (addSearchTimer) clearTimeout(addSearchTimer);
        addSearchTimer = setTimeout(() => {
          void runAddSearch();
        }, 250);
      },
      { signal },
    );

    container.querySelectorAll<HTMLButtonElement>(".rh-perm-add-confirm").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          void addEmpleado(empleadoId);
        },
        { signal },
      );
    });

    container.querySelector("#rh-perm-add-close")?.addEventListener("click", closeAddModal, { signal });
    container.querySelector("#rh-perm-add-done")?.addEventListener("click", closeAddModal, { signal });
    const addBackdrop = container.querySelector("#rh-perm-add-backdrop");
    addBackdrop?.addEventListener(
      "click",
      (ev) => {
        if (ev.target === addBackdrop) closeAddModal();
      },
      { signal },
    );

    // ── Modal: confirmar eliminación ──
    container.querySelector("#rh-perm-del-cancel")?.addEventListener("click", cancelDelete, { signal });
    container.querySelector("#rh-perm-del-confirm")?.addEventListener(
      "click",
      () => {
        void confirmDelete();
      },
      { signal },
    );
    const delBackdrop = container.querySelector("#rh-perm-del-backdrop");
    delBackdrop?.addEventListener(
      "click",
      (ev) => {
        if (ev.target === delBackdrop) cancelDelete();
      },
      { signal },
    );

    const modalBackdrop = container.querySelector("#rh-perm-modal-backdrop");
    modalBackdrop?.addEventListener(
      "click",
      (ev) => {
        if (ev.target === modalBackdrop) closeModal();
      },
      { signal },
    );

    container.querySelector("#rh-perm-modal-close")?.addEventListener("click", closeModal, { signal });
    container.querySelector("#rh-perm-modal-cancel")?.addEventListener("click", closeModal, { signal });

    container.querySelector("#rh-perm-modal-expand-all")?.addEventListener(
      "click",
      () => {
        syncDraftFromModal();
        for (const item of state.catalog) {
          state.modalExpandedGroups.add(item.group);
        }
        paint();
      },
      { signal },
    );

    container.querySelector("#rh-perm-modal-select-all")?.addEventListener(
      "click",
      () => {
        if (state.editingEmpleadoId === null) return;
        const draft = readDraftFromModal() ?? {};
        for (const mod of state.catalog) {
          draft[mod.key] = true;
        }
        state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
        paint();
      },
      { signal },
    );

    container.querySelector("#rh-perm-modal-deselect-all")?.addEventListener(
      "click",
      () => {
        if (state.editingEmpleadoId === null) return;
        const draft = readDraftFromModal() ?? {};
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
          const draft = readDraftFromModal() ?? {};
          for (const mod of state.catalog.filter((m) => m.group === group)) {
            draft[mod.key] = true;
          }
          state.draftByEmpleadoId.set(state.editingEmpleadoId, draft);
          state.modalExpandedGroups.add(group);
          paint();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLInputElement>(".rh-permiso-modulo").forEach((input) => {
      input.addEventListener(
        "change",
        () => {
          syncDraftFromModal();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLDetailsElement>("[data-modal-group]").forEach((details) => {
      details.addEventListener(
        "toggle",
        () => {
          const group = details.dataset.modalGroup;
          if (!group) return;
          if (details.open) state.modalExpandedGroups.add(group);
          else state.modalExpandedGroups.delete(group);
        },
        { signal },
      );
    });

    container.querySelector("#rh-perm-modal-save")?.addEventListener(
      "click",
      async () => {
        if (state.editingEmpleadoId === null) return;
        const empleadoId = state.editingEmpleadoId;
        syncDraftFromModal();
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
        if (ev.key !== "Escape") return;
        if (state.confirmDeleteId !== null) {
          ev.preventDefault();
          cancelDelete();
        } else if (state.addModalOpen) {
          ev.preventDefault();
          closeAddModal();
        } else if (state.editingEmpleadoId !== null) {
          ev.preventDefault();
          closeModal();
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
