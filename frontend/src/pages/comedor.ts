import {
  canAccessComedorLiderPage,
  canAccessComedorRhPage,
  canAccessEmpleadoPersonalDashboard,
  getEmpleadoIdFromAccessToken,
  getUserDisplayNameFromAccessToken,
} from "../auth/jwt.ts";
import {
  createComedorRequestMock,
  fetchComedorCalendarMonthMock,
  fetchComedorKpisMock,
  fetchComedorMenuOptionsMock,
  fetchComedorReservationsMock,
  fetchComedorSidebarMock,
  fetchComedorTeamKpisMock,
  fetchComedorTeamReservationsMock,
} from "../comedor/rh/mockData.ts";
import {
  clearWeekPlannerMock,
  createBlankWeekByStartIso,
  duplicatePreviousWeekMock,
  getCurrentWeekStartIso,
  loadWeekPlannerMock,
  publishWeekPlannerMock,
  saveWeekPlannerDraftMock,
  shiftWeekStartIso,
} from "../comedor/rh/weeklyPlannerMock.ts";
import { mountComedorNewRequestModal } from "../components/comedor/comedorNewRequestModal.ts";
import type {
  ComedorEmployeeOption,
  ComedorPanelState,
  ComedorWeekPlanner,
  ComedorWeekPlannerDayKey,
} from "../comedor/rh/types.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import {
  renderComedorDashboardEmpleado,
  type ComedorDashboardEmpleadoViewState,
} from "../components/comedor/comedorDashboardEmpleado.ts";
import {
  renderComedorDashboardLider,
  type ComedorDashboardLiderViewState,
} from "../components/comedor/comedorDashboardLider.ts";
import {
  renderComedorWeeklyPlanner,
  type ComedorWeeklyPlannerViewState,
} from "../components/comedor/comedorWeeklyPlanner.ts";
import { renderComedorDashboardRh, type ComedorDashboardRhViewState } from "../components/comedor/comedorDashboardRh.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { mountComedorStub } from "./shellModuleStubs.ts";

type RhComedorState = {
  statsState: ComedorPanelState;
  statsError: string | null;
  calendarState: ComedorPanelState;
  calendarError: string | null;
  sidebarState: ComedorPanelState;
  sidebarError: string | null;
  tableState: ComedorPanelState;
  tableError: string | null;
  statusFilter: "todos" | "confirmado" | "cancelado";
  search: string;
  page: number;
  pageSize: number;
  year: number;
  monthIndex: number;
} & Omit<
  ComedorDashboardRhViewState,
  | "statsState"
  | "statsError"
  | "calendarState"
  | "calendarError"
  | "sidebarState"
  | "sidebarError"
  | "tableState"
  | "tableError"
  | "tableFilters"
>;

function toViewState(state: RhComedorState): ComedorDashboardRhViewState {
  return {
    statsState: state.statsState,
    stats: state.stats,
    statsError: state.statsError,
    calendarState: state.calendarState,
    calendar: state.calendar,
    calendarError: state.calendarError,
    sidebarState: state.sidebarState,
    sidebar: state.sidebar,
    sidebarError: state.sidebarError,
    tableState: state.tableState,
    table: state.table,
    tableError: state.tableError,
    tableFilters: { statusFilter: state.statusFilter, search: state.search },
  };
}

type LiderComedorState = {
  statsState: ComedorPanelState;
  statsError: string | null;
  calendarState: ComedorPanelState;
  calendarError: string | null;
  tableState: ComedorPanelState;
  tableError: string | null;
  statusFilter: "todos" | "confirmado" | "cancelado";
  search: string;
  page: number;
  pageSize: number;
  year: number;
  monthIndex: number;
} & Omit<
  ComedorDashboardLiderViewState,
  | "statsState"
  | "statsError"
  | "calendarState"
  | "calendarError"
  | "tableState"
  | "tableError"
  | "tableFilters"
>;

function toLiderViewState(state: LiderComedorState): ComedorDashboardLiderViewState {
  return {
    statsState: state.statsState,
    stats: state.stats,
    statsError: state.statsError,
    calendarState: state.calendarState,
    calendar: state.calendar,
    calendarError: state.calendarError,
    tableState: state.tableState,
    table: state.table,
    tableError: state.tableError,
    tableFilters: { statusFilter: state.statusFilter, search: state.search },
  };
}

type EmpleadoComedorState = {
  calendarState: ComedorPanelState;
  calendarError: string | null;
  year: number;
  monthIndex: number;
} & Omit<ComedorDashboardEmpleadoViewState, "calendarState" | "calendarError">;

function toEmpleadoViewState(state: EmpleadoComedorState): ComedorDashboardEmpleadoViewState {
  return {
    calendarState: state.calendarState,
    calendar: state.calendar,
    calendarError: state.calendarError,
  };
}

type RhPlannerState = {
  panelState: ComedorPanelState;
  errorMessage: string | null;
  week: ComedorWeekPlanner;
  weekPickerValue: string;
  selectedDayKey: ComedorWeekPlannerDayKey;
  incompleteDaysCount: number;
  isSavingDraft: boolean;
  isPublishing: boolean;
  isDuplicating: boolean;
  lastSavedAt: number | null;
  menuEditor: {
    open: boolean;
    dayKey: ComedorWeekPlannerDayKey | null;
    field: "menuNormal" | "menuDieta";
    draftText: string;
  };
};

function weekInputFromIso(weekStartIso: string): string {
  const dt = new Date(`${weekStartIso}T00:00:00`);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day + 4);
  const firstThursday = new Date(dt.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 4);
  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / 604800000);
  return `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isoFromWeekInput(value: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? "", 10);
  const week = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const mondayWeek1 = new Date(year, 0, 4 - jan4Day);
  mondayWeek1.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  const y = String(mondayWeek1.getFullYear()).padStart(4, "0");
  const m = String(mondayWeek1.getMonth() + 1).padStart(2, "0");
  const d = String(mondayWeek1.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function plannerIncompleteDays(week: ComedorWeekPlanner): number {
  return week.dias.filter((day) => !day.menuNormal.trim() || !day.menuDieta.trim()).length;
}

function formatRelativeSavedLabel(lastSavedAt: number | null): string | null {
  if (lastSavedAt == null) return null;
  const deltaSec = Math.max(1, Math.floor((Date.now() - lastSavedAt) / 1000));
  if (deltaSec < 60) return `${deltaSec}s`;
  const min = Math.floor(deltaSec / 60);
  return `${min} min`;
}

function toPlannerViewState(state: RhPlannerState): ComedorWeeklyPlannerViewState {
  return {
    panelState: state.panelState,
    errorMessage: state.errorMessage,
    week: state.week,
    weekPickerValue: state.weekPickerValue,
    selectedDayKey: state.selectedDayKey,
    incompleteDaysCount: state.incompleteDaysCount,
    isSavingDraft: state.isSavingDraft,
    isPublishing: state.isPublishing,
    isDuplicating: state.isDuplicating,
    lastSavedAtLabel: formatRelativeSavedLabel(state.lastSavedAt),
    menuEditor: state.menuEditor,
  };
}

async function searchComedorEmployeesFromDb(query: string): Promise<readonly ComedorEmployeeOption[]> {
  const q = query.trim();
  if (!q) return [];
  const page = await getEmpleadosPage({ page: 1, page_size: 8, q });
  return page.items.map((item) => ({
    id: String(item.empleado_id),
    nombre: item.nombre,
    numero: item.no_empleado,
    area: item.area?.descripcion ?? "Sin área",
    avatarUrl: null,
  }));
}

function mountComedorRh(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const state: RhComedorState = {
    statsState: "loading",
    stats: null,
    statsError: null,
    calendarState: "loading",
    calendar: null,
    calendarError: null,
    sidebarState: "loading",
    sidebar: null,
    sidebarError: null,
    tableState: "loading",
    table: null,
    tableError: null,
    statusFilter: "todos",
    search: "",
    page: 1,
    pageSize: 10,
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-rh-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardRh(toViewState(state));
  }

  async function loadKpis(): Promise<void> {
    state.statsState = "loading";
    state.statsError = null;
    paint();
    try {
      const rows = await fetchComedorKpisMock();
      if (signal.aborted) return;
      state.stats = rows;
      state.statsState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.stats = null;
      state.statsState = "error";
      state.statsError = error instanceof Error ? error.message : "Error al cargar métricas.";
    }
    paint();
  }

  async function loadCalendar(): Promise<void> {
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const month = await fetchComedorCalendarMonthMock(state.year, state.monthIndex);
      if (signal.aborted) return;
      state.calendar = month;
      state.calendarState = Object.keys(month.dayMetrics).length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.calendar = null;
      state.calendarState = "error";
      state.calendarError = error instanceof Error ? error.message : "Error al cargar calendario.";
    }
    paint();
  }

  async function loadSidebar(): Promise<void> {
    state.sidebarState = "loading";
    state.sidebarError = null;
    paint();
    try {
      const dataset = await fetchComedorSidebarMock();
      if (signal.aborted) return;
      state.sidebar = dataset;
      state.sidebarState = dataset.alerts.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.sidebar = null;
      state.sidebarState = "error";
      state.sidebarError = error instanceof Error ? error.message : "Error al cargar alertas y gráficas.";
    }
    paint();
  }

  async function loadTable(): Promise<void> {
    state.tableState = "loading";
    state.tableError = null;
    paint();
    try {
      const page = await fetchComedorReservationsMock({
        statusFilter: state.statusFilter,
        search: state.search,
        page: state.page,
        pageSize: state.pageSize,
      });
      if (signal.aborted) return;
      state.table = page;
      state.tableState = page.items.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.table = null;
      state.tableState = "error";
      state.tableError = error instanceof Error ? error.message : "Error al cargar tabla de reservas.";
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-rh-root">${renderComedorDashboardRh(toViewState(state))}</div><div id="comedor-new-request-modal-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-rh-root");
  const modalHost = container.querySelector<HTMLElement>("#comedor-new-request-modal-host");
  const newRequestModal =
    modalHost ?
      mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        loadMenuOptions: fetchComedorMenuOptionsMock,
        searchEmployees: searchComedorEmployeesFromDb,
        onSubmit: createComedorRequestMock,
      })
    : null;
  let tableSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-planear]")) {
        window.location.hash = "#/comedor/planear";
        return;
      }
      if (target.closest("[data-comedor-nuevo]")) {
        void newRequestModal?.open();
        return;
      }
      if (target.closest("[data-comedor-retry-kpis]")) {
        void loadKpis();
        return;
      }
      if (target.closest("[data-comedor-retry-calendar]")) {
        void loadCalendar();
        return;
      }
      if (target.closest("[data-comedor-retry-sidebar]")) {
        void loadSidebar();
        return;
      }
      if (target.closest("[data-comedor-retry-table]")) {
        void loadTable();
        return;
      }

      const statusBtn = target.closest<HTMLButtonElement>("[data-comedor-filter-status]");
      if (statusBtn) {
        const status = statusBtn.getAttribute("data-comedor-filter-status");
        if (status === "todos" || status === "confirmado" || status === "cancelado") {
          state.statusFilter = status;
          state.page = 1;
          void loadTable();
        }
        return;
      }

      const pageBtn = target.closest<HTMLButtonElement>("[data-comedor-page]");
      if (pageBtn && !pageBtn.disabled) {
        const raw = pageBtn.getAttribute("data-comedor-page");
        const page = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(page) && page > 0) {
          state.page = page;
          void loadTable();
        }
        return;
      }

      const prevBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-prev-year]");
      if (prevBtn) {
        const year = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-year") ?? "", 10);
        const month = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const nextBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-next-year]");
      if (nextBtn) {
        const year = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-year") ?? "", 10);
        const month = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const todayBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-today-year]");
      if (todayBtn) {
        const year = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-year") ?? "", 10);
        const month = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-comedor-search]");
      if (!input) return;
      state.search = input.value;
      state.page = 1;
      if (tableSearchDebounceTimer != null) {
        window.clearTimeout(tableSearchDebounceTimer);
      }
      tableSearchDebounceTimer = window.setTimeout(() => {
        tableSearchDebounceTimer = null;
        void loadTable();
      }, 220);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    if (tableSearchDebounceTimer != null) {
      window.clearTimeout(tableSearchDebounceTimer);
      tableSearchDebounceTimer = null;
    }
    newRequestModal?.destroy();
  });

  void loadKpis();
  void loadCalendar();
  void loadSidebar();
  void loadTable();
}

function mountComedorRhPlanner(container: HTMLElement, signal: AbortSignal): void {
  const initialWeek = createBlankWeekByStartIso(getCurrentWeekStartIso());
  const state: RhPlannerState = {
    panelState: "loading",
    errorMessage: null,
    week: initialWeek,
    weekPickerValue: weekInputFromIso(initialWeek.weekStartIso),
    selectedDayKey: "lunes",
    incompleteDaysCount: plannerIncompleteDays(initialWeek),
    isSavingDraft: false,
    isPublishing: false,
    isDuplicating: false,
    lastSavedAt: null,
    menuEditor: {
      open: false,
      dayKey: null,
      field: "menuNormal",
      draftText: "",
    },
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-plan-root");
    if (!root) return;
    root.innerHTML = renderComedorWeeklyPlanner(toPlannerViewState(state));
  }

  async function loadWeek(weekStartIso: string): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    state.week = createBlankWeekByStartIso(weekStartIso);
    state.weekPickerValue = weekInputFromIso(weekStartIso);
    state.selectedDayKey = "lunes";
    state.incompleteDaysCount = plannerIncompleteDays(state.week);
    state.menuEditor.open = false;
    paint();
    try {
      const week = await loadWeekPlannerMock(weekStartIso);
      if (signal.aborted) return;
      if (week) {
        state.week = week;
        state.panelState = "ready";
      } else {
        state.week = createBlankWeekByStartIso(weekStartIso);
        state.panelState = "empty";
      }
      state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
      state.incompleteDaysCount = plannerIncompleteDays(state.week);
    } catch (error) {
      if (signal.aborted) return;
      state.panelState = "error";
      state.errorMessage = error instanceof Error ? error.message : "Error al cargar semana.";
    }
    paint();
  }

  function updateDay(
    dayKey: ComedorWeekPlannerDayKey,
    field: "menuNormal" | "menuDieta" | "visibleEmpleados",
    value: string | boolean,
  ): void {
    state.week = {
      ...state.week,
      status: "borrador",
      dias: state.week.dias.map((day) => {
        if (day.key !== dayKey) return day;
        if (field === "visibleEmpleados") {
          return { ...day, visibleEmpleados: Boolean(value) };
        }
        return { ...day, [field]: String(value) };
      }),
    };
    if (state.panelState === "ready") state.panelState = "ready";
    if (state.panelState === "empty") state.panelState = "empty";
    state.incompleteDaysCount = plannerIncompleteDays(state.week);
    paint();
  }

  function updateDayPhoto(dayKey: ComedorWeekPlannerDayKey, dataUrl: string | null, fileName: string | null): void {
    state.week = {
      ...state.week,
      status: "borrador",
      dias: state.week.dias.map((day) =>
        day.key === dayKey ? { ...day, fotoMenuDataUrl: dataUrl, fotoMenuNombre: fileName } : day
      ),
    };
    state.incompleteDaysCount = plannerIncompleteDays(state.week);
    paint();
  }

  function openMenuEditor(dayKey: ComedorWeekPlannerDayKey, field: "menuNormal" | "menuDieta"): void {
    const day = state.week.dias.find((item) => item.key === dayKey);
    state.menuEditor = {
      open: true,
      dayKey,
      field,
      draftText: field === "menuNormal" ? (day?.menuNormal ?? "") : (day?.menuDieta ?? ""),
    };
    state.selectedDayKey = dayKey;
    paint();
  }

  function closeMenuEditor(): void {
    state.menuEditor = { ...state.menuEditor, open: false, dayKey: null, draftText: "" };
    paint();
  }

  function saveMenuEditor(): void {
    if (!state.menuEditor.open || !state.menuEditor.dayKey) return;
    updateDay(state.menuEditor.dayKey, state.menuEditor.field, state.menuEditor.draftText.trim());
    state.menuEditor = { ...state.menuEditor, open: false, dayKey: null, draftText: "" };
    paint();
  }

  function copySelectedDayToWeek(): void {
    const source = state.week.dias.find((day) => day.key === state.selectedDayKey);
    if (!source) return;
    state.week = {
      ...state.week,
      status: "borrador",
      dias: state.week.dias.map((day) => ({
        ...day,
        menuNormal: source.menuNormal,
        menuDieta: source.menuDieta,
        fotoMenuDataUrl: source.fotoMenuDataUrl,
        fotoMenuNombre: source.fotoMenuNombre,
      })),
    };
    state.incompleteDaysCount = plannerIncompleteDays(state.week);
    showEmpleadosToast(container, "Se copió el día seleccionado a toda la semana.", "success");
    paint();
  }

  async function saveDraft(): Promise<void> {
    state.isSavingDraft = true;
    paint();
    try {
      const week = await saveWeekPlannerDraftMock(state.week);
      if (signal.aborted) return;
      state.week = week;
      state.panelState = "ready";
      state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
      state.incompleteDaysCount = plannerIncompleteDays(state.week);
      state.lastSavedAt = Date.now();
      showEmpleadosToast(container, "Borrador guardado correctamente.", "success");
    } catch {
      if (signal.aborted) return;
      showEmpleadosToast(container, "No se pudo guardar el borrador.", "error");
    } finally {
      state.isSavingDraft = false;
      paint();
    }
  }

  async function publishWeek(): Promise<void> {
    const confirmed = window.confirm("¿Publicar la semana actual para que esté disponible a empleados?");
    if (!confirmed) return;
    state.isPublishing = true;
    paint();
    try {
      const week = await publishWeekPlannerMock(state.week);
      if (signal.aborted) return;
      state.week = week;
      state.panelState = "ready";
      state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
      state.incompleteDaysCount = plannerIncompleteDays(state.week);
      state.lastSavedAt = Date.now();
      showEmpleadosToast(container, "Semana publicada para empleados.", "success");
    } catch {
      if (signal.aborted) return;
      showEmpleadosToast(container, "No se pudo publicar la semana.", "error");
    } finally {
      state.isPublishing = false;
      paint();
    }
  }

  async function duplicatePreviousWeek(): Promise<void> {
    state.isDuplicating = true;
    paint();
    try {
      const duplicated = await duplicatePreviousWeekMock(state.week.weekStartIso);
      if (signal.aborted) return;
      if (!duplicated) {
        showEmpleadosToast(container, "No hay semana anterior para duplicar.", "error");
      } else {
        state.week = duplicated;
        state.panelState = "ready";
        state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
        state.incompleteDaysCount = plannerIncompleteDays(state.week);
        state.lastSavedAt = Date.now();
        showEmpleadosToast(container, "Semana anterior duplicada.", "success");
      }
    } catch {
      if (signal.aborted) return;
      showEmpleadosToast(container, "No se pudo duplicar la semana anterior.", "error");
    } finally {
      state.isDuplicating = false;
      paint();
    }
  }

  async function clearWeek(): Promise<void> {
    const confirmed = window.confirm("Se limpiarán los campos de la semana en edición. ¿Deseas continuar?");
    if (!confirmed) return;
    try {
      const cleared = await clearWeekPlannerMock(state.week.weekStartIso);
      if (signal.aborted) return;
      state.week = cleared;
      state.panelState = "empty";
      state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
      state.selectedDayKey = "lunes";
      state.incompleteDaysCount = plannerIncompleteDays(state.week);
      state.lastSavedAt = Date.now();
      showEmpleadosToast(container, "Semana limpiada.", "success");
      paint();
    } catch {
      if (signal.aborted) return;
      showEmpleadosToast(container, "No se pudo limpiar la semana.", "error");
    }
  }

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-plan-root">${renderComedorWeeklyPlanner(toPlannerViewState(state))}</div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-plan-root");
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-plan-retry]")) {
        void loadWeek(state.week.weekStartIso);
        return;
      }
      if (target.closest("[data-comedor-plan-prev-week]")) {
        void loadWeek(shiftWeekStartIso(state.week.weekStartIso, -1));
        return;
      }
      if (target.closest("[data-comedor-plan-next-week]")) {
        void loadWeek(shiftWeekStartIso(state.week.weekStartIso, 1));
        return;
      }
      if (target.closest("[data-comedor-plan-duplicate]")) {
        void duplicatePreviousWeek();
        return;
      }
      if (target.closest("[data-comedor-plan-save-draft]")) {
        void saveDraft();
        return;
      }
      if (target.closest("[data-comedor-plan-publish]")) {
        void publishWeek();
        return;
      }
      if (target.closest("[data-comedor-plan-clear]")) {
        void clearWeek();
        return;
      }
      if (target.closest("[data-comedor-plan-copy-selected-day]")) {
        copySelectedDayToWeek();
        return;
      }
      const openMenuBtn = target.closest<HTMLElement>("[data-comedor-plan-menu-open]");
      if (openMenuBtn) {
        const raw = openMenuBtn.getAttribute("data-comedor-plan-menu-open") ?? "";
        const [day, field] = raw.split(":");
        if (
          (day === "lunes" ||
            day === "martes" ||
            day === "miercoles" ||
            day === "jueves" ||
            day === "viernes") &&
          (field === "menuNormal" || field === "menuDieta")
        ) {
          openMenuEditor(day, field);
        }
        return;
      }
      if (target.closest("[data-comedor-plan-menu-cancel]")) {
        closeMenuEditor();
        return;
      }
      if (target.closest("[data-comedor-plan-menu-save]")) {
        saveMenuEditor();
        return;
      }
      const removePhotoBtn = target.closest<HTMLElement>("[data-comedor-plan-remove-photo-day]");
      if (removePhotoBtn) {
        const day = removePhotoBtn.getAttribute("data-comedor-plan-remove-photo-day");
        if (
          day === "lunes" ||
          day === "martes" ||
          day === "miercoles" ||
          day === "jueves" ||
          day === "viernes"
        ) {
          updateDayPhoto(day, null, null);
        }
        return;
      }
      const daySelect = target.closest<HTMLElement>("[data-comedor-plan-select-day]");
      if (daySelect) {
        const key = daySelect.getAttribute("data-comedor-plan-select-day");
        if (
          key === "lunes" ||
          key === "martes" ||
          key === "miercoles" ||
          key === "jueves" ||
          key === "viernes"
        ) {
          state.selectedDayKey = key;
          paint();
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;
      const weekPicker = target.closest<HTMLInputElement>("[data-comedor-plan-week-picker]");
      if (weekPicker) {
        const iso = isoFromWeekInput(weekPicker.value);
        if (iso) {
          void loadWeek(iso);
        }
        return;
      }
      const visibility = target.closest<HTMLInputElement>("[data-comedor-plan-visible-day]");
      if (visibility) {
        const day = visibility.getAttribute("data-comedor-plan-visible-day");
        if (
          day === "lunes" ||
          day === "martes" ||
          day === "miercoles" ||
          day === "jueves" ||
          day === "viernes"
        ) {
          updateDay(day, "visibleEmpleados", visibility.checked);
        }
        return;
      }
      const fileInput = target.closest<HTMLInputElement>("[data-comedor-plan-photo-day]");
      if (fileInput) {
        const day = fileInput.getAttribute("data-comedor-plan-photo-day");
        const file = fileInput.files?.[0] ?? null;
        if (
          !file ||
          !(
            day === "lunes" ||
            day === "martes" ||
            day === "miercoles" ||
            day === "jueves" ||
            day === "viernes"
          )
        ) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const data = typeof reader.result === "string" ? reader.result : null;
          if (!data) return;
          updateDayPhoto(day, data, file.name);
        };
        reader.readAsDataURL(file);
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;
      const menuDraft = target.closest<HTMLTextAreaElement>("[data-comedor-plan-menu-draft]");
      if (!menuDraft) return;
      state.menuEditor = { ...state.menuEditor, draftText: menuDraft.value };
    },
    { signal },
  );

  void loadWeek(state.week.weekStartIso);
}

function mountComedorLider(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const state: LiderComedorState = {
    statsState: "loading",
    stats: null,
    statsError: null,
    calendarState: "loading",
    calendar: null,
    calendarError: null,
    tableState: "loading",
    table: null,
    tableError: null,
    statusFilter: "todos",
    search: "",
    page: 1,
    pageSize: 10,
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-lider-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardLider(toLiderViewState(state));
  }

  async function loadCalendar(): Promise<void> {
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const month = await fetchComedorCalendarMonthMock(state.year, state.monthIndex);
      if (signal.aborted) return;
      state.calendar = month;
      state.calendarState = Object.keys(month.dayMetrics).length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.calendar = null;
      state.calendarState = "error";
      state.calendarError = error instanceof Error ? error.message : "Error al cargar calendario.";
    }
    paint();
  }

  async function loadKpis(): Promise<void> {
    state.statsState = "loading";
    state.statsError = null;
    paint();
    try {
      const rows = await fetchComedorTeamKpisMock();
      if (signal.aborted) return;
      state.stats = rows;
      state.statsState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.stats = null;
      state.statsState = "error";
      state.statsError = error instanceof Error ? error.message : "Error al cargar métricas.";
    }
    paint();
  }

  async function loadTable(): Promise<void> {
    state.tableState = "loading";
    state.tableError = null;
    paint();
    try {
      const page = await fetchComedorTeamReservationsMock({
        statusFilter: state.statusFilter,
        search: state.search,
        page: state.page,
        pageSize: state.pageSize,
      });
      if (signal.aborted) return;
      state.table = page;
      state.tableState = page.items.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.table = null;
      state.tableState = "error";
      state.tableError = error instanceof Error ? error.message : "Error al cargar tabla de reservas.";
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-lider-root">${renderComedorDashboardLider(toLiderViewState(state))}</div><div id="comedor-lider-new-request-modal-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-lider-root");
  const modalHost = container.querySelector<HTMLElement>("#comedor-lider-new-request-modal-host");
  const newRequestModal =
    modalHost ?
      mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        allowExternalPeople: false,
        loadMenuOptions: fetchComedorMenuOptionsMock,
        searchEmployees: searchComedorEmployeesFromDb,
        onSubmit: createComedorRequestMock,
      })
    : null;
  let tableSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-nuevo]")) {
        void newRequestModal?.open();
        return;
      }
      if (target.closest("[data-comedor-retry-kpis]")) {
        void loadKpis();
        return;
      }
      if (target.closest("[data-comedor-retry-calendar]")) {
        void loadCalendar();
        return;
      }
      if (target.closest("[data-comedor-retry-table]")) {
        void loadTable();
        return;
      }

      const statusBtn = target.closest<HTMLButtonElement>("[data-comedor-filter-status]");
      if (statusBtn) {
        const status = statusBtn.getAttribute("data-comedor-filter-status");
        if (status === "todos" || status === "confirmado" || status === "cancelado") {
          state.statusFilter = status;
          state.page = 1;
          void loadTable();
        }
        return;
      }

      const pageBtn = target.closest<HTMLButtonElement>("[data-comedor-page]");
      if (pageBtn && !pageBtn.disabled) {
        const raw = pageBtn.getAttribute("data-comedor-page");
        const page = raw ? Number.parseInt(raw, 10) : NaN;
        if (Number.isFinite(page) && page > 0) {
          state.page = page;
          void loadTable();
        }
        return;
      }

      const prevBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-prev-year]");
      if (prevBtn) {
        const year = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-year") ?? "", 10);
        const month = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const nextBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-next-year]");
      if (nextBtn) {
        const year = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-year") ?? "", 10);
        const month = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const todayBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-today-year]");
      if (todayBtn) {
        const year = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-year") ?? "", 10);
        const month = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-comedor-search]");
      if (!input) return;
      state.search = input.value;
      state.page = 1;
      if (tableSearchDebounceTimer != null) {
        window.clearTimeout(tableSearchDebounceTimer);
      }
      tableSearchDebounceTimer = window.setTimeout(() => {
        tableSearchDebounceTimer = null;
        void loadTable();
      }, 220);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    if (tableSearchDebounceTimer != null) {
      window.clearTimeout(tableSearchDebounceTimer);
      tableSearchDebounceTimer = null;
    }
    newRequestModal?.destroy();
  });

  void loadKpis();
  void loadCalendar();
  void loadTable();
}

function mountComedorEmpleado(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const state: EmpleadoComedorState = {
    calendarState: "loading",
    calendar: null,
    calendarError: null,
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-empleado-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardEmpleado(toEmpleadoViewState(state));
  }

  async function loadCalendar(): Promise<void> {
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const month = await fetchComedorCalendarMonthMock(state.year, state.monthIndex);
      if (signal.aborted) return;
      state.calendar = month;
      state.calendarState = Object.keys(month.dayMetrics).length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.calendar = null;
      state.calendarState = "error";
      state.calendarError = error instanceof Error ? error.message : "Error al cargar calendario.";
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-empleado-root">${renderComedorDashboardEmpleado(toEmpleadoViewState(state))}</div><div id="comedor-empleado-new-request-modal-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-empleado-root");
  const modalHost = container.querySelector<HTMLElement>("#comedor-empleado-new-request-modal-host");
  const empleadoId = getEmpleadoIdFromAccessToken();
  const empleadoNombre = getUserDisplayNameFromAccessToken();
  const newRequestModal =
    modalHost ?
      mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        allowExternalPeople: false,
        allowEmployeeSearch: false,
        fixedEmployee:
          empleadoId ?
            {
              id: empleadoId,
              nombre: empleadoNombre,
              numero: "Mi usuario",
              area: "Mi área",
              avatarUrl: null,
            }
          : null,
        loadMenuOptions: fetchComedorMenuOptionsMock,
        searchEmployees: async () => [],
        onSubmit: createComedorRequestMock,
      })
    : null;
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-nuevo]")) {
        void newRequestModal?.open();
        return;
      }
      if (target.closest("[data-comedor-retry-calendar]")) {
        void loadCalendar();
        return;
      }

      const prevBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-prev-year]");
      if (prevBtn) {
        const year = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-year") ?? "", 10);
        const month = Number.parseInt(prevBtn.getAttribute("data-comedor-cal-prev-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const nextBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-next-year]");
      if (nextBtn) {
        const year = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-year") ?? "", 10);
        const month = Number.parseInt(nextBtn.getAttribute("data-comedor-cal-next-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
        return;
      }

      const todayBtn = target.closest<HTMLButtonElement>("[data-comedor-cal-today-year]");
      if (todayBtn) {
        const year = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-year") ?? "", 10);
        const month = Number.parseInt(todayBtn.getAttribute("data-comedor-cal-today-month") ?? "", 10);
        if (Number.isFinite(year) && Number.isFinite(month)) {
          state.year = year;
          state.monthIndex = month;
          void loadCalendar();
        }
      }
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    newRequestModal?.destroy();
  });

  void loadCalendar();
}

export function mountComedor(container: HTMLElement, signal: AbortSignal): void {
  const hash = window.location.hash || "#/comedor";
  const isPlannerRoute = hash.startsWith("#/comedor/planear");
  if (isPlannerRoute) {
    if (canAccessComedorRhPage()) {
      mountComedorRhPlanner(container, signal);
      return;
    }
    history.replaceState(null, "", "#/comedor");
  }

  if (canAccessComedorRhPage()) {
    mountComedorRh(container, signal);
    return;
  }
  if (canAccessComedorLiderPage()) {
    mountComedorLider(container, signal);
    return;
  }
  if (canAccessEmpleadoPersonalDashboard()) {
    mountComedorEmpleado(container, signal);
    return;
  }
  mountComedorStub(container);
}
