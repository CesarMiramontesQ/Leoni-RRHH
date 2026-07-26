import { mountAppShell } from "../layouts/appShell.ts";
import { fetchWithAuth } from "../api/http.ts";
import { hashParamNumero, hashParamTexto, hashSinParams } from "../utils/hashQuery.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertSuccess,
  badgeApproved,
  badgeCancelled,
  badgeInProgress,
  badgePending,
  badgeRejected,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FORM_LABEL,
  FORM_SELECT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  pageHeading,
  renderTabNav,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import {
  TALENTO_KPI_ICONS,
  talentoEyebrow,
  talentoKpiCard,
  talentoKpiGrid,
  talentoKpiSkeleton,
  type TalentoKpiAccent,
} from "../talento/pageKit.ts";
import {
  getPDIGestion,
  getPDIResumen,
  patchPDIEstado,
  getPDIProgresoEquipo,
  getPDIEquipoResumen,
  getPDIHeatmap,
  getPDITimeline,
  getEmpleadoResumen,
  getEmpleadosConPerfil,
  createPDI,
  getPDIKpisAvanzados,
  getPDIRecomendaciones,
  getPDIFilterOptions,
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

interface WizardEmpleadoOption {
  id: number;
  nombre: string;
  label: string;
  noEmpleado: number | null;
}

interface State {
  resumen: PDIResumenResponse;
  data: PDIGestionListResponse;
  areas: AreaOption[];
  puestosPerfil: AreaOption[];
  filters: {
    area_id: string;
    puesto_perfil_id: string;
    estado: string;
    fecha_inicio: string;
    fecha_fin: string;
    search: string;
  };
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
  wizardEmpleadoNombre: string | null;
  wizardEmpleadoOptions: WizardEmpleadoOption[];
  wizardEmpleadoLoading: boolean;
  wizardEmpleadoQuery: string;
  wizardCompetenciaQuery: string;
  competenciasLoading: boolean;
  wizardError: string | null;
  wizardData: WizardData;
  competenciasOptions: { id: number; nombre: string }[];
  flash: { type: "success" | "error"; message: string } | null;
  resumenLoading: boolean;
}

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

const ESTATUS_PDI: Record<string, { badge: (label: string) => string; label: string }> = {
  vencido: { badge: badgeRejected, label: "Vencido" },
  pendiente: { badge: badgePending, label: "Pendiente" },
  en_proceso: { badge: (l) => badgeInProgress(l), label: "En desarrollo" },
  completado: { badge: badgeApproved, label: "Completado" },
  sin_acciones: { badge: badgeCancelled, label: "Sin acciones" },
};

const BAR_COLORS: Record<string, string> = {
  alineado: "bg-emerald-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  critica: "bg-red-500",
};

const VIEW_TABS = [
  { id: "actions", label: "Acciones" },
  { id: "employees", label: "Por empleado" },
  { id: "team", label: "Resumen equipo" },
  { id: "heatmap", label: "Mapa de calor" },
  { id: "timeline", label: "Timeline" },
] as const;

function emptyPanel(message: string): string {
  return `<div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center text-sm text-text-muted">${escapeHtml(message)}</div>`;
}

function badgeHtml(item: PDIGestionItem): string {
  if (item.vencida) return badgeRejected("Vencida");
  switch (item.estado) {
    case "completado":
      return badgeApproved(ESTADO_LABELS.completado);
    case "en_proceso":
      return badgeInProgress(ESTADO_LABELS.en_proceso);
    case "cancelado":
      return badgeCancelled(ESTADO_LABELS.cancelado);
    default:
      return badgePending(ESTADO_LABELS.pendiente);
  }
}

function statusCellHtml(item: PDIGestionItem): string {
  const nextStates = VALID_NEXT[item.estado] ?? [];
  if (item.vencida || nextStates.length === 0) {
    return badgeHtml(item);
  }
  return `<div class="grid min-w-[8.5rem]" onclick="event.stopPropagation()">
    <select data-action="change-pdi-estado" data-pdi-id="${item.id}" class="${FORM_SELECT} py-1.5 text-xs">
      <option value="${item.estado}" selected>${escapeHtml(ESTADO_LABELS[item.estado] ?? item.estado)}</option>
      ${nextStates.map((s) => `<option value="${s}">${escapeHtml(ESTADO_LABELS[s] ?? s)}</option>`).join("")}
    </select>
    ${SELECT_CHEVRON}
  </div>`;
}

export function mountGestionPdi(container: HTMLElement, signal: AbortSignal): void {
  const PAGE_SIZE = 10;

  const state: State = {
    resumen: { total_acciones: 0, completadas: 0, en_proceso: 0, pendientes: 0, vencidas: 0 },
    data: { items: [], total: 0, page: 1, page_size: PAGE_SIZE },
    areas: [],
    puestosPerfil: [],
    // `area_id` puede venir del deep-link `#/pdi-gestion?area_id=N` (enlaces
    // cruzados del Dashboard de Talento). `loadAreas` lo descarta si el área no
    // está entre las opciones del usuario.
    filters: {
      area_id: String(hashParamNumero("area_id") ?? ""),
      puesto_perfil_id: "",
      estado: "", fecha_inicio: "", fecha_fin: "", search: "",
    },
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
    wizardEmpleadoNombre: null,
    wizardEmpleadoOptions: [],
    wizardEmpleadoLoading: false,
    wizardEmpleadoQuery: "",
    wizardCompetenciaQuery: "",
    competenciasLoading: false,
    wizardError: null,
    wizardData: { tipo: "", fecha_inicio: "", fecha_fin: "", accion: "", prioridad: "media", recursos: "", competencia_id: "", responsable: "" },
    competenciasOptions: [],
    flash: null,
    resumenLoading: true,
  };

  mountAppShell(container, {
    activeNav: "pdi-gestion",
    mainHtml: `<div id="gestion-pdi-page" class="${RH_DASHBOARD_PAGE_SHELL}"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#gestion-pdi-page")!;

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let wizardEmpSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  let restoreWizardEmpSearchFocus = false;
  let wizardEmpSearchCaret = 0;
  let restoreWizardCompSearchFocus = false;
  let wizardCompSearchCaret = 0;

  function clearWizardDeepLink(): void {
    const next = hashSinParams([
      "wizard",
      "empleado_id",
      "empleado_nombre",
      "competencia_id",
      "accion",
      "prioridad",
    ]);
    if (next !== window.location.hash) {
      window.history.replaceState(null, "", next);
    }
  }

  async function ensureCompetenciasOptions(): Promise<void> {
    if (state.competenciasOptions.length > 0) return;
    state.competenciasLoading = true;
    if (state.wizardOpen) restoreWizardCompSearchFocus = true;
    render();
    try {
      const res = await fetchWithAuth("/api/v1/competencias?limit=200");
      if (!res.ok) return;
      const data = await res.json();
      state.competenciasOptions = (data.items ?? data ?? [])
        .map((c: { id: number; nombre: string }) => ({
          id: c.id,
          nombre: c.nombre,
        }))
        .sort((a: { nombre: string }, b: { nombre: string }) =>
          a.nombre.localeCompare(b.nombre, "es"),
        );
    } finally {
      state.competenciasLoading = false;
    }
  }

  function filterWizardCompetencias(q: string): { id: number; nombre: string }[] {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return state.competenciasOptions
      .filter((c) => c.nombre.toLowerCase().includes(t))
      .slice(0, 12);
  }

  async function ensureWizardEmpleados(): Promise<void> {
    if (state.wizardEmpleadoOptions.length > 0) return;
    state.wizardEmpleadoLoading = true;
    if (state.wizardOpen) restoreWizardEmpSearchFocus = true;
    render();
    try {
      const list = await getEmpleadosConPerfil();
      state.wizardEmpleadoOptions = list
        .map((e) => {
          const parts = [e.empleado_nombre, e.puesto_nombre, e.area_nombre].filter(Boolean) as string[];
          return {
            id: e.empleado_id,
            nombre: e.empleado_nombre,
            label: parts.join(" · "),
            noEmpleado: e.no_empleado,
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    } catch {
      state.wizardEmpleadoOptions = [];
    } finally {
      state.wizardEmpleadoLoading = false;
    }
  }

  function filterWizardEmpleados(q: string): WizardEmpleadoOption[] {
    const t = q.trim().toLowerCase();
    const soloNumero = /^\d+$/.test(t);
    if (t.length < (soloNumero ? 1 : 2)) return [];
    return state.wizardEmpleadoOptions
      .filter((o) => {
        if (o.nombre.toLowerCase().includes(t)) return true;
        if (o.label.toLowerCase().includes(t)) return true;
        if (o.noEmpleado != null && String(o.noEmpleado).includes(t)) return true;
        return false;
      })
      .slice(0, 12);
  }

  function openWizard(opts?: {
    empleadoId?: number | null;
    empleadoNombre?: string | null;
    competenciaId?: number | null;
    accion?: string;
    prioridad?: "baja" | "media" | "alta";
  }): void {
    const competenciaId = opts?.competenciaId ?? null;
    const prioridad = opts?.prioridad ?? "media";
    let accion = opts?.accion?.trim() ?? "";
    if (!accion && competenciaId != null) {
      const nombre = state.competenciasOptions.find((c) => c.id === competenciaId)?.nombre;
      if (nombre) accion = `Desarrollar: ${nombre}`;
    }
    state.wizardEmpleadoId = opts?.empleadoId ?? null;
    state.wizardEmpleadoNombre = opts?.empleadoNombre?.trim() || null;
    state.wizardEmpleadoQuery = "";
    state.wizardCompetenciaQuery = "";
    state.wizardError = null;
    state.wizardStep = 1;
    state.wizardData = {
      tipo: "",
      fecha_inicio: "",
      fecha_fin: "",
      accion,
      prioridad,
      recursos: "",
      competencia_id: competenciaId != null ? String(competenciaId) : "",
      responsable: "",
    };
    state.wizardOpen = true;
    void ensureCompetenciasOptions().then(() => {
      if (!state.wizardOpen) return;
      if (!state.wizardData.accion && competenciaId != null) {
        const nombre = state.competenciasOptions.find((c) => c.id === competenciaId)?.nombre;
        if (nombre) state.wizardData.accion = `Desarrollar: ${nombre}`;
      }
      if (state.wizardEmpleadoId != null && !state.wizardEmpleadoNombre) {
        const found = state.wizardEmpleadoOptions.find((o) => o.id === state.wizardEmpleadoId);
        if (found) state.wizardEmpleadoNombre = found.nombre;
      }
      render();
    });
    render();
  }

  function maybeOpenWizardFromHash(): void {
    if (hashParamTexto("wizard") !== "1") return;
    const empleadoId = hashParamNumero("empleado_id");
    if (empleadoId == null) {
      clearWizardDeepLink();
      return;
    }
    const competenciaId = hashParamNumero("competencia_id");
    const accion = hashParamTexto("accion") ?? undefined;
    const empleadoNombre = hashParamTexto("empleado_nombre");
    const prioridadRaw = hashParamTexto("prioridad");
    const prioridad =
      prioridadRaw === "alta" || prioridadRaw === "baja" || prioridadRaw === "media"
        ? prioridadRaw
        : "alta";
    clearWizardDeepLink();
    openWizard({ empleadoId, empleadoNombre, competenciaId, accion, prioridad });
  }

  async function loadAreas() {
    const res = await fetchWithAuth("/api/v1/competencias/filter-options");
    if (res.ok) {
      const data = await res.json();
      state.areas = (data.areas ?? []).map((a: { id: string; label: string }) => ({
        id: Number(a.id),
        label: a.label,
      }));
    }
    // Un `area_id` del deep-link que no esté en las opciones del usuario se
    // descarta: dejarlo filtraría la consulta por un área que no puede ver y la
    // pantalla saldría vacía sin que el select mostrara por qué.
    if (state.filters.area_id && !state.areas.some((a) => a.id === Number(state.filters.area_id))) {
      state.filters.area_id = "";
    }
    await loadPuestosPerfilOptions();
  }

  async function loadPuestosPerfilOptions(): Promise<void> {
    const areaId = state.filters.area_id ? Number(state.filters.area_id) : undefined;
    const data = await getPDIFilterOptions(areaId ? { area_id: areaId } : undefined);
    state.puestosPerfil = (data.puestos_perfil ?? []).map((p) => ({
      id: Number(p.id),
      label: p.label,
    }));
    if (
      state.filters.puesto_perfil_id &&
      !state.puestosPerfil.some((p) => p.id === Number(state.filters.puesto_perfil_id))
    ) {
      state.filters.puesto_perfil_id = "";
    }
  }

  function scopeFilterParams(): { area_id?: number; puesto_perfil_id?: number } {
    const params: { area_id?: number; puesto_perfil_id?: number } = {};
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    if (state.filters.puesto_perfil_id) {
      params.puesto_perfil_id = Number(state.filters.puesto_perfil_id);
    }
    return params;
  }

  async function loadResumen() {
    state.resumenLoading = true;
    render();
    state.resumen = await getPDIResumen();
    state.kpisAvanzados = await getPDIKpisAvanzados(scopeFilterParams());
    state.resumenLoading = false;
    render();
  }

  async function loadItems() {
    state.loading = true;
    render();
    const params: Parameters<typeof getPDIGestion>[0] = {
      page: state.page,
      page_size: PAGE_SIZE,
      ...scopeFilterParams(),
    };
    if (state.filters.estado) params.estado = state.filters.estado;
    if (state.filters.fecha_inicio) params.fecha_inicio = state.filters.fecha_inicio;
    if (state.filters.fecha_fin) params.fecha_fin = state.filters.fecha_fin;
    if (state.filters.search) params.search = state.filters.search;
    if (state.soloVencidas) params.solo_vencidas = true;
    state.data = await getPDIGestion(params);
    state.loading = false;
    render();
  }

  function kpiFilterCard(
    key: string,
    label: string,
    count: number,
    accent: TalentoKpiAccent,
    icon: string,
  ): string {
    const active = state.activeKpi === key;
    return `<button type="button" data-action="kpi-filter" data-kpi="${key}" aria-pressed="${active}"
      class="rh-dash-kpi-card rounded-[18px] p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 ${active ? "ring-2 ring-accent/45" : "hover:border-accent/30"}">
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs font-semibold text-text-muted">${escapeHtml(label)}</p>
        <span class="rh-dash-kpi-icon rh-dash-kpi-icon--${accent} size-11 shrink-0 [&_svg]:size-5">${icon}</span>
      </div>
      <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${count}</p>
    </button>`;
  }

  function renderKpiSection(): string {
    if (state.resumenLoading) {
      return `${talentoKpiGrid(Array.from({ length: 4 }, () => talentoKpiSkeleton()).join(""), { ariaLabel: "Cargando indicadores" })}
        ${talentoKpiGrid(Array.from({ length: 4 }, () => talentoKpiSkeleton()).join(""), { ariaLabel: "Cargando métricas" })}`;
    }
    const { resumen, kpisAvanzados } = state;
    const filterRow = talentoKpiGrid(
      [
        kpiFilterCard("total", "Total acciones", resumen.total_acciones, "slate", TALENTO_KPI_ICONS.document),
        kpiFilterCard("completadas", "Completadas", resumen.completadas, "blue", TALENTO_KPI_ICONS.target),
        kpiFilterCard("en_proceso", "En proceso", resumen.en_proceso, "sky", TALENTO_KPI_ICONS.wrench),
        kpiFilterCard("vencidas", "Vencidas", resumen.vencidas, "red", TALENTO_KPI_ICONS.alert),
      ].join(""),
      { ariaLabel: "Filtros por estado de acciones PDI" },
    );
    const metricsRow = talentoKpiGrid(
      [
        talentoKpiCard({
          label: "Cumplimiento plan",
          value: `${kpisAvanzados.cumplimiento_plan_pct.toFixed(1)}%`,
          accent: "blue",
          icon: TALENTO_KPI_ICONS.chart,
        }),
        talentoKpiCard({
          label: "Inversión (hrs)",
          value: String(kpisAvanzados.inversion_horas_total),
          accent: "violet",
          icon: TALENTO_KPI_ICONS.academic,
        }),
        talentoKpiCard({
          label: "Hrs / empleado",
          value: kpisAvanzados.horas_training_promedio.toFixed(1),
          accent: "sky",
          icon: TALENTO_KPI_ICONS.users,
        }),
        talentoKpiCard({
          label: "Skill gap prom.",
          value: kpisAvanzados.promedio_skill_gap.toFixed(2),
          accent: "amber",
          icon: TALENTO_KPI_ICONS.grid,
        }),
      ].join(""),
      { ariaLabel: "Métricas avanzadas PDI" },
    );
    return `${filterRow}${metricsRow}`;
  }

  function filterField(label: string, controlHtml: string): string {
    return `<div class="${FILTER_FIELD_WRAP_LOCAL}"><label class="${FORM_LABEL}">${escapeHtml(label)}</label>${controlHtml}</div>`;
  }

  /** Ancho cómodo para filtros en fila (mismo patrón que listados RH). */
  const FILTER_FIELD_WRAP_LOCAL = "flex min-w-[9rem] flex-1 flex-col sm:max-w-[12rem]";

  /** Filtros de contexto (área / puesto) visibles en todas las vistas. */
  function renderGlobalFilters(): string {
    const { areas, puestosPerfil, filters } = state;
    return `
      <div class="flex flex-wrap items-end gap-3" data-filters="global">
        ${filterField(
          "Área",
          `<div class="grid w-full"><select data-action="filter-global" data-field="area_id" class="${FORM_SELECT}">
            <option value="">Todas</option>
            ${areas.map((a) => `<option value="${a.id}" ${filters.area_id === String(a.id) ? "selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}
          </select>${SELECT_CHEVRON}</div>`,
        )}
        ${filterField(
          "Puesto",
          `<div class="grid w-full"><select data-action="filter-global" data-field="puesto_perfil_id" class="${FORM_SELECT}">
            <option value="">Todos</option>
            ${puestosPerfil.map((p) => `<option value="${p.id}" ${filters.puesto_perfil_id === String(p.id) ? "selected" : ""}>${escapeHtml(p.label)}</option>`).join("")}
          </select>${SELECT_CHEVRON}</div>`,
        )}
      </div>`;
  }

  /** Filtros solo de la pestaña Acciones (estado, fechas, búsqueda). */
  function renderActionsFilters(): string {
    const { filters } = state;
    return `
      <div class="flex flex-wrap items-end gap-3" data-filters="actions">
        ${filterField(
          "Estado",
          `<div class="grid w-full"><select data-action="filter" data-field="estado" class="${FORM_SELECT}">
            <option value="">Todos</option>
            <option value="pendiente" ${filters.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="en_proceso" ${filters.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
            <option value="completado" ${filters.estado === "completado" ? "selected" : ""}>Completado</option>
            <option value="cancelado" ${filters.estado === "cancelado" ? "selected" : ""}>Cancelado</option>
          </select>${SELECT_CHEVRON}</div>`,
        )}
        ${filterField(
          "Desde",
          `<input type="date" data-action="filter" data-field="fecha_inicio" value="${escapeHtml(filters.fecha_inicio)}" class="${FIELD_INPUT}" />`,
        )}
        ${filterField(
          "Hasta",
          `<input type="date" data-action="filter" data-field="fecha_fin" value="${escapeHtml(filters.fecha_fin)}" class="${FIELD_INPUT}" />`,
        )}
        ${filterField(
          "Buscar",
          `<input type="search" data-action="search" placeholder="Nombre empleado…" value="${escapeHtml(filters.search)}" class="${FIELD_INPUT} min-w-[12rem]" />`,
        )}
      </div>`;
  }

  function reloadCurrentView(): void {
    state.page = 1;
    void loadResumen();
    switch (state.viewMode) {
      case "employees":
        void loadProgresoEquipo();
        break;
      case "team":
        void loadEquipoResumen();
        break;
      case "heatmap":
        void loadHeatmap();
        break;
      case "timeline":
        void loadTimeline();
        break;
      default:
        void loadItems();
        break;
    }
  }

  function renderActionsTable(): string {
    const { data } = state;
    const from = data.total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
    const to = Math.min(state.page * PAGE_SIZE, data.total);
    const totalPages = Math.ceil(data.total / PAGE_SIZE);

    const tableBody = state.loading
      ? skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando acciones PDI…" })
      : data.items.length === 0
        ? emptyPanel("Sin resultados para los filtros seleccionados.")
        : `<section class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-[920px] w-full text-left">
            <thead class="${RH_TABLE_HEAD}">
              <tr>
                <th class="px-4 py-3">Empleado</th>
                <th class="px-4 py-3">Área</th>
                <th class="px-4 py-3">Competencia</th>
                <th class="px-4 py-3">Acción</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Periodo</th>
                <th class="px-4 py-3">Responsable</th>
                <th class="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${data.items
                .map(
                  (item) => `
              <tr class="cursor-pointer transition hover:bg-slate-50/80 ${item.vencida ? "shadow-[inset_3px_0_0_0_var(--color-danger)]" : ""}" data-action="go-empleado" data-id="${item.empleado_id}">
                <td class="px-4 py-3 text-sm font-medium text-accent">${escapeHtml(item.empleado_nombre)}</td>
                <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(item.area_nombre ?? "—")}</td>
                <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(item.competencia_nombre)}</td>
                <td class="max-w-[180px] truncate px-4 py-3 text-sm text-text-primary" title="${escapeHtml(item.accion)}">${escapeHtml(item.accion)}</td>
                <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(item.tipo)}</td>
                <td class="whitespace-nowrap px-4 py-3 text-sm text-text-secondary">${escapeHtml(item.fecha_inicio)} — ${escapeHtml(item.fecha_fin)}</td>
                <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(item.responsable)}</td>
                <td class="px-4 py-3">${statusCellHtml(item)}</td>
              </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>`;

    const pager =
      !state.loading && data.total > 0
        ? `<div class="flex items-center justify-between text-sm text-text-secondary">
        <span>Mostrando ${from}–${to} de ${data.total}</span>
        <div class="flex gap-2">
          <button type="button" data-action="prev-page" ${state.page <= 1 ? "disabled" : ""} class="${BTN_SECONDARY} disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
          <button type="button" data-action="next-page" ${state.page >= totalPages ? "disabled" : ""} class="${BTN_SECONDARY} disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
        </div>
      </div>`
        : "";

    return `<div class="flex flex-col gap-4">${renderActionsFilters()}${tableBody}${pager}</div>`;
  }

  function renderEmployeeView(): string {
    const { progresoEquipo } = state;
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando progreso…" });
    }
    if (progresoEquipo.items.length === 0) return emptyPanel("Sin datos de progreso para el filtro actual.");
    return `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-[700px] w-full text-left">
            <thead class="${RH_TABLE_HEAD}">
              <tr>
                <th class="px-4 py-3">Empleado</th>
                <th class="px-4 py-3">Área</th>
                <th class="px-4 py-3">Progreso</th>
                <th class="px-4 py-3 text-center">Total</th>
                <th class="px-4 py-3 text-center">Completadas</th>
                <th class="px-4 py-3 text-center">En proceso</th>
                <th class="px-4 py-3 text-center">Pendientes</th>
                <th class="px-4 py-3 text-center">Vencidas</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${progresoEquipo.items
                .map((emp) => {
                  const barColor =
                    emp.progreso_pct >= 80 ? "bg-emerald-500" : emp.progreso_pct >= 50 ? "bg-accent" : "bg-amber-500";
                  return `
              <tr class="cursor-pointer transition hover:bg-slate-50/80" data-action="go-empleado" data-id="${emp.empleado_id}">
                <td class="px-4 py-3 text-sm font-medium text-accent">${escapeHtml(emp.empleado_nombre)}</td>
                <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(emp.area_nombre ?? "—")}</td>
                <td class="px-4 py-3">
                  <div class="flex min-w-[8rem] items-center gap-2">
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div class="h-full rounded-full ${barColor} transition-all" style="width:${emp.progreso_pct}%"></div>
                    </div>
                    <span class="w-9 text-right text-xs font-semibold tabular-nums text-text-primary">${Math.round(emp.progreso_pct)}%</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-center text-sm tabular-nums">${emp.total}</td>
                <td class="px-4 py-3 text-center text-sm tabular-nums text-emerald-700">${emp.completadas}</td>
                <td class="px-4 py-3 text-center text-sm tabular-nums text-accent">${emp.en_proceso}</td>
                <td class="px-4 py-3 text-center text-sm tabular-nums text-amber-700">${emp.pendientes}</td>
                <td class="px-4 py-3 text-center text-sm tabular-nums ${emp.vencidas > 0 ? "font-semibold text-red-700" : "text-text-secondary"}">${emp.vencidas}</td>
              </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  async function loadProgresoEquipo() {
    state.loading = true;
    render();
    state.progresoEquipo = await getPDIProgresoEquipo(scopeFilterParams());
    state.loading = false;
    render();
  }

  async function loadEquipoResumen() {
    state.loading = true;
    state.expandedEmployeeId = null;
    state.expandedData = null;
    render();
    state.equipoResumen = await getPDIEquipoResumen(scopeFilterParams());
    state.loading = false;
    render();
  }

  async function loadHeatmap() {
    state.loading = true;
    render();
    state.heatmapData = await getPDIHeatmap(scopeFilterParams());
    state.loading = false;
    render();
  }

  async function loadTimeline() {
    state.loading = true;
    render();
    state.timelineData = await getPDITimeline(scopeFilterParams());
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
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando mapa de calor…" });
    }
    if (heatmapData.empleados.length === 0 || heatmapData.competencias.length === 0) {
      return emptyPanel("Sin datos para el mapa de calor.");
    }

    const { competencias, empleados, matriz } = heatmapData;

    function cellColor(gap: number): string {
      if (gap === 0) return "bg-emerald-400";
      if (gap <= 1) return "bg-amber-400";
      if (gap < 2) return "bg-orange-500";
      return "bg-red-500";
    }

    return `
      <div class="flex flex-col gap-3">
        <section class="${RH_LISTADO_SURFACE} overflow-hidden">
          <div class="overflow-x-auto p-3 sm:p-4">
            <table class="border-collapse">
              <thead>
                <tr>
                  <th class="sticky left-0 z-30 min-w-[160px] border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-semibold text-text-muted">Competencia / Empl.</th>
                  ${empleados
                    .map((emp: HeatmapEmpleado) => {
                      const short = emp.nombre
                        .split(" ")
                        .slice(0, 2)
                        .map((w: string, i: number) => (i === 0 ? w : w[0] + "."))
                        .join(" ");
                      return `<th class="min-w-[36px] border-b border-slate-200 px-1 py-2 text-center">
                      <span class="block h-16 whitespace-nowrap text-[9px] font-medium text-text-muted [writing-mode:vertical-lr] rotate-180">${escapeHtml(short)}</span>
                    </th>`;
                    })
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${competencias
                  .map(
                    (comp) => `
                <tr>
                  <td class="sticky left-0 z-20 max-w-[160px] truncate border-r border-slate-100 bg-white px-3 py-1 text-[11px] text-text-primary" title="${escapeHtml(comp.competencia_nombre)}">${escapeHtml(comp.competencia_nombre)}</td>
                  ${empleados
                    .map((emp: HeatmapEmpleado) => {
                      const cell = matriz[String(emp.empleado_id)]?.[String(comp.competencia_id)];
                      if (!cell) {
                        return `<td class="px-1 py-1"><div class="mx-auto size-7 rounded bg-slate-100" title="N/A"></div></td>`;
                      }
                      const color = cellColor(cell.gap);
                      return `<td class="px-1 py-1"><div class="mx-auto size-7 cursor-default rounded ${color}" title="${escapeHtml(comp.competencia_nombre)} · ${escapeHtml(emp.nombre)}\nReq: ${cell.nivel_requerido} / Act: ${cell.nivel_actual} (Gap: ${cell.gap})"></div></td>`;
                    })
                    .join("")}
                </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
        <div class="flex flex-wrap items-center gap-4 text-[10px] text-text-muted">
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-emerald-400"></span>Alineado (0)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-amber-400"></span>Moderado (0.5–1)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-orange-500"></span>Alto (1–2)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded bg-red-500"></span>Crítico (2+)</span>
          <span class="flex items-center gap-1"><span class="inline-block size-3 rounded border border-border bg-slate-100"></span>N/A</span>
        </div>
      </div>`;
  }

  function renderTimeline(): string {
    const { timelineData } = state;
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando timeline…" });
    }
    if (timelineData.eventos.length === 0) {
      return emptyPanel("Sin eventos en los próximos 30 días.");
    }

    function dotColor(ev: TimelineEvent): string {
      if (ev.estado === "completado") return "bg-emerald-500";
      if (ev.vencida) return "bg-red-500";
      if (ev.dias_restantes !== null && ev.dias_restantes <= 7) return "bg-orange-500";
      return "bg-accent";
    }

    function groupLabel(fechaStr: string): string {
      const fecha = new Date(fechaStr + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((fecha.getTime() - today.getTime()) / 86400000);
      if (diff < 0) return "Vencidas";
      if (diff === 0) return "Hoy";
      if (diff <= 7) return "Esta semana";
      if (diff <= 14) return "Próxima semana";
      return "Próximo mes";
    }

    function estadoBadge(estado: string): string {
      switch (estado) {
        case "completado":
          return badgeApproved(ESTADO_LABELS.completado);
        case "en_proceso":
          return badgeInProgress(ESTADO_LABELS.en_proceso);
        case "cancelado":
          return badgeCancelled(ESTADO_LABELS.cancelado);
        default:
          return badgePending(ESTADO_LABELS.pendiente);
      }
    }

    let currentGroup = "";
    let html = `<section class="${RH_LISTADO_SURFACE} px-4 py-3 sm:px-5"><div class="relative space-y-0">`;

    for (const ev of timelineData.eventos) {
      const group = groupLabel(ev.fecha_fin);
      if (group !== currentGroup) {
        currentGroup = group;
        html += `<div class="pb-1 pt-3"><span class="text-[10px] font-semibold uppercase tracking-wider ${group === "Vencidas" ? "text-red-700" : "text-text-muted"}">${escapeHtml(group)}</span></div>`;
      }

      const diasText = ev.vencida
        ? `<span class="text-[10px] font-medium text-red-700">Vencida hace ${Math.abs(ev.dias_restantes ?? 0)} días</span>`
        : ev.dias_restantes !== null
          ? `<span class="text-[10px] text-text-muted">${ev.dias_restantes} días restantes</span>`
          : "";

      html += `
        <div class="flex gap-3 py-2 pl-1">
          <div class="flex flex-col items-center">
            <div class="mt-1.5 size-2.5 shrink-0 rounded-full ${dotColor(ev)}"></div>
            <div class="w-px flex-1 bg-slate-200"></div>
          </div>
          <div class="min-w-0 flex-1 pb-2">
            <div class="mb-0.5 flex items-center gap-2">
              <span class="text-[10px] uppercase tracking-wide text-text-muted">${new Date(ev.fecha_fin + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
              ${diasText}
            </div>
            <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(ev.accion)}</p>
            <p class="text-xs text-text-secondary">${escapeHtml(ev.empleado_nombre)} · ${escapeHtml(ev.competencia_nombre)}</p>
            <div class="mt-1">${estadoBadge(ev.estado)}</div>
          </div>
        </div>`;
    }
    html += "</div></section>";
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
      return skeletonBlock({ className: "h-20 rounded-xl", label: "Generando recomendaciones…" });
    }
    if (!state.recomendaciones || state.recomendaciones.empleado_id !== empleadoId) {
      return '<p class="py-2 text-xs text-text-muted">Expandir para cargar recomendaciones</p>';
    }
    if (state.recomendaciones.recomendaciones.length === 0) {
      return '<p class="py-2 text-xs text-text-muted">Recomendaciones no disponibles</p>';
    }
    return `<div class="grid gap-2 sm:grid-cols-3">${state.recomendaciones.recomendaciones
      .map(
        (r) => `
      <div class="rounded-lg border border-border bg-white p-3 text-xs">
        <p class="mb-1 font-semibold text-text-primary">${escapeHtml(r.accion)}</p>
        <p class="mb-2 text-text-secondary">${escapeHtml(r.justificacion)}</p>
        <div class="flex items-center gap-1.5">
          ${badgeInProgress(r.tipo)}
          ${r.prioridad === "alta" ? badgeRejected(r.prioridad) : r.prioridad === "baja" ? badgeCancelled(r.prioridad) : badgePending(r.prioridad)}
        </div>
      </div>`,
      )
      .join("")}</div>`;
  }

  const WIZARD_TIPOS = ["E-Learning", "Presencial", "Mentoring", "Coaching", "Certificación", "Rotación"];

  function renderWizardEmpleadoField(): string {
    if (state.wizardEmpleadoId != null) {
      const label =
        state.wizardEmpleadoNombre ??
        state.wizardEmpleadoOptions.find((o) => o.id === state.wizardEmpleadoId)?.nombre ??
        `Empleado #${state.wizardEmpleadoId}`;
      const noEmp = state.wizardEmpleadoOptions.find((o) => o.id === state.wizardEmpleadoId)?.noEmpleado;
      return `<div class="mb-4">
        <span class="${FORM_LABEL}">Colaborador *</span>
        <div class="mt-1 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(label)}</p>
            ${noEmp != null ? `<p class="text-xs text-text-muted tabular-nums">No. ${escapeHtml(String(noEmp))}</p>` : ""}
          </div>
          <button type="button" data-action="wizard-empleado-clear" class="${BTN_SECONDARY} shrink-0 px-2.5 py-1 text-xs">Cambiar</button>
        </div>
      </div>`;
    }

    const q = state.wizardEmpleadoQuery;
    const qTrim = q.trim();
    const soloNumero = /^\d+$/.test(qTrim);
    const minOk = qTrim.length >= (soloNumero ? 1 : 2);
    const matches = filterWizardEmpleados(q);
    let resultsHtml = "";
    if (qTrim.length > 0 && !minOk) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Escribe al menos 2 caracteres…</p>`;
    } else if (minOk && state.wizardEmpleadoLoading) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Buscando…</p>`;
    } else if (minOk && matches.length === 0) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Sin resultados</p>`;
    } else if (matches.length > 0) {
      resultsHtml = matches
        .map(
          (o) => `
        <button type="button" data-action="wizard-empleado-pick" data-empleado-id="${o.id}"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/10">
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">${escapeHtml(o.nombre)}</span>
          ${o.noEmpleado != null ? `<span class="shrink-0 text-xs tabular-nums text-text-muted">${escapeHtml(String(o.noEmpleado))}</span>` : ""}
        </button>`,
        )
        .join("");
    }

    const showResults = qTrim.length > 0;

    return `<div class="mb-4">
      <label for="pdi-wizard-empleado-search" class="${FORM_LABEL}">Colaborador *</label>
      <input id="pdi-wizard-empleado-search" type="search" data-action="wizard-empleado-search"
        value="${escapeHtml(q)}" autocomplete="off" placeholder="Buscar por nombre o No. de empleado…"
        class="mt-1 ${FIELD_INPUT}" role="combobox" aria-autocomplete="list" aria-expanded="${showResults ? "true" : "false"}" />
      ${
        showResults
          ? `<div class="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-md" role="listbox">${resultsHtml}</div>`
          : `<p class="mt-1 text-xs text-text-muted">Escribe nombre o número para buscar; no se lista el catálogo completo.</p>`
      }
    </div>`;
  }

  function renderWizardCompetenciaField(): string {
    const selectedId = state.wizardData.competencia_id;
    if (selectedId) {
      const found = state.competenciasOptions.find((c) => String(c.id) === selectedId);
      const label = found?.nombre ?? `Competencia #${selectedId}`;
      return `<div class="mb-3">
        <span class="${FORM_LABEL}">Competencia vinculada *</span>
        <div class="mt-1 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
          <p class="min-w-0 truncate text-sm font-medium text-text-primary">${escapeHtml(label)}</p>
          <button type="button" data-action="wizard-competencia-clear" class="${BTN_SECONDARY} shrink-0 px-2.5 py-1 text-xs">Cambiar</button>
        </div>
      </div>`;
    }

    const q = state.wizardCompetenciaQuery;
    const qTrim = q.trim();
    const minOk = qTrim.length >= 2;
    const matches = filterWizardCompetencias(q);
    let resultsHtml = "";
    if (qTrim.length > 0 && !minOk) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Escribe al menos 2 caracteres…</p>`;
    } else if (minOk && state.competenciasLoading) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Buscando…</p>`;
    } else if (minOk && matches.length === 0) {
      resultsHtml = `<p class="px-2.5 py-2 text-xs text-text-muted">Sin resultados</p>`;
    } else if (matches.length > 0) {
      resultsHtml = matches
        .map(
          (c) => `
        <button type="button" data-action="wizard-competencia-pick" data-competencia-id="${c.id}"
          class="flex w-full items-center rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/10">
          <span class="truncate text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
        </button>`,
        )
        .join("");
    }

    const showResults = qTrim.length > 0;

    return `<div class="mb-3">
      <label for="pdi-wizard-competencia-search" class="${FORM_LABEL}">Competencia vinculada *</label>
      <input id="pdi-wizard-competencia-search" type="search" data-action="wizard-competencia-search"
        value="${escapeHtml(q)}" autocomplete="off" placeholder="Buscar competencia por nombre…"
        class="mt-1 ${FIELD_INPUT}" role="combobox" aria-autocomplete="list" aria-expanded="${showResults ? "true" : "false"}" />
      ${
        showResults
          ? `<div class="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-md" role="listbox">${resultsHtml}</div>`
          : `<p class="mt-1 text-xs text-text-muted">Escribe el nombre para buscar; no se lista el catálogo completo.</p>`
      }
    </div>`;
  }

  function renderWizardModal(): string {
    if (!state.wizardOpen) return "";
    const { wizardStep: step, wizardData: d } = state;
    const stepLabels = ["Tipo acción", "Detalles", "Recursos", "Confirmar"];
    const PRIO_OPTS: Array<{ v: "baja" | "media" | "alta"; l: string }> = [
      { v: "baja", l: "Baja" },
      { v: "media", l: "Media" },
      { v: "alta", l: "Alta" },
    ];

    const stepIndicator = `<div class="mb-6 flex items-center justify-center gap-2">${stepLabels
      .map((lbl, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return `<div class="flex items-center gap-1.5">
        <div class="flex size-6 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-accent text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-text-muted"}">${done ? "✓" : n}</div>
        <span class="hidden text-xs sm:inline ${active ? "font-semibold text-text-primary" : "text-text-muted"}">${escapeHtml(lbl)}</span>
      </div>${i < 3 ? '<div class="h-px w-6 bg-slate-200"></div>' : ""}`;
      })
      .join("")}</div>`;

    let bodyHtml = "";
    if (step === 1) {
      bodyHtml = `
        ${renderWizardEmpleadoField()}
        <label class="mb-3 block"><span class="${FORM_LABEL}">Tipo de acción *</span>
          <div class="mt-1 grid"><select data-wizard-field="tipo" class="${FORM_SELECT}">
            <option value="">Seleccionar…</option>
            ${WIZARD_TIPOS.map((t) => `<option value="${escapeHtml(t)}" ${d.tipo === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
          </select>${SELECT_CHEVRON}</div>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block"><span class="${FORM_LABEL}">Fecha inicio *</span>
            <input type="date" data-wizard-field="fecha_inicio" value="${escapeHtml(d.fecha_inicio)}" class="mt-1 ${FIELD_INPUT}"/>
          </label>
          <label class="block"><span class="${FORM_LABEL}">Fecha fin *</span>
            <input type="date" data-wizard-field="fecha_fin" value="${escapeHtml(d.fecha_fin)}" class="mt-1 ${FIELD_INPUT}"/>
          </label>
        </div>`;
    } else if (step === 2) {
      bodyHtml = `
        <label class="mb-3 block"><span class="${FORM_LABEL}">Nombre de la acción *</span>
          <input type="text" data-wizard-field="accion" value="${escapeHtml(d.accion)}" placeholder="Ej: Curso de soldadura avanzada" class="mt-1 ${FIELD_INPUT}"/>
        </label>
        <div class="mb-3"><span class="${FORM_LABEL}">Prioridad *</span>
          <div class="inline-flex rounded-lg border border-border p-0.5">${PRIO_OPTS.map(
            (p) =>
              `<button type="button" data-wizard-field="prioridad" data-value="${p.v}" class="rounded-md px-4 py-1.5 text-xs font-semibold transition ${d.prioridad === p.v ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:bg-slate-50"}">${p.l}</button>`,
          ).join("")}</div>
        </div>`;
    } else if (step === 3) {
      bodyHtml = `
        <label class="mb-3 block"><span class="${FORM_LABEL}">Recursos asignados</span>
          <textarea data-wizard-field="recursos" rows="2" placeholder="Presupuesto, materiales, herramientas…" class="mt-1 ${FIELD_TEXTAREA}">${escapeHtml(d.recursos)}</textarea>
        </label>
        ${renderWizardCompetenciaField()}
        <label class="block"><span class="${FORM_LABEL}">Responsable *</span>
          <input type="text" data-wizard-field="responsable" value="${escapeHtml(d.responsable)}" placeholder="Nombre o área responsable" class="mt-1 ${FIELD_INPUT}"/>
        </label>`;
    } else {
      const compName = state.competenciasOptions.find((c) => String(c.id) === d.competencia_id)?.nombre ?? "—";
      const empLabel =
        state.wizardEmpleadoNombre ??
        state.wizardEmpleadoOptions.find((o) => o.id === state.wizardEmpleadoId)?.nombre ??
        (state.wizardEmpleadoId != null ? `Empleado #${state.wizardEmpleadoId}` : "—");
      bodyHtml = `
        <div class="space-y-2 rounded-lg border border-border bg-active-tint/40 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div class="col-span-2"><span class="text-text-muted">Colaborador:</span> <span class="font-medium text-text-primary">${escapeHtml(empLabel)}</span></div>
            <div><span class="text-text-muted">Tipo:</span> <span class="font-medium text-text-primary">${escapeHtml(d.tipo)}</span></div>
            <div><span class="text-text-muted">Prioridad:</span> ${d.prioridad === "alta" ? badgeRejected(d.prioridad) : d.prioridad === "baja" ? badgeCancelled(d.prioridad) : badgePending(d.prioridad)}</div>
            <div><span class="text-text-muted">Inicio:</span> <span class="font-medium text-text-primary">${escapeHtml(d.fecha_inicio)}</span></div>
            <div><span class="text-text-muted">Fin:</span> <span class="font-medium text-text-primary">${escapeHtml(d.fecha_fin)}</span></div>
            <div class="col-span-2"><span class="text-text-muted">Acción:</span> <span class="font-medium text-text-primary">${escapeHtml(d.accion)}</span></div>
            <div><span class="text-text-muted">Competencia:</span> <span class="font-medium text-text-primary">${escapeHtml(compName)}</span></div>
            <div><span class="text-text-muted">Responsable:</span> <span class="font-medium text-text-primary">${escapeHtml(d.responsable)}</span></div>
            ${d.recursos ? `<div class="col-span-2"><span class="text-text-muted">Recursos:</span> <span class="font-medium text-text-primary">${escapeHtml(d.recursos)}</span></div>` : ""}
          </div>
        </div>`;
    }

    const errorBanner = state.wizardError
      ? `<div class="mb-4">${alertError(state.wizardError)}</div>`
      : "";

    return `
      <div class="${MODAL_OVERLAY}" data-action="wizard-backdrop" role="presentation">
        <div class="${MODAL_PANEL} relative w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="pdi-wizard-title">
          <button type="button" data-action="wizard-close" class="absolute right-3 top-3 text-text-muted hover:text-text-primary" aria-label="Cerrar">
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h2 id="pdi-wizard-title" class="mb-1 text-base font-bold text-text-primary">Asignar acción de desarrollo</h2>
          <p class="mb-4 text-sm text-text-secondary">Define la acción PDI y el colaborador al que se asigna.</p>
          ${errorBanner}
          ${stepIndicator}
          ${bodyHtml}
          <div class="mt-6 flex justify-between border-t border-slate-100 pt-4">
            <button type="button" data-action="wizard-prev" class="${BTN_SECONDARY} ${step === 1 ? "invisible" : ""}">Anterior</button>
            ${
              step < 4
                ? `<button type="button" data-action="wizard-next" class="${BTN_PRIMARY}">Siguiente</button>`
                : `<button type="button" data-action="wizard-submit" class="${BTN_PRIMARY}">Crear acción</button>`
            }
          </div>
        </div>
      </div>`;
  }

  function renderExpandedCard(emp: EquipoResumenEmpleadoItem): string {
    const initials = emp.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    const loadingOrData = state.expandedData && state.expandedData.empleado_id === emp.empleado_id;
    return `
      <div class="mx-3 my-2 rounded-xl border border-border bg-active-tint/40 p-5">
        <div class="mb-4 flex items-start gap-4">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">${escapeHtml(initials)}</div>
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-bold text-text-primary">${escapeHtml(emp.nombre)}</h3>
            <p class="text-xs text-text-secondary">${escapeHtml(emp.puesto_nombre ?? "—")} · No. ${emp.no_empleado}</p>
          </div>
          ${renderCircleProgress(emp.progreso_pct, 52)}
          <div class="shrink-0 text-right">
            <p class="text-[10px] uppercase tracking-wide text-text-muted">Competencias</p>
            <p class="text-sm font-bold text-text-primary">${emp.score_competencias}</p>
            <p class="mt-1 text-[10px] uppercase tracking-wide text-text-muted">Cumplimiento</p>
            <p class="text-sm font-bold text-text-primary">${emp.evaluacion_general_prom}%</p>
          </div>
        </div>
        <div class="border-t border-slate-200/70 pt-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Análisis de brechas</h4>
          ${loadingOrData ? renderBrechasChart(state.expandedData!.competencias) : skeletonBlock({ className: "h-16 rounded-xl", label: "Cargando brechas…" })}
        </div>
        <div class="mt-4 border-t border-slate-200/70 pt-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Recomendaciones</h4>
          ${renderRecomendaciones(emp.empleado_id)}
        </div>
        <div class="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
          <button type="button" data-action="open-wizard-emp" data-empleado-id="${emp.empleado_id}" data-empleado-nombre="${escapeHtml(emp.nombre)}" class="${BTN_PRIMARY} text-xs">
            Asignar acción
          </button>
          <a href="#/evaluaciones/empleado/${emp.empleado_id}" class="text-xs font-medium text-accent hover:underline">Ver perfil completo →</a>
        </div>
      </div>`;
  }

  function renderTeamSummary(): string {
    const { equipoResumen } = state;
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando resumen de equipo…" });
    }
    if (equipoResumen.items.length === 0) return emptyPanel("Sin datos de equipo para el filtro actual.");
    return `
      <section class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-[900px] w-full text-left">
            <thead class="${RH_TABLE_HEAD}">
              <tr>
                <th class="px-4 py-3">Colaborador</th>
                <th class="px-4 py-3">Estatus PDI</th>
                <th class="px-4 py-3">Brechas críticas</th>
                <th class="px-4 py-3">Última actualización</th>
                <th class="px-4 py-3 text-center">Score</th>
                <th class="w-12 px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${equipoResumen.items
                .map((emp) => {
                  const initials = emp.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                  const estCfg = ESTATUS_PDI[emp.estatus_pdi] ?? ESTATUS_PDI.sin_acciones;
                  const isExpanded = state.expandedEmployeeId === emp.empleado_id;
                  return `
              <tr class="transition hover:bg-slate-50/80 ${isExpanded ? "bg-accent-light/30" : ""}">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">${escapeHtml(initials)}</div>
                    <div>
                      <p class="cursor-pointer text-sm font-medium text-accent" data-action="go-empleado" data-id="${emp.empleado_id}">${escapeHtml(emp.nombre)}</p>
                      <p class="text-[11px] text-text-muted">${escapeHtml(emp.puesto_nombre ?? emp.area_nombre ?? "—")}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">${estCfg.badge(estCfg.label)}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    ${
                      emp.brechas_criticas.length === 0
                        ? '<span class="text-[11px] italic text-text-muted">Sin brechas críticas</span>'
                        : emp.brechas_criticas
                            .slice(0, 3)
                            .map((b) => {
                              const label =
                                b.competencia_nombre.length > 12
                                  ? b.competencia_nombre.slice(0, 12) + "…"
                                  : b.competencia_nombre;
                              return b.gap >= 2
                                ? badgeRejected(label)
                                : badgePending(label);
                            })
                            .join("") +
                          (emp.brechas_criticas.length > 3
                            ? `<span class="text-[10px] text-text-muted">+${emp.brechas_criticas.length - 3}</span>`
                            : "")
                    }
                  </div>
                </td>
                <td class="px-4 py-3 text-xs text-text-secondary">${emp.ultima_actualizacion ? new Date(emp.ultima_actualizacion).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td class="px-4 py-3 text-center">
                  <span class="text-xs font-semibold tabular-nums">${emp.score_competencias}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <button type="button" data-action="expand-team-card" data-empleado-id="${emp.empleado_id}"
                    class="inline-flex size-7 items-center justify-center rounded-md text-text-muted transition hover:bg-accent-light hover:text-accent" aria-expanded="${isExpanded}">
                    <svg class="size-4 transition ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </td>
              </tr>
              ${isExpanded ? `<tr class="team-detail-row"><td colspan="6" class="p-0">${renderExpandedCard(emp)}</td></tr>` : ""}`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderHeaderActions(): string {
    return `<div class="flex flex-wrap items-center gap-2">
      <button type="button" data-action="open-wizard" class="${BTN_PRIMARY}">
        <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Asignar acción
      </button>
      <button type="button" data-action="export-pdf" class="${BTN_SECONDARY}">Exportar PDF</button>
      <button type="button" data-action="export-excel" class="${BTN_SECONDARY}">Exportar Excel</button>
      <button type="button" data-action="notificar-equipo" class="${BTN_SECONDARY}">
        <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        Notificar equipo
      </button>
    </div>`;
  }

  function render() {
    const flashHtml =
      state.flash == null
        ? ""
        : state.flash.type === "success"
          ? alertSuccess(state.flash.message)
          : alertError(state.flash.message);

    root.innerHTML = `
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-2">
            ${talentoEyebrow("Desarrollo")}
            ${pageHeading(
              "Gestión PDI",
              "Planes de desarrollo individual: seguimiento de acciones, progreso del equipo y brechas de competencias.",
            )}
          </div>
          ${renderHeaderActions()}
        </div>
        ${flashHtml}
        ${renderKpiSection()}
        ${renderGlobalFilters()}
        <div data-tabs="pdi-views">
          ${renderTabNav([...VIEW_TABS], state.viewMode, { ariaLabel: "Vistas de Gestión PDI" })}
        </div>
        ${renderViewContent()}
      </div>
      ${renderWizardModal()}
    `;

    if (restoreWizardEmpSearchFocus) {
      restoreWizardEmpSearchFocus = false;
      const el = root.querySelector<HTMLInputElement>("[data-action='wizard-empleado-search']");
      if (el) {
        el.focus();
        const caret = Math.min(wizardEmpSearchCaret, el.value.length);
        el.setSelectionRange(caret, caret);
      }
    }
    if (restoreWizardCompSearchFocus) {
      restoreWizardCompSearchFocus = false;
      const el = root.querySelector<HTMLInputElement>("[data-action='wizard-competencia-search']");
      if (el) {
        el.focus();
        const caret = Math.min(wizardCompSearchCaret, el.value.length);
        el.setSelectionRange(caret, caret);
      }
    }
  }

  root.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || !state.wizardOpen) return;
      e.preventDefault();
      state.wizardOpen = false;
      state.wizardError = null;
      clearWizardDeepLink();
      render();
    },
    { signal },
  );

  root.addEventListener("click", (e) => {
    const tabEl = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"][data-tab]');
    if (tabEl?.closest("[data-tabs='pdi-views']")) {
      const view = tabEl.dataset.tab as State["viewMode"];
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
          void loadItems();
        }
      }
      return;
    }

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

    if (action === "wizard-empleado-pick") {
      const empId = Number(target.dataset.empleadoId);
      if (!Number.isFinite(empId)) return;
      const found = state.wizardEmpleadoOptions.find((o) => o.id === empId);
      state.wizardEmpleadoId = empId;
      state.wizardEmpleadoNombre = found?.nombre ?? null;
      state.wizardEmpleadoQuery = "";
      state.wizardError = null;
      render();
      return;
    }

    if (action === "wizard-empleado-clear") {
      state.wizardEmpleadoId = null;
      state.wizardEmpleadoNombre = null;
      state.wizardEmpleadoQuery = "";
      state.wizardError = null;
      render();
      return;
    }

    if (action === "wizard-competencia-pick") {
      const compId = Number(target.dataset.competenciaId);
      if (!Number.isFinite(compId)) return;
      state.wizardData.competencia_id = String(compId);
      state.wizardCompetenciaQuery = "";
      state.wizardError = null;
      render();
      return;
    }

    if (action === "wizard-competencia-clear") {
      state.wizardData.competencia_id = "";
      state.wizardCompetenciaQuery = "";
      state.wizardError = null;
      render();
      return;
    }

    if (action === "open-wizard" || action === "open-wizard-emp") {
      const empId = target.dataset.empleadoId ? Number(target.dataset.empleadoId) : null;
      const empNombre = target.dataset.empleadoNombre?.trim() || null;
      openWizard({ empleadoId: empId, empleadoNombre: empNombre });
      return;
    }

    if (action === "wizard-close") {
      state.wizardOpen = false;
      state.wizardError = null;
      clearWizardDeepLink();
      render();
      return;
    }

    if (action === "wizard-backdrop") {
      // Solo cerrar si el click fue en el overlay, no en el panel ni sus botones.
      if ((e.target as HTMLElement).dataset.action !== "wizard-backdrop") return;
      state.wizardOpen = false;
      state.wizardError = null;
      clearWizardDeepLink();
      render();
      return;
    }

    if (action === "wizard-prev" && state.wizardStep > 1) {
      state.wizardError = null;
      state.wizardStep--;
      render();
      return;
    }

    if (action === "wizard-next") {
      const d = state.wizardData;
      if (state.wizardStep === 1) {
        if (state.wizardEmpleadoId == null) {
          state.wizardError = "Selecciona el colaborador.";
          render();
          return;
        }
        if (!d.tipo || !d.fecha_inicio || !d.fecha_fin) {
          state.wizardError = "Completa tipo y fechas.";
          render();
          return;
        }
      }
      if (state.wizardStep === 2 && !d.accion) {
        state.wizardError = "Indica el nombre de la acción.";
        render();
        return;
      }
      if (state.wizardStep === 3 && (!d.competencia_id || !d.responsable)) {
        state.wizardError = "Selecciona competencia y responsable.";
        render();
        return;
      }
      state.wizardError = null;
      state.wizardStep++;
      render();
      return;
    }

    if (action === "wizard-submit") {
      const d = state.wizardData;
      if (!state.wizardEmpleadoId || !d.competencia_id) {
        state.wizardError = !state.wizardEmpleadoId
          ? "Selecciona el colaborador."
          : "Falta la competencia vinculada.";
        render();
        return;
      }
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
      void createPDI(state.wizardEmpleadoId, payload).then((result) => {
        if (result) {
          state.wizardOpen = false;
          state.wizardError = null;
          state.flash = { type: "success", message: "Acción PDI creada correctamente." };
          clearWizardDeepLink();
          void Promise.all([loadResumen(), loadItems()]);
        } else {
          state.wizardError = "No se pudo crear la acción. Intenta de nuevo.";
          render();
        }
      });
      return;
    }

    if (target.dataset.wizardField === "prioridad") {
      const val = target.dataset.value as "baja" | "media" | "alta";
      if (val) {
        state.wizardData.prioridad = val;
        render();
      }
    }

    if (action === "export-pdf") {
      void exportPDI("pdf", scopeFilterParams());
    }
    if (action === "export-excel") {
      void exportPDI("excel", scopeFilterParams());
    }

    if (action === "notificar-equipo") {
      if (confirm("¿Notificar a todos los empleados con acciones pendientes?")) {
        void notificarEquipoPDI().then((res) => {
          if (res.notificaciones_creadas > 0) {
            state.flash = {
              type: "success",
              message: `Se notificó a ${res.empleados_notificados} empleado(s).`,
            };
          } else {
            state.flash = { type: "error", message: "No se crearon notificaciones." };
          }
          render();
        });
      }
    }
  }, { signal });

  root.addEventListener("change", async (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === "filter-global") {
      const field = target.dataset.field as keyof State["filters"];
      const value = (target as HTMLSelectElement | HTMLInputElement).value;
      state.filters[field] = value;
      state.activeKpi = "";
      state.soloVencidas = false;
      if (field === "area_id") {
        state.filters.puesto_perfil_id = "";
        void loadPuestosPerfilOptions().then(() => {
          reloadCurrentView();
          void loadResumen();
        });
        return;
      }
      reloadCurrentView();
      void loadResumen();
      return;
    }
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
    if (target.dataset.action === "wizard-empleado-search" && state.wizardOpen) {
      const input = target as HTMLInputElement;
      const value = input.value;
      wizardEmpSearchCaret = input.selectionStart ?? value.length;
      restoreWizardEmpSearchFocus = true;
      state.wizardEmpleadoQuery = value;
      const q = value.trim();
      const soloNumero = /^\d+$/.test(q);
      const shouldSearch = q.length >= (soloNumero ? 1 : 2);
      if (wizardEmpSearchTimeout) clearTimeout(wizardEmpSearchTimeout);
      if (shouldSearch && state.wizardEmpleadoOptions.length === 0) {
        wizardEmpSearchTimeout = setTimeout(() => {
          void ensureWizardEmpleados().then(() => {
            if (!state.wizardOpen) return;
            restoreWizardEmpSearchFocus = true;
            render();
          });
        }, 200);
      }
      render();
      return;
    }
    if (target.dataset.action === "wizard-competencia-search" && state.wizardOpen) {
      const input = target as HTMLInputElement;
      const value = input.value;
      wizardCompSearchCaret = input.selectionStart ?? value.length;
      restoreWizardCompSearchFocus = true;
      state.wizardCompetenciaQuery = value;
      if (value.trim().length >= 2 && state.competenciasOptions.length === 0) {
        void ensureCompetenciasOptions().then(() => {
          if (!state.wizardOpen) return;
          restoreWizardCompSearchFocus = true;
          render();
        });
      }
      render();
      return;
    }
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

  void Promise.all([loadAreas(), loadResumen()]).then(() => {
    maybeOpenWizardFromHash();
    void loadItems();
  });
}
