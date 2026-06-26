import { mountAppShell } from "../layouts/appShell.ts";
import { fetchWithAuth } from "../api/http.ts";
import {
  getPDIGestion,
  getPDIResumen,
  patchPDIEstado,
  getPDIProgresoEquipo,
  getPDIEquipoResumen,
  getPDIHeatmap,
  getPDITimeline,
  getEmpleadoResumen,
  createPDI,
  getPDIKpisAvanzados,
  getPDIRecomendaciones,
  exportPDI,
  notificarEquipoPDI,
  type PDIGestionItem,
  type PDIGestionListResponse,
  type PDIResumenResponse,
  type PDIProgresoEquipoResponse,
  type EquipoResumenResponse,
  type EquipoResumenEmpleadoItem,
  type EmpleadoResumen,
  type CompetenciaResumenItem,
  type HeatmapResponse,
  type HeatmapEmpleado,
  type TimelineResponse,
  type TimelineEvent,
  type PDIKpisAvanzadosResponse,
  type PDIRecomendacionItem,
  type PDIRecomendacionesResponse,
  type PDICreatePayload,
} from "../api/evaluaciones.ts";

interface AreaOption {
  id: number;
  label: string;
}

interface WizardData {
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  accion: string;
  prioridad: "baja" | "media" | "alta";
  recursos: string;
  competencia_id: string;
  responsable: string;
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
  viewMode: "actions" | "employees" | "team" | "heatmap" | "timeline";
  progresoEquipo: PDIProgresoEquipoResponse;
  equipoResumen: EquipoResumenResponse;
  expandedEmployeeId: number | null;
  expandedData: EmpleadoResumen | null;
  heatmapData: HeatmapResponse;
  timelineData: TimelineResponse;
  kpisAvanzados: PDIKpisAvanzadosResponse;
  recomendaciones: PDIRecomendacionesResponse | null;
  recomendacionesLoading: boolean;
  wizardOpen: boolean;
  wizardStep: number;
  wizardEmpleadoId: number | null;
  wizardData: WizardData;
  competenciasOptions: { id: number; nombre: string }[];
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

const ESTATUS_PDI: Record<string, { cls: string; label: string }> = {
  vencido: { cls: "bg-red-50 text-red-700 border-red-200", label: "Vencido" },
  pendiente: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Pendiente" },
  en_proceso: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "En Desarrollo" },
  completado: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Completado" },
  sin_acciones: { cls: "bg-slate-50 text-slate-500 border-slate-200", label: "Sin Acciones" },
};

const BAR_COLORS: Record<string, string> = {
  alineado: "bg-emerald-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  critica: "bg-red-500",
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
    equipoResumen: { items: [], total: 0 },
    expandedEmployeeId: null,
    expandedData: null,
    heatmapData: { competencias: [], empleados: [], matriz: {} },
    timelineData: { eventos: [], total: 0 },
    kpisAvanzados: { cumplimiento_plan_pct: 0, horas_training_promedio: 0, promedio_skill_gap: 0, inversion_horas_total: 0 },
    recomendaciones: null,
    recomendacionesLoading: false,
    wizardOpen: false,
    wizardStep: 1,
    wizardEmpleadoId: null,
    wizardData: { tipo: "", fecha_inicio: "", fecha_fin: "", accion: "", prioridad: "media", recursos: "", competencia_id: "", responsable: "" },
    competenciasOptions: [],
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
    const areaParam = state.filters.area_id ? { area_id: Number(state.filters.area_id) } : undefined;
    state.kpisAvanzados = await getPDIKpisAvanzados(areaParam);
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

  async function loadEquipoResumen() {
    state.loading = true;
    state.expandedEmployeeId = null;
    state.expandedData = null;
    render();
    const params: { area_id?: number } = {};
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    state.equipoResumen = await getPDIEquipoResumen(params);
    state.loading = false;
    render();
  }

  async function loadHeatmap() {
    state.loading = true;
    render();
    const params: { area_id?: number } = {};
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    state.heatmapData = await getPDIHeatmap(params);
    state.loading = false;
    render();
  }

  async function loadTimeline() {
    state.loading = true;
    render();
    const params: { area_id?: number } = {};
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    state.timelineData = await getPDITimeline(params);
    state.loading = false;
    render();
  }

  function renderViewContent(): string {
    switch (state.viewMode) {
      case "actions": return renderActionsTable();
      case "employees": return renderEmployeeView();
      case "team": return renderTeamSummary();
      case "heatmap": return renderHeatmap();
      case "timeline": return renderTimeline();
      default: return renderActionsTable();
    }
  }

  function renderHeatmap(): string {
    const { heatmapData } = state;
    if (state.loading) return `<div class="flex items-center justify-center py-12 text-sm text-slate-500">Cargando...</div>`;
    if (heatmapData.empleados.length === 0 || heatmapData.competencias.length === 0) {
      return `<div class="px-3 py-8 text-center text-sm text-slate-400">Sin datos para el mapa de calor</div>`;
    }

    const { competencias, empleados, matriz } = heatmapData;

    function cellColor(gap: number): string {
      if (gap === 0) return "bg-emerald-400";
      if (gap <= 1) return "bg-amber-400";
      if (gap < 2) return "bg-orange-500";
      return "bg-red-500";
    }

    return `
      <div class="space-y-3">
        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="border-collapse">
            <thead>
              <tr>
                <th class="sticky left-0 z-30 bg-white px-3 py-2 text-left text-[11px] font-semibold text-slate-600 min-w-[160px] border-b border-r border-slate-200">Competencia / Empl.</th>
                ${empleados.map((emp: HeatmapEmpleado) => {
                  const short = emp.nombre.split(" ").slice(0, 2).map((w: string, i: number) => i === 0 ? w : w[0] + ".").join(" ");
                  return `<th class="px-1 py-2 text-center border-b border-slate-200 min-w-[36px]">
                    <span class="block text-[9px] text-slate-500 font-medium whitespace-nowrap [writing-mode:vertical-lr] rotate-180 h-16">${short}</span>
                  </th>`;
                }).join("")}
              </tr>
            </thead>
            <tbody>
              ${competencias.map(comp => `
              <tr>
                <td class="sticky left-0 z-20 bg-white px-3 py-1 text-[11px] text-slate-700 border-r border-slate-100 truncate max-w-[160px]" title="${comp.competencia_nombre}">${comp.competencia_nombre}</td>
                ${empleados.map((emp: HeatmapEmpleado) => {
                  const cell = matriz[String(emp.empleado_id)]?.[String(comp.competencia_id)];
                  if (!cell) return `<td class="px-1 py-1"><div class="size-7 rounded bg-slate-100 mx-auto" title="N/A"></div></td>`;
                  const color = cellColor(cell.gap);
                  return `<td class="px-1 py-1"><div class="size-7 rounded ${color} mx-auto cursor-default" title="${comp.competencia_nombre} · ${emp.nombre}\nReq: ${cell.nivel_requerido} / Act: ${cell.nivel_actual} (Gap: ${cell.gap})"></div></td>`;
                }).join("")}
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="flex items-center gap-4 text-[10px] text-slate-500">
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-emerald-400"></span>Alineado (0)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-amber-400"></span>Moderado (0.5-1)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-orange-500"></span>Alto (1-2)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-red-500"></span>Critico (2+)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-slate-100 border border-slate-200"></span>N/A</span>
        </div>
      </div>`;
  }

  function renderTimeline(): string {
    const { timelineData } = state;
    if (state.loading) return `<div class="flex items-center justify-center py-12 text-sm text-slate-500">Cargando...</div>`;
    if (timelineData.eventos.length === 0) {
      return `<div class="px-3 py-8 text-center text-sm text-slate-400">Sin eventos en los proximos 30 dias</div>`;
    }

    function dotColor(ev: TimelineEvent): string {
      if (ev.estado === "completado") return "bg-emerald-500";
      if (ev.vencida) return "bg-red-500";
      if (ev.dias_restantes !== null && ev.dias_restantes <= 7) return "bg-orange-500";
      return "bg-blue-500";
    }

    function groupLabel(fechaStr: string): string {
      const fecha = new Date(fechaStr + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((fecha.getTime() - today.getTime()) / 86400000);
      if (diff < 0) return "Vencidas";
      if (diff === 0) return "Hoy";
      if (diff <= 7) return "Esta semana";
      if (diff <= 14) return "Proxima semana";
      return "Proximo mes";
    }

    let currentGroup = "";
    let html = '<div class="space-y-0 relative">';

    for (const ev of timelineData.eventos) {
      const group = groupLabel(ev.fecha_fin);
      if (group !== currentGroup) {
        currentGroup = group;
        html += `<div class="pt-3 pb-1"><span class="text-[10px] font-semibold uppercase tracking-wider ${group === "Vencidas" ? "text-red-600" : "text-slate-400"}">${group}</span></div>`;
      }

      const dot = dotColor(ev);
      const badgeCls = BADGE_CLASSES[ev.estado] ?? BADGE_CLASSES.pendiente;
      const diasText = ev.vencida
        ? `<span class="text-[10px] text-red-600 font-medium">Vencida hace ${Math.abs(ev.dias_restantes ?? 0)} dias</span>`
        : ev.dias_restantes !== null
          ? `<span class="text-[10px] text-slate-500">${ev.dias_restantes} dias restantes</span>`
          : "";

      html += `
        <div class="flex gap-3 py-2 pl-1">
          <div class="flex flex-col items-center">
            <div class="size-2.5 rounded-full ${dot} shrink-0 mt-1.5"></div>
            <div class="w-px flex-1 bg-slate-200"></div>
          </div>
          <div class="flex-1 min-w-0 pb-2">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-[10px] uppercase tracking-wide text-slate-400">${new Date(ev.fecha_fin + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
              ${diasText}
            </div>
            <p class="text-sm font-medium text-slate-900 truncate">${ev.accion}</p>
            <p class="text-xs text-slate-500">${ev.empleado_nombre} · ${ev.competencia_nombre}</p>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium mt-1 ${badgeCls}">${ESTADO_LABELS[ev.estado] ?? ev.estado}</span>
          </div>
        </div>`;
    }
    html += "</div>";
    return html;
  }

  function renderCircleProgress(pct: number, size: number = 48): string {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
    return `<svg width="${size}" height="${size}" class="shrink-0">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="4"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".35em" class="fill-slate-700" style="font-size:${size < 50 ? 9 : 10}px;font-weight:700">${Math.round(pct)}%</text>
    </svg>`;
  }

  function renderBrechasChart(competencias: CompetenciaResumenItem[]): string {
    const sorted = [...competencias].filter(c => c.gap > 0).sort((a, b) => b.brecha_pct - a.brecha_pct);
    if (sorted.length === 0) return `<p class="text-xs text-slate-400 italic">Sin brechas identificadas — todas las competencias alineadas</p>`;
    return `
      <div class="flex items-center gap-3 mb-2 text-[10px] text-slate-500">
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-2 rounded bg-slate-300/60"></span>Requerido</span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-2 rounded bg-blue-500"></span>Actual</span>
      </div>
      <div class="space-y-1.5">
      ${sorted.slice(0, 8).map(c => {
        const reqPct = (c.nivel_requerido / 4) * 100;
        const actPct = (c.nivel_actual / 4) * 100;
        const color = BAR_COLORS[c.severidad] ?? "bg-slate-400";
        return `<div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-600 w-36 truncate" title="${c.competencia_nombre}">${c.competencia_nombre}</span>
          <div class="flex-1 relative h-3 rounded bg-slate-100">
            <div class="absolute inset-y-0 left-0 rounded bg-slate-300/60" style="width:${reqPct}%"></div>
            <div class="absolute inset-y-0 left-0 rounded ${color}" style="width:${actPct}%"></div>
          </div>
          <span class="text-[10px] font-medium w-14 text-right ${c.gap > 0 ? "text-red-600" : "text-slate-500"}">Gap: ${c.gap > 0 ? "-" : ""}${c.gap.toFixed(1)}</span>
        </div>`;
      }).join("")}
      </div>`;
  }

  function renderRecomendaciones(empleadoId: number): string {
    if (state.recomendacionesLoading && state.expandedEmployeeId === empleadoId) {
      return '<div class="flex items-center gap-2 py-3 text-xs text-slate-400"><svg class="animate-spin size-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg> Generando recomendaciones...</div>';
    }
    if (!state.recomendaciones || state.recomendaciones.empleado_id !== empleadoId) {
      return '<div class="py-2 text-xs text-slate-400">Expandir para cargar recomendaciones</div>';
    }
    if (state.recomendaciones.recomendaciones.length === 0) {
      return '<div class="py-2 text-xs text-slate-400">Recomendaciones no disponibles</div>';
    }
    const PRIO_BADGE: Record<string, string> = { baja: "bg-slate-100 text-slate-600", media: "bg-amber-50 text-amber-700", alta: "bg-red-50 text-red-700" };
    return `<div class="grid gap-2 sm:grid-cols-3">${state.recomendaciones.recomendaciones.map(r => `
      <div class="rounded-lg border border-slate-200 p-3 text-xs">
        <p class="font-semibold text-slate-900 mb-1">${r.accion}</p>
        <p class="text-slate-500 mb-2">${r.justificacion}</p>
        <div class="flex items-center gap-1.5">
          <span class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">${r.tipo}</span>
          <span class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIO_BADGE[r.prioridad] ?? PRIO_BADGE.media}">${r.prioridad}</span>
        </div>
      </div>`).join("")}</div>`;
  }

  const WIZARD_TIPOS = ["E-Learning", "Presencial", "Mentoring", "Coaching", "Certificación", "Rotación"];

  function renderWizardModal(): string {
    if (!state.wizardOpen) return "";
    const { wizardStep: step, wizardData: d } = state;
    const stepLabels = ["Tipo Acción", "Detalles", "Recursos", "Confirmar"];
    const PRIO_OPTS: Array<{ v: "baja" | "media" | "alta"; l: string }> = [{ v: "baja", l: "Baja" }, { v: "media", l: "Media" }, { v: "alta", l: "Alta" }];

    const stepIndicator = `<div class="flex items-center justify-center gap-2 mb-6">${stepLabels.map((lbl, i) => {
      const n = i + 1;
      const active = n === step;
      const done = n < step;
      return `<div class="flex items-center gap-1.5">
        <div class="size-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-blue-600 text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}">${done ? "✓" : n}</div>
        <span class="text-xs ${active ? "text-slate-900 font-semibold" : "text-slate-400"} hidden sm:inline">${lbl}</span>
      </div>${i < 3 ? '<div class="w-6 h-px bg-slate-200"></div>' : ""}`;
    }).join("")}</div>`;

    let bodyHtml = "";
    if (step === 1) {
      bodyHtml = `
        <label class="block mb-3"><span class="text-xs font-medium text-slate-700">Tipo de acción *</span>
          <select data-wizard-field="tipo" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            ${WIZARD_TIPOS.map(t => `<option value="${t}" ${d.tipo === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block"><span class="text-xs font-medium text-slate-700">Fecha inicio *</span>
            <input type="date" data-wizard-field="fecha_inicio" value="${d.fecha_inicio}" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"/>
          </label>
          <label class="block"><span class="text-xs font-medium text-slate-700">Fecha fin *</span>
            <input type="date" data-wizard-field="fecha_fin" value="${d.fecha_fin}" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"/>
          </label>
        </div>`;
    } else if (step === 2) {
      bodyHtml = `
        <label class="block mb-3"><span class="text-xs font-medium text-slate-700">Nombre de la acción *</span>
          <input type="text" data-wizard-field="accion" value="${d.accion}" placeholder="Ej: Curso de soldadura avanzada" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"/>
        </label>
        <div class="mb-3"><span class="text-xs font-medium text-slate-700 block mb-1.5">Prioridad *</span>
          <div class="inline-flex rounded-lg border border-slate-200 p-0.5">${PRIO_OPTS.map(p =>
            `<button type="button" data-wizard-field="prioridad" data-value="${p.v}" class="px-4 py-1.5 text-xs font-semibold rounded-md transition ${d.prioridad === p.v ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}">${p.l}</button>`
          ).join("")}</div>
        </div>`;
    } else if (step === 3) {
      bodyHtml = `
        <label class="block mb-3"><span class="text-xs font-medium text-slate-700">Recursos asignados</span>
          <textarea data-wizard-field="recursos" rows="2" placeholder="Presupuesto, materiales, herramientas..." class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">${d.recursos}</textarea>
        </label>
        <label class="block mb-3"><span class="text-xs font-medium text-slate-700">Competencia vinculada *</span>
          <select data-wizard-field="competencia_id" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            ${state.competenciasOptions.map(c => `<option value="${c.id}" ${d.competencia_id === String(c.id) ? "selected" : ""}>${c.nombre}</option>`).join("")}
          </select>
        </label>
        <label class="block"><span class="text-xs font-medium text-slate-700">Responsable *</span>
          <input type="text" data-wizard-field="responsable" value="${d.responsable}" placeholder="Nombre o área responsable" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"/>
        </label>`;
    } else {
      const PRIO_CLS: Record<string, string> = { baja: "bg-slate-100 text-slate-600", media: "bg-amber-50 text-amber-700", alta: "bg-red-50 text-red-700" };
      const compName = state.competenciasOptions.find(c => String(c.id) === d.competencia_id)?.nombre ?? "—";
      bodyHtml = `
        <div class="space-y-2 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><span class="text-slate-500">Tipo:</span> <span class="font-medium">${d.tipo}</span></div>
            <div><span class="text-slate-500">Prioridad:</span> <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIO_CLS[d.prioridad] ?? ""}">${d.prioridad}</span></div>
            <div><span class="text-slate-500">Inicio:</span> <span class="font-medium">${d.fecha_inicio}</span></div>
            <div><span class="text-slate-500">Fin:</span> <span class="font-medium">${d.fecha_fin}</span></div>
            <div class="col-span-2"><span class="text-slate-500">Acción:</span> <span class="font-medium">${d.accion}</span></div>
            <div><span class="text-slate-500">Competencia:</span> <span class="font-medium">${compName}</span></div>
            <div><span class="text-slate-500">Responsable:</span> <span class="font-medium">${d.responsable}</span></div>
            ${d.recursos ? `<div class="col-span-2"><span class="text-slate-500">Recursos:</span> <span class="font-medium">${d.recursos}</span></div>` : ""}
          </div>
        </div>`;
    }

    return `
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]" data-action="wizard-backdrop">
        <div class="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onclick="event.stopPropagation()">
          <button type="button" data-action="wizard-close" class="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h2 class="text-base font-bold text-slate-900 mb-4">Asignar Acción de Desarrollo</h2>
          ${stepIndicator}
          ${bodyHtml}
          <div class="flex justify-between mt-6 pt-4 border-t border-slate-100">
            <button type="button" data-action="wizard-prev" class="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition ${step === 1 ? "invisible" : ""}">Anterior</button>
            ${step < 4
              ? `<button type="button" data-action="wizard-next" class="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition">Siguiente</button>`
              : `<button type="button" data-action="wizard-submit" class="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition">Crear Acción</button>`}
          </div>
        </div>
      </div>`;
  }

  function renderExpandedCard(emp: EquipoResumenEmpleadoItem): string {
    const initials = emp.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
    const loadingOrData = state.expandedData && state.expandedData.empleado_id === emp.empleado_id;
    return `
      <div class="mx-3 my-2 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-start gap-4 mb-4">
          <div class="size-12 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">${initials}</div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold text-slate-900">${emp.nombre}</h3>
            <p class="text-xs text-slate-500">${emp.puesto_nombre ?? "—"} · No. ${emp.no_empleado}</p>
          </div>
          ${renderCircleProgress(emp.progreso_pct, 52)}
          <div class="text-right shrink-0">
            <p class="text-[10px] uppercase tracking-wide text-slate-400">Competencias</p>
            <p class="text-sm font-bold text-slate-900">${emp.score_competencias}</p>
            <p class="text-[10px] uppercase tracking-wide text-slate-400 mt-1">Cumplimiento</p>
            <p class="text-sm font-bold text-slate-900">${emp.evaluacion_general_prom}%</p>
          </div>
        </div>
        <div class="border-t border-slate-100 pt-3">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Analisis de Brechas Competenciales</h4>
          ${loadingOrData ? renderBrechasChart(state.expandedData!.competencias) : '<div class="flex items-center justify-center py-4 text-xs text-slate-400">Cargando brechas...</div>'}
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Recomendaciones AI</h4>
          ${renderRecomendaciones(emp.empleado_id)}
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button type="button" data-action="open-wizard-emp" data-empleado-id="${emp.empleado_id}" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition">
            <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Asignar Accion
          </button>
          <a href="#/evaluaciones/empleado/${emp.empleado_id}" class="text-xs font-medium text-blue-600 hover:text-blue-800">Ver perfil completo →</a>
        </div>
      </div>`;
  }

  function renderTeamSummary(): string {
    const { equipoResumen } = state;
    if (state.loading) return `<div class="flex items-center justify-center py-12 text-sm text-slate-500">Cargando...</div>`;
    if (equipoResumen.items.length === 0) return `<div class="px-3 py-8 text-center text-sm text-slate-400">Sin datos de equipo</div>`;
    return `
      <div class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-[900px] w-full text-left">
          <thead class="border-b border-slate-200 shadow-sm">
            <tr>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Colaborador</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Estatus PDI</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Brechas Criticas</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-left text-xs font-semibold uppercase text-white">Ultima Actualizacion</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white">Score</th>
              <th class="sticky top-0 z-20 bg-[#0A1628] px-3 py-2 text-center text-xs font-semibold uppercase text-white w-12"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${equipoResumen.items.map(emp => {
              const initials = emp.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
              const estCfg = ESTATUS_PDI[emp.estatus_pdi] ?? ESTATUS_PDI.sin_acciones;
              const isExpanded = state.expandedEmployeeId === emp.empleado_id;
              return `
            <tr class="hover:bg-blue-50/40 ${isExpanded ? "bg-blue-50/30" : ""}">
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2.5">
                  <div class="size-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">${initials}</div>
                  <div>
                    <p class="text-sm font-medium text-blue-700 cursor-pointer" data-action="go-empleado" data-id="${emp.empleado_id}">${emp.nombre}</p>
                    <p class="text-[11px] text-slate-500">${emp.puesto_nombre ?? emp.area_nombre ?? "—"}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5">
                <span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${estCfg.cls}">
                  <span class="size-1.5 rounded-full ${emp.estatus_pdi === "vencido" ? "bg-red-500" : emp.estatus_pdi === "en_proceso" ? "bg-blue-500" : emp.estatus_pdi === "completado" ? "bg-emerald-500" : emp.estatus_pdi === "pendiente" ? "bg-amber-500" : "bg-slate-400"}"></span>
                  ${estCfg.label}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex flex-wrap gap-1">
                  ${emp.brechas_criticas.length === 0
                    ? '<span class="text-[11px] text-slate-400 italic">Sin brechas criticas</span>'
                    : emp.brechas_criticas.slice(0, 3).map(b =>
                      `<span class="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${b.gap >= 2 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}">${b.competencia_nombre.length > 12 ? b.competencia_nombre.slice(0, 12) + "…" : b.competencia_nombre}</span>`
                    ).join("") + (emp.brechas_criticas.length > 3 ? `<span class="text-[10px] text-slate-400">+${emp.brechas_criticas.length - 3}</span>` : "")}
                </div>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-600">${emp.ultima_actualizacion ? new Date(emp.ultima_actualizacion).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
              <td class="px-3 py-2.5 text-center">
                <span class="text-xs font-semibold tabular-nums">${emp.score_competencias}</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <button type="button" data-action="expand-team-card" data-empleado-id="${emp.empleado_id}"
                  class="inline-flex items-center justify-center size-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                  <svg class="size-4 transition ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
              </td>
            </tr>
            ${isExpanded ? `<tr class="team-detail-row"><td colspan="6" class="p-0">${renderExpandedCard(emp)}</td></tr>` : ""}`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
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

        <div class="flex items-center justify-between mb-4">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 flex-1">
            ${kpiCard("total", "Total Acciones", resumen.total_acciones, "bg-slate-400")}
            ${kpiCard("completadas", "Completadas", resumen.completadas, "bg-emerald-500")}
            ${kpiCard("en_proceso", "En Proceso", resumen.en_proceso, "bg-blue-500")}
            ${kpiCard("vencidas", "Vencidas", resumen.vencidas, "bg-red-500")}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <div class="rounded-[14px] border border-slate-200/60 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Cumplimiento Plan</span>
            <p class="text-2xl font-bold tabular-nums text-slate-900 mt-1">${state.kpisAvanzados.cumplimiento_plan_pct.toFixed(1)}%</p>
          </div>
          <div class="rounded-[14px] border border-slate-200/60 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Inversion (hrs)</span>
            <p class="text-2xl font-bold tabular-nums text-slate-900 mt-1">${state.kpisAvanzados.inversion_horas_total}</p>
          </div>
          <div class="rounded-[14px] border border-slate-200/60 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Hrs/Empleado</span>
            <p class="text-2xl font-bold tabular-nums text-slate-900 mt-1">${state.kpisAvanzados.horas_training_promedio.toFixed(1)}</p>
          </div>
          <div class="rounded-[14px] border border-slate-200/60 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Skill Gap Prom</span>
            <p class="text-2xl font-bold tabular-nums text-slate-900 mt-1">${state.kpisAvanzados.promedio_skill_gap.toFixed(2)}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 mb-6">
          <button type="button" data-action="open-wizard" class="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition">
            <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Asignar Accion
          </button>
          <button type="button" data-action="export-pdf" class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            Exportar PDF
          </button>
          <button type="button" data-action="export-excel" class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            Exportar Excel
          </button>
          <button type="button" data-action="notificar-equipo" class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            Notificar Equipo
          </button>
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
          <button type="button" role="tab" data-action="toggle-view" data-view="team"
            aria-selected="${state.viewMode === "team"}"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${state.viewMode === "team" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}">
            Resumen del Equipo
          </button>
          <button type="button" role="tab" data-action="toggle-view" data-view="heatmap"
            aria-selected="${state.viewMode === "heatmap"}"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${state.viewMode === "heatmap" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}">
            Mapa de Calor
          </button>
          <button type="button" role="tab" data-action="toggle-view" data-view="timeline"
            aria-selected="${state.viewMode === "timeline"}"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${state.viewMode === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}">
            Timeline
          </button>
        </div>

        ${renderViewContent()}
      </div>
      ${renderWizardModal()}
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
      const view = target.dataset.view as State["viewMode"];
      if (view && view !== state.viewMode) {
        state.viewMode = view;
        if (view === "employees") {
          void loadProgresoEquipo();
        } else if (view === "team") {
          void loadEquipoResumen();
        } else if (view === "heatmap") {
          void loadHeatmap();
        } else if (view === "timeline") {
          void loadTimeline();
        } else {
          render();
        }
      }
    }

    if (action === "expand-team-card") {
      const empId = Number(target.dataset.empleadoId);
      if (state.expandedEmployeeId === empId) {
        state.expandedEmployeeId = null;
        state.expandedData = null;
        state.recomendaciones = null;
        render();
      } else {
        state.expandedEmployeeId = empId;
        state.expandedData = null;
        state.recomendaciones = null;
        state.recomendacionesLoading = true;
        render();
        void getEmpleadoResumen(empId).then(data => {
          if (data && state.expandedEmployeeId === empId) {
            state.expandedData = data;
            render();
          }
        });
        void getPDIRecomendaciones(empId).then(data => {
          if (state.expandedEmployeeId === empId) {
            state.recomendaciones = data;
            state.recomendacionesLoading = false;
            render();
          }
        });
      }
    }

    if (action === "open-wizard" || action === "open-wizard-emp") {
      const empId = target.dataset.empleadoId ? Number(target.dataset.empleadoId) : null;
      state.wizardEmpleadoId = empId;
      state.wizardStep = 1;
      state.wizardData = { tipo: "", fecha_inicio: "", fecha_fin: "", accion: "", prioridad: "media", recursos: "", competencia_id: "", responsable: "" };
      state.wizardOpen = true;
      if (state.competenciasOptions.length === 0) {
        void fetchWithAuth("/api/v1/competencias?limit=200").then(async res => {
          if (res.ok) {
            const data = await res.json();
            state.competenciasOptions = (data.items ?? data ?? []).map((c: { id: number; nombre: string }) => ({ id: c.id, nombre: c.nombre }));
            render();
          }
        });
      }
      render();
    }

    if (action === "wizard-close" || action === "wizard-backdrop") {
      state.wizardOpen = false;
      render();
    }

    if (action === "wizard-prev" && state.wizardStep > 1) {
      state.wizardStep--;
      render();
    }

    if (action === "wizard-next") {
      const d = state.wizardData;
      if (state.wizardStep === 1 && (!d.tipo || !d.fecha_inicio || !d.fecha_fin)) return;
      if (state.wizardStep === 2 && !d.accion) return;
      if (state.wizardStep === 3 && (!d.competencia_id || !d.responsable)) return;
      state.wizardStep++;
      render();
    }

    if (action === "wizard-submit") {
      const d = state.wizardData;
      if (!state.wizardEmpleadoId || !d.competencia_id) return;
      const payload: PDICreatePayload = {
        competencia_id: Number(d.competencia_id),
        accion: d.accion,
        tipo: d.tipo,
        fecha_inicio: d.fecha_inicio,
        fecha_fin: d.fecha_fin,
        responsable: d.responsable,
        prioridad: d.prioridad,
        recursos: d.recursos || undefined,
      };
      void createPDI(state.wizardEmpleadoId, payload).then(result => {
        if (result) {
          state.wizardOpen = false;
          void Promise.all([loadResumen(), loadItems()]);
        }
      });
    }

    if (target.dataset.wizardField === "prioridad") {
      const val = target.dataset.value as "baja" | "media" | "alta";
      if (val) {
        state.wizardData.prioridad = val;
        render();
      }
    }

    if (action === "export-pdf") {
      void exportPDI("pdf");
    }
    if (action === "export-excel") {
      void exportPDI("excel");
    }

    if (action === "notificar-equipo") {
      if (confirm("¿Notificar a todos los empleados con acciones pendientes?")) {
        void notificarEquipoPDI().then(res => {
          if (res.notificaciones_creadas > 0) {
            alert(`Se notificó a ${res.empleados_notificados} empleado(s).`);
          }
        });
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
    const wizField = target.dataset.wizardField;
    if (wizField && state.wizardOpen) {
      const val = (target as HTMLSelectElement | HTMLInputElement).value;
      (state.wizardData as Record<string, string>)[wizField] = val;
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
    const wizField = target.dataset.wizardField;
    if (wizField && state.wizardOpen) {
      const val = (target as HTMLInputElement | HTMLTextAreaElement).value;
      (state.wizardData as Record<string, string>)[wizField] = val;
    }
  }, { signal });

  void Promise.all([loadAreas(), loadResumen()]).then(() => loadItems());
}
