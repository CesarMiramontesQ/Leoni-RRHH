import { mountAppShell } from "../layouts/appShell.ts";
import {
  getCompetencias,
  createCompetencia,
  updateCompetencia,
  deleteCompetencia,
  getCompetenciaPuestos,
  type CompetenciasFetchError,
} from "../api/competencias.ts";
import type { Competencia, CompetenciasTab, NivelMatriz } from "../dashboard/competencias/types.ts";
import { clearAuth } from "../auth/session.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  applyPuestoNivelChange,
  createMatrizRequisitosModel,
  loadCompetenciasPuesto,
  loadMatrizFilterOptions,
  loadPuestosList,
  renderMatrizRequisitosTab,
  savePuestoNivelesPending,
  type MatrizRequisitosModel,
} from "../components/competencias/matrizRequisitosTab.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
  SELECT_CHEVRON,
  badgeOpen,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
} from "../ui/uiTokens.ts";
import {
  TIPO_COMPETENCIA_OPTIONS,
  TIPO_COMPETENCIA_LABELS,
  esTipoCompetenciaValido,
  grupoFromTipo,
} from "../ui/catalogoCompetenciaTipo.ts";

// ── Iconos (Heroicons outline / solid) ──────────────────────────────────

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`;
const ICON_WRENCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.199 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745-1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>`;
const ICON_TAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg>`;

const SUBCAT_LABELS: Record<string, string> = {
  ...TIPO_COMPETENCIA_LABELS,
  complementos: "Complementos",
};

const GRUPO_FILTER_LABELS: Record<string, string> = {
  tecnica: "Técnica",
  habilidad_blanda: "Habilidad blanda",
};

// ── Helpers visuales ────────────────────────────────────────────────────

type CatalogoStats = {
  total: number;
  tecnicas: number;
  blandas: number;
  subcategorias: number;
};

function computeCatalogoStats(items: Competencia[]): CatalogoStats {
  const subcats = new Set<string>();
  let tecnicas = 0;
  let blandas = 0;
  for (const c of items) {
    if (c.grupo === "tecnica") tecnicas += 1;
    else blandas += 1;
    if (c.subcategoria) subcats.add(c.subcategoria);
  }
  return { total: items.length, tecnicas, blandas, subcategorias: subcats.size };
}

function filterCatalogoItems(
  items: Competencia[],
  filterText: string,
  grupoFilter: string,
  subcategoriaFilter: string,
): Competencia[] {
  let filtered = items;
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    filtered = filtered.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q),
    );
  }
  if (grupoFilter) filtered = filtered.filter((c) => c.grupo === grupoFilter);
  if (subcategoriaFilter) filtered = filtered.filter((c) => c.subcategoria === subcategoriaFilter);
  return filtered;
}

function hasActiveCatalogoFilters(filterText: string, grupoFilter: string, subcategoriaFilter: string): boolean {
  return Boolean(filterText.trim() || grupoFilter || subcategoriaFilter);
}

function grupoBadge(grupo: "tecnica" | "habilidad_blanda"): string {
  if (grupo === "tecnica") return badgeOpen("Técnica");
  return `<span class="comp-grupo-badge comp-grupo-badge--blanda inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900"><span class="size-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true"></span>Habilidad blanda</span>`;
}

function subcategoriaChip(label: string): string {
  return `<span class="comp-subcat-chip inline-flex max-w-[14rem] items-center truncate rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

function descripcionCell(text: string): string {
  const safe = escapeHtml(text);
  return `<p class="comp-desc-cell line-clamp-2 text-sm leading-relaxed text-text-secondary" title="${safe}">${safe}</p>`;
}

function renderRowActions(id: number): string {
  return `<div class="comp-row-actions flex items-center justify-end gap-1">
    <button type="button" data-action="edit-competencia" data-id="${id}" class="comp-row-action" title="Editar competencia" aria-label="Editar competencia">
      ${ICON_EDIT}
    </button>
    <button type="button" data-action="delete-competencia" data-id="${id}" class="comp-row-action comp-row-action--danger" title="Eliminar competencia" aria-label="Eliminar competencia">
      ${ICON_TRASH}
    </button>
  </div>`;
}

// ── KPIs del catálogo ───────────────────────────────────────────────────

function kpiSkeletonCard(): string {
  return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="h-3.5 w-28 rounded-md bg-slate-200/90"></div>
      <div class="h-11 w-11 rounded-xl bg-slate-200/80"></div>
    </div>
    <div class="mt-4 h-10 w-16 rounded-md bg-slate-100/90"></div>
  </article>`;
}

function renderCatalogoKpis(stats: CatalogoStats): string {
  const items = [
    { label: "Total competencias", value: stats.total, sub: "En el catálogo activo", icon: ICON_GRID, iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue" },
    { label: "Técnicas", value: stats.tecnicas, sub: "Conocimientos e idiomas", icon: ICON_WRENCH, iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky" },
    { label: "Habilidades blandas", value: stats.blandas, sub: "Competencias conductuales", icon: ICON_HEART, iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet" },
    { label: "Subcategorías", value: stats.subcategorias, sub: "Tipos distintos en uso", icon: ICON_TAG, iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--slate" },
  ];
  return `
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Indicadores del catálogo">
    ${items
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

// ── Pestañas ────────────────────────────────────────────────────────────

function renderTabButton(tab: CompetenciasTab, active: CompetenciasTab, label: string): string {
  const isActive = tab === active;
  return `<button
    type="button"
    role="tab"
    aria-selected="${isActive}"
    data-action="comp-tab"
    data-tab="${tab}"
    class="comp-page-tab ${isActive ? "comp-page-tab--active" : ""}"
  >${escapeHtml(label)}</button>`;
}

function renderTabsNav(active: CompetenciasTab): string {
  return `
  <div class="comp-page-tabs" role="tablist" aria-label="Secciones de competencias">
    ${renderTabButton("catalogo", active, "Catálogo")}
    ${renderTabButton("matriz", active, "Niveles por puesto")}
  </div>`;
}

// ── Filtros del catálogo ────────────────────────────────────────────────

function renderFilterActiveChips(filterText: string, grupoFilter: string, subcategoriaFilter: string): string {
  const chips: string[] = [];
  if (filterText.trim()) chips.push(`Búsqueda: “${escapeHtml(filterText.trim())}”`);
  if (grupoFilter) chips.push(`Grupo: ${escapeHtml(GRUPO_FILTER_LABELS[grupoFilter] ?? grupoFilter)}`);
  if (subcategoriaFilter) {
    chips.push(`Subcategoría: ${escapeHtml(SUBCAT_LABELS[subcategoriaFilter] ?? subcategoriaFilter)}`);
  }
  if (chips.length === 0) return "";
  return `<div class="comp-filter-chips flex flex-wrap items-center gap-2 border-t border-slate-100/90 pt-3">
    <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Filtros activos</span>
    ${chips
      .map(
        (c) =>
          `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-900">${c}</span>`,
      )
      .join("")}
    <button type="button" data-action="catalogo-clear-filters" class="${RH_LISTADO_BTN_GHOST} ml-auto text-xs">Limpiar filtros</button>
  </div>`;
}

function renderCatalogoFilters(
  filterText: string,
  grupoFilter: string,
  subcategoriaFilter: string,
  visibleCount: number,
  totalCount: number,
): string {
  const hasActive = hasActiveCatalogoFilters(filterText, grupoFilter, subcategoriaFilter);
  const activeChips = renderFilterActiveChips(filterText, grupoFilter, subcategoriaFilter);
  const resultsLine =
    hasActive || filterText.trim()
      ? `<p class="text-xs text-text-muted" id="comp-catalogo-results-count" aria-live="polite">
          Mostrando <strong class="font-semibold text-text-primary tabular-nums">${visibleCount}</strong>
          de <strong class="font-semibold tabular-nums">${totalCount}</strong> competencias
        </p>`
      : `<p class="text-xs text-text-muted" id="comp-catalogo-results-count">${totalCount} competencia${totalCount !== 1 ? "s" : ""} en catálogo</p>`;

  return `
  <section class="${RH_LISTADO_SURFACE} comp-catalogo-filters p-4 sm:p-5" aria-label="Filtros del catálogo">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
        <p class="mt-0.5 text-xs text-text-muted">Encuentra competencias por nombre, descripción, grupo o subcategoría.</p>
      </div>
      <div class="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        ${resultsLine}
        <button type="button" data-action="add-competencia" class="${RH_LISTADO_BTN_PRIMARY} comp-btn-nueva w-full sm:w-auto">
          ${ICON_PLUS}
          Nueva competencia
        </button>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] lg:items-end">
      <div class="min-w-0">
        <label for="comp-catalogo-search" class="${RH_LISTADO_LABEL}">Buscar</label>
        <div class="relative">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">${ICON_SEARCH}</span>
          <input
            type="search"
            id="comp-catalogo-search"
            data-action="catalogo-filter"
            placeholder="Nombre o descripción de la competencia…"
            value="${escapeHtml(filterText)}"
            autocomplete="off"
            class="comp-search-input block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
          />
        </div>
      </div>
      <div class="min-w-0">
        <label for="comp-catalogo-grupo" class="${RH_LISTADO_LABEL}">Grupo</label>
        <div class="grid grid-cols-1">
          <select id="comp-catalogo-grupo" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="">Todos los grupos</option>
            <option value="tecnica" ${grupoFilter === "tecnica" ? "selected" : ""}>Técnica</option>
            <option value="habilidad_blanda" ${grupoFilter === "habilidad_blanda" ? "selected" : ""}>Habilidad blanda</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-0">
        <label for="comp-catalogo-subcategoria" class="${RH_LISTADO_LABEL}">Subcategoría</label>
        <div class="grid grid-cols-1">
          <select id="comp-catalogo-subcategoria" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="">Todas las subcategorías</option>
            <option value="informatica" ${subcategoriaFilter === "informatica" ? "selected" : ""}>Informática</option>
            <option value="idiomas" ${subcategoriaFilter === "idiomas" ? "selected" : ""}>Idiomas</option>
            <option value="profesional" ${subcategoriaFilter === "profesional" ? "selected" : ""}>Profesional</option>
            <option value="social" ${subcategoriaFilter === "social" ? "selected" : ""}>Social</option>
            <option value="personal" ${subcategoriaFilter === "personal" ? "selected" : ""}>Personal</option>
            <option value="metodos" ${subcategoriaFilter === "metodos" ? "selected" : ""}>Métodos</option>
            <option value="complementos" ${subcategoriaFilter === "complementos" ? "selected" : ""}>Complementos</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
    </div>
    ${hasActive ? `<span class="comp-filter-active-dot mt-3 inline-flex size-2 rounded-full bg-leoni-blue" aria-hidden="true" title="Hay filtros activos"></span>` : ""}
    ${activeChips}
  </section>`;
}

// ── Tabla y estados del catálogo ────────────────────────────────────────

function renderEmptyCatalogo(): string {
  return `
  <div class="comp-empty-state flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50/90 via-white to-blue-50/20 px-6 py-14 text-center">
    <span class="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">${ICON_GRID}</span>
    <p class="mt-4 text-sm font-semibold text-text-primary">Aún no hay competencias en el catálogo</p>
    <p class="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Crea la primera competencia para vincularla a perfiles de puesto y definir niveles requeridos en la pestaña <strong class="font-semibold text-text-primary">Niveles por puesto</strong>.
    </p>
    <button type="button" data-action="add-competencia" class="${RH_LISTADO_BTN_PRIMARY} comp-btn-nueva mt-6">
      ${ICON_PLUS}
      Nueva competencia
    </button>
  </div>`;
}

function renderNoSearchResults(filterText: string, grupoFilter: string, subcategoriaFilter: string): string {
  const hints: string[] = [];
  if (filterText.trim()) hints.push("prueba con otro término de búsqueda");
  if (grupoFilter || subcategoriaFilter) hints.push("ajusta o limpia los filtros de grupo y subcategoría");
  const hintText = hints.length > 0 ? hints.join(" o ") + "." : "Ajusta los criterios de búsqueda.";
  return `
  <div class="comp-empty-state flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 px-6 py-12 text-center">
    <span class="flex size-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80">${ICON_SEARCH}</span>
    <p class="mt-4 text-sm font-semibold text-text-primary">Sin coincidencias</p>
    <p class="mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">No hay competencias que coincidan con los filtros actuales. ${escapeHtml(hintText)}</p>
    <button type="button" data-action="catalogo-clear-filters" class="${RH_LISTADO_BTN_GHOST} mt-5">Limpiar filtros</button>
  </div>`;
}

function renderCatalogoTableRows(filtered: Competencia[]): string {
  return filtered
    .map(
      (c) => `
      <tr class="comp-catalogo-row group">
        <td class="comp-col-nombre px-4 py-3.5 align-top">
          <p class="text-sm font-semibold leading-snug text-text-primary">${escapeHtml(c.nombre)}</p>
        </td>
        <td class="comp-col-desc px-4 py-3.5 align-top max-w-xs lg:max-w-md xl:max-w-lg">${descripcionCell(c.descripcion)}</td>
        <td class="px-4 py-3.5 align-top whitespace-nowrap">${grupoBadge(c.grupo)}</td>
        <td class="px-4 py-3.5 align-top">
          ${
            c.subcategoria
              ? subcategoriaChip(SUBCAT_LABELS[c.subcategoria] ?? c.subcategoria)
              : `<span class="text-sm text-slate-400">—</span>`
          }
        </td>
        <td class="px-3 py-3 align-top">${renderRowActions(c.id)}</td>
      </tr>`,
    )
    .join("");
}

function renderCatalogoTab(
  items: Competencia[],
  filterText: string,
  grupoFilter: string,
  subcategoriaFilter: string,
): string {
  const filtered = filterCatalogoItems(items, filterText, grupoFilter, subcategoriaFilter);
  const stats = computeCatalogoStats(items);

  let tableBody = "";
  if (items.length === 0) {
    tableBody = "";
  } else if (filtered.length === 0) {
    tableBody = "";
  } else {
    tableBody = renderCatalogoTableRows(filtered);
  }

  const tableSection =
    items.length === 0
      ? renderEmptyCatalogo()
      : filtered.length === 0
        ? renderNoSearchResults(filterText, grupoFilter, subcategoriaFilter)
        : `
      <div class="${RH_LISTADO_SURFACE} comp-catalogo-table-wrap overflow-hidden p-0">
        <div class="comp-catalogo-scroll overflow-x-auto overflow-y-auto">
          <table class="comp-catalogo-table min-w-full w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" class="comp-col-nombre px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre</th>
                <th scope="col" class="comp-col-desc px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Descripción</th>
                <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Grupo</th>
                <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Subcategoría</th>
                <th scope="col" class="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90">${tableBody}</tbody>
          </table>
        </div>
      </div>`;

  return `
    <div class="flex flex-col gap-4 sm:gap-5" role="tabpanel" id="comp-tab-panel-catalogo" aria-label="Catálogo de competencias">
      ${renderCatalogoKpis(stats)}
      ${renderCatalogoFilters(filterText, grupoFilter, subcategoriaFilter, filtered.length, items.length)}
      ${tableSection}
    </div>`;
}

// ── Loading / Error ─────────────────────────────────────────────────────

function renderLoading(): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER}" aria-busy="true" aria-label="Cargando competencias">
      <div class="h-6 w-48 animate-pulse rounded-md bg-slate-200/90"></div>
      <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
    </div>`;
}

function renderError(message: string | null): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <div class="flex min-h-[280px] items-center justify-center rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 via-white to-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]" role="alert">
        <div class="flex max-w-md flex-col items-center gap-4">
          <p class="text-base font-semibold text-text-primary">Error al cargar datos</p>
          <p class="text-sm leading-relaxed text-text-secondary">${escapeHtml(message || "Error inesperado")}</p>
          <button type="button" data-action="retry" class="${BTN_SECONDARY}">Reintentar</button>
        </div>
      </div>
    </div>`;
}

function renderPageHeader(): string {
  return `
    <header class="comp-page-header flex flex-col gap-2">
      <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
        <ol class="flex flex-wrap items-center gap-1">
          <li><a href="#/" class="font-medium transition hover:text-leoni-blue">Inicio</a></li>
          <li class="text-slate-300" aria-hidden="true">/</li>
          <li class="font-semibold text-text-primary" aria-current="page">Competencias</li>
        </ol>
      </nav>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Matriz de Competencias</h1>
        <p class="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Administra el catálogo corporativo y los niveles mínimos exigidos por perfil de puesto.
        </p>
      </div>
    </header>`;
}

// ── Modales ─────────────────────────────────────────────────────────────

function renderCompetenciaModal(comp: Competencia | null): string {
  const isEdit = comp !== null;
  const title = isEdit ? "Editar competencia" : "Nueva competencia";
  const subtitle = isEdit
    ? "Actualiza los datos visibles en catálogos y perfiles de puesto."
    : "Registra una competencia reutilizable en toda la organización.";
  const nombre = comp?.nombre ?? "";
  const descripcion = comp?.descripcion ?? "";
  const tipo = comp?.subcategoria && esTipoCompetenciaValido(comp.subcategoria) ? comp.subcategoria : "informatica";

  const tipoOpts = TIPO_COMPETENCIA_OPTIONS.map(
    (o) => `<option value="${o.value}" ${tipo === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
  ).join("");

  return `
    <div id="comp-modal-backdrop" data-action="close-modal" class="comp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div
        class="comp-modal-panel w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        data-modal-inner
        role="dialog"
        aria-modal="true"
        aria-labelledby="comp-modal-title"
      >
        <div class="border-b border-slate-100 px-6 py-5">
          <h2 id="comp-modal-title" class="text-lg font-semibold text-text-primary">${title}</h2>
          <p class="mt-1 text-sm text-text-muted">${subtitle}</p>
        </div>
        <form id="comp-modal-form" novalidate class="flex flex-col gap-4 px-6 py-5">
          <div id="comp-modal-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          ${isEdit ? `<input type="hidden" name="id" value="${comp.id}" />` : ""}
          <div>
            <label for="comp-modal-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600" aria-hidden="true">*</span></label>
            <input id="comp-modal-nombre" type="text" name="nombre" value="${escapeHtml(nombre)}" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
          </div>
          <div>
            <label for="comp-modal-descripcion" class="${RH_LISTADO_LABEL}">Descripción <span class="text-red-600" aria-hidden="true">*</span></label>
            <textarea id="comp-modal-descripcion" name="descripcion" rows="3" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">${escapeHtml(descripcion)}</textarea>
          </div>
          <div>
            <label for="comp-modal-tipo" class="${RH_LISTADO_LABEL}">Tipo <span class="text-red-600" aria-hidden="true">*</span></label>
            <div class="grid grid-cols-1">
              <select id="comp-modal-tipo" name="tipo" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                ${tipoOpts}
              </select>
              ${SELECT_CHEVRON}
            </div>
            <p class="mt-1.5 text-xs text-text-muted">El tipo determina el grupo (técnica o habilidad blanda) y la subcategoría.</p>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="close-modal" class="${BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY} w-full sm:w-auto">${isEdit ? "Guardar cambios" : "Crear competencia"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDeleteConfirmModal(
  id: number,
  nombre: string,
  puestos: { id: number; codigo: string; nombre: string }[],
): string {
  const puestosHtml =
    puestos.length === 0
      ? `<p class="text-sm text-text-muted">No está asociada a ningún perfil de puesto.</p>`
      : `<p class="text-sm text-text-secondary mb-2">Se eliminará de <strong class="text-text-primary">${puestos.length}</strong> perfil${puestos.length !== 1 ? "es" : ""} de puesto:</p>
         <ul class="comp-delete-puestos-list max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-2">
           ${puestos.map((p) => `<li class="flex items-center gap-2 py-1 text-sm text-text-primary"><span class="font-mono text-xs text-text-muted">${escapeHtml(p.codigo)}</span> ${escapeHtml(p.nombre)}</li>`).join("")}
         </ul>`;

  return `
    <div class="comp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div class="comp-modal-panel w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]" role="alertdialog" aria-labelledby="comp-delete-title" aria-modal="true">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="comp-delete-title" class="text-lg font-semibold text-text-primary">Eliminar competencia</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-sm leading-relaxed text-text-secondary">¿Eliminar <strong class="text-text-primary">${escapeHtml(nombre)}</strong> del catálogo? Esta acción no se puede deshacer.</p>
          <div class="mt-4">${puestosHtml}</div>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" data-action="cancel-delete-competencia" class="${BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
          <button type="button" data-action="confirm-delete-competencia" data-id="${id}" class="${BTN_DANGER} w-full sm:w-auto">Eliminar</button>
        </div>
      </div>
    </div>`;
}

// ── Page mount ────────────────────────────────────────────────────────

export function mountCompetencias(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let activeTab: CompetenciasTab = "catalogo";
  let catalogoItems: Competencia[] = [];
  let catalogoFilter = "";
  let catalogoGrupo = "";
  let catalogoSubcategoria = "";
  let errorMessage: string | null = null;
  let editingCompetencia: Competencia | null = null;
  let showModal = false;
  const matrizModel: MatrizRequisitosModel = createMatrizRequisitosModel(getRolFromAccessToken() === "rh");

  mountAppShell(container, {
    pageTitle: "Matriz de Competencias",
    activeNav: "empleados",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="competencias-page-root" class="flex min-h-0 flex-1 flex-col">
      <div id="competencias-inner"></div>
      <div id="comp-modal-host"></div>
      <div id="comp-delete-modal-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#competencias-inner");
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    const tabContent =
      activeTab === "catalogo"
        ? renderCatalogoTab(catalogoItems, catalogoFilter, catalogoGrupo, catalogoSubcategoria)
        : `<div role="tabpanel" id="comp-tab-panel-matriz" aria-label="Niveles por puesto" class="flex flex-col gap-4">${renderMatrizRequisitosTab(matrizModel)}</div>`;

    inner.innerHTML = `
      <div id="competencias-root" class="${RH_LISTADO_PAGE_OUTER}">
        ${renderPageHeader()}
        ${renderTabsNav(activeTab)}
        <div id="comp-tab-panel" class="comp-tab-panel">${tabContent}</div>
      </div>`;
  }

  async function paintMatrizTab(): Promise<void> {
    if (activeTab !== "matriz") return;
    const panel = container.querySelector("#comp-tab-panel");
    if (!panel) return;
    panel.innerHTML = `<div role="tabpanel" id="comp-tab-panel-matriz" aria-label="Niveles por puesto" class="flex flex-col gap-4">${renderMatrizRequisitosTab(matrizModel)}</div>`;
  }

  function paintModal(): void {
    const host = container.querySelector("#comp-modal-host");
    if (!host) return;
    if (!showModal) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = renderCompetenciaModal(editingCompetencia);
  }

  function showDeleteConfirmModal(id: number, nombre: string, puestos: { id: number; codigo: string; nombre: string }[]): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (!host) return;
    host.innerHTML = renderDeleteConfirmModal(id, nombre, puestos);
  }

  function closeDeleteConfirmModal(): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (host) host.innerHTML = "";
  }

  function clearCatalogoFilters(): void {
    catalogoFilter = "";
    catalogoGrupo = "";
    catalogoSubcategoria = "";
    paint();
  }

  function handleSessionExpired(): void {
    clearAuth();
    void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
      abortAuthenticatedShell();
      void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
    });
  }

  async function loadCatalogo(): Promise<void> {
    try {
      catalogoItems = await getCompetencias({ page_size: 200 });
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) {
        handleSessionExpired();
        return;
      }
    }
  }

  async function init(): Promise<void> {
    status = "loading";
    paint();
    try {
      await loadCatalogo();
      await loadMatrizFilterOptions(matrizModel);
      try {
        await loadPuestosList(matrizModel);
      } catch {
        /* La pestaña Niveles por puesto recargará puestos al abrirla */
      }
      status = "ready";
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) {
        handleSessionExpired();
        return;
      }
      status = "error";
      errorMessage = (e as CompetenciasFetchError)?.detail || "Error de conexion.";
    }
    paint();
    if (activeTab === "matriz") await paintMatrizTab();
  }

  async function switchToMatrizTab(): Promise<void> {
    activeTab = "matriz";
    paint();
    try {
      if (matrizModel.areaOptions.length === 0) {
        await loadMatrizFilterOptions(matrizModel);
      }
      if (matrizModel.puestos.length === 0) {
        await loadPuestosList(matrizModel);
      }
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) {
        handleSessionExpired();
        return;
      }
    }
    if (matrizModel.puestoId) {
      await loadCompetenciasPuesto(matrizModel);
    }
    await paintMatrizTab();
  }

  const root = container.querySelector("#competencias-page-root");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  root?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;

      if (t.closest("[data-action='add-competencia']")) {
        editingCompetencia = null;
        showModal = true;
        paintModal();
        return;
      }

      if (t.closest("[data-action='catalogo-clear-filters']")) {
        clearCatalogoFilters();
        return;
      }

      const editBtn = t.closest<HTMLElement>("[data-action='edit-competencia']");
      if (editBtn) {
        const id = Number.parseInt(editBtn.getAttribute("data-id") ?? "", 10);
        const comp = catalogoItems.find((c) => c.id === id);
        if (comp) {
          editingCompetencia = comp;
          showModal = true;
          paintModal();
        }
        return;
      }

      const delBtn = t.closest<HTMLElement>("[data-action='delete-competencia']");
      if (delBtn) {
        const id = Number.parseInt(delBtn.getAttribute("data-id") ?? "", 10);
        if (!Number.isFinite(id)) return;
        void (async () => {
          try {
            const puestos = await getCompetenciaPuestos(id);
            const comp = catalogoItems.find((c) => c.id === id);
            const nombre = comp?.nombre ?? "esta competencia";
            showDeleteConfirmModal(id, nombre, puestos);
          } catch (err: unknown) {
            const fe = err as CompetenciasFetchError;
            if (fe?.status === 401) {
              handleSessionExpired();
              return;
            }
            alert(fe?.detail || "Error al consultar puestos asociados");
          }
        })();
        return;
      }

      const confirmDelBtn = t.closest<HTMLElement>("[data-action='confirm-delete-competencia']");
      if (confirmDelBtn) {
        const id = Number.parseInt(confirmDelBtn.getAttribute("data-id") ?? "", 10);
        if (!Number.isFinite(id)) return;
        confirmDelBtn.setAttribute("disabled", "true");
        confirmDelBtn.textContent = "Eliminando...";
        void (async () => {
          try {
            await deleteCompetencia(id);
            closeDeleteConfirmModal();
            await loadCatalogo();
            paint();
          } catch (err: unknown) {
            const fe = err as CompetenciasFetchError;
            if (fe?.status === 401) {
              handleSessionExpired();
              return;
            }
            alert(fe?.detail || "Error al eliminar");
            confirmDelBtn.removeAttribute("disabled");
            confirmDelBtn.textContent = "Eliminar";
          }
        })();
        return;
      }

      const cancelDelBtn = t.closest<HTMLElement>("[data-action='cancel-delete-competencia']");
      if (cancelDelBtn) {
        closeDeleteConfirmModal();
        return;
      }

      const closeBtn = t.closest<HTMLElement>("[data-action='close-modal']");
      if (closeBtn) {
        if (closeBtn.id === "comp-modal-backdrop" && t.closest("[data-modal-inner]")) {
          /* click dentro del panel */
        } else {
          showModal = false;
          paintModal();
        }
        return;
      }

      if (t.closest("[data-action='retry']")) {
        void init();
        return;
      }

      const tabBtn = t.closest<HTMLElement>("[data-action='comp-tab']");
      if (tabBtn) {
        const tab = tabBtn.getAttribute("data-tab") as CompetenciasTab | null;
        if (tab === "catalogo") {
          activeTab = "catalogo";
          paint();
        } else if (tab === "matriz") {
          void switchToMatrizTab();
        }
        return;
      }

      if (t.closest("[data-action='puesto-niveles-guardar']")) {
        void (async () => {
          await savePuestoNivelesPending(matrizModel);
          await paintMatrizTab();
        })();
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "comp-catalogo-search" || t.closest("[data-action='catalogo-filter']")) {
        clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          catalogoFilter = (t as HTMLInputElement).value;
          paint();
        }, 250);
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (e) => {
      const t = e.target as HTMLElement;

      if (t.id === "comp-catalogo-grupo") {
        catalogoGrupo = (t as HTMLSelectElement).value;
        paint();
        return;
      }
      if (t.id === "comp-catalogo-subcategoria") {
        catalogoSubcategoria = (t as HTMLSelectElement).value;
        paint();
        return;
      }

      if (t.matches("[data-action='puesto-niveles-area']")) {
        matrizModel.areaId = (t as HTMLSelectElement).value;
        matrizModel.puestoId = "";
        matrizModel.competencias = [];
        matrizModel.pending.clear();
        void (async () => {
          await loadPuestosList(matrizModel);
          await paintMatrizTab();
        })();
        return;
      }

      if (t.matches("[data-action='puesto-niveles-puesto']")) {
        matrizModel.puestoId = (t as HTMLSelectElement).value;
        matrizModel.pending.clear();
        void (async () => {
          await loadCompetenciasPuesto(matrizModel);
          await paintMatrizTab();
        })();
        return;
      }

      const nivelSel = t.closest<HTMLElement>("[data-action='puesto-nivel-req']");
      if (nivelSel) {
        const compId = Number.parseInt(nivelSel.getAttribute("data-competencia-id") ?? "", 10);
        const nivel = Number.parseInt((nivelSel as HTMLSelectElement).value, 10) as NivelMatriz;
        if (Number.isFinite(compId) && nivel >= 0 && nivel <= 4) {
          applyPuestoNivelChange(matrizModel, compId, nivel);
          void paintMatrizTab();
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "keydown",
    (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Escape" && showModal) {
        ke.preventDefault();
        showModal = false;
        paintModal();
      }
    },
    { signal },
  );

  container.addEventListener(
    "submit",
    (e) => {
      const form = (e.target as HTMLElement).closest("#comp-modal-form");
      if (!form) return;
      e.preventDefault();
      const fd = new FormData(form as HTMLFormElement);
      const nombre = (fd.get("nombre") as string)?.trim();
      const descripcion = (fd.get("descripcion") as string)?.trim();
      const tipo = fd.get("tipo") as string;
      const subcategoria = tipo || undefined;
      const grupo = grupoFromTipo(tipo);
      const idRaw = fd.get("id") as string | null;
      const errorEl = (form as HTMLFormElement).querySelector("#comp-modal-error") as HTMLElement | null;

      const showError = (message: string) => {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
      };
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      }

      if (!nombre) {
        showError("Indica el nombre de la competencia.");
        return;
      }
      if (!descripcion) {
        showError("Indica la descripcion de la competencia.");
        return;
      }
      if (!tipo) {
        showError("Selecciona un tipo.");
        return;
      }

      void (async () => {
        try {
          if (idRaw) {
            const id = Number.parseInt(idRaw, 10);
            await updateCompetencia(id, { nombre, descripcion, grupo, subcategoria });
          } else {
            await createCompetencia({ nombre, descripcion, grupo, subcategoria });
          }
          showModal = false;
          paintModal();
          await loadCatalogo();
          paint();
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) {
            handleSessionExpired();
            return;
          }
          alert(fe?.detail || "Error al guardar");
        }
      })();
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  void init();
}
