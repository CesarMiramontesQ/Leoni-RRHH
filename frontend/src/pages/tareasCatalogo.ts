import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getTareasCatalogo,
  createTareaCatalogo,
  type TareaCatalogo,
  type TareaCatalogoFetchError,
} from "../api/tareasCatalogo.ts";
import { fetchWithAuth } from "../api/http.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  BTN_DANGER,
  FIELD_FOCUS,
  FIELD_INPUT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  pageHeading,
  badgeOpen,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";

// ── Constantes ────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_CLIPBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>`;
const ICON_TAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const ICON_SPARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;

const CAT_CHIP_VARIANTS = [
  "tc-cat-chip--blue",
  "tc-cat-chip--teal",
  "tc-cat-chip--violet",
  "tc-cat-chip--amber",
  "tc-cat-chip--slate",
] as const;

// ── Tipos y helpers ───────────────────────────────────────────────────────

type TipoFilter = "" | "principal" | "complemento";

type CatalogoFilters = {
  text: string;
  categoria: string;
  tipo: TipoFilter;
};

type CatalogoStats = {
  total: number;
  categorias: number;
  activas: number;
  complementarias: number;
};

type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function computeCatalogoStats(items: TareaCatalogo[]): CatalogoStats {
  const cats = new Set<string>();
  let activas = 0;
  let complementarias = 0;
  for (const t of items) {
    if (t.categoria?.trim()) cats.add(t.categoria.trim().toLowerCase());
    if (t.activa) activas += 1;
    if (t.es_complemento) complementarias += 1;
  }
  return {
    total: items.length,
    categorias: cats.size,
    activas,
    complementarias,
  };
}

function distinctCategorias(items: TareaCatalogo[]): string[] {
  const seen = new Map<string, string>();
  for (const t of items) {
    const label = t.categoria?.trim();
    if (label) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
}

function hasActiveFilters(filters: CatalogoFilters): boolean {
  return !!(filters.text.trim() || filters.categoria || filters.tipo);
}

function filterItems(items: TareaCatalogo[], filters: CatalogoFilters): TareaCatalogo[] {
  const q = filters.text.trim().toLowerCase();
  const cat = filters.categoria.trim().toLowerCase();
  const tipo = filters.tipo;
  return items.filter((t) => {
    if (q && !(t.nombre.toLowerCase().includes(q) || (t.categoria?.toLowerCase().includes(q) ?? false))) {
      return false;
    }
    if (cat && (t.categoria?.trim().toLowerCase() ?? "") !== cat) return false;
    if (tipo === "principal" && t.es_complemento) return false;
    if (tipo === "complemento" && !t.es_complemento) return false;
    return true;
  });
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

function categoriaChipClass(cat: string): (typeof CAT_CHIP_VARIANTS)[number] {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h + cat.charCodeAt(i)) % CAT_CHIP_VARIANTS.length;
  return CAT_CHIP_VARIANTS[h]!;
}

function categoriaBadge(cat: string | undefined): string {
  if (!cat?.trim()) {
    return `<span class="text-xs text-text-muted">Sin categoría</span>`;
  }
  const label = cat.trim();
  const cls = categoriaChipClass(label);
  return `<span class="tc-cat-chip ${cls} inline-flex max-w-[12rem] items-center truncate rounded-md border px-2.5 py-0.5 text-xs font-semibold" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

function tipoBadge(esComplemento: boolean): string {
  if (esComplemento) {
    return `<span class="tc-tipo-badge tc-tipo-badge--complemento inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>Complementaria</span>`;
  }
  return badgeOpen("Principal");
}

function kpiSkeletonCard(): string {
  return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
    <div class="h-3 w-24 rounded bg-slate-200/90"></div>
    <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
    <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
  </article>`;
}

// ── Render ──────────────────────────────────────────────────────────────

function renderLoading(): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER} tc-page" aria-busy="true" aria-label="Cargando catálogo de tareas">
    ${renderLevelUpBackBar()}
    <div class="h-6 w-56 animate-pulse rounded-md bg-slate-200/90"></div>
    <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
    <div class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
    <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
  </div>`;
}

function renderError(message: string | null): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER} tc-page">
    ${renderLevelUpBackBar()}
    <div class="flex min-h-[280px] items-center justify-center rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 via-white to-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]" role="alert">
      <div class="flex max-w-md flex-col items-center gap-4">
        <p class="text-base font-semibold text-text-primary">Error al cargar el catálogo</p>
        <p class="text-sm leading-relaxed text-text-secondary">${escapeHtml(message || "Error inesperado")}</p>
        <button type="button" data-action="retry" class="${RH_LISTADO_BTN_SECONDARY}">Reintentar</button>
      </div>
    </div>
  </div>`;
}

function renderPageHeader(): string {
  return `
  ${pageHeading(
    "Catálogo de Tareas",
    "Administra las tareas utilizadas en perfiles de puesto y evaluaciones operativas.",
  )}`;
}

function renderKpis(stats: CatalogoStats): string {
  const kpis = [
    {
      label: "Total de tareas",
      value: String(stats.total),
      sub: "En el catálogo activo",
      icon: ICON_CLIPBOARD,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: "Categorías",
      value: String(stats.categorias),
      sub: "Clasificaciones distintas",
      icon: ICON_TAG,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
    },
    {
      label: "Tareas activas",
      value: String(stats.activas),
      sub: "Disponibles para asignar",
      icon: ICON_CHECK,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
    {
      label: "Complementarias",
      value: String(stats.complementarias),
      sub: "Marcadas como complemento",
      icon: ICON_SPARK,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
    },
  ];

  return `
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Resumen del catálogo">
    ${kpis
      .map(
        (k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${k.value}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`,
      )
      .join("")}
  </div>`;
}

function renderFilters(filters: CatalogoFilters, categorias: string[]): string {
  const catOpts = categorias
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${filters.categoria.toLowerCase() === c.toLowerCase() ? "selected" : ""}>${escapeHtml(c)}</option>`,
    )
    .join("");

  return `
  <section class="${RH_LISTADO_SURFACE} tc-filters p-4 sm:p-5" aria-label="Búsqueda y filtros de tareas">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(9rem,1fr)_minmax(9rem,1fr)] sm:items-end">
        <div class="min-w-0">
          <label for="tarea-catalogo-search" class="${RH_LISTADO_LABEL}">Buscar tarea</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input
              type="search"
              id="tarea-catalogo-search"
              data-action="catalogo-filter"
              autocomplete="off"
              placeholder="Nombre o categoría…"
              value="${escapeHtml(filters.text)}"
              class="tc-search-input block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
            />
          </div>
        </div>
        <div class="min-w-0">
          <label for="tarea-catalogo-cat" class="${RH_LISTADO_LABEL}">Categoría</label>
          <div class="grid grid-cols-1">
            <select id="tarea-catalogo-cat" data-action="filter-categoria" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
              <option value="" ${filters.categoria === "" ? "selected" : ""}>Todas las categorías</option>
              ${catOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="min-w-0">
          <label for="tarea-catalogo-tipo" class="${RH_LISTADO_LABEL}">Tipo</label>
          <div class="grid grid-cols-1">
            <select id="tarea-catalogo-tipo" data-action="filter-tipo" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
              <option value="" ${filters.tipo === "" ? "selected" : ""}>Todos los tipos</option>
              <option value="principal" ${filters.tipo === "principal" ? "selected" : ""}>Principal</option>
              <option value="complemento" ${filters.tipo === "complemento" ? "selected" : ""}>Complementaria</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      <button type="button" data-action="add-tarea" class="${RH_LISTADO_BTN_PRIMARY} tc-btn-nueva w-full shrink-0 sm:w-auto lg:self-end">
        ${ICON_PLUS}<span>Nueva tarea</span>
      </button>
    </div>
  </section>`;
}

function renderResultsBar(filters: CatalogoFilters, filteredCount: number, totalCount: number): string {
  const active = hasActiveFilters(filters);
  const text = active
    ? `<strong class="font-semibold tabular-nums text-text-primary">${filteredCount}</strong> de <strong class="tabular-nums text-text-primary">${totalCount}</strong> tarea${totalCount !== 1 ? "s" : ""}`
    : `<strong class="font-semibold tabular-nums text-text-primary">${filteredCount}</strong> tarea${filteredCount !== 1 ? "s" : ""} en catálogo`;

  const chips: string[] = [];
  if (filters.text.trim()) chips.push(`Búsqueda: "${escapeHtml(filters.text.trim())}"`);
  if (filters.categoria) chips.push(`Categoría: ${escapeHtml(filters.categoria)}`);
  if (filters.tipo) chips.push(`Tipo: ${filters.tipo === "principal" ? "Principal" : "Complementaria"}`);

  return `
  <div class="tc-results-bar flex flex-wrap items-center justify-between gap-2 px-1" aria-live="polite">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-text-secondary">${text}</p>
      ${chips
        .map(
          (c) =>
            `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-xs font-medium text-blue-900">${c}</span>`,
        )
        .join("")}
    </div>
    ${active ? `<button type="button" data-action="clear-search" class="${RH_LISTADO_BTN_GHOST} !px-2.5 !py-1.5 text-xs">Limpiar filtros</button>` : ""}
  </div>`;
}

function renderTableFooter(pg: PaginatedList<TareaCatalogo>): string {
  if (pg.total === 0) return "";
  const from = (pg.page - 1) * pg.pageSize + 1;
  const to = Math.min(pg.page * pg.pageSize, pg.total);

  const pageButtons = paginationRange(pg.totalPages, pg.page)
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "tc-page-btn tc-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
        : "tc-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-tc-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
    })
    .join("");

  return `
  <footer class="tc-table-footer flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
    <p class="text-xs font-medium text-slate-600 sm:text-sm">
      Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span>
    </p>
    ${
      pg.totalPages > 1
        ? `<nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación del catálogo">
      <button type="button" data-tc-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
        class="tc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página anterior</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
      </button>
      ${pageButtons}
      <button type="button" data-tc-page="${pg.page + 1}" ${pg.page >= pg.totalPages ? "disabled" : ""}
        class="tc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
        <span class="sr-only">Página siguiente</span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
      </button>
    </nav>`
        : ""
    }
  </footer>`;
}

function renderTableRows(pageItems: TareaCatalogo[]): string {
  return pageItems
    .map((t) => {
      const nombre = escapeHtml(t.nombre);
      return `
    <tr class="tc-catalogo-row group">
      <td class="tc-col-nombre px-4 py-3.5 align-middle">
        <p class="max-w-md truncate text-sm font-semibold text-text-primary" title="${nombre}">${nombre}</p>
      </td>
      <td class="px-4 py-3.5 align-middle">${categoriaBadge(t.categoria)}</td>
      <td class="px-4 py-3.5 align-middle">${tipoBadge(t.es_complemento)}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-right" data-tc-stop-row-nav="1">
        <div class="flex items-center justify-end gap-1">
          <button type="button" data-action="edit-tarea" data-id="${t.id}" class="tc-row-action" title="Editar tarea" aria-label="Editar ${nombre}">
            ${ICON_EDIT}
          </button>
          <button type="button" data-action="delete-tarea" data-id="${t.id}" class="tc-row-action tc-row-action--danger" title="Desactivar tarea" aria-label="Desactivar ${nombre}">
            ${ICON_TRASH}
          </button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function renderEmptyCatalog(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} tc-empty px-6 py-14 text-center">
    <p class="text-base font-semibold text-text-primary">Sin tareas en el catálogo</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Crea la primera tarea para reutilizarla en perfiles de puesto y asignaciones operativas.
    </p>
    <button type="button" data-action="add-tarea" class="${RH_LISTADO_BTN_PRIMARY} tc-btn-nueva mx-auto mt-6">
      ${ICON_PLUS}<span>Nueva tarea</span>
    </button>
  </div>`;
}

function renderNoResults(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} tc-empty px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">Sin resultados</p>
    <p class="mt-1.5 text-xs text-text-muted">No hay tareas que coincidan con los filtros aplicados.</p>
    <button type="button" data-action="clear-search" class="${RH_LISTADO_BTN_GHOST} mx-auto mt-4 text-xs">Limpiar filtros</button>
  </div>`;
}

function renderCatalogoTable(
  filtered: TareaCatalogo[],
  filters: CatalogoFilters,
  listPage: number,
): string {
  if (filtered.length === 0) {
    return hasActiveFilters(filters) ? renderNoResults() : renderEmptyCatalog();
  }

  const pg = paginateList(filtered, listPage);

  return `
  <section class="${RH_LISTADO_SURFACE} tc-table-wrap overflow-hidden p-0 flex flex-col" aria-label="Listado de tareas">
    <div class="tc-catalogo-scroll overflow-x-auto">
      <table class="tc-catalogo-table min-w-[640px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Nombre</th>
            <th scope="col" class="px-4 py-3.5 text-left">Categoría</th>
            <th scope="col" class="px-4 py-3.5 text-left">Tipo</th>
            <th scope="col" class="px-3 py-3.5 text-right"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${renderTableRows(pg.items)}</tbody>
      </table>
    </div>
    ${renderTableFooter(pg)}
  </section>`;
}

function renderReadyContent(
  items: TareaCatalogo[],
  filters: CatalogoFilters,
  listPage: number,
): string {
  const stats = computeCatalogoStats(items);
  const filtered = filterItems(items, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(1, listPage), totalPages);

  const mainBlock =
    items.length === 0
      ? renderEmptyCatalog()
      : `
    <div class="tc-content-stack flex flex-col gap-4 sm:gap-5">
      ${renderFilters(filters, distinctCategorias(items))}
      ${items.length > 0 ? renderResultsBar(filters, filtered.length, items.length) : ""}
      ${renderCatalogoTable(filtered, filters, safePage)}
    </div>`;

  return `
  <div class="${RH_LISTADO_PAGE_OUTER} tc-page">
    ${renderLevelUpBackBar()}
    ${renderPageHeader()}
    ${items.length > 0 ? renderKpis(stats) : ""}
    ${mainBlock}
  </div>`;
}

function renderModal(editing: TareaCatalogo | null, categorias: string[]): string {
  const isEdit = !!editing;
  const nombre = editing?.nombre ?? "";
  const categoria = editing?.categoria ?? "";
  const categoriaOpts = categorias
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join("");
  const es_complemento = editing?.es_complemento ?? false;
  const title = isEdit ? "Editar tarea" : "Nueva tarea";
  const subtitle = isEdit
    ? "Los cambios aplican al catálogo; los perfiles que ya la usan conservan su asignación."
    : "Registra una tarea reutilizable en perfiles de puesto.";

  return `
    <div id="tarea-modal-backdrop" class="tc-modal-backdrop ${MODAL_OVERLAY}" role="presentation">
      <div class="tc-modal-panel ${MODAL_PANEL} max-w-md" role="dialog" aria-modal="true" aria-labelledby="tarea-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="tarea-modal-title" class="text-lg font-semibold text-text-primary">${title}</h3>
          <p class="mt-1 text-sm text-text-muted">${subtitle}</p>
        </div>
        <form id="tarea-modal-form" class="flex flex-col gap-4 px-6 py-5">
          <div id="tarea-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          <div>
            <label for="tarea-modal-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600" aria-hidden="true">*</span></label>
            <input id="tarea-modal-nombre" name="nombre" type="text" required value="${escapeHtml(nombre)}"
              class="${FIELD_INPUT}"
              placeholder="Descripción de la tarea" />
          </div>
          <div>
            <label for="tarea-modal-categoria" class="${RH_LISTADO_LABEL}">Categoría <span class="text-text-muted font-normal">(opcional — elige una existente o escribe una nueva)</span></label>
            <input id="tarea-modal-categoria" name="categoria" type="text" value="${escapeHtml(categoria)}"
              list="tarea-modal-categoria-list" autocomplete="off"
              class="${FIELD_INPUT}"
              placeholder="Ej. logística, calidad, seguridad…" />
            <datalist id="tarea-modal-categoria-list">${categoriaOpts}</datalist>
          </div>
          <div class="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <input id="tarea-modal-complemento" name="es_complemento" type="checkbox" ${es_complemento ? "checked" : ""}
              class="mt-0.5 size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            <div>
              <label for="tarea-modal-complemento" class="text-sm font-medium text-text-primary">Tarea complementaria</label>
              <p class="mt-0.5 text-xs text-text-muted">Las tareas principales definen el núcleo del perfil; las complementarias amplían funciones.</p>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" data-action="close-modal" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">${isEdit ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDeleteConfirm(tarea: TareaCatalogo): string {
  return `
    <div id="tarea-delete-backdrop" class="tc-modal-backdrop ${MODAL_OVERLAY}" role="presentation">
      <div class="tc-modal-panel ${MODAL_PANEL} max-w-sm p-6" role="alertdialog" aria-modal="true" aria-labelledby="tarea-delete-title">
        <h3 id="tarea-delete-title" class="text-lg font-semibold text-text-primary">Desactivar tarea</h3>
        <p class="mt-2 text-sm leading-relaxed text-text-secondary">
          ¿Desactivar <strong class="text-text-primary">${escapeHtml(tarea.nombre)}</strong> del catálogo?
          Los perfiles que ya la tienen asignada no se verán afectados.
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" data-action="close-delete" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="confirm-delete" class="${BTN_DANGER}">Desactivar</button>
        </div>
      </div>
    </div>`;
}

// ── Page mount ────────────────────────────────────────────────────────────

export function mountTareasCatalogo(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: TareaCatalogo[] = [];
  const filters: CatalogoFilters = { text: "", categoria: "", tipo: "" };
  let listPage = 1;
  let errorMessage: string | null = null;
  let editingTarea: TareaCatalogo | null = null;
  let showModal = false;
  let deletingTarea: TareaCatalogo | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  mountAppShell(container, {
    pageTitle: "Catálogo de Tareas",
    activeNav: "tareas-catalogo",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="tareas-catalogo-root">
      <div id="tareas-catalogo-inner">${renderLoading()}</div>
      <div id="tarea-modal-host"></div>
      <div id="tarea-delete-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#tareas-catalogo-inner");
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    inner.innerHTML = renderReadyContent(items, filters, listPage);

    const modalHost = container.querySelector("#tarea-modal-host");
    if (modalHost) modalHost.innerHTML = showModal ? renderModal(editingTarea, distinctCategorias(items)) : "";

    const deleteHost = container.querySelector("#tarea-delete-host");
    if (deleteHost) deleteHost.innerHTML = deletingTarea ? renderDeleteConfirm(deletingTarea) : "";
  }

  async function loadCatalogo(): Promise<void> {
    status = "loading";
    paint();
    try {
      items = await getTareasCatalogo({ page_size: 200 });
      status = "ready";
      const filteredCount = filterItems(items, filters).length;
      const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE) || 1);
      listPage = Math.min(listPage, totalPages);
    } catch (e) {
      status = "error";
      errorMessage = (e as TareaCatalogoFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  container.addEventListener(
    "click",
    async (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;

      const pageBtn = target.closest<HTMLElement>("[data-tc-page]");
      if (pageBtn && !pageBtn.hasAttribute("disabled")) {
        const next = Number(pageBtn.dataset.tcPage);
        if (!Number.isNaN(next) && next >= 1) {
          listPage = next;
          paint();
          container.querySelector("#tareas-catalogo-inner")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "retry") {
        void loadCatalogo();
        return;
      }

      if (action === "clear-search") {
        filters.text = "";
        filters.categoria = "";
        filters.tipo = "";
        listPage = 1;
        paint();
        return;
      }

      if (action === "add-tarea") {
        editingTarea = null;
        showModal = true;
        paint();
        return;
      }

      if (action === "edit-tarea") {
        const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
        const item = items.find((t) => t.id === id);
        if (item) {
          editingTarea = item;
          showModal = true;
          paint();
        }
        return;
      }

      if (action === "delete-tarea") {
        const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
        const item = items.find((t) => t.id === id);
        if (item) {
          deletingTarea = item;
          paint();
        }
        return;
      }

      if (action === "close-modal") {
        showModal = false;
        editingTarea = null;
        paint();
        return;
      }

      if (action === "close-delete") {
        deletingTarea = null;
        paint();
        return;
      }

      if (action === "confirm-delete" && deletingTarea) {
        try {
          await fetchWithAuth(`/api/v1/tareas-catalogo/${deletingTarea.id}`, { method: "DELETE" });
          deletingTarea = null;
          await loadCatalogo();
        } catch {
          deletingTarea = null;
          paint();
        }
      }
    },
    { signal },
  );

  container.addEventListener(
    "click",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "tarea-modal-backdrop") {
        showModal = false;
        editingTarea = null;
        paint();
      }
      if (target.id === "tarea-delete-backdrop") {
        deletingTarea = null;
        paint();
      }
    },
    { signal },
  );

  container.addEventListener(
    "input",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "tarea-catalogo-search") {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filters.text = (target as HTMLInputElement).value;
          listPage = 1;
          paint();
        }, 250);
      }
    },
    { signal },
  );

  container.addEventListener(
    "change",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "tarea-catalogo-cat") {
        filters.categoria = (target as HTMLSelectElement).value;
        listPage = 1;
        paint();
        return;
      }
      if (target.id === "tarea-catalogo-tipo") {
        filters.tipo = (target as HTMLSelectElement).value as TipoFilter;
        listPage = 1;
        paint();
      }
    },
    { signal },
  );

  container.addEventListener(
    "submit",
    async (e) => {
      if (signal.aborted) return;
      const form = (e.target as HTMLElement).closest("#tarea-modal-form");
      if (!form) return;
      e.preventDefault();

      const fd = new FormData(form as HTMLFormElement);
      const nombre = String(fd.get("nombre") ?? "").trim();
      const categoria = String(fd.get("categoria") ?? "").trim() || undefined;
      const es_complemento = fd.has("es_complemento");

      if (!nombre) return;

      const wasEdit = !!editingTarea;
      const submitBtn = (form as HTMLElement).querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando…";
      }

      const errorEl = (form as HTMLElement).querySelector("#tarea-form-error") as HTMLElement | null;

      try {
        if (editingTarea) {
          const body: Record<string, unknown> = {};
          if (nombre !== editingTarea.nombre) body.nombre = nombre;
          if (categoria !== editingTarea.categoria) body.categoria = categoria ?? null;
          if (es_complemento !== editingTarea.es_complemento) body.es_complemento = es_complemento;
          if (Object.keys(body).length > 0) {
            await fetchWithAuth(`/api/v1/tareas-catalogo/${editingTarea.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          }
        } else {
          await createTareaCatalogo({ nombre, categoria, es_complemento });
        }
        showModal = false;
        editingTarea = null;
        await loadCatalogo();
      } catch (err) {
        const detail = (err as TareaCatalogoFetchError)?.detail ?? "Error al guardar";
        if (errorEl) {
          errorEl.textContent = detail;
          errorEl.classList.remove("hidden");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = wasEdit ? "Guardar" : "Crear";
        }
      }
    },
    { signal },
  );

  void loadCatalogo();
}
