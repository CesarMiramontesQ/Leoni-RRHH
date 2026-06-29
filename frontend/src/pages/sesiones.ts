import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  pageHeading,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import { getAllSesiones } from "../api/cursos.ts";
import type { SesionGlobalItem, SesionGlobalListResponse } from "../api/cursos.ts";
import { ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../dashboard/cursos/types.ts";

const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>`;
const ICON_CALENDAR_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>`;

const FILTER_SELECT_CLS = `${RH_LISTADO_SELECT} col-start-1 row-start-1 appearance-none ${RH_LISTADO_FOCUS_RING}`;
const FILTER_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

function estadoBadgeCls(estado: string): string {
  if (estado === "completada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (estado === "cancelada") return "border-red-200 bg-red-50 text-red-800";
  if (estado === "en_curso") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function mountSesiones(container: HTMLElement): void {
  interface State {
    data: SesionGlobalListResponse;
    loading: boolean;
    page: number;
    pageSize: number;
    filtroEstado: string;
    busqueda: string;
  }

  const state: State = {
    data: { items: [], total: 0 },
    loading: true,
    page: 1,
    pageSize: 50,
    filtroEstado: "",
    busqueda: "",
  };

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async function loadData(): Promise<void> {
    try {
      state.data = await getAllSesiones({
        page: state.page,
        page_size: state.pageSize,
        estado: state.filtroEstado || undefined,
        q: state.busqueda || undefined,
      });
    } catch {
      state.data = { items: [], total: 0 };
    }
  }

  function filtrosActivos(): boolean {
    return !!(state.filtroEstado || state.busqueda);
  }

  function kpiSkeletonCard(): string {
    return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="h-3 w-24 rounded bg-slate-200/90"></div>
      <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
      <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
    </article>`;
  }

  function renderPageHeader(): string {
    return pageHeading(
      "Sesiones de Cursos",
      "Consulta fechas, ubicaciones, instructores e inscritos de todas las sesiones programadas.",
    );
  }

  function renderKpis(): string {
    const items = state.data.items;
    const programadas = items.filter((s) => s.estado === "programada").length;
    const enCurso = items.filter((s) => s.estado === "en_curso").length;
    const completadas = items.filter((s) => s.estado === "completada").length;
    const inscritos = items.reduce((sum, s) => sum + s.inscritos_count, 0);

    const kpis = [
      {
        label: "Total sesiones",
        value: String(state.data.total),
        sub: filtrosActivos() ? "Con filtros aplicados" : "Registradas en el sistema",
        icon: ICON_CALENDAR,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
      },
      {
        label: "Programadas",
        value: String(programadas),
        sub: "En esta página",
        icon: ICON_CLOCK,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
      },
      {
        label: "Completadas",
        value: String(completadas),
        sub: "En esta página",
        icon: ICON_CHECK,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
      },
      {
        label: "Inscritos",
        value: String(inscritos),
        sub: enCurso > 0 ? `${enCurso} sesión${enCurso !== 1 ? "es" : ""} en curso` : "En esta página",
        icon: ICON_USERS,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      },
    ];

    return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Resumen de sesiones">
      ${kpis.map((k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${k.value}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`).join("")}
    </div>`;
  }

  function renderFilters(): string {
    const hasFilters = filtrosActivos();
    const resultsLine = hasFilters
      ? `Mostrando <strong class="font-semibold text-text-primary tabular-nums">${state.data.total}</strong> sesiones`
      : `<strong class="font-semibold text-text-primary tabular-nums">${state.data.total}</strong> sesiones en total`;

    const pageSizeOpts = [25, 50, 100]
      .map((n) => `<option value="${n}" ${n === state.pageSize ? "selected" : ""}>${n}</option>`)
      .join("");

    return `
    <section class="${RH_LISTADO_SURFACE} ss-filters p-4 sm:p-5" aria-label="Filtros de sesiones">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
          <p class="mt-0.5 text-xs text-text-muted">Localiza sesiones por curso, ubicación o instructor.</p>
        </div>
        <p class="text-xs text-text-muted" aria-live="polite">${resultsLine}</p>
      </div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3">
        <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
          <label for="sesiones-search" class="${RH_LISTADO_LABEL}">Búsqueda</label>
          <div class="relative mt-1">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input id="sesiones-search" type="search" data-action="sesiones-search" autocomplete="off"
              placeholder="Curso, ubicación, instructor…"
              value="${escapeHtml(state.busqueda)}"
              class="${FILTER_INPUT_CLS}" />
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="sesiones-filter-estado" class="${RH_LISTADO_LABEL}">Estado</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="sesiones-filter-estado" data-action="sesiones-filter-estado" class="${FILTER_SELECT_CLS}">
              <option value="">Todos</option>
              <option value="programada" ${state.filtroEstado === "programada" ? "selected" : ""}>Programada</option>
              <option value="en_curso" ${state.filtroEstado === "en_curso" ? "selected" : ""}>En curso</option>
              <option value="completada" ${state.filtroEstado === "completada" ? "selected" : ""}>Completada</option>
              <option value="cancelada" ${state.filtroEstado === "cancelada" ? "selected" : ""}>Cancelada</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="sesiones-page-size" class="${RH_LISTADO_LABEL}">Por página</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="sesiones-page-size" data-action="sesiones-page-size" class="${FILTER_SELECT_CLS}">
              ${pageSizeOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        ${hasFilters ? `
        <div class="w-full shrink-0 sm:w-auto xl:ml-1">
          <button type="button" data-action="sesiones-clear-filters" class="${RH_LISTADO_BTN_GHOST} w-full text-xs sm:w-auto">Limpiar filtros</button>
        </div>` : ""}
      </div>
    </section>`;
  }

  function renderEmptyState(): string {
    const hasFilters = filtrosActivos();
    return `
    <div class="${RH_LISTADO_SURFACE} ss-empty px-6 py-14 text-center">
      ${ICON_CALENDAR_EMPTY}
      <p class="mt-4 text-base font-semibold text-text-primary">${hasFilters ? "Sin sesiones encontradas" : "Sin sesiones"}</p>
      <p class="mt-2 text-sm text-text-secondary">${hasFilters ? "Prueba ajustando los filtros de búsqueda." : "Aún no hay sesiones programadas en el sistema."}</p>
      ${hasFilters ? `<button type="button" data-action="sesiones-clear-filters" class="${RH_LISTADO_BTN_GHOST} mx-auto mt-5 text-xs">Limpiar filtros</button>` : ""}
    </div>`;
  }

  function renderPagination(): string {
    const totalPages = Math.max(1, Math.ceil(state.data.total / state.pageSize));
    if (totalPages <= 1 && state.data.total <= state.pageSize) return "";

    const from = (state.page - 1) * state.pageSize + 1;
    const to = Math.min(state.page * state.pageSize, state.data.total);

    const pageButtons = paginationRange(totalPages, state.page)
      .map((x) => {
        if (x === "ellipsis") {
          return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
        }
        const active = x === state.page;
        const cls = active
          ? "ss-page-btn ss-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
          : "ss-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
        return `<button type="button" data-action="sesiones-goto-page" data-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
      })
      .join("");

    return `
    <footer class="ss-table-footer flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${state.data.total}</span>
      </p>
      <nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación de sesiones">
        <button type="button" data-action="sesiones-prev" ${state.page <= 1 ? "disabled" : ""}
          class="ss-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página anterior</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
        </button>
        ${pageButtons}
        <button type="button" data-action="sesiones-next" ${state.page >= totalPages ? "disabled" : ""}
          class="ss-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página siguiente</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
        </button>
      </nav>
    </footer>`;
  }

  function renderRow(s: SesionGlobalItem): string {
    const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
    const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : "—";
    const cupo = s.cupo_max ? `${s.inscritos_count}/${s.cupo_max}` : `${s.inscritos_count}`;
    const label = ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;
    const cursoNombre = escapeHtml(s.curso_nombre ?? `Curso #${s.curso_id}`);

    return `
    <tr class="ss-sesion-row cursor-pointer transition" data-action="go-sesion" data-curso-id="${s.curso_id}" data-sesion-id="${s.id}">
      <td class="px-4 py-3.5 align-middle">
        <span class="block max-w-[220px] truncate text-sm font-semibold text-leoni-blue" title="${cursoNombre}">${cursoNombre}</span>
      </td>
      <td class="px-4 py-3.5 align-middle text-sm font-medium whitespace-nowrap text-text-primary">${escapeHtml(fecha)}</td>
      <td class="px-4 py-3.5 align-middle text-sm whitespace-nowrap text-slate-600">${escapeHtml(horario)}</td>
      <td class="px-4 py-3.5 align-middle max-w-[160px] truncate text-sm text-slate-600" title="${escapeHtml(s.ubicacion ?? "")}">${escapeHtml(s.ubicacion ?? "—")}</td>
      <td class="px-4 py-3.5 align-middle max-w-[160px] truncate text-sm text-slate-600" title="${escapeHtml(s.instructor_nombre ?? "")}">${escapeHtml(s.instructor_nombre ?? "—")}</td>
      <td class="px-4 py-3.5 align-middle text-center text-sm tabular-nums text-slate-600">${cupo}</td>
      <td class="px-4 py-3.5 align-middle text-center">
        <span class="inline-flex items-center rounded-full border ${estadoBadgeCls(s.estado)} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(label)}</span>
      </td>
    </tr>`;
  }

  function renderTable(): string {
    return `
    <div class="overflow-x-auto">
      <table class="ss-sesiones-table min-w-[800px] w-full text-left text-sm">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th class="px-4 py-3.5">Curso</th>
            <th class="px-4 py-3.5">Fecha</th>
            <th class="px-4 py-3.5">Horario</th>
            <th class="px-4 py-3.5">Ubicación</th>
            <th class="px-4 py-3.5">Instructor</th>
            <th class="px-4 py-3.5 text-center">Inscritos</th>
            <th class="px-4 py-3.5 text-center">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${state.data.items.map(renderRow).join("")}</tbody>
      </table>
    </div>`;
  }

  function renderListContent(): string {
    if (state.loading && state.data.items.length === 0) {
      return `
      <section class="${RH_LISTADO_SURFACE} ss-table-wrap flex min-h-[240px] flex-col overflow-hidden p-0" aria-busy="true" aria-label="Cargando sesiones">
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14">
          <div class="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-leoni-blue" aria-hidden="true"></div>
          <p class="text-sm text-text-secondary">Cargando sesiones…</p>
        </div>
      </section>`;
    }

    if (state.data.items.length === 0) {
      return renderEmptyState();
    }

    return `
    <section class="${RH_LISTADO_SURFACE} ss-table-wrap flex flex-col overflow-hidden p-0" aria-label="Listado de sesiones">
      <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 class="text-sm font-semibold text-text-primary">Resultados</h2>
        <p class="text-xs text-text-muted">${state.data.total} sesión${state.data.total !== 1 ? "es" : ""}</p>
      </div>
      ${renderTable()}
      ${renderPagination()}
    </section>`;
  }

  function renderLoadingPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER} ss-page" aria-busy="true" aria-label="Cargando sesiones">
      ${renderLevelUpBackBar()}
      <div class="h-6 w-56 animate-pulse rounded-md bg-slate-200/90"></div>
      <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
    </div>`;
  }

  function renderPage(): string {
    if (state.loading && state.data.items.length === 0 && !filtrosActivos()) {
      return renderLoadingPage();
    }

    const showKpis = !state.loading || state.data.items.length > 0;

    return `
    <div class="${RH_LISTADO_PAGE_OUTER} ss-page">
      ${renderLevelUpBackBar()}
      ${renderPageHeader()}
      ${showKpis ? renderKpis() : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>`}
      <div class="ss-content-stack flex flex-col gap-4 sm:gap-5">
        ${renderFilters()}
        ${renderListContent()}
      </div>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Sesiones",
      activeNav: "sesiones",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  async function reload(): Promise<void> {
    state.loading = true;
    render();
    await loadData();
    state.loading = false;
    render();
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    const row = t.closest("[data-action='go-sesion']") as HTMLElement | null;
    if (row) {
      const cId = row.dataset.cursoId;
      const sId = row.dataset.sesionId;
      if (cId && sId) window.location.hash = `#/sesiones/${cId}/${sId}`;
      return;
    }

    if (t.closest("[data-action='sesiones-clear-filters']")) {
      state.filtroEstado = "";
      state.busqueda = "";
      state.page = 1;
      await reload();
      return;
    }

    if (t.closest("[data-action='sesiones-prev']")) {
      if (state.page > 1) {
        state.page--;
        await reload();
      }
      return;
    }

    const gotoPageBtn = t.closest<HTMLElement>("[data-action='sesiones-goto-page']");
    if (gotoPageBtn) {
      const targetPage = Number(gotoPageBtn.dataset.page);
      const totalPages = Math.max(1, Math.ceil(state.data.total / state.pageSize));
      if (targetPage >= 1 && targetPage <= totalPages && targetPage !== state.page) {
        state.page = targetPage;
        await reload();
      }
      return;
    }

    if (t.closest("[data-action='sesiones-next']")) {
      const totalPages = Math.max(1, Math.ceil(state.data.total / state.pageSize));
      if (state.page < totalPages) {
        state.page++;
        await reload();
      }
      return;
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLSelectElement;
    if (t.matches("[data-action='sesiones-filter-estado']")) {
      state.filtroEstado = t.value;
      state.page = 1;
      await reload();
    }
    if (t.matches("[data-action='sesiones-page-size']")) {
      state.pageSize = Number(t.value);
      state.page = 1;
      await reload();
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='sesiones-search']")) {
      state.busqueda = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        state.page = 1;
        await reload();
        const input = container.querySelector<HTMLInputElement>("[data-action='sesiones-search']");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 350);
    }
  }

  render();
  container.addEventListener("click", handleClick);
  container.addEventListener("change", handleChange);
  container.addEventListener("input", handleInput);

  (async () => {
    await loadData();
    state.loading = false;
    render();
  })();
}
