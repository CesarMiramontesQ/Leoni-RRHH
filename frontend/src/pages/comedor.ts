import {
  canAccessComedorAjustesPage,
  canAccessComedorLiderPage,
  canAccessComedorPersonalForRh,
  canAccessComedorPlanearPage,
  canAccessComedorReportePage,
  canAccessComedorRhPage,
  canAccessEmpleadoPersonalDashboard,
  getEffectiveGestorNavRol,
  getEmpleadoDirectoryNumericIdFromAccessToken,
  getEmpleadoIdFromAccessToken,
  getNoEmpleadoFromAccessToken,
  hasRhOperativeViewerContextOrGrant,
  getRolFromAccessToken,
  getUserDisplayNameFromAccessToken,
} from "../auth/jwt.ts";
import { hasExplicitModuleGrant } from "../auth/rhModulePermissions.ts";
import { getAuthMe } from "../api/auth.ts";
import { refreshAccessTokenSession } from "../api/http.ts";
import { mountComedorAsignarComedorModal } from "../components/comedor/comedorAsignarComedorModal.ts";
import { mountComedorCrearComedorModal } from "../components/comedor/comedorCrearComedorModal.ts";
import { mountComedorNewRequestModal } from "../components/comedor/comedorNewRequestModal.ts";
import {
  addYearsToIsoString,
  etiquetaTipoComida,
  hoyReservaComedorIso,
  primerLunesReservaComedorPermitidoIso,
} from "../utils/comedorReservaFechas.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import {
  cancelarComedorAcceso,
  crearComedorRhRegistro,
  editarComedorAcceso,
  getComedorRhCodigosExternos,
  type ComedorCodigoExternoApiItem,
  getComedorEstadisticas,
  getComedorMenuSemana,
  eliminarComedorMenuSemana,
  getComedorMisFechasOcupadas,
  getComedorMisProximasReservas,
  getComedorMisReservasMes,
  getComedorEquipoProximasReservas,
  getComedorRhRegistrosReporte,
  getComedorRhResumenDiario,
  getComedorEquipoMetricas,
  getComedorEquipoBeneficiarios,
  getComedorPrimeraFechaReserva,
  getComedorProyecciones,
  getComedoresActivos,
  getComedorAsignado,
  registrarComedorSeleccion,
  reservarComedorAcceso,
  buscarComedorRhEmpleados,
  isComedorApiError,
  type ComedorRhRegistroResponseApi,
  type ComedorMisReservaApiItem,
  type MenuSemanalApiItem,
} from "../api/comedor.ts";
import { extraerPrimerNombreApellido } from "../utils/comedorNombreCorto.ts";
import type {
  ComedorCalendarMonth,
  ComedorEmployeeOption,
  ComedorKpi,
  ComedorPanelState,
  ComedorSupervisorTableSegment,
  ComedorTeamReservationsPage,
  ComedorSidebarDataset,
  ComedorWeekPlanner,
  ComedorWeekPlannerDay,
  ComedorWeekPlannerDayKey,
} from "../comedor/rh/types.ts";
import {
  cloneMenuDiaDetalle,
  createEmptyMenuDiaDetalle,
  parseMenuDiaDetalleFromApi,
  type ComedorMenuDiaDetalle,
} from "../comedor/rh/menuDayDetalle.ts";
import {
  createComedorMenuDelDiaLoader,
  persistComedorDayMenu,
  persistComedorWeekMenu,
} from "../comedor/rh/loadMenuDelDia.ts";
import type { PlaneacionMenuTemplateDay } from "../comedor/rh/parsePlaneacionMenuTemplate.ts";
import {
  isComedorWeekPlannerDayKey,
  WEEK_PLANNER_DAY_KEYS,
  WEEK_PLANNER_DAY_LABELS,
} from "../comedor/rh/weekPlannerDays.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import {
  COMEDOR_EMPLEADO_PROXIMAS_PAGE_SIZE,
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
import { mountComedorWeeklyPlanningImportModal } from "../components/comedor/comedorWeeklyPlanningImportModal.ts";
import { mountComedorClearWeekModal } from "../components/comedor/comedorClearWeekModal.ts";
import { mountComedorDayMenuEditModal } from "../components/comedor/comedorDayMenuEditModal.ts";
import { renderComedorDashboardRh, type ComedorDashboardRhViewState } from "../components/comedor/comedorDashboardRh.ts";
import {
  buildRhPlatillosPorSemana,
  getCurrentWeekStartIso,
  mapProyeccionesToSidebar,
} from "../comedor/rh/buildRhComedorSidebar.ts";
import { isoFromWeekInput, weekInputFromIso } from "../comedor/rh/weekRange.ts";
import { reporteDetalleRowsSorted } from "../components/comedor/comedorReporteAnalytics.ts";
import { renderComedorReporteDashboard } from "../components/comedor/comedorReporteDashboard.ts";
import { downloadReporteComedorExcel } from "../comedor/reportes/exportReporteComedorExcel.ts";
import {
  COMEDOR_TABLE_TH,
  comedorLiderOcultaKpisOpcionAb,
  comedorLiderStatsGridClass,
  comedorLiderStatsSkeletonCount,
  escapeComedorHtml,
  filterComedorKpisOpcionAb,
} from "../components/comedor/comedorUiUtils.ts";
import { mountComedorAjustes } from "./comedorAjustes.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderComedorBackBar } from "../navigation/comedorBackLink.ts";
import {
  BTN_GHOST,
  FILTER_FIELD_WRAP,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
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
import type { ComedorRhProximoRegistroRow } from "../comedor/rh/types.ts";
import {
  clasificarEstadoOps,
  diasEnPeriodoCalendario,
  filterPorAreaSeleccion,
  filterPorComedorSeleccion,
  filterProximosPorRango,
  reporteAreaFilterOptions,
  sumResumenDiario,
} from "../comedor/reportes/reporteAggregations.ts";

function esViewerRhComedor(
  grantKey: "comedor-registro" | "comedor-ajustes" | "comedor-planear" | "reportes",
): boolean {
  return hasRhOperativeViewerContextOrGrant(grantKey);
}

/** Mismo contenedor visual que Solicitudes (`#rh-comedor-page` activa estilos en `style.css`). */
const COMEDOR_DASHBOARD_PAGE_SHELL =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

const COMEDOR_DASHBOARD_MAIN_CLASS = "py-0";

type RhComedorState = {
  statsState: ComedorPanelState;
  statsError: string | null;
  calendarState: ComedorPanelState;
  calendarError: string | null;
  sidebarState: ComedorPanelState;
  sidebarError: string | null;
  year: number;
  monthIndex: number;
} & Omit<
  ComedorDashboardRhViewState,
  "statsState" | "statsError" | "calendarState" | "calendarError" | "sidebarState" | "sidebarError"
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
  };
}

type LiderComedorState = {
  statsState: ComedorPanelState;
  statsError: string | null;
  tableState: ComedorPanelState;
  tableError: string | null;
  search: string;
  page: number;
  pageSize: number;
  /** Solo aplica filtros de segmento en `loadTable` cuando `isSupervisorTable` es true. */
  tableSegment: ComedorSupervisorTableSegment;
  isSupervisorTable: boolean;
  /** Oculta KPIs «% Opción A» / «% Opción B» (supervisor y gerente). */
  hideOpcionKpis: boolean;
} & Omit<
  ComedorDashboardLiderViewState,
  | "statsState"
  | "statsError"
  | "statsGridClass"
  | "statsSkeletonCount"
  | "tableState"
  | "tableError"
  | "tableFilters"
>;

function toLiderViewState(state: LiderComedorState): ComedorDashboardLiderViewState {
  return {
    statsState: state.statsState,
    stats: state.stats,
    statsError: state.statsError,
    statsGridClass: comedorLiderStatsGridClass(state.hideOpcionKpis),
    statsSkeletonCount: comedorLiderStatsSkeletonCount(state.hideOpcionKpis),
    tableState: state.tableState,
    table: state.table,
    tableError: state.tableError,
    tableFilters: {
      search: state.search,
      supervisorSegment: state.tableSegment,
      showSupervisorSegment: state.isSupervisorTable,
    },
  };
}

type EmpleadoComedorState = {
  calendarState: ComedorPanelState;
  calendarError: string | null;
  proximasState: ComedorPanelState;
  proximasError: string | null;
  proximasPage: number;
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
  | "proximasPage"
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
    proximasPage: state.proximasPage,
    editingReservaId: state.editingReservaId,
    editTipoComida: state.editTipoComida,
    isSavingEdition: state.isSavingEdition,
  };
}

type ReporteComedorState = ReporteComedorViewState;

function toReporteViewState(state: ReporteComedorState): ReporteComedorViewState {
  return { ...state };
}

function emptyCalendarMonth(year: number, monthIndex: number): ComedorCalendarMonth {
  return {
    year,
    monthIndex,
    legend: [],
    dayMetrics: {},
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

function shiftWeekStartIso(weekStartIso: string, deltaWeeks: number): string {
  const start = isoToDate(weekStartIso);
  return dateToIso(addDays(start, deltaWeeks * 7));
}

function createBlankWeekByStartIso(weekStartIso: string): ComedorWeekPlanner {
  const start = isoToDate(weekStartIso);
  const end = addDays(start, 6);
  const dias: ComedorWeekPlannerDay[] = WEEK_PLANNER_DAY_KEYS.map((dayKey, index) => {
    const dayDate = addDays(start, index);
    return {
      key: dayKey,
      label: WEEK_PLANNER_DAY_LABELS[dayKey],
      fechaIso: dateToIso(dayDate),
      fechaCorta: formatWeekShortDate(dayDate),
      menuNormal: "",
      menuDieta: "",
      detalle: createEmptyMenuDiaDetalle(),
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

function mergeImportedDaysIntoWeek(
  weekStartIso: string,
  days: PlaneacionMenuTemplateDay[],
): ComedorWeekPlanner {
  const byKey = new Map(days.map((day) => [day.key, day]));
  const baseWeek = createBlankWeekByStartIso(weekStartIso);
  return {
    ...baseWeek,
    status: "borrador",
    dias: baseWeek.dias.map((day) => {
      const imported = byKey.get(day.key);
      if (!imported) return day;
      return {
        ...day,
        menuNormal: imported.menuNormal,
        menuDieta: imported.menuDieta,
        detalle: cloneMenuDiaDetalle(imported.detalle),
      };
    }),
  };
}

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

function mapResumenRhToCalendarMonth(
  year: number,
  monthIndex: number,
  items: Awaited<ReturnType<typeof getComedorRhResumenDiario>>,
): ComedorCalendarMonth {
  const visible = calendarVisibleDateRange(year, monthIndex);
  const dayMetrics: ComedorCalendarMonth["dayMetrics"] = {};
  for (const r of items) {
    const dayDate = isoToDate(r.fecha);
    if (dayDate < visible.start || dayDate > visible.end) continue;
    const iso = dateToIso(dayDate);
    const caseras = Number.isFinite(r.caseras) ? Math.max(0, r.caseras) : 0;
    const saludables = Number.isFinite(r.saludables) ? Math.max(0, r.saludables) : 0;
    dayMetrics[iso] = {
      isoDate: iso,
      reservas: caseras + saludables,
      tags: [
        { id: `rh-caseras-${iso}`, label: `${caseras} Opción A`, tone: "normal" },
        { id: `rh-saludables-${iso}`, label: `${saludables} Opción B`, tone: "dieta" },
      ],
    };
  }
  return {
    year,
    monthIndex,
    legend: [
      { id: "rh-caseras", label: "Opción A", dotClass: "bg-leoni-blue" },
      { id: "rh-saludables", label: "Opción B", dotClass: "bg-emerald-500" },
    ],
    dayMetrics,
  };
}

function formatEstadoAccesoLabel(estadoAcceso: string): string {
  const key = estadoAcceso.trim().toUpperCase();
  if (key === "ACCEDIDO") return "Accedido";
  if (key === "PENDIENTE") return "Pendiente";
  if (key === "REPETIDO") return "Repetido";
  return estadoAcceso;
}

function formatTipoComidaLabel(tipoComida: string): string {
  const key = tipoComida.trim().toLowerCase();
  if (key === "casera") return "Opción A";
  if (key === "saludable") return "Opción B";
  return tipoComida;
}

function createComedorIdResolver(options?: {
  getTargetUserId?: () => number | undefined;
  /** RH: primer comedor activo del catálogo (publicar menú, externos). */
  rhAdmin?: boolean;
}): {
  resolve: () => Promise<number | null>;
  invalidate: () => void;
} {
  let cacheKey: string | undefined;
  let cached: number | null | undefined;
  return {
    resolve: async () => {
      if (options?.rhAdmin) {
        if (cached !== undefined) return cached;
        const comedores = await getComedoresActivos();
        cached = comedores[0]?.id ?? null;
        return cached;
      }
      const target = options?.getTargetUserId?.();
      const key = target != null ? `t:${target}` : "self";
      if (cached !== undefined && cacheKey === key) return cached;
      try {
        const { comedor_id } = await getComedorAsignado(target);
        cacheKey = key;
        cached = comedor_id;
        return cached;
      } catch {
        cacheKey = key;
        cached = null;
        return null;
      }
    },
    invalidate: () => {
      cacheKey = undefined;
      cached = undefined;
    },
  };
}

function mapEstadisticasToRhKpis(
  estadisticas: Awaited<ReturnType<typeof getComedorEstadisticas>>,
  estadisticasProximaSemana: Awaited<ReturnType<typeof getComedorEstadisticas>>,
  vistaComidasRh: boolean,
): readonly ComedorKpi[] {
  const totalRegistros = estadisticas.total_registros;
  const totalComidasSemana =
    typeof estadisticas.total_comidas === "number" && Number.isFinite(estadisticas.total_comidas) ?
      Math.max(0, estadisticas.total_comidas)
    : Math.max(0, estadisticas.normal + estadisticas.dieta);
  const totalComidasProxima =
    typeof estadisticasProximaSemana.total_comidas === "number"
    && Number.isFinite(estadisticasProximaSemana.total_comidas) ?
      Math.max(0, estadisticasProximaSemana.total_comidas)
    : Math.max(0, estadisticasProximaSemana.normal + estadisticasProximaSemana.dieta);

  const valorSemana = vistaComidasRh ? totalComidasSemana : totalRegistros;
  const valorProximaSemana = vistaComidasRh ? totalComidasProxima : estadisticasProximaSemana.total_registros;

  const porcentajeAsistencia =
    totalRegistros > 0 ? Math.round((estadisticas.acceso_concedido / totalRegistros) * 100) : 0;
  const labelComidasORegistros = vistaComidasRh ? "Comidas registradas" : "Registros";
  return [
    {
      id: "reservas_hoy",
      titulo: "Semana actual",
      valor: String(valorSemana),
      descripcion: `${labelComidasORegistros}\nSemana ${estadisticas.semana}`,
      accentClass: "border-t-leoni-blue",
      progressPercent: undefined,
    },
    {
      id: "registros_proxima_semana",
      titulo: "Próxima semana",
      valor: String(valorProximaSemana),
      descripcion: `${labelComidasORegistros}\nPlaneación semanal`,
      accentClass: "border-t-sky-500",
      progressPercent: undefined,
    },
    {
      id: "ocupacion_actual",
      titulo: "Registros activos",
      valor: String(totalRegistros),
      descripcion: "Confirmados\nSemana actual",
      accentClass: "border-t-emerald-500",
      progressPercent: undefined,
    },
    {
      id: "porcentaje_asistencia",
      titulo: "Asistencia",
      valor: `${porcentajeAsistencia}%`,
      descripcion: `Asistencia vs registro\n${estadisticas.acceso_concedido} asistencias de ${totalRegistros} registros`,
      accentClass: "border-t-violet-500",
      progressPercent: porcentajeAsistencia,
    },
  ];
}

function mapMetricasLiderToKpis(metricas: Awaited<ReturnType<typeof getComedorEquipoMetricas>>): readonly ComedorKpi[] {
  return [
    {
      id: "semana_actual_total",
      titulo: "Comidas semana actual",
      valor: String(metricas.semana_actual_total ?? 0),
      descripcion: "Reservas activas y confirmadas (lunes a domingo).",
      accentClass: "border-t-leoni-blue",
    },
    {
      id: "semana_proxima_total",
      titulo: "Comidas semana próxima",
      valor: String(metricas.semana_proxima_total ?? 0),
      descripcion: "Reservas activas y confirmadas para la próxima semana.",
      accentClass: "border-t-sky-500",
    },
    {
      id: "porcentaje_asistencia",
      titulo: "Asistencia del equipo",
      valor: `${metricas.porcentaje_asistencia ?? 0}%`,
      descripcion: `Asistencia vs reserva\n${metricas.total_asistencias ?? 0} asistencias de ${metricas.total_activas ?? 0} registros del equipo.`,
      accentClass: "border-t-violet-500",
      progressPercent: metricas.porcentaje_asistencia ?? 0,
    },
    {
      id: "porcentaje_caseras",
      titulo: "% Opción A",
      valor: `${metricas.porcentaje_caseras ?? 0}%`,
      descripcion: `Sobre ${metricas.total_activas ?? 0} reservas activas/confirmadas.`,
      accentClass: "border-t-emerald-500",
      progressPercent: metricas.porcentaje_caseras ?? 0,
    },
    {
      id: "porcentaje_saludables",
      titulo: "% Opción B",
      valor: `${metricas.porcentaje_saludables ?? 0}%`,
      descripcion: `Sobre ${metricas.total_activas ?? 0} reservas activas/confirmadas.`,
      accentClass: "border-t-violet-500",
      progressPercent: metricas.porcentaje_saludables ?? 0,
    },
  ];
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
      secundario: "Basado en últimas 4 semanas (referencia histórica)",
      icono: "costo",
    },
  ];
}

function conteosOpcionAyB(rows: readonly ComedorRhProximoRegistroRow[]): { caseras: number; saludables: number } {
  let caseras = 0;
  let saludables = 0;
  for (const r of rows) {
    const t = (r.tipo_comida || "").trim().toLowerCase();
    if (t === "casera") caseras += 1;
    else if (t === "saludable") saludables += 1;
  }
  return { caseras, saludables };
}

function mapRhReporteKpis(
  resumen: Awaited<ReturnType<typeof getComedorRhResumenDiario>>,
  desdeIso: string,
  hastaIso: string,
  opsEnRangoYcomedor: readonly ComedorRhProximoRegistroRow[],
  areaFilter: "todos" | string,
  areaDisplayLabel: string | null,
): readonly ReporteComedorKpi[] {
  const diasCal = diasEnPeriodoCalendario(desdeIso, hastaIso);
  const sum = sumResumenDiario(resumen);
  let caseras: number;
  let saludables: number;
  let total: number;
  if (areaFilter === "todos") {
    caseras = sum.caseras;
    saludables = sum.saludables;
    total = caseras + saludables;
  } else {
    const c = conteosOpcionAyB(opsEnRangoYcomedor);
    caseras = c.caseras;
    saludables = c.saludables;
    total = opsEnRangoYcomedor.length;
  }
  const promedioDiario = diasCal > 0 ? (total / diasCal).toFixed(1) : "0";
  const comedoresSet = new Set(opsEnRangoYcomedor.map((r) => (r.comedor_nombre || "").trim()).filter(Boolean));
  const empleadosSet = new Set(opsEnRangoYcomedor.map((r) => r.empleado_id));
  let acc = 0;
  let pend = 0;
  let canc = 0;
  for (const r of opsEnRangoYcomedor) {
    const c = clasificarEstadoOps(r.estado_acceso);
    if (c === "confirmado") acc += 1;
    else if (c === "cancelado") canc += 1;
    else pend += 1;
  }
  const mixValor =
    total > 0
      ? `${Math.round((caseras / total) * 100)}% / ${Math.round((saludables / total) * 100)}%`
      : "—";
  const mixSecundario =
    areaFilter === "todos"
      ? "Distribución sobre el total consolidado del periodo"
      : `Filtro aplicado: solo ${areaDisplayLabel ?? "área seleccionada"}.`;
  const promedioDiarioSec =
    areaFilter === "todos"
      ? `${diasCal} días calendario · Resumen diario RH`
      : `${diasCal} días calendario · Registros operativos por área`;
  return [
    {
      id: "total_registros_resumen",
      label: "Total registros (consolidado)",
      valor: String(total),
      secundario: `Opción A ${caseras} · Opción B ${saludables}`,
      icono: "empleados",
    },
    {
      id: "promedio_diario_resumen",
      label: "Promedio diario",
      valor: promedioDiario,
      secundario: promedioDiarioSec,
      icono: "costo",
    },
    {
      id: "mix_menu_resumen",
      label: "Mix Opción A / Opción B",
      valor: mixValor,
      secundario: mixSecundario,
      icono: "consumo",
    },
    {
      id: "empleados_unicos_operativo",
      label: "Empleados únicos",
      valor: String(empleadosSet.size),
      secundario: "Basado en registros operativos del periodo seleccionado",
      icono: "empleados",
    },
    {
      id: "accedidos_operativo",
      label: "Accedidos",
      valor: String(acc),
      secundario: "Registros operativos en el periodo (huella validada)",
      icono: "asistencia",
    },
    {
      id: "pendientes_operativo",
      label: "Pendientes",
      valor: String(pend),
      secundario: "Registros operativos en el periodo",
      icono: "consumo",
    },
    {
      id: "cancelados_operativo",
      label: "Cancelados / expirados",
      valor: String(canc),
      secundario: "Registros operativos en el periodo",
      icono: "costo",
    },
    {
      id: "comedores_activos_operativo",
      label: "Comedores con registros",
      valor: String(comedoresSet.size),
      secundario:
        comedoresSet.size > 0 ? "Comedores distintos en registros del periodo" : "Sin registros en el periodo",
      icono: "asistencia",
    },
  ];
}

/** Registros operativos en el rango del reporte (inclusive), alineado con resumen-diario RH. */
async function fetchAllRhRegistrosReportePages(
  desdeIso: string,
  hastaIso: string,
  filtroEstado: "todos" | "confirmado" | "cancelado",
): Promise<readonly ComedorRhProximoRegistroRow[]> {
  const pageSize = 50 as const;
  let page = 1;
  const all: ComedorRhProximoRegistroRow[] = [];
  let total = Infinity;
  while (all.length < total) {
    const raw = await getComedorRhRegistrosReporte(desdeIso, hastaIso, page, pageSize, { filtroEstado });
    all.push(...raw.items);
    total = raw.total;
    if (raw.items.length === 0) break;
    page += 1;
    if (page > 400) break;
  }
  return all;
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
  if (preset === "today") {
    const iso = toIsoDate(today);
    return { inicioIso: iso, finIso: iso };
  }
  if (preset === "this_week") {
    const dow = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { inicioIso: toIsoDate(start), finIso: toIsoDate(end) };
  }
  if (preset === "next_week") {
    const dow = (today.getDay() + 6) % 7;
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dow);
    const start = new Date(thisWeekStart);
    start.setDate(thisWeekStart.getDate() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { inicioIso: toIsoDate(start), finIso: toIsoDate(end) };
  }
  if (preset === "this_month") {
    return { inicioIso: toIsoDate(startOfMonth(today)), finIso: toIsoDate(endOfMonth(today)) };
  }
  const _never: never = preset;
  throw new Error(`Preset de fecha no contemplado: ${String(_never)}`);
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
  isDuplicating: boolean;
};

function toPlannerViewState(state: RhPlannerState): ComedorWeeklyPlannerViewState {
  return {
    panelState: state.panelState,
    errorMessage: state.errorMessage,
    week: state.week,
    weekPickerValue: state.weekPickerValue,
    selectedDayKey: state.selectedDayKey,
    isDuplicating: state.isDuplicating,
  };
}

async function searchComedorEmployeesFromDb(query: string): Promise<readonly ComedorEmployeeOption[]> {
  const q = query.trim();
  if (!q) return [];
  if (q.length < 2) return [];
  const page = await buscarComedorRhEmpleados(q, 8);
  return page.items.map((item) => ({
    id: String(item.empleado_id),
    nombre: item.nombre,
    numero: formatNoEmpleadoDisplay(item.no_empleado),
    area: item.area ?? "Sin área",
    avatarUrl: null,
  }));
}

async function resolveEmpleadoOptionForComedor(
  empleadoId: string | null,
  empleadoNombre: string,
  noEmpleadoJwt: string | null,
): Promise<ComedorEmployeeOption | null> {
  if (!empleadoId && !noEmpleadoJwt && !empleadoNombre.trim()) return null;
  const numeroFallback = formatNoEmpleadoDisplay(noEmpleadoJwt || empleadoId || "");
  const base: ComedorEmployeeOption = {
    id: empleadoId ?? "",
    nombre: empleadoNombre.trim() || "Empleado",
    numero: numeroFallback || "—",
    area: "Sin área",
    avatarUrl: null,
  };
  if (canAccessEmpleadoPersonalDashboard()) {
    try {
      const me = await getAuthMe();
      const areaLabel = me.area?.descripcion?.trim();
      return {
        id: String(me.empleado_id),
        nombre: me.nombre?.trim() || base.nombre,
        numero: formatNoEmpleadoDisplay(me.no_empleado) || base.numero,
        area: areaLabel || base.area,
        avatarUrl: null,
      };
    } catch {
      return base;
    }
  }
  const q = (noEmpleadoJwt || empleadoId || empleadoNombre).trim();
  if (!q) return base;
  try {
    const page = await buscarComedorRhEmpleados(q, 8);
    const exactByNoEmpleado = noEmpleadoJwt ?
      page.items.find((item) => formatNoEmpleadoDisplay(item.no_empleado) === formatNoEmpleadoDisplay(noEmpleadoJwt))
    : undefined;
    const exactByEmpleadoId = empleadoId ?
      page.items.find((item) => String(item.empleado_id) === String(empleadoId))
    : undefined;
    const picked = exactByNoEmpleado ?? exactByEmpleadoId ?? page.items[0];
    if (!picked) return base;
    return {
      id: String(picked.empleado_id),
      nombre: picked.nombre || base.nombre,
      numero: formatNoEmpleadoDisplay(picked.no_empleado) || base.numero,
      area: picked.area ?? base.area,
      avatarUrl: null,
    };
  } catch {
    return base;
  }
}

function mountComedorRh(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const comedorIdResolver = createComedorIdResolver({ rhAdmin: true });
  const resolveComedorId = () => comedorIdResolver.resolve();
  const loadMenuDelDia = createComedorMenuDelDiaLoader(resolveComedorId);
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
      const currentWeekStartIso = getCurrentWeekStartIso();
      const nextWeekStartIso = shiftWeekStartIso(currentWeekStartIso, 1);
      const [estadisticasActual, estadisticasProxima] = await Promise.all([
        getComedorEstadisticas(currentWeekStartIso),
        getComedorEstadisticas(nextWeekStartIso),
      ]);
      const vistaComidasRh = esViewerRhComedor("comedor-registro");
      const rows = mapEstadisticasToRhKpis(estadisticasActual, estadisticasProxima, vistaComidasRh);
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
      const visible = calendarVisibleDateRange(state.year, state.monthIndex);
      const resumen = await getComedorRhResumenDiario(visible.startIso, visible.endIso);
      if (signal.aborted || requestVersion !== calendarRequestVersion) return;
      const month = mapResumenRhToCalendarMonth(state.year, state.monthIndex, resumen);
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
      const weekStartIso = getCurrentWeekStartIso();
      const desde4SemanasIso = dateToIso(addDays(isoToDate(weekStartIso), -21));
      const weekEndIso = dateToIso(addDays(isoToDate(weekStartIso), 6));
      const incluirResumenRh = esViewerRhComedor("comedor-registro");
      const [proyecciones, estadisticas, resumenSemanaRh] = await Promise.all([
        getComedorProyecciones(),
        getComedorEstadisticas(weekStartIso),
        incluirResumenRh ? getComedorRhResumenDiario(desde4SemanasIso, weekEndIso) : Promise.resolve([]),
      ]);
      let dataset: ComedorSidebarDataset = mapProyeccionesToSidebar(proyecciones, estadisticas);
      if (incluirResumenRh) {
        dataset = {
          ...dataset,
          rhPlatillosPorSemana: buildRhPlatillosPorSemana(resumenSemanaRh, weekStartIso),
        };
      }
      if (signal.aborted) return;
      state.sidebar = dataset;
      state.sidebarState =
        dataset.alerts.length > 0 ||
        dataset.weeklyOccupancy.length > 0 ||
        dataset.dietDistribution.saludablePercent > 0 ||
        (dataset.rhPlatillosPorSemana?.length ?? 0) > 0
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

  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainClass: COMEDOR_DASHBOARD_MAIN_CLASS,
    mainHtml: `<div id="rh-comedor-page" class="${COMEDOR_DASHBOARD_PAGE_SHELL}">${renderComedorBackBar()}<div id="comedor-rh-root">${renderComedorDashboardRh(toViewState(state))}</div></div><div id="comedor-new-request-modal-host"></div><div id="comedor-rh-crear-comedor-host"></div><div id="comedor-rh-asignar-comedor-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-rh-root");
  const modalHost = container.querySelector<HTMLElement>("#comedor-new-request-modal-host");
  const crearComedorHost = container.querySelector<HTMLElement>("#comedor-rh-crear-comedor-host");
  const asignarComedorHost = container.querySelector<HTMLElement>("#comedor-rh-asignar-comedor-host");
  const crearComedorModal =
    crearComedorHost ?
      mountComedorCrearComedorModal(crearComedorHost, {
        toastContainer: container,
        onCreated: async () => {
          comedorIdResolver.invalidate();
          await Promise.all([loadKpis(), loadCalendar(), loadSidebar()]);
        },
      })
    : null;
  const asignarComedorModal =
    asignarComedorHost ?
      mountComedorAsignarComedorModal(asignarComedorHost, {
        toastContainer: container,
        onSaved: async () => {
          await loadSidebar();
        },
      })
    : null;
  const newRequestModal =
    modalHost ?
      mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        allowExternalPeople: true,
        allowEmployeeSearch: true,
        fechaMinReservaIso: hoyReservaComedorIso(),
        fechaServicioMinMensaje: "No se pueden registrar comidas para días pasados.",
        fechaMinHint: "Solo fechas de hoy en adelante.",
        menuFieldLabel: "Tipo de comida",
        loadMenuOptions: async () => {
          return [
            { id: "casera", label: "Opción A" },
            { id: "saludable", label: "Opción B" },
          ];
        },
        loadMenuDelDia,
        searchEmployees: searchComedorEmployeesFromDb,
        onSubmit: async (payload) => {
          const comedorId = await resolveComedorId();
          if (comedorId == null) throw new Error("No hay comedor activo configurado.");
          const employeeId =
            payload.personType === "interno" && payload.employeeId
              ? Number.parseInt(payload.employeeId, 10)
              : null;
          return await crearComedorRhRegistro({
            personType: payload.personType,
            comedorId,
            fechasIso: payload.fechas,
            tipoComida: payload.menuId,
            employeeId,
            externalPeopleCount: payload.externalPeopleCount,
            observaciones: payload.observaciones,
          });
        },
        onSuccess: async (result, payload) => {
          const data = result as ComedorRhRegistroResponseApi | null;
          await Promise.all([loadKpis(), loadCalendar(), loadSidebar()]);
          if (!data || payload.personType !== "externo" || !data.credenciales_temporales) return;
          const cred = data.credenciales_temporales;
          const lineasPases = cred.pases.map(
            (p, i) =>
              `  ${i + 1}. Usuario/código: ${p.codigo_acceso}  |  Contraseña: ${p.password_temporal}`,
          );
          window.alert(
            [
              "Credenciales temporales generadas (una por persona):",
              `Lote: ${cred.lote_id}`,
              `Vigencia: ${cred.valido_desde} al ${cred.valido_hasta}`,
              "En terminal de comedor: usuario = código mostrado, contraseña = la de cada fila.",
              ...lineasPases,
            ].join("\n"),
          );
        },
      })
    : null;
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const externalCodesRouteBtn = target.closest<HTMLButtonElement>("[data-comedor-external-codes-route]");
      if (externalCodesRouteBtn) {
        const route = externalCodesRouteBtn.getAttribute("data-comedor-external-codes-route");
        if (route) window.location.hash = route;
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

      const alertBtn = target.closest<HTMLButtonElement>("[data-comedor-alert-id]");
      if (alertBtn) {
        const alertId = alertBtn.getAttribute("data-comedor-alert-id");
        if (alertId === "empleados-sin-comedor-asignado") {
          void asignarComedorModal?.open();
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

  signal.addEventListener("abort", () => {
    newRequestModal?.destroy();
    crearComedorModal?.destroy();
  });

  void loadKpis();
  void loadCalendar();
  void loadSidebar();
}

function mountComedorRhCodigosExternos(container: HTMLElement, signal: AbortSignal): void {
  type CodigoEstatus = "todos" | "ACTIVO" | "USADO_PARCIAL" | "USADO_TOTAL";

  const DATE_RANGE_MSG = "La fecha inicial no puede ser posterior a la fecha final.";

  function formatIsoDateMx(iso: string): string {
    if (!iso) return "";
    const parts = iso.split("-").map((x) => Number.parseInt(x, 10));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return iso;
    const [y, m, d] = parts;
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(y, (m ?? 1) - 1, d ?? 1),
    );
  }

  function estatusFiltroLabel(e: CodigoEstatus): string {
    switch (e) {
      case "todos":
        return "Todos";
      case "ACTIVO":
        return "ACTIVO";
      case "USADO_PARCIAL":
        return "USADO_PARCIAL";
      case "USADO_TOTAL":
        return "USADO_TOTAL";
      default:
        return String(e);
    }
  }

  function tipoComidaLabel(tipo: string): string {
    return tipo === "casera" ? "Opción A" : "Opción B";
  }

  function tipoComidaBadgeClass(tipo: string): string {
    return tipo === "casera"
      ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
      : "border-sky-200/90 bg-sky-50 text-sky-900";
  }

  function dateRangeInvalid(): boolean {
    if (!state.desdeIso || !state.hastaIso) return false;
    return state.desdeIso > state.hastaIso;
  }

  function statusBadgeHtml(estatus: ComedorCodigoExternoApiItem["estatus"]): string {
    const dot = (cls: string) =>
      `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
    switch (estatus) {
      case "VENCIDO":
        return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">${dot("bg-red-400")}<span>${escapeComedorHtml(estatus)}</span></span>`;
      case "USADO_TOTAL":
        return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">${dot("bg-emerald-500")}<span>${escapeComedorHtml(estatus)}</span></span>`;
      case "USADO_PARCIAL":
        return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">${dot("bg-amber-400")}<span>${escapeComedorHtml(estatus)}</span></span>`;
      default:
        return `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900">${dot("bg-blue-500")}<span>${escapeComedorHtml(estatus)}</span></span>`;
    }
  }

  function iconKpiGrid(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM3.75 15.75a2.25 2.25 0 0 1 2.25-2.25h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" /></svg>`;
  }

  function iconKpiChart(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>`;
  }

  function iconKpiUsers(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.21-8.482 9.338 9.338 0 0 0 .464 9.062ZM12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>`;
  }

  function renderKpiCard(opts: {
    title: string;
    value: string | number;
    desc: string;
    footer: string;
    icon: string;
    variantClass: string;
    iconTintClass: string;
  }): string {
    return `
    <article class="rh-comedor-kpi-card rh-sol-kpi-card ${opts.variantClass} flex min-h-[8.5rem] flex-col rounded-2xl border p-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition-[box-shadow,transform,border-color] duration-200 motion-reduce:transition-none sm:min-h-46 sm:p-5">
      <header class="flex items-start gap-2.5">
        <div class="rh-sol-kpi-card__icon rh-comedor-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px] ${opts.iconTintClass}" aria-hidden="true">${opts.icon}</div>
        <p class="min-w-0 flex-1 pt-0.5 text-[13px] font-bold leading-tight tracking-tight text-[#475569]">${escapeComedorHtml(opts.title)}</p>
      </header>
      <div class="mt-3 min-w-0 flex-1 sm:mt-4">
        <p class="text-[clamp(1.65rem,4vw,2.1rem)] font-extrabold tabular-nums leading-none tracking-tight text-[#0f172a]">${escapeComedorHtml(String(opts.value))}</p>
        <p class="mt-2 text-[13px] leading-snug text-[#64748b]">${escapeComedorHtml(opts.desc)}</p>
        <p class="mt-1.5 text-[11px] font-medium leading-snug text-[#94a3b8]">${escapeComedorHtml(opts.footer)}</p>
      </div>
    </article>`;
  }

  function renderKpisSection(rows: readonly ComedorCodigoExternoApiItem[]): string {
    const total = rows.length;
    const usosSum = rows.reduce((acc, r) => acc + (Number.isFinite(r.usados) ? r.usados : 0), 0);
    const cuposSum = rows.reduce((acc, r) => acc + (Number.isFinite(r.cantidad_personas) ? r.cantidad_personas : 0), 0);

    const cards = [
      renderKpiCard({
        title: "Total de códigos",
        value: total,
        desc: "Registros vigentes en pantalla.",
        footer: "Los vencidos no se listan; siguen en base de datos.",
        icon: iconKpiGrid(),
        variantClass: "rh-comedor-kpi--semana-actual",
        iconTintClass: "text-[#1e40af]",
      }),
      renderKpiCard({
        title: "Usos (hoy)",
        value: usosSum,
        desc: "Suma de usados en las filas.",
        footer: "Acumulado del listado visible.",
        icon: iconKpiChart(),
        variantClass: "rh-comedor-kpi--asistencia",
        iconTintClass: "text-violet-700",
      }),
      renderKpiCard({
        title: "Cupos totales",
        value: cuposSum,
        desc: "Suma de cantidad (personas).",
        footer: "Capacidad acumulada del listado.",
        icon: iconKpiUsers(),
        variantClass: "rh-comedor-kpi--proxima-semana",
        iconTintClass: "text-slate-700",
      }),
    ].join("");

    return `
      <section aria-label="Resumen de códigos externos" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">${cards}</section>`;
  }

  function renderLoadingShell(): string {
    const bar = (w: string) =>
      `<div class="h-3 ${w} rounded-md bg-slate-200/85 motion-safe:animate-pulse"></div>`;
    const kpiSkel = `
      <div class="flex min-h-[8.5rem] flex-col rounded-2xl border border-[rgba(148,163,184,0.2)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:min-h-46 sm:p-5 motion-safe:animate-pulse">
        <div class="flex items-center gap-2.5">
          <div class="size-11 shrink-0 rounded-[12px] bg-slate-200/90"></div>
          <div class="h-3.5 flex-1 rounded-md bg-slate-200/75"></div>
        </div>
        <div class="mt-4 space-y-2">
          <div class="h-8 w-28 rounded-md bg-slate-200/90"></div>
          ${bar("max-w-[200px]")}
          ${bar("w-2/3")}
        </div>
      </div>`;
    return `
      <div class="flex flex-col gap-5 sm:gap-6">
        <div class="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 motion-safe:animate-pulse sm:p-7">
          <div class="h-8 max-w-md rounded-lg bg-slate-200/80"></div>
          <div class="mt-3 h-4 max-w-xl rounded-md bg-slate-100/90"></div>
          <div class="mt-6 h-px w-full bg-slate-100"></div>
          <div class="mt-4 grid gap-2 sm:grid-cols-2">
            ${bar("max-w-xs")}
            ${bar("max-w-xs")}
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${Array.from({ length: 3 }, () => kpiSkel).join("")}
        </div>
        <div class="rh-sol-filters-card rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 sm:p-5 motion-safe:animate-pulse">
          <div class="flex flex-wrap gap-3">
            ${bar("h-10 w-40")}
            ${bar("h-10 w-40")}
            ${bar("h-10 w-48")}
            ${bar("h-10 w-28")}
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 sm:p-4 motion-safe:animate-pulse">
          <div class="h-10 rounded-lg bg-slate-100/90"></div>
          <div class="mt-3 space-y-2">
            ${Array.from({ length: 6 }, () => `<div class="h-12 rounded-lg bg-slate-50"></div>`).join("")}
          </div>
        </div>
      </div>`;
  }

  const state: {
    panelState: ComedorPanelState;
    errorMessage: string | null;
    desdeIso: string;
    hastaIso: string;
    estatus: CodigoEstatus;
    rows: Awaited<ReturnType<typeof getComedorRhCodigosExternos>>;
    dateRangeError: string | null;
  } = {
    panelState: "loading",
    errorMessage: null,
    desdeIso: "",
    hastaIso: "",
    estatus: "todos",
    rows: [],
    dateRangeError: null,
  };

  function render(): string {
    if (state.panelState === "loading") {
      return renderLoadingShell();
    }
    if (state.panelState === "error") {
      return `<div class="rounded-2xl border border-red-200/90 bg-gradient-to-br from-red-50 via-white to-red-50/40 px-5 py-6 text-sm text-red-900 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ring-1 ring-red-900/5">
        <p class="font-semibold text-[#111827]">No se pudo cargar el listado</p>
        <p class="mt-2 leading-relaxed text-red-800/95">${escapeComedorHtml(state.errorMessage ?? "Error al cargar códigos externos.")}</p>
        <button type="button" data-comedor-codigos-retry class="rh-sol-btn-primary mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-[10px] px-4 py-2 text-sm font-semibold sm:w-auto">Reintentar</button>
      </div>`;
    }

    const periodoHtml = (() => {
      if (state.desdeIso && state.hastaIso) {
        return `<p class="text-[13px] text-slate-700"><span class="font-semibold text-slate-900">Periodo:</span> <span class="font-medium text-slate-800">${escapeComedorHtml(formatIsoDateMx(state.desdeIso))}</span> <span class="text-slate-400">—</span> <span class="font-medium text-slate-800">${escapeComedorHtml(formatIsoDateMx(state.hastaIso))}</span></p>`;
      }
      if (state.desdeIso) {
        return `<p class="text-[13px] text-slate-700"><span class="font-semibold text-slate-900">Desde:</span> <span class="font-medium text-slate-800">${escapeComedorHtml(formatIsoDateMx(state.desdeIso))}</span></p>`;
      }
      if (state.hastaIso) {
        return `<p class="text-[13px] text-slate-700"><span class="font-semibold text-slate-900">Hasta:</span> <span class="font-medium text-slate-800">${escapeComedorHtml(formatIsoDateMx(state.hastaIso))}</span></p>`;
      }
      return `<p class="text-[13px] text-slate-600">Sin rango de fechas seleccionado en filtros.</p>`;
    })();

    const heroBlock = `
      <header class="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white bg-[radial-gradient(1200px_circle_at_100%_-10%,rgba(37,99,235,0.07),transparent_45%)] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 sm:p-7">
        <div class="pointer-events-none absolute -right-12 top-0 size-52 rounded-full bg-leoni-blue/6 blur-3xl sm:size-64"></div>
        <div class="relative space-y-2">
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-[1.75rem]">Códigos externos</h1>
          <p class="max-w-3xl text-sm leading-relaxed text-slate-600">Consulta y monitorea códigos externos generados para acceso al comedor.</p>
        </div>
        <div class="relative mt-5 h-px w-full bg-gradient-to-r from-slate-200/0 via-slate-200 to-slate-200/0"></div>
        <div class="relative mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          ${periodoHtml}
          <p class="text-[13px] text-slate-700"><span class="font-semibold text-slate-900">Estatus:</span> ${escapeComedorHtml(estatusFiltroLabel(state.estatus))}</p>
        </div>
      </header>`;

    const dateErrBlock =
      state.dateRangeError ?
        `<div class="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-900/5" role="alert">
          <p class="font-semibold text-amber-950">${escapeComedorHtml(state.dateRangeError)}</p>
        </div>`
      : "";

    const filtrosCard = `
      <section class="rh-sol-filters-card rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 sm:p-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filtros</p>
            <p class="text-sm font-semibold text-slate-900">Refinar listado</p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div class="${FILTER_FIELD_WRAP}">
            <label for="comedor-codigos-desde-input" class="${RH_LISTADO_LABEL}">Desde</label>
            <input id="comedor-codigos-desde-input" type="date" value="${escapeComedorHtml(state.desdeIso)}" data-comedor-codigos-desde
              class="min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}"/>
          </div>
          <div class="${FILTER_FIELD_WRAP}">
            <label for="comedor-codigos-hasta-input" class="${RH_LISTADO_LABEL}">Hasta</label>
            <input id="comedor-codigos-hasta-input" type="date" value="${escapeComedorHtml(state.hastaIso)}" data-comedor-codigos-hasta
              class="min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}"/>
          </div>
          <div class="${FILTER_FIELD_WRAP}">
            <label for="comedor-codigos-estatus-input" class="${RH_LISTADO_LABEL}">Estatus</label>
            <div class="relative grid w-full grid-cols-1 grid-rows-1">
              <select id="comedor-codigos-estatus-input" data-comedor-codigos-estatus class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING} col-start-1 row-start-1">
                <option value="todos" ${state.estatus === "todos" ? "selected" : ""}>Todos</option>
                <option value="ACTIVO" ${state.estatus === "ACTIVO" ? "selected" : ""}>ACTIVO</option>
                <option value="USADO_PARCIAL" ${state.estatus === "USADO_PARCIAL" ? "selected" : ""}>USADO_PARCIAL</option>
                <option value="USADO_TOTAL" ${state.estatus === "USADO_TOTAL" ? "selected" : ""}>USADO_TOTAL</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px] sm:flex-1 sm:flex-row sm:justify-end lg:min-w-0 lg:flex-none">
            <button type="button" data-comedor-codigos-filtrar class="rh-sol-btn-primary inline-flex min-h-[42px] w-full flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-semibold shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:transform-none sm:w-auto">Filtrar</button>
            <button type="button" data-comedor-codigos-reset class="${BTN_GHOST} min-h-[42px] w-full justify-center sm:w-auto">Restablecer</button>
          </div>
        </div>
        ${dateErrBlock}
      </section>`;

    const tableRows = state.rows
      .map((row) => {
        const usoPct =
          row.cantidad_personas > 0 ? Math.min(100, Math.round((row.usados / row.cantidad_personas) * 100)) : 0;
        const tipoLabel = tipoComidaLabel(row.tipo_comida);
        const tipoCls = tipoComidaBadgeClass(row.tipo_comida);
        return `
        <tr class="rh-sol-data-row border-b border-slate-100/90 transition-colors duration-150 hover:bg-[rgba(248,250,252,0.85)] motion-reduce:transition-none">
          <td class="whitespace-nowrap px-3 py-3.5 text-sm text-slate-800 sm:px-4">${escapeComedorHtml(row.fecha_inicio)}</td>
          <td class="whitespace-nowrap px-3 py-3.5 text-sm text-slate-800 sm:px-4">${escapeComedorHtml(row.fecha_fin)}</td>
          <td class="px-3 py-3.5 text-right tabular-nums sm:px-4">
            <span class="inline-flex min-w-[2rem] items-center justify-end rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-bold text-slate-900">${escapeComedorHtml(String(row.cantidad_personas))}</span>
          </td>
          <td class="px-3 py-3.5 sm:px-4">
            <span class="inline-flex max-w-full items-center rounded-full border ${tipoCls} px-2.5 py-0.5 text-xs font-semibold">${escapeComedorHtml(tipoLabel)}</span>
          </td>
          <td class="max-w-[11rem] px-3 py-3.5 sm:max-w-[13rem] sm:px-4">
            <code class="block truncate font-mono text-[0.8125rem] text-slate-800" title="${escapeComedorHtml(row.codigo_acceso)}">${escapeComedorHtml(row.codigo_acceso)}</code>
          </td>
          <td class="max-w-[9rem] px-3 py-3.5 sm:px-4">
            <code class="inline-block max-w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[0.75rem] text-slate-800" title="${escapeComedorHtml(row.password_temporal)}">${escapeComedorHtml(row.password_temporal)}</code>
          </td>
          <td class="px-3 py-3.5 sm:px-4">
            <div class="flex min-w-[5.5rem] flex-col gap-1.5">
              <span class="text-sm font-semibold tabular-nums text-slate-800">${escapeComedorHtml(String(row.usados))}/${escapeComedorHtml(String(row.cantidad_personas))}</span>
              <div class="h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-slate-100" role="presentation">
                <div class="h-full rounded-full bg-violet-500/90 transition-[width] duration-200 motion-reduce:transition-none" style="width:${usoPct}%"></div>
              </div>
            </div>
          </td>
          <td class="whitespace-nowrap px-3 py-3.5 sm:px-4">${statusBadgeHtml(row.estatus)}</td>
        </tr>`;
      })
      .join("");

    const emptyBody = `
      <tr>
        <td colspan="8" class="px-3 py-14 sm:px-4">
          <div class="rh-sol-empty mx-auto max-w-md rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 px-5 py-10 text-center shadow-sm">
            <div class="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6 text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /></svg>
            </div>
            <p class="text-sm font-semibold text-slate-900">No hay códigos externos para los filtros seleccionados.</p>
            <p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-600">Prueba ajustando el rango de fechas o el estatus.</p>
          </div>
        </td>
      </tr>`;

    const tabla = `
      <section class="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 sm:p-4">
        <div class="-mx-1 overflow-x-auto sm:mx-0">
          <table class="min-w-[920px] w-full border-collapse text-sm">
            <thead>
              <tr class="bg-[var(--color-grid-header-bg,#F8FAFC)]">
                <th scope="col" class="${COMEDOR_TABLE_TH}">Inicio</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Fin</th>
                <th scope="col" class="${COMEDOR_TABLE_TH} text-right">Cantidad</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Tipo</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Código</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Contraseña</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Uso (hoy)</th>
                <th scope="col" class="${COMEDOR_TABLE_TH}">Estatus</th>
              </tr>
            </thead>
            <tbody class="text-[13px]">${tableRows || emptyBody}</tbody>
          </table>
        </div>
      </section>`;

    const kpis = renderKpisSection(state.rows);

    return `
      <div class="flex flex-col gap-5 sm:gap-6">
        ${heroBlock}
        ${kpis}
        ${filtrosCard}
        ${tabla}
      </div>`;
  }

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-codigos-root");
    if (!root) return;
    root.innerHTML = render();
  }

  async function load(): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    state.dateRangeError = null;
    paint();
    try {
      const rows = await getComedorRhCodigosExternos({
        desdeIso: state.desdeIso || undefined,
        hastaIso: state.hastaIso || undefined,
        estatus: state.estatus,
      });
      if (signal.aborted) return;
      state.rows = rows.filter((r) => r.estatus !== "VENCIDO");
      state.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.panelState = "error";
      state.errorMessage = error instanceof Error ? error.message : "Error al cargar códigos externos";
    }
    paint();
  }

  mountAppShell(container, {
    pageTitle: "Códigos externos",
    activeNav: "comedor",
    mainClass: COMEDOR_DASHBOARD_MAIN_CLASS,
    mainHtml: `<div id="rh-comedor-page" class="${COMEDOR_DASHBOARD_PAGE_SHELL}">
      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5 sm:gap-6">
        ${renderComedorBackBar()}
        <div id="comedor-codigos-root" class="min-w-0"></div>
      </div>
    </div>`,
  });
  const root = container.querySelector<HTMLElement>("#comedor-codigos-root");
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-codigos-retry]")) {
        void load();
        return;
      }
      if (target.closest("[data-comedor-codigos-reset]")) {
        state.desdeIso = "";
        state.hastaIso = "";
        state.estatus = "todos";
        state.dateRangeError = null;
        void load();
        return;
      }
      if (target.closest("[data-comedor-codigos-filtrar]")) {
        if (dateRangeInvalid()) {
          state.dateRangeError = DATE_RANGE_MSG;
          paint();
          return;
        }
        state.dateRangeError = null;
        void load();
      }
    },
    { signal },
  );
  root?.addEventListener(
    "change",
    (event) => {
      const hadDateErr = state.dateRangeError != null;
      const target = event.target as HTMLElement;
      const desde = target.closest<HTMLInputElement>("[data-comedor-codigos-desde]");
      if (desde) state.desdeIso = desde.value;
      const hasta = target.closest<HTMLInputElement>("[data-comedor-codigos-hasta]");
      if (hasta) state.hastaIso = hasta.value;
      const estatus = target.closest<HTMLSelectElement>("[data-comedor-codigos-estatus]");
      if (estatus) state.estatus = (estatus.value as CodigoEstatus) || "todos";
      if (!dateRangeInvalid()) state.dateRangeError = null;
      if (hadDateErr && state.dateRangeError == null && state.panelState === "ready") paint();
    },
    { signal },
  );
  void load();
}

function mountComedorRhPlanner(container: HTMLElement, signal: AbortSignal): void {
  const initialWeek = createBlankWeekByStartIso(getCurrentWeekStartIso());
  const comedorIdResolver = createComedorIdResolver({ rhAdmin: true });
  const resolveComedorId = () => comedorIdResolver.resolve();
  const state: RhPlannerState = {
    panelState: "loading",
    errorMessage: null,
    week: initialWeek,
    weekPickerValue: weekInputFromIso(initialWeek.weekStartIso),
    selectedDayKey: "lunes",
    isDuplicating: false,
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
    paint();
    try {
      const comedorId = await resolveComedorId();
      if (comedorId == null) {
        state.week = createBlankWeekByStartIso(weekStartIso);
        state.panelState = "empty";
        state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
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
            detalle: normal?.detalle
              ? cloneMenuDiaDetalle(parseMenuDiaDetalleFromApi(normal.detalle))
              : createEmptyMenuDiaDetalle(),
          };
        }),
      };
      if (signal.aborted) return;
      state.panelState = menus.length > 0 ? "ready" : "empty";
      state.weekPickerValue = weekInputFromIso(state.week.weekStartIso);
    } catch (error) {
      if (signal.aborted) return;
      state.panelState = "error";
      state.errorMessage = error instanceof Error ? error.message : "Error al cargar semana.";
    }
    paint();
  }

  function selectPreviewDay(dayKey: ComedorWeekPlannerDayKey): void {
    state.selectedDayKey = dayKey;
    paint();
  }

  async function persistCurrentWeekMenu(): Promise<number> {
    const comedorId = await resolveComedorId();
    if (comedorId == null) {
      throw new Error("No hay comedor activo configurado.");
    }
    const savedCount = await persistComedorWeekMenu({
      comedorId,
      weekStartIso: state.week.weekStartIso,
      dias: state.week.dias,
      debug: import.meta.env.DEV,
    });
    if (import.meta.env.DEV) {
      console.debug("[planeacion-import] Registros insertados/actualizados:", savedCount);
    }
    return savedCount;
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

  async function deleteWeekFromDatabase(weekStartIso: string): Promise<void> {
    const comedorId = await resolveComedorId();
    if (comedorId == null) {
      throw new Error("No hay comedor activo configurado.");
    }
    await eliminarComedorMenuSemana(comedorId, weekStartIso);
    if (signal.aborted) return;
    await loadWeek(weekStartIso);
    if (signal.aborted) return;
    showEmpleadosToast(container, "Planeación de la semana eliminada.", "success");
  }

  async function checkWeekHasPlanning(weekStartIso: string): Promise<boolean> {
    const comedorId = await resolveComedorId();
    if (comedorId == null) {
      throw new Error("No hay comedor activo configurado.");
    }
    const menus = await getComedorMenuSemana(comedorId, weekStartIso);
    return menus.length > 0;
  }

  async function saveDayMenu(payload: {
    dayKey: string;
    menuNormal: string;
    menuDieta: string;
    detalle: ComedorMenuDiaDetalle;
  }): Promise<void> {
    const comedorId = await resolveComedorId();
    if (comedorId == null) {
      throw new Error("No hay comedor activo configurado.");
    }
    await persistComedorDayMenu({
      comedorId,
      weekStartIso: state.week.weekStartIso,
      day: {
        key: payload.dayKey,
        menuNormal: payload.menuNormal,
        menuDieta: payload.menuDieta,
        detalle: payload.detalle,
      },
    });
    if (signal.aborted) return;

    await loadWeek(state.week.weekStartIso);
    if (signal.aborted) return;
    state.selectedDayKey = isComedorWeekPlannerDayKey(payload.dayKey)
      ? payload.dayKey
      : state.selectedDayKey;
    paint();
    showEmpleadosToast(container, "Menú del día actualizado.", "success");
  }

  async function applyWeeklyPlanningImport(payload: {
    weekStartIso: string;
    days: PlaneacionMenuTemplateDay[];
    isUpdate: boolean;
  }): Promise<void> {
    state.week = mergeImportedDaysIntoWeek(payload.weekStartIso, payload.days);
    state.weekPickerValue = weekInputFromIso(payload.weekStartIso);
    state.panelState = "ready";
    state.selectedDayKey = "lunes";
    paint();

    await persistCurrentWeekMenu();
    if (signal.aborted) return;

    await loadWeek(payload.weekStartIso);
    if (signal.aborted) return;

    state.panelState = "ready";
    paint();
    showEmpleadosToast(
      container,
      payload.isUpdate ? "Planeación actualizada correctamente." : "Planeación registrada correctamente.",
      "success",
    );
  }

  mountAppShell(container, {
    pageTitle: "Planeación de Menú",
    activeNav: "comedor-planear",
    mainClass: "py-5 sm:py-6",
    mainHtml: `${renderComedorBackBar()}<div id="comedor-plan-root">${renderComedorWeeklyPlanner(toPlannerViewState(state))}</div><div id="comedor-plan-import-host"></div><div id="comedor-plan-clear-host"></div><div id="comedor-plan-day-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-plan-root");
  const importModalHost = container.querySelector<HTMLElement>("#comedor-plan-import-host");
  const clearModalHost = container.querySelector<HTMLElement>("#comedor-plan-clear-host");
  const dayModalHost = container.querySelector<HTMLElement>("#comedor-plan-day-host");
  const importModal =
    importModalHost ?
      mountComedorWeeklyPlanningImportModal(importModalHost, {
        checkWeekHasPlanning: (weekStartIso) => checkWeekHasPlanning(weekStartIso),
        onImport: (payload) => applyWeeklyPlanningImport(payload),
      })
    : { open: () => {}, close: () => {}, destroy: () => {} };
  const clearModal =
    clearModalHost ?
      mountComedorClearWeekModal(clearModalHost, {
        onConfirm: async ({ weekStartIso }) => deleteWeekFromDatabase(weekStartIso),
      })
    : { open: () => {}, close: () => {}, destroy: () => {} };
  const dayModal =
    dayModalHost ?
      mountComedorDayMenuEditModal(dayModalHost, {
        onSave: (payload) => saveDayMenu(payload),
      })
    : { open: () => {}, close: () => {}, destroy: () => {} };
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comedor-plan-edit-day]")) {
        if (state.panelState !== "ready") return;
        const day = state.week.dias.find((item) => item.key === state.selectedDayKey);
        if (!day) return;
        dayModal.open({
          dayKey: day.key,
          dayLabel: day.label,
          fechaCorta: day.fechaCorta,
          menuNormal: day.menuNormal,
          menuDieta: day.menuDieta,
          detalle: day.detalle,
        });
        return;
      }
      if (target.closest("[data-comedor-plan-import-open]")) {
        importModal.open();
        return;
      }
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
      if (target.closest("[data-comedor-plan-clear-open]")) {
        if (state.panelState !== "ready") return;
        clearModal.open({
          weekStartIso: state.week.weekStartIso,
          weekLabel: state.week.weekLabel,
        });
        return;
      }
      const previewDayBtn = target.closest<HTMLElement>("[data-comedor-plan-preview-day]");
      if (previewDayBtn) {
        const key = previewDayBtn.getAttribute("data-comedor-plan-preview-day");
        if (isComedorWeekPlannerDayKey(key)) selectPreviewDay(key);
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
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    dayModal.destroy();
    importModal.destroy();
    clearModal.destroy();
  }, { once: true });

  void loadWeek(state.week.weekStartIso);
}

function mountComedorLider(container: HTMLElement, signal: AbortSignal): void {
  const liderRol = getEffectiveGestorNavRol();
  const isSupervisor = liderRol === "supervisor";
  const hideOpcionKpis = comedorLiderOcultaKpisOpcionAb(liderRol);
  const currentUserId = getEmpleadoDirectoryNumericIdFromAccessToken();
  const beneficiaryTargetRef = { id: undefined as number | undefined };
  const comedorIdResolver = createComedorIdResolver({
    getTargetUserId: () => beneficiaryTargetRef.id,
  });
  const resolveComedorId = () => comedorIdResolver.resolve();
  const loadMenuDelDia = createComedorMenuDelDiaLoader(resolveComedorId);
  const state: LiderComedorState = {
    statsState: "loading",
    stats: null,
    statsError: null,
    tableState: "loading",
    table: null,
    tableError: null,
    search: "",
    page: 1,
    pageSize: 10,
    tableSegment: "equipo",
    isSupervisorTable: isSupervisor,
    hideOpcionKpis,
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>("#comedor-lider-root");
    if (!root) return;
    root.innerHTML = renderComedorDashboardLider(toLiderViewState(state));
  }

  async function loadKpis(): Promise<void> {
    state.statsState = "loading";
    state.statsError = null;
    paint();
    try {
      const rows = filterComedorKpisOpcionAb(
        mapMetricasLiderToKpis(await getComedorEquipoMetricas()),
        hideOpcionKpis,
      );
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
      let scoped = rows;
      if (state.isSupervisorTable && currentUserId != null) {
        scoped =
          state.tableSegment === "personal"
            ? rows.filter((row) => row.empleado_id === currentUserId)
            : rows.filter((row) => row.empleado_id !== currentUserId);
      }
      const search = state.search.trim().toLowerCase();
      const filtered = search
        ? scoped.filter((row) => row.empleado_nombre.toLowerCase().includes(search))
        : scoped;
      const totalFiltered = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalFiltered / state.pageSize));
      if (state.page > totalPages) {
        state.page = totalPages;
      }
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
      mainClass: COMEDOR_DASHBOARD_MAIN_CLASS,
      mainHtml: `<div id="rh-comedor-page" class="${COMEDOR_DASHBOARD_PAGE_SHELL}">${renderComedorBackBar()}<div id="comedor-lider-root">${renderComedorDashboardLider(toLiderViewState(state))}</div></div><div id="comedor-lider-new-request-modal-host"></div>`,
    });

    const root = container.querySelector<HTMLElement>("#comedor-lider-root");
    const modalHost = container.querySelector<HTMLElement>("#comedor-lider-new-request-modal-host");

    let supervisorSelfForModal: ComedorEmployeeOption | null = null;
    if (isSupervisor && currentUserId != null && !signal.aborted) {
      const resolved = await resolveEmpleadoOptionForComedor(
        String(currentUserId),
        getUserDisplayNameFromAccessToken(),
        getNoEmpleadoFromAccessToken(),
      );
      if (!signal.aborted && resolved) {
        supervisorSelfForModal = resolved;
      }
    }

    const newRequestModal =
      modalHost ?
        mountComedorNewRequestModal(modalHost, {
        toastContainer: container,
        allowExternalPeople: false,
        allowEmployeeSearch: false,
        fechaMinReservaIso,
        menuFieldLabel: "Tipo de comida",
        loadMenuOptions: async () => [
          { id: "casera", label: "Opción A" },
          { id: "saludable", label: "Opción B" },
        ],
        loadMenuDelDia,
        ...(supervisorSelfForModal ?
          {
            supervisorBeneficiaryConfig: {
              self: supervisorSelfForModal,
              loadTeamOptions: async () => {
                const rows = await getComedorEquipoBeneficiarios();
                const uid = currentUserId!;
                return rows
                  .filter((row) => row.empleado_id !== uid)
                  .map((row) => ({
                    id: String(row.empleado_id),
                    nombre: row.nombre_corto,
                    numero: formatNoEmpleadoDisplay(row.no_empleado),
                    area: "Equipo directo",
                    avatarUrl: null,
                  }))
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
              },
            },
          }
        : {}),
        searchEmployees: searchComedorEmployeesFromDb,
        onBeneficiaryUserIdChange: (userId) => {
          beneficiaryTargetRef.id = userId;
          comedorIdResolver.invalidate();
        },
        onSubmit: async (payload) => {
          const targetUserId =
            isSupervisor &&
            payload.personType === "interno" &&
            payload.supervisorSelfRegistration !== true &&
            payload.employeeId
              ? Number.parseInt(payload.employeeId, 10)
              : undefined;
          if (isSupervisor && targetUserId != null && !Number.isFinite(targetUserId)) {
            throw new Error("Selecciona un beneficiario válido.");
          }
          await reservarComedorAcceso({
            fechasIso: payload.fechas,
            tipoComida: payload.menuId,
            targetUserId,
          });
          await loadTable();
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
        const sugerido = tipoActual === "saludable" ? "opcion_b" : "opcion_a";
        const nuevoTipoInput = window
          .prompt("Editar tipo de comida (opcion_a/opcion_b):", sugerido)
          ?.trim()
          .toLowerCase();
        if (!nuevoTipoInput) return;
        const nuevoTipo =
          nuevoTipoInput === "opcion_a"
            ? "casera"
            : nuevoTipoInput === "opcion_b"
              ? "saludable"
              : nuevoTipoInput;
        if (nuevoTipo !== "casera" && nuevoTipo !== "saludable") {
          showEmpleadosToast(container, "Tipo de comida inválido.", "error");
          return;
        }
        void (async () => {
          try {
            await editarComedorAcceso({ accesoId, tipoComida: nuevoTipo });
            showEmpleadosToast(container, "Registro actualizado correctamente.", "success");
            await loadTable();
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
            await loadTable();
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

    root?.addEventListener(
      "change",
      (event) => {
        const select = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-comedor-table-segment]");
        if (!select) return;
        const raw = select.value;
        if (raw !== "personal" && raw !== "equipo") return;
        state.tableSegment = raw;
        state.page = 1;
        void loadTable();
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
    void loadTable();
  })();
}

/** Ante 403 por rol desactualizado en JWT: refresca sesión y remonta vista si cambió el rol. */
async function recoverComedorEmpleadoSessionAfter403(
  container: HTMLElement,
  signal: AbortSignal,
): Promise<"retry" | "remounted" | "none"> {
  const refreshed = await refreshAccessTokenSession();
  if (!refreshed) return "none";
  if (getRolFromAccessToken() !== "empleado") {
    mountComedor(container, signal);
    return "remounted";
  }
  return "retry";
}

function mountComedorEmpleado(container: HTMLElement, signal: AbortSignal): void {
  const now = new Date();
  const comedorIdResolver = createComedorIdResolver();
  const resolveComedorId = () => comedorIdResolver.resolve();
  const loadMenuDelDia = createComedorMenuDelDiaLoader(resolveComedorId);
  const state: EmpleadoComedorState = {
    calendarState: "loading",
    calendar: null,
    calendarError: null,
    proximasState: "loading",
    proximas: [],
    proximasError: null,
    proximasPage: 1,
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

  async function loadCalendar(allowSessionRecovery = true): Promise<void> {
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
      if (
        allowSessionRecovery &&
        isComedorApiError(error) &&
        error.status === 403
      ) {
        const recovery = await recoverComedorEmpleadoSessionAfter403(container, signal);
        if (recovery === "retry") {
          return loadCalendar(false);
        }
        if (recovery === "remounted") return;
      }
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

  async function loadProximas(allowSessionRecovery = true): Promise<void> {
    state.proximasState = "loading";
    state.proximasError = null;
    paint();
    try {
      const rows = await getComedorMisProximasReservas(200);
      if (signal.aborted) return;
      const hoyIso = dateToIso(new Date());
      const filtered = rows.filter(
        (row) =>
          row.estado_acceso.trim().toUpperCase() !== "EXPIRADO" &&
          row.fecha_servicio >= hoyIso,
      );
      filtered.sort((a, b) => a.fecha_servicio.localeCompare(b.fecha_servicio));
      state.proximas = filtered;
      const totalPages = Math.max(1, Math.ceil(filtered.length / COMEDOR_EMPLEADO_PROXIMAS_PAGE_SIZE));
      if (state.proximasPage > totalPages) state.proximasPage = totalPages;
      state.proximasState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      if (
        allowSessionRecovery &&
        isComedorApiError(error) &&
        error.status === 403
      ) {
        const recovery = await recoverComedorEmpleadoSessionAfter403(container, signal);
        if (recovery === "retry") {
          return loadProximas(false);
        }
        if (recovery === "remounted") return;
      }
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
      mainClass: COMEDOR_DASHBOARD_MAIN_CLASS,
      mainHtml: `<div id="rh-comedor-page" class="${COMEDOR_DASHBOARD_PAGE_SHELL}">${renderComedorBackBar()}<div id="comedor-empleado-root">${renderComedorDashboardEmpleado(toEmpleadoViewState(state))}</div></div><div id="comedor-empleado-new-request-modal-host"></div>`,
    });

    const root = container.querySelector<HTMLElement>("#comedor-empleado-root");
    const modalHost = container.querySelector<HTMLElement>("#comedor-empleado-new-request-modal-host");
    const empleadoId = getEmpleadoIdFromAccessToken();
    const empleadoNombre = getUserDisplayNameFromAccessToken();
    const noEmpleadoJwt = getNoEmpleadoFromAccessToken();
    const empleadoOption = await resolveEmpleadoOptionForComedor(empleadoId, empleadoNombre, noEmpleadoJwt);
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
          fixedEmployee: empleadoOption,
          loadMenuOptions: async () => [
            { id: "casera", label: "Opción A" },
            { id: "saludable", label: "Opción B" },
          ],
          loadMenuDelDia,
          searchEmployees: async () => [],
          onSubmit: async (payload) => {
            const firstDate = payload.fechas[0];
            if (!firstDate) throw new Error("Selecciona al menos una fecha.");
            const semanaIso = startOfWeekIsoFromDateIso(firstDate);
            const intentarReserva = async () => {
              await reservarComedorAcceso({
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

        const pageBtn = target.closest<HTMLButtonElement>("[data-comedor-empleado-proximas-page]");
        if (pageBtn) {
          if (pageBtn.disabled) return;
          const requested = Number.parseInt(
            pageBtn.getAttribute("data-comedor-empleado-proximas-page") ?? "",
            10,
          );
          if (!Number.isFinite(requested) || requested < 1) return;
          const totalPages = Math.max(
            1,
            Math.ceil(state.proximas.length / COMEDOR_EMPLEADO_PROXIMAS_PAGE_SIZE),
          );
          const next = Math.min(Math.max(1, requested), totalPages);
          if (next === state.proximasPage) return;
          state.proximasPage = next;
          paint();
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
              "La fecha límite para modificar este servicio de comedor ya venció (jueves de la semana anterior).",
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
              "La fecha límite para modificar este servicio de comedor ya venció (jueves de la semana anterior).",
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
  const comedorIdResolver = createComedorIdResolver({ rhAdmin: true });
  const resolveComedorId = () => comedorIdResolver.resolve();
  const esRhReporte = esViewerRhComedor("reportes");
  const state: ReporteComedorState = {
    filtersDataset: {
      departamentos: [{ id: "todos", label: "Todos los comedores" }],
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
    dateRangeError: null,
    reporteDetallePage: 1,
    tabSearchComedor: "",
    tabSearchEmpleado: "",
    tabSearchArea: "",
    selectedAreaFilter: "todos",
    kpisModo: esRhReporte ? "rh_resumen" : "comedor_semana",
    kpisState: "loading",
    kpis: null,
    kpisError: null,
    rhResumenDiario: null,
    tableState: "loading",
    table: null,
    tableError: null,
    tableSortKey: "dias_mes",
    tableSortDirection: "desc",
    lastUpdatedLabel: null,
    selectedEmpleadoId: null,
    rhAnalyticsState: esRhReporte ? "loading" : "empty",
    rhAnalyticsRows: [],
    rhAnalyticsError: null,
    rhCodigosExternosRows: [],
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
    root.innerHTML = reporteComedorInnerWrap(`${renderComedorBackBar()}${renderComedorReporteDashboard(toReporteViewState(state))}`);
  }

  async function loadFilters(): Promise<void> {
    try {
      const comedores = await getComedoresActivos();
      const preserveDept = state.selectedDepartamentoId;
      const dataset = {
        ...state.filtersDataset,
        fechaInicioIso: state.selectedFechaInicioIso,
        fechaFinIso: state.selectedFechaFinIso,
        departamentos: [
          { id: "todos", label: "Todos los comedores" },
          ...comedores.map((item) => ({ id: String(item.id), label: item.nombre })),
        ],
      };
      if (signal.aborted) return;
      state.filtersDataset = dataset;
      const stillValid = dataset.departamentos.some((d) => d.id === preserveDept);
      state.selectedDepartamentoId = stillValid ? preserveDept : "todos";
      state.draftDepartamentoId = state.selectedDepartamentoId;
      state.draftTurnoId = state.selectedTurnoId;
      state.draftFechaInicioIso = state.selectedFechaInicioIso;
      state.draftFechaFinIso = state.selectedFechaFinIso;
    } catch {
      if (signal.aborted) return;
    }
    paint();
  }

  function comedorNombreFiltroSeleccionado(): string | null {
    if (state.selectedDepartamentoId === "todos") return null;
    const opt = state.filtersDataset.departamentos.find((d) => d.id === state.selectedDepartamentoId);
    return opt?.label.trim() ? opt.label.trim() : null;
  }

  async function loadKpis(): Promise<void> {
    state.kpisState = "loading";
    state.kpisError = null;
    state.kpisModo = esRhReporte ? "rh_resumen" : "comedor_semana";
    if (esRhReporte) {
      state.rhAnalyticsState = "loading";
      state.rhAnalyticsError = null;
    }
    paint();
    try {
      if (esRhReporte) {
        const desde = state.selectedFechaInicioIso.slice(0, 10);
        const hasta = state.selectedFechaFinIso.slice(0, 10);
        const [resumen, bulk] = await Promise.all([
          getComedorRhResumenDiario(state.selectedFechaInicioIso, state.selectedFechaFinIso),
          fetchAllRhRegistrosReportePages(
            state.selectedFechaInicioIso,
            state.selectedFechaFinIso,
            "todos",
          ),
        ]);
        let externos: ComedorCodigoExternoApiItem[] = [];
        try {
          externos = await getComedorRhCodigosExternos({ desdeIso: desde, hastaIso: hasta });
        } catch {
          externos = [];
        }
        if (signal.aborted) return;
        state.rhResumenDiario = resumen;
        state.rhAnalyticsRows = bulk;
        state.rhCodigosExternosRows = externos;
        state.rhAnalyticsState = "ready";
        const areaOpts = reporteAreaFilterOptions(bulk);
        const validAreaIds = new Set<string>(["todos", ...areaOpts.map((o) => o.id)]);
        if (!validAreaIds.has(state.selectedAreaFilter)) {
          state.selectedAreaFilter = "todos";
        }
        const opsFiltrados = filterPorAreaSeleccion(
          filterPorComedorSeleccion(
            filterProximosPorRango(bulk, state.selectedFechaInicioIso, state.selectedFechaFinIso),
            comedorNombreFiltroSeleccionado(),
          ),
          state.selectedAreaFilter,
        );
        const areaDisplayLabel =
          state.selectedAreaFilter === "todos"
            ? null
            : (areaOpts.find((o) => o.id === state.selectedAreaFilter)?.label ?? null);
        const rows = mapRhReporteKpis(
          resumen,
          state.selectedFechaInicioIso,
          state.selectedFechaFinIso,
          opsFiltrados,
          state.selectedAreaFilter,
          areaDisplayLabel,
        );
        state.kpis = rows;
        state.kpisState = rows.length > 0 ? "ready" : "empty";
      } else {
        state.rhResumenDiario = null;
        state.rhAnalyticsRows = [];
        state.rhCodigosExternosRows = [];
        state.rhAnalyticsState = "empty";
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
      }
    } catch (error) {
      if (signal.aborted) return;
      state.kpis = null;
      state.kpisState = "error";
      state.kpisError = error instanceof Error ? error.message : "Error al cargar métricas.";
      if (esRhReporte) {
        state.rhAnalyticsState = "error";
        state.rhAnalyticsError = state.kpisError;
        state.rhCodigosExternosRows = [];
      }
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
    state.reporteDetallePage = 1;
    const tasks: Promise<void>[] = [loadKpis(), loadTable()];
    await Promise.all(tasks);
    if (signal.aborted) return;
    state.lastUpdatedLabel = toUpdatedLabel(Date.now());
    paint();
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

  function exportarReporteComedor(): void {
    if (state.rhAnalyticsState !== "ready") return;
    const rows = reporteDetalleRowsSorted(toReporteViewState(state));
    downloadReporteComedorExcel({ rows });
  }

  function aplicarRangoFechasReporte(): boolean {
    if (isoToDate(state.draftFechaInicioIso).getTime() > isoToDate(state.draftFechaFinIso).getTime()) {
      state.dateRangeError = "La fecha inicial no puede ser posterior a la fecha final.";
      paint();
      return false;
    }
    state.dateRangeError = null;
    state.selectedFechaInicioIso = state.draftFechaInicioIso;
    state.selectedFechaFinIso = state.draftFechaFinIso;
    state.draftDatePreset = "custom";
    state.filtersDataset = {
      ...state.filtersDataset,
      fechaInicioIso: state.selectedFechaInicioIso,
      fechaFinIso: state.selectedFechaFinIso,
    };
    return true;
  }

  function reporteComedorInnerWrap(html: string): string {
    return `<div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5 sm:gap-6">${html}</div>`;
  }

  mountAppShell(container, {
    pageTitle: "Reporte comedor",
    activeNav: "reportes",
    mainClass: "pt-0 pb-5 sm:pb-6",
    mainHtml: `<div id="comedor-reporte-root" class="${COMEDOR_DASHBOARD_PAGE_SHELL}">${reporteComedorInnerWrap(`${renderComedorBackBar()}${renderComedorReporteDashboard(toReporteViewState(state))}`)}</div>`,
  });

  const root = container.querySelector<HTMLElement>("#comedor-reporte-root");
  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const presetReporte = target.closest<HTMLButtonElement>("[data-comedor-reporte-preset]");
      if (presetReporte) {
        const raw = presetReporte.getAttribute("data-comedor-reporte-preset");
        if (raw === "custom") {
          state.draftDatePreset = "custom";
          paint();
          return;
        }
        if (
          raw === "today" ||
          raw === "this_week" ||
          raw === "next_week" ||
          raw === "this_month"
        ) {
          const range = dateRangeFromPreset(raw);
          state.draftDatePreset = raw;
          state.selectedFechaInicioIso = range.inicioIso;
          state.selectedFechaFinIso = range.finIso;
          state.draftFechaInicioIso = range.inicioIso;
          state.draftFechaFinIso = range.finIso;
          state.dateRangeError = null;
          state.filtersDataset = {
            ...state.filtersDataset,
            fechaInicioIso: range.inicioIso,
            fechaFinIso: range.finIso,
          };
          void reloadAll();
          return;
        }
        return;
      }
      if (target.closest("[data-comedor-reporte-export]")) {
        exportarReporteComedor();
        return;
      }
      if (target.closest("[data-comedor-reporte-reset-filters]")) {
        const range = dateRangeFromPreset("this_month");
        state.draftDatePreset = "this_month";
        state.selectedFechaInicioIso = range.inicioIso;
        state.selectedFechaFinIso = range.finIso;
        state.draftFechaInicioIso = range.inicioIso;
        state.draftFechaFinIso = range.finIso;
        state.selectedDepartamentoId = "todos";
        state.draftDepartamentoId = "todos";
        state.selectedAreaFilter = "todos";
        state.tabSearchComedor = "";
        state.tabSearchEmpleado = "";
        state.tabSearchArea = "";
        state.dateRangeError = null;
        state.filtersDataset = {
          ...state.filtersDataset,
          fechaInicioIso: range.inicioIso,
          fechaFinIso: range.finIso,
        };
        void reloadAll();
        return;
      }
      const detallePageBtn = target.closest<HTMLButtonElement>("[data-comedor-reporte-detalle-page]");
      if (detallePageBtn) {
        const raw = detallePageBtn.getAttribute("data-comedor-reporte-detalle-page");
        const p = Number.parseInt(raw ?? "1", 10);
        if (Number.isFinite(p) && p >= 1) {
          state.reporteDetallePage = p;
          paint();
        }
        return;
      }
      if (target.closest("[data-comedor-reporte-retry-kpis]")) {
        void loadKpis();
        return;
      }
      if (target.closest("[data-comedor-reporte-retry-table]")) {
        void loadTable();
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
      const comedorSel = target.closest<HTMLSelectElement>("[data-comedor-reporte-filter-comedor]");
      if (comedorSel) {
        state.selectedDepartamentoId = comedorSel.value;
        state.draftDepartamentoId = comedorSel.value;
        state.reporteDetallePage = 1;
        void loadKpis();
        return;
      }
      const areaSel = target.closest<HTMLSelectElement>("[data-comedor-reporte-filter-area]");
      if (areaSel) {
        state.selectedAreaFilter = areaSel.value;
        state.reporteDetallePage = 1;
        void loadKpis();
        paint();
        return;
      }
      const draftStart = target.closest<HTMLInputElement>("[data-comedor-reporte-draft-start]");
      if (draftStart) {
        state.draftFechaInicioIso = draftStart.value;
        state.draftDatePreset = "custom";
        if (aplicarRangoFechasReporte()) void reloadAll();
        return;
      }
      const draftEnd = target.closest<HTMLInputElement>("[data-comedor-reporte-draft-end]");
      if (draftEnd) {
        state.draftFechaFinIso = draftEnd.value;
        state.draftDatePreset = "custom";
        if (aplicarRangoFechasReporte()) void reloadAll();
        return;
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;
      const draftStart = target.closest<HTMLInputElement>("[data-comedor-reporte-draft-start]");
      if (draftStart) {
        state.draftFechaInicioIso = draftStart.value;
        state.draftDatePreset = "custom";
        paint();
        return;
      }
      const draftEnd = target.closest<HTMLInputElement>("[data-comedor-reporte-draft-end]");
      if (draftEnd) {
        state.draftFechaFinIso = draftEnd.value;
        state.draftDatePreset = "custom";
        paint();
        return;
      }
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

  // `#/comedor/gestion` se fusionó en Ajustes Comedor (pestaña «Comedores»). Se conserva
  // el redirect para no romper enlaces guardados ni el historial de nadie.
  const isAjustesRoute =
    hash.startsWith("#/comedor/ajustes") || hash.startsWith("#/comedor/gestion");
  if (isAjustesRoute) {
    if (canAccessComedorAjustesPage()) {
      if (hash.startsWith("#/comedor/gestion")) {
        history.replaceState(null, "", "#/comedor/ajustes");
      }
      mountComedorAjustes(container, signal);
      return;
    }
    history.replaceState(null, "", canAccessComedorPersonalForRh() ? "#/comedor" : "#/");
    if (canAccessComedorPersonalForRh()) {
      mountComedorEmpleado(container, signal);
    } else {
      mountDashboardPlaceholder(container);
    }
    return;
  }

  const isPlannerRoute = hash.startsWith("#/comedor/planear");
  if (isPlannerRoute) {
    if (canAccessComedorPlanearPage()) {
      mountComedorRhPlanner(container, signal);
      return;
    }
    history.replaceState(null, "", canAccessComedorPersonalForRh() ? "#/comedor" : "#/comedor");
    if (canAccessComedorPersonalForRh()) {
      mountComedorEmpleado(container, signal);
      return;
    }
  }

  const isReporteRoute = hash.startsWith("#/comedor/reporte");
  if (isReporteRoute) {
    if (canAccessComedorReportePage()) {
      mountComedorReporte(container, signal);
      return;
    }
    history.replaceState(null, "", canAccessComedorPersonalForRh() ? "#/comedor" : "#/comedor");
    if (canAccessComedorPersonalForRh()) {
      mountComedorEmpleado(container, signal);
      return;
    }
  }

  const isCodigosExternosRoute = hash.startsWith("#/comedor/codigos-externos");
  if (isCodigosExternosRoute) {
    if (canAccessComedorAjustesPage()) {
      mountComedorRhCodigosExternos(container, signal);
      return;
    }
    history.replaceState(null, "", canAccessComedorPersonalForRh() ? "#/comedor" : "#/comedor");
    if (canAccessComedorPersonalForRh()) {
      mountComedorEmpleado(container, signal);
      return;
    }
  }

  if (canAccessComedorPersonalForRh()) {
    mountComedorEmpleado(container, signal);
    return;
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
