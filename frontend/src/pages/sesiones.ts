import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_SECONDARY, BTN_GHOST, FIELD_FOCUS, FILTER_FIELD_WRAP } from "../ui/uiTokens.ts";
import { getAllSesiones } from "../api/cursos.ts";
import type { SesionGlobalListResponse } from "../api/cursos.ts";
import { ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../dashboard/cursos/types.ts";

const SURFACE = "rounded-2xl border border-border bg-white shadow-sm";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const CONTROL = "mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-slate-400";

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

  function render(): void {
    mountAppShell(container, {
      activeNav: "sesiones",
      mainHtml: renderPage(),
    });
  }

  function filtrosActivos(): boolean {
    return !!(state.filtroEstado || state.busqueda);
  }

  function renderPage(): string {
    const totalPages = Math.ceil(state.data.total / state.pageSize);
    const pageSizeOpts = [25, 50, 100]
      .map(n => `<option value="${n}" ${n === state.pageSize ? "selected" : ""}>${n}</option>`)
      .join("");

    const clearBtn = filtrosActivos()
      ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
          <button type="button" data-action="sesiones-clear-filters" class="${BTN_GHOST} text-xs w-full sm:w-auto">Limpiar filtros</button>
        </div>`
      : "";

    return `
    <div class="flex flex-col gap-5">
      <!-- Encabezado -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-text-primary">Sesiones de Cursos</h1>
          <p class="text-sm text-slate-500 mt-0.5">${state.data.total} sesión${state.data.total !== 1 ? "es" : ""} en total</p>
        </div>
      </div>

      <!-- Filtros -->
      <section class="${SURFACE} p-4 sm:p-5" aria-label="Filtros de sesiones">
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-text-primary">Filtros de búsqueda</h2>
          <p class="text-xs font-medium text-slate-500">Mostrando <span class="tabular-nums font-semibold text-text-primary">${state.data.total}</span> sesiones</p>
        </div>
        <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2">
          <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
            <label for="sesiones-search" class="${LABEL}">Búsqueda</label>
            <div class="relative mt-1">
              <svg class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>
              <input id="sesiones-search" type="search" data-action="sesiones-search"
                placeholder="Buscar curso, ubicación, instructor..."
                value="${escapeHtml(state.busqueda)}"
                class="${CONTROL} pl-9 ${FIELD_FOCUS}" />
            </div>
          </div>
          <div class="${FILTER_FIELD_WRAP}">
            <label for="sesiones-filter-estado" class="${LABEL}">Estado</label>
            <select id="sesiones-filter-estado" data-action="sesiones-filter-estado" class="${CONTROL} ${FIELD_FOCUS}">
              <option value="">Todos</option>
              <option value="programada" ${state.filtroEstado === "programada" ? "selected" : ""}>Programada</option>
              <option value="en_curso" ${state.filtroEstado === "en_curso" ? "selected" : ""}>En curso</option>
              <option value="completada" ${state.filtroEstado === "completada" ? "selected" : ""}>Completada</option>
              <option value="cancelada" ${state.filtroEstado === "cancelada" ? "selected" : ""}>Cancelada</option>
            </select>
          </div>
          <div class="${FILTER_FIELD_WRAP}">
            <label for="sesiones-page-size" class="${LABEL}">Por página</label>
            <select id="sesiones-page-size" data-action="sesiones-page-size" class="${CONTROL} ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
          ${clearBtn}
        </div>
      </section>

      <!-- Tabla -->
      ${state.loading ? `<div class="${SURFACE} p-8 text-center"><p class="text-sm text-slate-400">Cargando sesiones...</p></div>` : state.data.items.length === 0 ? `
      <div class="${SURFACE} p-8 text-center">
        <p class="text-sm text-slate-500 font-medium">Sin sesiones encontradas</p>
        <p class="text-xs text-slate-400 mt-1">Prueba ajustando los filtros de búsqueda.</p>
      </div>` : `
      <section class="${SURFACE} overflow-hidden" aria-label="Listado de sesiones">
        <div class="overflow-x-auto">
          <table class="min-w-[760px] w-full text-left">
            <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">Curso</th>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3">Horario</th>
                <th class="px-4 py-3">Ubicación</th>
                <th class="px-4 py-3">Instructor</th>
                <th class="px-4 py-3 text-center">Inscritos</th>
                <th class="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${renderRows()}</tbody>
          </table>
        </div>

        ${totalPages > 1 ? `
        <div class="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span class="text-xs text-slate-500">Página <span class="font-semibold tabular-nums">${state.page}</span> de <span class="tabular-nums">${totalPages}</span></span>
          <div class="flex gap-2">
            <button data-action="sesiones-prev" ${state.page <= 1 ? "disabled" : ""} class="${BTN_SECONDARY} text-xs disabled:opacity-40">← Anterior</button>
            <button data-action="sesiones-next" ${state.page >= totalPages ? "disabled" : ""} class="${BTN_SECONDARY} text-xs disabled:opacity-40">Siguiente →</button>
          </div>
        </div>` : ""}
      </section>
      `}
    </div>`;
  }

  function renderRows(): string {
    return state.data.items.map(s => {
      const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
      const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : "—";
      const cupo = s.cupo_max ? `${s.inscritos_count}/${s.cupo_max}` : `${s.inscritos_count}`;
      const estadoCls =
        s.estado === "completada" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
        s.estado === "cancelada" ? "border-red-200 bg-red-50 text-red-800" :
        s.estado === "en_curso" ? "border-blue-200 bg-blue-50 text-blue-800" :
        "border-slate-200 bg-slate-50 text-slate-700";
      const label = ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;

      return `
      <tr class="hover:bg-slate-50/60 cursor-pointer transition-colors" data-action="go-sesion" data-curso-id="${s.curso_id}" data-sesion-id="${s.id}">
        <td class="px-4 py-3">
          <span class="text-sm font-medium text-blue-600">${escapeHtml(s.curso_nombre ?? `Curso #${s.curso_id}`)}</span>
        </td>
        <td class="px-4 py-3 text-sm text-text-primary font-medium whitespace-nowrap">${escapeHtml(fecha)}</td>
        <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${escapeHtml(horario)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(s.ubicacion ?? "—")}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(s.instructor ?? "—")}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-600 text-center">${cupo}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center rounded-full border ${estadoCls} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(label)}</span>
        </td>
      </tr>`;
    }).join("");
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
      state.loading = true;
      render();
      await loadData();
      state.loading = false;
      render();
      return;
    }

    if (t.closest("[data-action='sesiones-prev']")) {
      if (state.page > 1) {
        state.page--;
        state.loading = true;
        render();
        await loadData();
        state.loading = false;
        render();
      }
      return;
    }

    if (t.closest("[data-action='sesiones-next']")) {
      state.page++;
      state.loading = true;
      render();
      await loadData();
      state.loading = false;
      render();
      return;
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLSelectElement;
    if (t.matches("[data-action='sesiones-filter-estado']")) {
      state.filtroEstado = t.value;
      state.page = 1;
      state.loading = true;
      render();
      await loadData();
      state.loading = false;
      render();
    }
    if (t.matches("[data-action='sesiones-page-size']")) {
      state.pageSize = Number(t.value);
      state.page = 1;
      state.loading = true;
      render();
      await loadData();
      state.loading = false;
      render();
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='sesiones-search']")) {
      state.busqueda = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        state.page = 1;
        state.loading = true;
        render();
        await loadData();
        state.loading = false;
        render();
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
