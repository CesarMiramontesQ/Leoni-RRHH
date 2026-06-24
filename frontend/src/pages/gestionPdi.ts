import { mountAppShell } from "../layouts/appShell.ts";
import { fetchWithAuth } from "../api/http.ts";
import {
  getPDIGestion,
  getPDIResumen,
  patchPDIEstado,
  getPDIProgresoEquipo,
  type PDIGestionItem,
  type PDIGestionListResponse,
  type PDIResumenResponse,
  type PDIProgresoEquipoResponse,
} from "../api/evaluaciones.ts";

interface AreaOption {
  id: number;
  label: string;
}

interface State {
  resumen: PDIResumenResponse;
  data: PDIGestionListResponse;
  areas: AreaOption[];
  filters: { area_id: string; estado: string; fecha_inicio: string; fecha_fin: string; search: string };
  page: number;
  loading: boolean;
  activeKpi: string;
  soloVencidas: boolean;
  viewMode: "actions" | "employees";
  progresoEquipo: PDIProgresoEquipoResponse;
}

const BADGE_CLASSES: Record<string, string> = {
  pendiente: "bg-amber-50 text-amber-700 border border-amber-200",
  en_proceso: "bg-blue-50 text-blue-700 border border-blue-200",
  completado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelado: "bg-slate-50 text-slate-600 border border-slate-200",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

const VALID_NEXT: Record<string, string[]> = {
  pendiente: ["en_proceso", "cancelado"],
  en_proceso: ["completado", "cancelado"],
  completado: [],
  cancelado: [],
};

function badgeHtml(item: PDIGestionItem): string {
  if (item.vencida) {
    return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200">Vencida</span>`;
  }
  const cls = BADGE_CLASSES[item.estado] ?? BADGE_CLASSES.pendiente;
  const label = ESTADO_LABELS[item.estado] ?? item.estado;
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}">${label}</span>`;
}

function statusCellHtml(item: PDIGestionItem): string {
  const nextStates = VALID_NEXT[item.estado] ?? [];
  if (item.vencida || nextStates.length === 0) {
    return badgeHtml(item);
  }
  const cls = BADGE_CLASSES[item.estado] ?? BADGE_CLASSES.pendiente;
  return `<select data-action="change-pdi-estado" data-pdi-id="${item.id}"
    class="rounded-full px-2 py-0.5 text-xs font-medium border cursor-pointer appearance-none ${cls}"
    onclick="event.stopPropagation()">
    <option value="${item.estado}" selected>${ESTADO_LABELS[item.estado] ?? item.estado}</option>
    ${nextStates.map(s => `<option value="${s}">${ESTADO_LABELS[s] ?? s}</option>`).join("")}
  </select>`;
}

export function mountGestionPdi(container: HTMLElement, signal: AbortSignal): void {
  const PAGE_SIZE = 10;

  const state: State = {
    resumen: { total_acciones: 0, completadas: 0, en_proceso: 0, pendientes: 0, vencidas: 0 },
    data: { items: [], total: 0, page: 1, page_size: PAGE_SIZE },
    areas: [],
    filters: { area_id: "", estado: "", fecha_inicio: "", fecha_fin: "", search: "" },
    page: 1,
    loading: true,
    activeKpi: "",
    soloVencidas: false,
    viewMode: "actions",
    progresoEquipo: { items: [], total: 0 },
  };

  mountAppShell(container, {
    activeNav: "evaluaciones",
    mainHtml: `<div id="gestion-pdi-page"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#gestion-pdi-page")!;

  async function loadAreas() {
    const res = await fetchWithAuth("/api/v1/competencias/filter-options");
    if (res.ok) {
      const data = await res.json();
      state.areas = (data.areas ?? []).map((a: { id: string; label: string }) => ({
        id: Number(a.id),
        label: a.label,
      }));
    }
  }

  async function loadResumen() {
    state.resumen = await getPDIResumen();
  }

  async function loadItems() {
    state.loading = true;
    render();
    const params: Parameters<typeof getPDIGestion>[0] = {
      page: state.page,
      page_size: PAGE_SIZE,
    };
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    if (state.filters.estado) params.estado = state.filters.estado;
    if (state.filters.fecha_inicio) params.fecha_inicio = state.filters.fecha_inicio;
    if (state.filters.fecha_fin) params.fecha_fin = state.filters.fecha_fin;
    if (state.filters.search) params.search = state.filters.search;
    if (state.soloVencidas) params.solo_vencidas = true;
    state.data = await getPDIGestion(params);
    state.loading = false;
    render();
  }

  function kpiCard(key: string, label: string, count: number, dotColor: string): string {
    const active = state.activeKpi === key;
    return `<button type="button" data-action="kpi-filter" data-kpi="${key}" aria-pressed="${active}"
      class="group flex flex-col gap-2 rounded-[14px] border p-4 text-left transition
        ${active ? "border-blue-600 bg-blue-50/45 shadow-[0_6px_18px_rgba(30,64,175,0.12)]" : "border-slate-200/60 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-blue-400/40 hover:bg-slate-50/70"}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2">
      <span class="flex items-center gap-2">
        <span class="size-2 shrink-0 rounded-full ${dotColor}"></span>
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</span>
      </span>
      <span class="text-2xl font-bold tabular-nums text-slate-900">${count}</span>
    </button>`;
  }

  function renderActionsTable(): string {
    const { data, areas, filters } = state;
    const from = data.total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
    const to = Math.min(state.page * PAGE_SIZE, data.total);
    const totalPages = Math.ceil(data.total / PAGE_SIZE);

    return `
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600">Area</label>
          <select data-action="filter" data-field="area_id" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Todas</option>
            ${areas.map((a) => `<option value="${a.id}" ${filters.area_id === String(a.id) ? "selected" : ""}>${a.label}</option>`).join("")}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600">Estado</label>
          <select data-action="filter" data-field="estado" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="pendiente" ${filters.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="en_proceso" ${filters.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
            <option value="completado" ${filters.estado === "completado" ? "selected" : ""}>Completado</option>
            <option value="cancelado" ${filters.estado === "cancelado" ? "selected" : ""}>Cancelado</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600">Desde</label>
          <input type="date" data-action="filter" data-field="fecha_inicio" value="${filters.fecha_inicio}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600">Hasta</label>
          <input type="date" data-action="filter" data-field="fecha_fin" value="${filters.fecha_fin}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600">Buscar</label>
          <input type="text" data-action="search" placeholder="Nombre empleado..." value="${filters.search}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-48" />
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-200">
        ${state.loading ? `<div class="flex items-center justify-center py-12 text-sm text-slate-500">Cargando...</div>` : `
        <table class="min-w-[920px] w-full text-left">
          <thead class="border-b border-slate-200 shadow-sm">
            <tr>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Empleado</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Area</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Competencia</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Accion</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Tipo</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Periodo</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Responsable</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${data.items.length === 0 ? `<tr><td colspan="8" class="px-3 py-8 text-center text-sm text-slate-400">Sin resultados</td></tr>` : data.items.map((item) => `
            <tr class="cursor-pointer hover:bg-blue-50/40" ${item.vencida ? 'style="box-shadow: inset 3px 0 0 0 #ef4444"' : ""} data-action="go-empleado" data-id="${item.empleado_id}">
              <td class="px-3 py-2.5 align-middle text-sm font-medium text-blue-700">${item.empleado_nombre}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-600">${item.area_nombre ?? "—"}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-700">${item.competencia_nombre}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-700 max-w-[180px] truncate">${item.accion}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-600">${item.tipo}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-600 whitespace-nowrap">${item.fecha_inicio} — ${item.fecha_fin}</td>
              <td class="px-3 py-2.5 align-middle text-sm text-slate-600">${item.responsable}</td>
              <td class="px-3 py-2.5 align-middle">${statusCellHtml(item)}</td>
            </tr>`).join("")}
          </tbody>
        </table>`}
      </div>

      ${data.total > 0 ? `
      <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>Mostrando ${from}–${to} de ${data.total}</span>
        <div class="flex gap-2">
          <button data-action="prev-page" ${state.page <= 1 ? "disabled" : ""} class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
          <button data-action="next-page" ${state.page >= totalPages ? "disabled" : ""} class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Siguiente</button>
        </div>
      </div>` : ""}`;
  }

  function renderEmployeeView(): string {
    const { progresoEquipo } = state;
    if (state.loading) return `<div class="flex items-center justify-center py-12 text-sm text-slate-500">Cargando...</div>`;
    if (progresoEquipo.items.length === 0) return `<div class="px-3 py-8 text-center text-sm text-slate-400">Sin datos de progreso</div>`;
    return `
      <div class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-[700px] w-full text-left">
          <thead class="border-b border-slate-200 shadow-sm">
            <tr>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Empleado</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Area</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Progreso</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">Total</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">Completadas</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">En Proceso</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">Pendientes</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">Vencidas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${progresoEquipo.items.map(emp => {
              const barColor = emp.progreso_pct >= 80 ? "bg-emerald-500" : emp.progreso_pct >= 50 ? "bg-blue-500" : "bg-amber-500";
              return `
            <tr class="hover:bg-blue-50/40 cursor-pointer" data-action="go-empleado" data-id="${emp.empleado_id}">
              <td class="px-3 py-2.5 text-sm font-medium text-blue-700">${emp.empleado_nombre}</td>
              <td class="px-3 py-2.5 text-sm text-slate-600">${emp.area_nombre ?? "—"}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2 min-w-[8rem]">
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full ${barColor} transition-all" style="width:${emp.progreso_pct}%"></div>
                  </div>
                  <span class="text-xs font-semibold tabular-nums text-slate-700 w-9 text-right">${Math.round(emp.progreso_pct)}%</span>
                </div>
              </td>
              <td class="px-3 py-2.5 text-center text-sm tabular-nums">${emp.total}</td>
              <td class="px-3 py-2.5 text-center text-sm tabular-nums text-emerald-700">${emp.completadas}</td>
              <td class="px-3 py-2.5 text-center text-sm tabular-nums text-blue-700">${emp.en_proceso}</td>
              <td class="px-3 py-2.5 text-center text-sm tabular-nums text-amber-700">${emp.pendientes}</td>
              <td class="px-3 py-2.5 text-center text-sm tabular-nums ${emp.vencidas > 0 ? "text-red-700 font-semibold" : "text-slate-600"}">${emp.vencidas}</td>
            </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function loadProgresoEquipo() {
    state.loading = true;
    render();
    const params: { area_id?: number } = {};
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    state.progresoEquipo = await getPDIProgresoEquipo(params);
    state.loading = false;
    render();
  }

  function render() {
    const { resumen } = state;

    root.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav class="mb-4 text-sm text-slate-500">
          <a href="#/evaluaciones" class="hover:text-blue-600">Evaluaciones</a>
          <span class="mx-1">/</span>
          <span class="text-slate-900 font-medium">Gestion PDI</span>
        </nav>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          ${kpiCard("total", "Total Acciones", resumen.total_acciones, "bg-slate-400")}
          ${kpiCard("completadas", "Completadas", resumen.completadas, "bg-emerald-500")}
          ${kpiCard("en_proceso", "En Proceso", resumen.en_proceso, "bg-blue-500")}
          ${kpiCard("vencidas", "Vencidas", resumen.vencidas, "bg-red-500")}
        </div>

        <div class="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit" role="tablist">
          <button type="button" role="tab" data-action="toggle-view" data-view="actions"
            aria-selected="${state.viewMode === "actions"}"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${state.viewMode === "actions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}">
            Todas las acciones
          </button>
          <button type="button" role="tab" data-action="toggle-view" data-view="employees"
            aria-selected="${state.viewMode === "employees"}"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${state.viewMode === "employees" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}">
            Por empleado
          </button>
        </div>

        ${state.viewMode === "actions" ? renderActionsTable() : renderEmployeeView()}
      </div>
    `;
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "kpi-filter") {
      const kpi = target.dataset.kpi ?? "";
      if (state.activeKpi === kpi) {
        state.activeKpi = "";
        state.filters.estado = "";
        state.soloVencidas = false;
      } else {
        state.activeKpi = kpi;
        state.soloVencidas = false;
        if (kpi === "completadas") state.filters.estado = "completado";
        else if (kpi === "en_proceso") state.filters.estado = "en_proceso";
        else if (kpi === "vencidas") { state.filters.estado = ""; state.soloVencidas = true; }
        else state.filters.estado = "";
      }
      state.page = 1;
      void loadItems();
    }

    if (action === "prev-page" && state.page > 1) {
      state.page--;
      void loadItems();
    }
    if (action === "next-page") {
      const totalPages = Math.ceil(state.data.total / PAGE_SIZE);
      if (state.page < totalPages) {
        state.page++;
        void loadItems();
      }
    }

    if (action === "go-empleado") {
      const el = e.target as HTMLElement;
      if (el.tagName === "SELECT" || el.tagName === "OPTION") return;
      const id = target.dataset.id;
      if (id) window.location.hash = `#/evaluaciones/empleado/${id}`;
    }

    if (action === "toggle-view") {
      const view = target.dataset.view as "actions" | "employees";
      if (view && view !== state.viewMode) {
        state.viewMode = view;
        if (view === "employees") {
          void loadProgresoEquipo();
        } else {
          render();
        }
      }
    }
  }, { signal });

  root.addEventListener("change", async (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === "filter") {
      const field = target.dataset.field as keyof State["filters"];
      const value = (target as HTMLSelectElement | HTMLInputElement).value;
      state.filters[field] = value;
      state.activeKpi = "";
      state.soloVencidas = false;
      state.page = 1;
      void loadItems();
    }
    if (target.dataset.action === "change-pdi-estado") {
      const pdiId = Number(target.dataset.pdiId);
      const newEstado = (target as HTMLSelectElement).value;
      if (!pdiId || !newEstado) return;
      const result = await patchPDIEstado(pdiId, newEstado);
      if (result) {
        void Promise.all([loadResumen(), loadItems()]);
      } else {
        render();
      }
    }
  }, { signal });

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === "search") {
      const value = (target as HTMLInputElement).value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.filters.search = value;
        state.page = 1;
        void loadItems();
      }, 350);
    }
  }, { signal });

  void Promise.all([loadAreas(), loadResumen()]).then(() => loadItems());
}
