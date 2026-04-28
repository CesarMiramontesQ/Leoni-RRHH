import {
  canAccessComedorLiderPage,
  canAccessComedorReportePage,
  canAccessComedorRhPage,
  canAccessEmpleadoPersonalDashboard,
  getEmpleadoDirectoryNumericIdFromAccessToken,
  getEmpleadoIdFromAccessToken,
  getRolFromAccessToken,
  getUserDisplayNameFromAccessToken,
} from "../auth/jwt.ts";
import { mountComedorCrearComedorModal } from "../components/comedor/comedorCrearComedorModal.ts";
import { mountComedorEditarComedorModal } from "../components/comedor/comedorEditarComedorModal.ts";
import { renderComedorGestionAdmin } from "../components/comedor/comedorGestionAdmin.ts";
import { mountComedorNewRequestModal } from "../components/comedor/comedorNewRequestModal.ts";
import {
  addYearsToIsoString,
  etiquetaTipoComida,
  primerLunesReservaComedorPermitidoIso,
} from "../utils/comedorReservaFechas.ts";
import {
  cancelarComedorAcceso,
  editarComedorAcceso,
  getComedorEstadisticas,
  getComedorMenuSemana,
  getComedorMisFechasOcupadas,
  getComedorMisProximasReservas,
  getComedorMisReservasMes,
  getComedorEquipoProximasReservas,
  getComedorEquipoReservasMes,
  getComedorEquipoBeneficiarios,
  getComedorPrimeraFechaReserva,
  getComedorProyecciones,
  getComedoresActivos,
  publicarComedorMenu,
  registrarComedorSeleccion,
  reservarComedorAcceso,
  isComedorApiError,
  type ComedorMisReservaApiItem,
  type MenuSemanalApiItem,
} from "../api/comedor.ts";
import { extraerPrimerNombreApellido } from "../utils/comedorNombreCorto.ts";
import type {
  ComedorCalendarMonth,
  ComedorEmployeeOption,
  ComedorKpi,
  ComedorMenuOption,
  ComedorPanelState,
  ComedorReservationsPage,
  ComedorTeamReservationsPage,
  ComedorSidebarDataset,
  ComedorWeekPlanner,
  ComedorWeekPlannerDay,
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
import { renderComedorReporteDashboard } from "../components/comedor/comedorReporteDashboard.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { mountDashboardPlaceholder } from "./dashboard.ts";
import { mountComedorStub } from "./shellModuleStubs.ts";
import type {
  ReporteComedorDatePreset,
  ReporteComedorKpi,
  ReporteComedorSortDirection,
  ReporteComedorSortKey,
  ReporteComedorTableResponse,
  ReporteComedorViewState,
} from "../comedor/reportes/types.ts";

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
    tableFilters: { search: state.search },
  };
}

type EmpleadoComedorState = {
  calendarState: ComedorPanelState;
  calendarError: string | null;
  proximasState: ComedorPanelState;
  proximasError: string | null;
  editingReservaId: number | null;
  editTipoComida: string;
  isSavingEdition: boolean;
  year: number;
  monthIndex: number;
} & Omit<
  ComedorDashboardEmpleadoViewState,
  | "calendarState"
  | "calendarError"
  | "proximasState"
  | "proximasError"
  | "editingReservaId"
  | "editTipoComida"
  | "isSavingEdition"
>;

function toEmpleadoViewState(state: EmpleadoComedorState): ComedorDashboardEmpleadoViewState {
  return {
    calendarState: state.calendarState,
    calendar: state.calendar,
    calendarError: state.calendarError,
    proximasState: state.proximasState,
    proximas: state.proximas,
    proximasError: state.proximasError,
    editingReservaId: state.editingReservaId,
    editTipoComida: state.editTipoComida,
    isSavingEdition: state.isSavingEdition,
  };
}

type ReporteComedorState = ReporteComedorViewState;

function toReporteViewState(state: ReporteComedorState): ReporteComedorViewState {
  return { ...state };
}

type ComedorGestionAdminState = {
  panelState: "loading" | "ready" | "empty" | "error";
  items: Awaited<ReturnType<typeof getComedoresActivos>>;
  errorMessage: string | null;
};

function emptyCalendarMonth(year: number, monthIndex: number): ComedorCalendarMonth {
  return {
    year,
    monthIndex,
    legend: [],
    dayMetrics: {},
  };
}

function emptyReservationsPage(page: number, pageSize: number): ComedorReservationsPage {
  return {
    items: [],
    total: 0,
    page,
    pageSize,
  };
}

function emptyTeamReservationsPage(page: number, pageSize: number): ComedorTeamReservationsPage {
  return {
    items: [],
    total: 0,
    page,
    pageSize,
  };
}

const WEEK_DAY_KEYS: readonly ComedorWeekPlannerDayKey[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
];

const WEEK_DAY_LABELS: Record<ComedorWeekPlannerDayKey, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
};

function dateToIso(value: Date): string {
  const y = String(value.getFullYear()).padStart(4, "0");
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value);
  out.setDate(out.getDate() + days);
  return out;
}

function mondayOf(value: Date): Date {
  const out = new Date(value);
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatWeekShortDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(value)
    .replace(".", "");
}

function formatWeekLabel(start: Date, end: Date): string {
  const startLabel = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(start)
    .replace(".", "");
  const endLabel = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(end)
    .replace(".", "");
  return `${startLabel} - ${endLabel}`;
}

function getCurrentWeekStartIso(): string {
  return dateToIso(mondayOf(new Date()));
}

function shiftWeekStartIso(weekStartIso: string, deltaWeeks: number): string {
  const start = isoToDate(weekStartIso);
  return dateToIso(addDays(start, deltaWeeks * 7));
}

function createBlankWeekByStartIso(weekStartIso: string): ComedorWeekPlanner {
  const start = isoToDate(weekStartIso);
  const end = addDays(start, 4);
  const dias: ComedorWeekPlannerDay[] = WEEK_DAY_KEYS.map((dayKey, index) => {
    const dayDate = addDays(start, index);
    return {
      key: dayKey,
      label: WEEK_DAY_LABELS[dayKey],
      fechaIso: dateToIso(dayDate),
      fechaCorta: formatWeekShortDate(dayDate),
      menuNormal: "",
      menuDieta: "",
      visibleEmpleados: false,
      fotoMenuDataUrl: null,
      fotoMenuNombre: null,
    };
  });
  return {
    weekStartIso,
    weekEndIso: dateToIso(end),
    weekLabel: formatWeekLabel(start, end),
    status: "borrador",
    dias,
  };
}

const DEFAULT_MENU_OPTIONS: readonly ComedorMenuOption[] = [
  { id: "normal", label: "Normal" },
  { id: "dieta", label: "Dieta" },
];

const DIA_TO_INDEX: Record<string, number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  miércoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  sábado: 5,
  domingo: 6,
};

function normalizeDayLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function startOfWeekIsoFromDateIso(dateIso: string): string {
  return dateToIso(mondayOf(isoToDate(dateIso)));
}

function weekStartsForVisibleRange(year: number, monthIndex: number): string[] {
  const { start, end } = calendarVisibleDateRange(year, monthIndex);
  const unique = new Set<string>();
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    unique.add(startOfWeekIsoFromDateIso(dateToIso(cursor)));
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

function calendarVisibleDateRange(year: number, monthIndex: number): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
} {
  const first = new Date(year, monthIndex, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - firstWeekday);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return {
    start,
    end,
    startIso: dateToIso(start),
    endIso: dateToIso(end),
  };
}

function monthsCoveredByVisibleRange(year: number, monthIndex: number): Array<{ year: number; month: number }> {
  const { start, end } = calendarVisibleDateRange(year, monthIndex);
  const out: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function mapMenusToCalendarMonth(
  year: number,
  monthIndex: number,
  menusByWeek: Record<string, MenuSemanalApiItem[]>,
): ComedorCalendarMonth {
  const visible = calendarVisibleDateRange(year, monthIndex);
  const dayMetrics: ComedorCalendarMonth["dayMetrics"] = {};

  for (const [weekStartIso, menus] of Object.entries(menusByWeek)) {
    const monday = isoToDate(weekStartIso);
    for (const menu of menus) {
      const dayIndex = DIA_TO_INDEX[normalizeDayLabel(menu.dia)];
      if (dayIndex == null) continue;
      const dayDate = addDays(monday, dayIndex);
      if (dayDate < visible.start || dayDate > visible.end) continue;
      const iso = dateToIso(dayDate);
      const tipo = normalizeDayLabel(menu.tipo);
      const tone = tipo.includes("diet") ? "dieta" : "normal";
      if (!dayMetrics[iso]) {
        dayMetrics[iso] = {
          isoDate: iso,
          reservas: 0,
          tags: [],
        };
      }
      dayMetrics[iso].reservas += 1;
      dayMetrics[iso].tags.push({
        id: `${menu.id}`,
        label: menu.tipo,
        tone,
      });
    }
  }

  return {
    year,
    monthIndex,
    legend: [
      { id: "normal", label: "Normal", dotClass: "bg-leoni-blue" },
      { id: "dieta", label: "Dieta", dotClass: "bg-emerald-500" },
    ],
    dayMetrics,
  };
}

function mapReservasEmpleadoToCalendarMonth(
  year: number,
  monthIndex: number,
  items: ComedorMisReservaApiItem[],
): ComedorCalendarMonth {
  const visible = calendarVisibleDateRange(year, monthIndex);
  const dayMetrics: ComedorCalendarMonth["dayMetrics"] = {};
  for (const r of items) {
    if (r.estado_acceso.trim().toUpperCase() === "EXPIRADO") continue;
    const dayDate = isoToDate(r.fecha_servicio);
    if (dayDate < visible.start || dayDate > visible.end) continue;
    const iso = dateToIso(dayDate);
    if (!dayMetrics[iso]) {
      dayMetrics[iso] = { isoDate: iso, reservas: 0, tags: [] };
    }
    dayMetrics[iso].reservas += 1;
    dayMetrics[iso].tags.push({
      id: `reserva-${r.id}`,
      label: etiquetaTipoComida(r.tipo_comida),
      tone: "reserva",
    });
  }
  return {
    year,
    monthIndex,
    legend: [{ id: "mis_reservas", label: "Mis reservas", dotClass: "bg-orange-500" }],
    dayMetrics,
  };
}

function mapReservasEquipoToCalendarMonth(
  year: number,
  monthIndex: number,
  items: Awaited<ReturnType<typeof getComedorEquipoReservasMes>>,
  currentUserId: number | null,
): ComedorCalendarMonth {
  const visible = calendarVisibleDateRange(year, monthIndex);
  const dayMetrics: ComedorCalendarMonth["dayMetrics"] = {};
  for (const r of items) {
    const dayDate = isoToDate(r.fecha_servicio);
    if (dayDate < visible.start || dayDate > visible.end) continue;
    const iso = dateToIso(dayDate);
    if (!dayMetrics[iso]) {
      dayMetrics[iso] = { isoDate: iso, reservas: 0, tags: [] };
    }
    const nombreCorto = (r.empleado_nombre_corto || "").trim() || extraerPrimerNombreApellido(r.empleado_nombre);
    dayMetrics[iso].reservas += 1;
    const isOwnReservation = currentUserId != null && r.empleado_id === currentUserId;
    dayMetrics[iso].tags.push(
      isOwnReservation
        ? {
            id: `equipo-${r.id}`,
            label: etiquetaTipoComida(r.tipo_comida),
            tone: "supervisor",
          }
        : {
            id: `equipo-${r.id}`,
            label: `Comida ${nombreCorto}`,
            tone: "reserva",
          },
    );
  }
  return {
    year,
    monthIndex,
    legend: [
      { id: "equipo_reservas", label: "Reservas de equipo", dotClass: "bg-orange-500" },
      { id: "mis_reservas_supervisor", label: "Mis reservas", dotClass: "bg-violet-500" },
    ],
    dayMetrics,
  };
}

function formatEstadoAccesoLabel(estadoAcceso: string): string {
  const key = estadoAcceso.trim().toUpperCase();
  if (key === "ACCEDIDO") return "Accedido";
  if (key === "PENDIENTE") return "Pendiente";
  return estadoAcceso;
}

function formatTipoComidaLabel(tipoComida: string): string {
  const key = tipoComida.trim().toLowerCase();
  if (key === "casera") return "Casera";
  if (key === "saludable") return "Saludable";
  return tipoComida;
}

function createComedorIdResolver(): {
  resolve: () => Promise<number | null>;
  invalidate: () => void;
} {
  let cached: number | null | undefined;
  return {
    resolve: async () => {
      if (cached !== undefined) return cached;
      const comedores = await getComedoresActivos();
      cached = comedores[0]?.id ?? null;
      return cached;
    },
    invalidate: () => {
      cached = undefined;
    },
  };
}

function mapEstadisticasToRhKpis(
  estadisticas: Awaited<ReturnType<typeof getComedorEstadisticas>>,
  capacidad: number | null,
): readonly ComedorKpi[] {
  const total = estadisticas.total_registros;
  const cap = capacidad && capacidad > 0 ? capacidad : null;
  const ocupacionPercent = cap ? Math.round((total / cap) * 100) : null;
  return [
    {
      id: "reservas_hoy",
      titulo: "Registros de la semana",
      valor: String(total),
      descripcion: `Semana ${estadisticas.semana}`,
      accentClass: "border-t-leoni-blue",
      progressPercent: cap ? Math.min(100, ocupacionPercent ?? 0) : undefined,
    },
    {
      id: "capacidad_total",
      titulo: "Capacidad diaria",
      valor: cap ? String(cap) : "—",
      descripcion: "Capacidad del comedor activo",
      accentClass: "border-t-sky-500",
      progressPercent: cap ? 100 : undefined,
    },
    {
      id: "ocupacion_actual",
      titulo: "Ocupación estimada",
      valor: ocupacionPercent == null ? "—" : `${ocupacionPercent}%`,
      descripcion: cap ? `${total} de ${cap}` : "Sin capacidad configurada",
      accentClass: "border-t-emerald-500",
      progressPercent: ocupacionPercent == null ? undefined : Math.min(100, ocupacionPercent),
    },
    {
      id: "dietas_especiales",
      titulo: "Dietas especiales",
      valor: String(estadisticas.dieta),
      descripcion: `Normales: ${estadisticas.normal}`,
      accentClass: "border-t-violet-500",
      progressPercent:
        estadisticas.total_registros > 0
          ? Math.round((estadisticas.dieta / estadisticas.total_registros) * 100)
          : 0,
    },
  ];
}

function mapProyeccionesToSidebar(
  proyecciones: Awaited<ReturnType<typeof getComedorProyecciones>>,
  estadisticas: Awaited<ReturnType<typeof getComedorEstadisticas>>,
): ComedorSidebarDataset {
  const weeklyOccupancy = Object.entries(proyecciones.ultimas_4_semanas)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([_week, values], idx) => {
      const total = Math.max(1, values.normal + values.dieta);
      const percent = Math.round((values.dieta / total) * 100);
      return { label: `Semana ${idx + 1}`, percent };
    });

  const total = Math.max(1, estadisticas.total_registros);
  const saludablePercent = Math.round((estadisticas.dieta / total) * 100);
  const regularPercent = Math.max(0, 100 - saludablePercent);

  return {
    alerts: [],
    weeklyOccupancy,
    dietDistribution: { saludablePercent, regularPercent },
    suggestion: {
      titulo: "Proyección semanal",
      mensaje: `Promedio semanal: ${proyecciones.promedio_semanal}.`,
      ctaLabel: "Actualizar",
    },
  };
}

function mapEstadisticasToReporteKpis(
  estadisticas: Awaited<ReturnType<typeof getComedorEstadisticas>>,
  proyecciones: Awaited<ReturnType<typeof getComedorProyecciones>>,
): readonly ReporteComedorKpi[] {
  return [
    {
      id: "total_empleados",
      label: "Total registros",
      valor: String(estadisticas.total_registros),
      secundario: `Semana ${estadisticas.semana}`,
      icono: "empleados",
    },
    {
      id: "promedio_asistencia",
      label: "Accesos concedidos",
      valor: String(estadisticas.acceso_concedido),
      secundario: "Registros validados por huella",
      icono: "asistencia",
    },
    {
      id: "dias_mayor_consumo",
      label: "Tipo de platillo",
      valor: estadisticas.dieta >= estadisticas.normal ? "Dieta" : "Normal",
      secundario: `Normal ${estadisticas.normal} / Dieta ${estadisticas.dieta}`,
      icono: "consumo",
    },
    {
      id: "costo_estimado",
      label: "Promedio semanal",
      valor: `${proyecciones.promedio_semanal}`,
      secundario: "Basado en últimas 4 semanas",
      icono: "costo",
    },
  ];
}

function toIsoDate(value: Date): string {
  const y = String(value.getFullYear()).padStart(4, "0");
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function dateRangeFromPreset(preset: Exclude<ReporteComedorDatePreset, "custom">): {
  inicioIso: string;
  finIso: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "last_7") {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { inicioIso: toIsoDate(start), finIso: toIsoDate(today) };
  }
  if (preset === "last_30") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { inicioIso: toIsoDate(start), finIso: toIsoDate(today) };
  }
  if (preset === "this_month") {
    return { inicioIso: toIsoDate(startOfMonth(today)), finIso: toIsoDate(endOfMonth(today)) };
  }
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    inicioIso: toIsoDate(startOfMonth(previousMonth)),
    finIso: toIsoDate(endOfMonth(previousMonth)),
  };
}

function toUpdatedLabel(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return formatter.format(timestamp);
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

function mountComedorGestionAdmin(container: HTMLElement, signal: AbortSignal): void {
  const state: ComedorGestionAdminState = {
    panelState: "loading",
    items: [],
    errorMessage: null,
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-admin-root");
    if (!root) return;
    root.innerHTML = renderComedorGestionAdmin(state);
  }

  async function loadComedores(): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    paint();
    try {
      const rows = await getComedoresActivos();
      if (signal.aborted) return;
      state.items = rows;
      state.panelState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.items = [];
      state.panelState = "error";
      state.errorMessage = error instanceof Error ? error.message : "Error al cargar comedores.";
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Gestión de comedores",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-admin-root">${renderComedorGestionAdmin(state)}</div><div id="comedor-admin-crear-host"></div><div id="comedor-admin-editar-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-admin-root");
  const crearHost = container.querySelector<HTMLElement>("#comedor-admin-crear-host");
  const editarHost = container.querySelector<HTMLElement>("#comedor-admin-editar-host");
  const crearModal =
    crearHost ?
      mountComedorCrearComedorModal(crearHost, {
        toastContainer: container,
        onCreated: async () => {
          await loadComedores();
        },
      })
    : null;
  const editarModal =
    editarHost ?
      mountComedorEditarComedorModal(editarHost, {
        toastContainer: container,
        onUpdated: async () => {
          await loadComedores();
        },
      })
    : null;

  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-admin-back]")) {
        window.location.hash = "#/comedor";
        return;
      }
      if (target.closest("[data-comedor-admin-add]")) {
        crearModal?.open();
        return;
      }
      if (target.closest("[data-comedor-admin-retry]")) {
        void loadComedores();
        return;
      }
      const editBtn = target.closest<HTMLButtonElement>("[data-comedor-admin-edit-id]");
      if (editBtn) {
        const comedorId = Number.parseInt(editBtn.getAttribute("data-comedor-admin-edit-id") ?? "", 10);
        if (!Number.isFinite(comedorId)) return;
        const comedor = state.items.find((item) => item.id === comedorId);
        if (!comedor) return;
        editarModal?.open(comedor);
      }
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    crearModal?.destroy();
    editarModal?.destroy();
  });

  void loadComedores();
}

function mountComedorRh(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
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
  let calendarRequestVersion = 0;

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
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.stats = [];
        state.statsState = "empty";
        paint();
        return;
      }
      const [comedores, estadisticas] = await Promise.all([
        getComedoresActivos(),
        getComedorEstadisticas(getCurrentWeekStartIso()),
      ]);
      const capacidad = comedores.find((c) => c.id === comedorId)?.capacidad ?? null;
      const rows = mapEstadisticasToRhKpis(estadisticas, capacidad);
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
    const requestVersion = ++calendarRequestVersion;
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.calendar = emptyCalendarMonth(state.year, state.monthIndex);
        state.calendarState = "ready";
        paint();
        return;
      }
      const weeks = weekStartsForVisibleRange(state.year, state.monthIndex);
      const menus = await Promise.all(
        weeks.map(async (weekStartIso) => [weekStartIso, await getComedorMenuSemana(comedorId, weekStartIso)] as const),
      );
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
      const month = mapMenusToCalendarMonth(state.year, state.monthIndex, Object.fromEntries(menus));
      state.calendar = month;
      state.calendarState = "ready";
    } catch (error) {
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
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
      const [proyecciones, estadisticas] = await Promise.all([
        getComedorProyecciones(),
        getComedorEstadisticas(getCurrentWeekStartIso()),
      ]);
      const dataset = mapProyeccionesToSidebar(proyecciones, estadisticas);
      if (signal.aborted) return;
      state.sidebar = dataset;
      state.sidebarState =
        dataset.alerts.length > 0 || dataset.weeklyOccupancy.length > 0 || dataset.dietDistribution.saludablePercent > 0
          ? "ready"
          : "empty";
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
    const page = emptyReservationsPage(state.page, state.pageSize);
    if (signal.aborted) return;
    state.table = page;
    state.tableState = "empty";
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-rh-root">${renderComedorDashboardRh(toViewState(state))}</div><div id="comedor-new-request-modal-host"></div><div id="comedor-rh-crear-comedor-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-rh-root");
  const modalHost = container.querySelector<HTMLElement>("#comedor-new-request-modal-host");
  const crearComedorHost = container.querySelector<HTMLElement>("#comedor-rh-crear-comedor-host");
  const crearComedorModal =
    crearComedorHost ?
      mountComedorCrearComedorModal(crearComedorHost, {
        toastContainer: container,
        onCreated: async () => {
          comedorIdResolver.invalidate();
          await Promise.all([loadKpis(), loadCalendar(), loadSidebar(), loadTable()]);
        },
      })
    : null;
  const newRequestModal =
    modalHost ?
      mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        allowExternalPeople: false,
        allowEmployeeSearch: false,
        loadMenuOptions: async () => {
          const comedorId = await resolveComedorId();
          if (comedorId == null) return DEFAULT_MENU_OPTIONS;
          const rows = await getComedorMenuSemana(comedorId, getCurrentWeekStartIso());
          const tipos = Array.from(new Set(rows.map((row) => normalizeDayLabel(row.tipo))));
          if (tipos.length === 0) return DEFAULT_MENU_OPTIONS;
          return tipos.map((tipo) => ({
            id: tipo,
            label: tipo === "dieta" ? "Dieta" : "Normal",
          }));
        },
        searchEmployees: searchComedorEmployeesFromDb,
        onSubmit: async (payload) => {
          const firstDate = payload.fechas[0];
          if (!firstDate) throw new Error("Selecciona al menos un día hábil.");
          const comedorId = await resolveComedorId();
          if (comedorId == null) throw new Error("No hay comedor activo configurado.");
          await registrarComedorSeleccion({
            comedorId,
            semanaIso: startOfWeekIsoFromDateIso(firstDate),
            tipoPlatillo: payload.menuId,
          });
        },
      })
    : null;
  let tableSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-gestionar]")) {
        window.location.hash = "#/comedor/gestion";
        return;
      }
      if (target.closest("[data-comedor-planear]")) {
        window.location.hash = "#/comedor/planear";
        return;
      }
      if (target.closest("[data-comedor-rh-crear-comedor]")) {
        crearComedorModal?.open();
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
    crearComedorModal?.destroy();
  });

  void loadKpis();
  void loadCalendar();
  void loadSidebar();
  void loadTable();
}

function mountComedorRhPlanner(container: HTMLElement, signal: AbortSignal): void {
  const initialWeek = createBlankWeekByStartIso(getCurrentWeekStartIso());
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
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
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.week = createBlankWeekByStartIso(weekStartIso);
        state.panelState = "empty";
        state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
        state.incompleteDaysCount = plannerIncompleteDays(state.week);
        paint();
        return;
      }
      const menus = await getComedorMenuSemana(comedorId, weekStartIso);
      const baseWeek = createBlankWeekByStartIso(weekStartIso);
      const byDay = new Map<string, MenuSemanalApiItem[]>();
      for (const menu of menus) {
        const day = normalizeDayLabel(menu.dia);
        const existing = byDay.get(day);
        if (existing) existing.push(menu);
        else byDay.set(day, [menu]);
      }
      state.week = {
        ...baseWeek,
        status: menus.length > 0 ? "publicado" : "borrador",
        dias: baseWeek.dias.map((day) => {
          const rows = byDay.get(day.key) ?? [];
          const normal = rows.find((row) => normalizeDayLabel(row.tipo) === "normal");
          const dieta = rows.find((row) => normalizeDayLabel(row.tipo) === "dieta");
          return {
            ...day,
            menuNormal: normal?.descripcion ?? "",
            menuDieta: dieta?.descripcion ?? "",
          };
        }),
      };
      if (signal.aborted) return;
      state.panelState = menus.length > 0 ? "ready" : "empty";
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
      if (signal.aborted) return;
      showEmpleadosToast(container, "Guardado de borrador en integracion con backend.", "error");
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
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        throw new Error("No hay comedor activo configurado.");
      }
      const payloads = state.week.dias.flatMap((day) => {
        const rows: { dia: string; tipo: string; descripcion: string }[] = [];
        if (day.menuNormal.trim()) {
          rows.push({ dia: day.key, tipo: "normal", descripcion: day.menuNormal.trim() });
        }
        if (day.menuDieta.trim()) {
          rows.push({ dia: day.key, tipo: "dieta", descripcion: day.menuDieta.trim() });
        }
        return rows;
      });
      await Promise.all(
        payloads.map((entry) =>
          publicarComedorMenu({
            comedorId,
            semanaIso: state.week.weekStartIso,
            dia: entry.dia,
            tipo: entry.tipo,
            descripcion: entry.descripcion,
          }),
        ),
      );
      if (signal.aborted) return;
      state.week = { ...state.week, status: "publicado" };
      state.panelState = state.week.dias.length > 0 ? "ready" : "empty";
      state.lastSavedAt = Date.now();
      showEmpleadosToast(container, "Semana publicada correctamente.", "success");
    } catch (error) {
      if (signal.aborted) return;
      showEmpleadosToast(
        container,
        error instanceof Error ? error.message : "No se pudo publicar la semana.",
        "error",
      );
    } finally {
      state.isPublishing = false;
      paint();
    }
  }

  async function duplicatePreviousWeek(): Promise<void> {
    state.isDuplicating = true;
    paint();
    try {
      if (signal.aborted) return;
      showEmpleadosToast(container, "Duplicado de semana en integracion con backend.", "error");
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
      if (signal.aborted) return;
      state.week = createBlankWeekByStartIso(state.week.weekStartIso);
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
  const isSupervisor = getRolFromAccessToken() === "supervisor";
  const currentUserId = getEmpleadoDirectoryNumericIdFromAccessToken();
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
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
    search: "",
    page: 1,
    pageSize: 10,
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };
  let calendarRequestVersion = 0;

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-lider-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardLider(toLiderViewState(state));
  }

  async function loadCalendar(): Promise<void> {
    const requestVersion = ++calendarRequestVersion;
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const monthsToLoad = monthsCoveredByVisibleRange(state.year, state.monthIndex);
      const reservasPorMes = await Promise.all(
        monthsToLoad.map(({ year, month }) => getComedorEquipoReservasMes(year, month)),
      );
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
      const reservas = reservasPorMes.flat();
      const reservasUnicas = Array.from(new Map(reservas.map((item) => [item.id, item])).values());
      const month = mapReservasEquipoToCalendarMonth(state.year, state.monthIndex, reservasUnicas, currentUserId);
      state.calendar = month;
      state.calendarState = "ready";
    } catch (error) {
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
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
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.stats = [];
        state.statsState = "empty";
        paint();
        return;
      }
      const [comedores, estadisticas] = await Promise.all([
        getComedoresActivos(),
        getComedorEstadisticas(getCurrentWeekStartIso()),
      ]);
      const capacidad = comedores.find((c) => c.id === comedorId)?.capacidad ?? null;
      const rows = mapEstadisticasToRhKpis(estadisticas, capacidad).slice(0, 2);
      if (signal.aborted) return;
      state.stats = rows;
      state.statsState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      if (isComedorApiError(error) && error.status === 403) {
        state.stats = [];
        state.statsState = "empty";
        state.statsError = null;
        paint();
        return;
      }
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
      const rows = await getComedorEquipoProximasReservas(200);
      if (signal.aborted) return;
      const search = state.search.trim().toLowerCase();
      const filtered = search
        ? rows.filter((row) => row.empleado_nombre.toLowerCase().includes(search))
        : rows;
      const start = (state.page - 1) * state.pageSize;
      const end = start + state.pageSize;
      state.table = {
        items: filtered.slice(start, end).map((row) => ({
          id: row.id,
          empleadoId: row.empleado_id,
          empleadoNombre: extraerPrimerNombreApellido(row.empleado_nombre),
          tipoComida: formatTipoComidaLabel(row.tipo_comida),
          fecha: row.fecha_servicio,
          estado: formatEstadoAccesoLabel(row.estado_acceso),
          canManage: currentUserId != null && row.empleado_id === currentUserId,
        })),
        total: filtered.length,
        page: state.page,
        pageSize: state.pageSize,
      };
      state.tableState = filtered.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.table = emptyTeamReservationsPage(state.page, state.pageSize);
      state.tableState = "error";
      state.tableError = error instanceof Error ? error.message : "Error al cargar registros del equipo.";
    }
    paint();
  }

  void (async () => {
    let fechaMinReservaIso = primerLunesReservaComedorPermitidoIso();
    try {
      const ref = await getComedorPrimeraFechaReserva();
      if (!signal.aborted && ref.fecha_iso?.trim()) {
        fechaMinReservaIso = ref.fecha_iso.trim();
      }
    } catch {
      /* fallback: cálculo local */
    }
    if (signal.aborted) return;

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
        allowEmployeeSearch: false,
        fechaMinReservaIso,
        menuFieldLabel: "Tipo de comida",
        loadMenuOptions: async () => [
          { id: "casera", label: "Casera" },
          { id: "saludable", label: "Saludable" },
        ],
        loadEmployeeOptions: isSupervisor
          ? async () => {
              const rows = await getComedorEquipoBeneficiarios();
              return rows.map((row) => ({
                id: String(row.empleado_id),
                nombre: row.nombre_corto,
                numero: row.no_empleado,
                area: row.empleado_id === rows[0]?.empleado_id ? "Mí mismo" : "Equipo directo",
                avatarUrl: null,
              }));
            }
          : undefined,
        searchEmployees: searchComedorEmployeesFromDb,
        onSubmit: async (payload) => {
          const comedorId = await resolveComedorId();
          if (comedorId == null) throw new Error("No hay comedor activo configurado.");
          const targetUserId = isSupervisor && payload.personType === "interno" && payload.employeeId
            ? Number.parseInt(payload.employeeId, 10)
            : undefined;
          if (isSupervisor && targetUserId != null && !Number.isFinite(targetUserId)) {
            throw new Error("Selecciona un beneficiario válido.");
          }
          await reservarComedorAcceso({
            comedorId,
            fechasIso: payload.fechas,
            tipoComida: payload.menuId,
            targetUserId,
          });
          await Promise.all([loadCalendar(), loadTable()]);
        },
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
        return;
      }

      const editBtn = target.closest<HTMLButtonElement>("[data-comedor-edit-acceso-id]");
      if (editBtn) {
        const accesoId = Number.parseInt(editBtn.getAttribute("data-comedor-edit-acceso-id") ?? "", 10);
        if (!Number.isFinite(accesoId)) return;
        const row = state.table?.items.find((item) => item.id === accesoId) ?? null;
        if (!row || !row.canManage) {
          showEmpleadosToast(container, "Solo puedes editar tus propios registros.", "error");
          return;
        }
        const tipoActual = row.tipoComida.trim().toLowerCase();
        const sugerido = tipoActual === "saludable" ? "saludable" : "casera";
        const nuevoTipo = window
          .prompt("Editar tipo de comida (casera/saludable):", sugerido)
          ?.trim()
          .toLowerCase();
        if (!nuevoTipo) return;
        if (nuevoTipo !== "casera" && nuevoTipo !== "saludable") {
          showEmpleadosToast(container, "Tipo de comida inválido.", "error");
          return;
        }
        void (async () => {
          try {
            await editarComedorAcceso({ accesoId, tipoComida: nuevoTipo });
            showEmpleadosToast(container, "Registro actualizado correctamente.", "success");
            await Promise.all([loadCalendar(), loadTable()]);
          } catch (error) {
            showEmpleadosToast(
              container,
              isComedorApiError(error) ? error.detail : "No se pudo actualizar el registro.",
              "error",
            );
          }
        })();
        return;
      }

      const cancelBtn = target.closest<HTMLButtonElement>("[data-comedor-cancel-acceso-id]");
      if (cancelBtn) {
        const accesoId = Number.parseInt(cancelBtn.getAttribute("data-comedor-cancel-acceso-id") ?? "", 10);
        if (!Number.isFinite(accesoId)) return;
        const row = state.table?.items.find((item) => item.id === accesoId) ?? null;
        if (!row || !row.canManage) {
          showEmpleadosToast(container, "Solo puedes cancelar tus propios registros.", "error");
          return;
        }
        const ok = window.confirm("¿Deseas cancelar este registro de comedor?");
        if (!ok) return;
        void (async () => {
          try {
            await cancelarComedorAcceso(accesoId);
            showEmpleadosToast(container, "Registro cancelado correctamente.", "success");
            await Promise.all([loadCalendar(), loadTable()]);
          } catch (error) {
            showEmpleadosToast(
              container,
              isComedorApiError(error) ? error.detail : "No se pudo cancelar el registro.",
              "error",
            );
          }
        })();
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
  })();
}

function mountComedorEmpleado(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
  const state: EmpleadoComedorState = {
    calendarState: "loading",
    calendar: null,
    calendarError: null,
    proximasState: "loading",
    proximas: [],
    proximasError: null,
    editingReservaId: null,
    editTipoComida: "casera",
    isSavingEdition: false,
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };
  let calendarRequestVersion = 0;

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-empleado-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardEmpleado(toEmpleadoViewState(state));
  }

  async function loadCalendar(): Promise<void> {
    const requestVersion = ++calendarRequestVersion;
    state.calendarState = "loading";
    state.calendarError = null;
    paint();
    try {
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.calendar = emptyCalendarMonth(state.year, state.monthIndex);
        state.calendarState = "ready";
        paint();
        return;
      }
      const monthsToLoad = monthsCoveredByVisibleRange(state.year, state.monthIndex);
      const reservasPorMes = await Promise.all(
        monthsToLoad.map(({ year, month }) => getComedorMisReservasMes(year, month)),
      );
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
      const reservas = reservasPorMes.flat();
      const reservasUnicas = Array.from(new Map(reservas.map((item) => [item.id, item])).values());
      state.calendar = mapReservasEmpleadoToCalendarMonth(state.year, state.monthIndex, reservasUnicas);
      state.calendarState = "ready";
    } catch (error) {
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
      state.calendar = null;
      state.calendarState = "error";
      state.calendarError = isComedorApiError(error)
        ? error.detail
        : error instanceof Error
          ? error.message
          : "Error al cargar calendario.";
    }
    paint();
  }

  async function loadProximas(): Promise<void> {
    state.proximasState = "loading";
    state.proximasError = null;
    paint();
    try {
      const rows = await getComedorMisProximasReservas(5);
      if (signal.aborted) return;
      state.proximas = rows.filter((row) => row.estado_acceso.trim().toUpperCase() !== "EXPIRADO");
      state.proximasState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.proximas = [];
      state.proximasState = "error";
      state.proximasError = isComedorApiError(error)
        ? error.detail
        : error instanceof Error
          ? error.message
          : "Error al cargar próximas asistencias.";
    }
    paint();
  }

  function findProximaById(accesoId: number): EmpleadoComedorState["proximas"][number] | null {
    return state.proximas.find((row) => row.id === accesoId) ?? null;
  }

  void (async () => {
    let fechaMinReservaIso = primerLunesReservaComedorPermitidoIso();
    try {
      const ref = await getComedorPrimeraFechaReserva();
      if (!signal.aborted && ref.fecha_iso?.trim()) {
        fechaMinReservaIso = ref.fecha_iso.trim();
      }
    } catch {
      /* fallback: cálculo local */
    }
    if (signal.aborted) return;

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
          fechaMinReservaIso,
          loadFechasBloqueadas: async () => {
            const desde = fechaMinReservaIso;
            const hasta = addYearsToIsoString(desde, 1);
            const { fechas } = await getComedorMisFechasOcupadas(desde, hasta);
            return fechas;
          },
          menuFieldLabel: "Opción de comida",
          fixedEmployee:
            empleadoId ?
              {
                id: empleadoId,
                nombre: empleadoNombre,
                numero: empleadoId,
                area: "Sin area",
                avatarUrl: null,
              }
            : null,
          loadMenuOptions: async () => [
            { id: "casera", label: "Casera" },
            { id: "saludable", label: "Saludable" },
          ],
          searchEmployees: async () => [],
          onSubmit: async (payload) => {
            const firstDate = payload.fechas[0];
            if (!firstDate) throw new Error("Selecciona al menos un día hábil.");
            const comedorId = await resolveComedorId();
            if (comedorId == null) throw new Error("No hay comedor activo configurado.");
            const semanaIso = startOfWeekIsoFromDateIso(firstDate);
            const intentarReserva = async () => {
              await reservarComedorAcceso({
                comedorId,
                fechasIso: payload.fechas,
                tipoComida: payload.menuId,
              });
            };
            try {
              await intentarReserva();
            } catch (error) {
              if (
                isComedorApiError(error) &&
                typeof error.detail === "string" &&
                error.detail.toLowerCase().includes("selecci")
              ) {
                await registrarComedorSeleccion({
                  comedorId,
                  semanaIso,
                  tipoPlatillo: "normal",
                });
                await intentarReserva();
              } else {
                throw error;
              }
            }
            await Promise.all([loadCalendar(), loadProximas()]);
          },
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
        if (target.closest("[data-comedor-retry-proximas]")) {
          void loadProximas();
          return;
        }

        const editBtn = target.closest<HTMLButtonElement>("[data-comedor-edit-acceso-id]");
        if (editBtn) {
          const accesoId = Number.parseInt(editBtn.getAttribute("data-comedor-edit-acceso-id") ?? "", 10);
          if (!Number.isFinite(accesoId)) return;
          const row = findProximaById(accesoId);
          if (!row) return;
          if (row.fecha_servicio < fechaMinReservaIso) {
            showEmpleadosToast(
              container,
              "Solo puedes editar reservas de semanas futuras.",
              "error",
            );
            return;
          }
          state.editingReservaId = accesoId;
          state.editTipoComida = row.tipo_comida;
          state.isSavingEdition = false;
          paint();
          return;
        }

        const cancelBtn = target.closest<HTMLButtonElement>("[data-comedor-cancel-acceso-id]");
        if (cancelBtn) {
          const accesoId = Number.parseInt(cancelBtn.getAttribute("data-comedor-cancel-acceso-id") ?? "", 10);
          if (!Number.isFinite(accesoId)) return;
          const row = findProximaById(accesoId);
          if (!row) return;
          if (row.fecha_servicio < fechaMinReservaIso) {
            showEmpleadosToast(
              container,
              "Solo puedes cancelar reservas de semanas futuras.",
              "error",
            );
            return;
          }
          const ok = window.confirm("¿Deseas cancelar este registro de comedor?");
          if (!ok) return;
          void (async () => {
            try {
              await cancelarComedorAcceso(accesoId);
              showEmpleadosToast(container, "Registro cancelado correctamente.", "success");
              await Promise.all([loadCalendar(), loadProximas()]);
            } catch (error) {
              showEmpleadosToast(
                container,
                isComedorApiError(error)
                  ? error.detail
                  : "No se pudo cancelar el registro.",
                "error",
              );
            }
          })();
          return;
        }

        if (target.closest("[data-comedor-edit-cancel]")) {
          state.editingReservaId = null;
          state.isSavingEdition = false;
          paint();
          return;
        }

        if (target.closest("[data-comedor-edit-save]")) {
          if (state.editingReservaId == null || state.isSavingEdition) return;
          state.isSavingEdition = true;
          paint();
          void (async () => {
            try {
              await editarComedorAcceso({
                accesoId: state.editingReservaId as number,
                tipoComida: state.editTipoComida,
              });
              state.editingReservaId = null;
              state.isSavingEdition = false;
              showEmpleadosToast(container, "Registro actualizado correctamente.", "success");
              await Promise.all([loadCalendar(), loadProximas()]);
            } catch (error) {
              state.isSavingEdition = false;
              paint();
              showEmpleadosToast(
                container,
                isComedorApiError(error)
                  ? error.detail
                  : "No se pudo actualizar el registro.",
                "error",
              );
            }
          })();
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
      "change",
      (event) => {
        const select = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-comedor-edit-tipo-comida]");
        if (!select) return;
        state.editTipoComida = select.value;
      },
      { signal },
    );

    signal.addEventListener("abort", () => {
      newRequestModal?.destroy();
    });

    void loadCalendar();
    void loadProximas();
  })();
}

function mountComedorReporte(container: HTMLElement, signal: AbortSignal): void {
  const initialRange = dateRangeFromPreset("this_month");
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
  const state: ReporteComedorState = {
    filtersDataset: {
      departamentos: [{ id: "todos", label: "Todos los departamentos" }],
      turnos: [{ id: "todos", label: "Todos los turnos" }],
      fechaInicioIso: initialRange.inicioIso,
      fechaFinIso: initialRange.finIso,
    },
    draftDepartamentoId: "todos",
    draftTurnoId: "todos",
    draftFechaInicioIso: initialRange.inicioIso,
    draftFechaFinIso: initialRange.finIso,
    draftDatePreset: "this_month",
    selectedDepartamentoId: "todos",
    selectedTurnoId: "todos",
    selectedFechaInicioIso: initialRange.inicioIso,
    selectedFechaFinIso: initialRange.finIso,
    kpisState: "loading",
    kpis: null,
    kpisError: null,
    tableState: "loading",
    table: null,
    tableError: null,
    tableSearch: "",
    tableSortKey: "dias_mes",
    tableSortDirection: "desc",
    lastUpdatedLabel: null,
    selectedEmpleadoId: null,
  };

  function normalizeSelection(): void {
    const empleados = state.table?.empleados ?? [];
    if (empleados.length === 0) {
      state.selectedEmpleadoId = null;
      return;
    }
    const stillExists = empleados.some((item) => item.id === state.selectedEmpleadoId);
    if (!stillExists) {
      state.selectedEmpleadoId = empleados[0]?.id ?? null;
    }
  }

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-reporte-root");
    if (!root) return;
    root.innerHTML = renderComedorReporteDashboard(toReporteViewState(state));
  }

  async function loadFilters(): Promise<void> {
    try {
      const comedores = await getComedoresActivos();
      const dataset = {
        ...state.filtersDataset,
        departamentos: [
          { id: "todos", label: "Todos los comedores" },
          ...comedores.map((item) => ({ id: String(item.id), label: item.nombre })),
        ],
      };
      if (signal.aborted) return;
      state.filtersDataset = dataset;
      state.selectedDepartamentoId = dataset.departamentos[0]?.id ?? "todos";
      state.selectedTurnoId = dataset.turnos[0]?.id ?? "todos";
      state.selectedFechaInicioIso = dataset.fechaInicioIso;
      state.selectedFechaFinIso = dataset.fechaFinIso;
      state.draftDepartamentoId = state.selectedDepartamentoId;
      state.draftTurnoId = state.selectedTurnoId;
      state.draftFechaInicioIso = state.selectedFechaInicioIso;
      state.draftFechaFinIso = state.selectedFechaFinIso;
      state.draftDatePreset = "custom";
    } catch {
      if (signal.aborted) return;
    }
    paint();
  }

  async function loadKpis(): Promise<void> {
    state.kpisState = "loading";
    state.kpisError = null;
    paint();
    try {
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.kpis = [];
        state.kpisState = "empty";
        paint();
        return;
      }
      const [estadisticas, proyecciones] = await Promise.all([
        getComedorEstadisticas(getCurrentWeekStartIso()),
        getComedorProyecciones(),
      ]);
      const rows = mapEstadisticasToReporteKpis(estadisticas, proyecciones);
      if (signal.aborted) return;
      state.kpis = rows;
      state.kpisState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.kpis = null;
      state.kpisState = "error";
      state.kpisError = error instanceof Error ? error.message : "Error al cargar métricas.";
    }
    paint();
  }

  async function loadTable(): Promise<void> {
    state.tableState = "loading";
    state.tableError = null;
    paint();
    const dataset: ReporteComedorTableResponse = { empleados: [] };
    if (signal.aborted) return;
    state.table = dataset;
    state.tableState = "empty";
    normalizeSelection();
    paint();
  }

  async function reloadAll(): Promise<void> {
    await Promise.all([loadKpis(), loadTable()]);
    if (signal.aborted) return;
    state.lastUpdatedLabel = toUpdatedLabel(Date.now());
    paint();
  }

  function applyFilters(): void {
    state.selectedDepartamentoId = state.draftDepartamentoId;
    state.selectedTurnoId = state.draftTurnoId;
    state.selectedFechaInicioIso = state.draftFechaInicioIso;
    state.selectedFechaFinIso = state.draftFechaFinIso;
    void reloadAll();
  }

  function clearFilters(): void {
    const defaultDepartamentoId = state.filtersDataset.departamentos[0]?.id ?? "todos";
    const defaultTurnoId = state.filtersDataset.turnos[0]?.id ?? "todos";
    const inicioIso = state.filtersDataset.fechaInicioIso;
    const finIso = state.filtersDataset.fechaFinIso;
    state.draftDepartamentoId = defaultDepartamentoId;
    state.draftTurnoId = defaultTurnoId;
    state.draftFechaInicioIso = inicioIso;
    state.draftFechaFinIso = finIso;
    state.draftDatePreset = "custom";
    applyFilters();
  }

  function applyDatePreset(preset: Exclude<ReporteComedorDatePreset, "custom">): void {
    const range = dateRangeFromPreset(preset);
    state.draftDatePreset = preset;
    state.draftFechaInicioIso = range.inicioIso;
    state.draftFechaFinIso = range.finIso;
    paint();
  }

  function removeActiveChip(chip: "departamento" | "turno" | "fecha"): void {
    if (chip === "departamento") {
      state.draftDepartamentoId = state.filtersDataset.departamentos[0]?.id ?? "todos";
    }
    if (chip === "turno") {
      state.draftTurnoId = state.filtersDataset.turnos[0]?.id ?? "todos";
    }
    if (chip === "fecha") {
      state.draftFechaInicioIso = state.filtersDataset.fechaInicioIso;
      state.draftFechaFinIso = state.filtersDataset.fechaFinIso;
      state.draftDatePreset = "custom";
    }
    applyFilters();
  }

  function updateTableSort(nextKey: ReporteComedorSortKey): void {
    if (state.tableSortKey === nextKey) {
      state.tableSortDirection = state.tableSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.tableSortKey = nextKey;
      const defaultDir: ReporteComedorSortDirection = nextKey === "nombre" ? "asc" : "desc";
      state.tableSortDirection = defaultDir;
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Reporte comedor",
    activeNav: "reportes",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="comedor-reporte-root">${renderComedorReporteDashboard(toReporteViewState(state))}</div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-reporte-root");
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-reporte-retry-kpis]")) {
        void loadKpis();
        return;
      }
      if (target.closest("[data-comedor-reporte-retry-table]")) {
        void loadTable();
        return;
      }
      if (target.closest("[data-comedor-reporte-clear-filters]")) {
        clearFilters();
        return;
      }
      const presetBtn = target.closest<HTMLButtonElement>("[data-comedor-reporte-date-preset]");
      if (presetBtn) {
        const preset = presetBtn.getAttribute("data-comedor-reporte-date-preset");
        if (preset === "last_7" || preset === "last_30" || preset === "this_month" || preset === "previous_month") {
          applyDatePreset(preset);
        }
        return;
      }
      const clearChipBtn = target.closest<HTMLButtonElement>("[data-comedor-reporte-clear-chip]");
      if (clearChipBtn) {
        const chip = clearChipBtn.getAttribute("data-comedor-reporte-clear-chip");
        if (chip === "departamento" || chip === "turno" || chip === "fecha") {
          removeActiveChip(chip);
        }
        return;
      }
      const sortBtn = target.closest<HTMLButtonElement>("[data-comedor-reporte-sort]");
      if (sortBtn) {
        const key = sortBtn.getAttribute("data-comedor-reporte-sort");
        if (key === "nombre" || key === "dias_mes" || key === "menu" || key === "estado") {
          updateTableSort(key);
        }
        return;
      }
      const row = target.closest<HTMLElement>("[data-comedor-reporte-row]");
      if (row) {
        state.selectedEmpleadoId = row.getAttribute("data-comedor-reporte-row");
        paint();
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;
      const filter = target.closest<HTMLElement>("[data-comedor-reporte-filter]");
      if (!filter) return;
      const key = filter.getAttribute("data-comedor-reporte-filter");
      if (!key) return;
      if (key === "departamento" && filter instanceof HTMLSelectElement) {
        state.draftDepartamentoId = filter.value;
      }
      if (key === "turno" && filter instanceof HTMLSelectElement) {
        state.draftTurnoId = filter.value;
      }
      if (key === "fecha_inicio" && filter instanceof HTMLInputElement) {
        state.draftFechaInicioIso = filter.value;
        state.draftDatePreset = "custom";
      }
      if (key === "fecha_fin" && filter instanceof HTMLInputElement) {
        state.draftFechaFinIso = filter.value;
        state.draftDatePreset = "custom";
      }
      paint();
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;
      const search = target.closest<HTMLInputElement>("[data-comedor-reporte-search]");
      if (!search) return;
      state.tableSearch = search.value;
      paint();
    },
    { signal },
  );

  void loadFilters().then(() => {
    if (signal.aborted) return;
    void reloadAll();
  });
}

export function mountComedor(container: HTMLElement, signal: AbortSignal): void {
  const hash = window.location.hash || "#/comedor";
  const isGestionRoute = hash.startsWith("#/comedor/gestion");
  if (isGestionRoute) {
    if (canAccessComedorRhPage()) {
      mountComedorGestionAdmin(container, signal);
      return;
    }
    history.replaceState(null, "", "#/");
    mountDashboardPlaceholder(container);
    return;
  }

  const isPlannerRoute = hash.startsWith("#/comedor/planear");
  if (isPlannerRoute) {
    if (canAccessComedorRhPage()) {
      mountComedorRhPlanner(container, signal);
      return;
    }
    history.replaceState(null, "", "#/comedor");
  }

  const isReporteRoute = hash.startsWith("#/comedor/reporte");
  if (isReporteRoute) {
    if (canAccessComedorReportePage()) {
      mountComedorReporte(container, signal);
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
