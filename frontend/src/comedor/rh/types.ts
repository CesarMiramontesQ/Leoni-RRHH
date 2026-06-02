export type ComedorPanelState = "loading" | "ready" | "empty" | "error";

export type ComedorKpi = {
  id: string;
  titulo: string;
  valor: string;
  descripcion: string;
  tendencia?: string;
  accentClass: string;
  progressPercent?: number;
};

export type ComedorCalendarLegendItem = {
  id: string;
  label: string;
  dotClass: string;
};

export type ComedorCalendarDayTagTone = "normal" | "dieta" | "critico" | "reserva" | "supervisor";

export type ComedorCalendarDayTag = {
  id: string;
  label: string;
  tone: ComedorCalendarDayTagTone;
};

export type ComedorCalendarDay = {
  isoDate: string;
  reservas: number;
  tags: ComedorCalendarDayTag[];
};

export type ComedorCalendarMonth = {
  year: number;
  monthIndex: number;
  legend: ComedorCalendarLegendItem[];
  dayMetrics: Record<string, ComedorCalendarDay>;
};

export type ComedorAlertLevel = "critica" | "media" | "info";

export type ComedorAlert = {
  id: string;
  titulo: string;
  detalle: string;
  level: ComedorAlertLevel;
};

export type ComedorWeekOccupancyPoint = {
  label: string;
  percent: number;
};

/** Una columna de la gráfica RH: totales caseras / saludables en una semana (lunes–domingo). */
export type ComedorRhSemanaPlatilloPorSemana = {
  weekStartIso: string;
  label: string;
  caseras: number;
  saludables: number;
  total: number;
};

export type ComedorDietDistribution = {
  saludablePercent: number;
  regularPercent: number;
};

export type ComedorExternalCodesCard = {
  titulo: string;
  mensaje: string;
  ctaLabel: string;
  ctaRoute: string;
};

export type ComedorSidebarDataset = {
  alerts: ComedorAlert[];
  weeklyOccupancy: ComedorWeekOccupancyPoint[];
  dietDistribution: ComedorDietDistribution;
  externalCodesCard: ComedorExternalCodesCard;
  /** Solo rol RH: agregado por semana (últimas 4) para gráfica caseras vs saludables. */
  rhPlatillosPorSemana?: readonly ComedorRhSemanaPlatilloPorSemana[];
};

export type ComedorReservationStatus = "confirmado" | "cancelado" | "pendiente";
export type ComedorReservationDietType = "normal" | "dieta";

export type ComedorReservationRow = {
  id: number;
  empleadoNombre: string;
  empleadoNumero: string;
  area: string;
  turno: string;
  dieta: ComedorReservationDietType;
  status: ComedorReservationStatus;
  horaReserva: string;
  avatarUrl: string | null;
};

export type ComedorReservationsQuery = {
  statusFilter: "todos" | "confirmado" | "cancelado";
  search: string;
  page: number;
  pageSize: number;
};

export type ComedorReservationsPage = {
  items: ComedorReservationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ComedorRhProximoRegistroRow = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  no_empleado: string;
  area: string;
  comedor_nombre: string;
  fecha_servicio: string;
  tipo_comida: string;
  estado_acceso: string;
};

export type ComedorRhProximosRegistrosPage = {
  items: readonly ComedorRhProximoRegistroRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ComedorTeamReservationRow = {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  tipoComida: string;
  fecha: string;
  estado: string;
  canManage: boolean;
};

export type ComedorTeamReservationsPage = {
  items: ComedorTeamReservationRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Alcance del listado de reservas en tablero de líder (solo UI supervisor). */
export type ComedorSupervisorTableSegment = "personal" | "equipo";

export type ComedorPersonType = "interno" | "externo";

export type ComedorEmployeeOption = {
  id: string;
  nombre: string;
  numero: string;
  area: string;
  avatarUrl: string | null;
};

export type ComedorMenuOption = {
  id: string;
  label: string;
};

export type ComedorCreateRequestPayload = {
  personType: ComedorPersonType;
  employeeId: string | null;
  externalPeopleCount: number | null;
  menuId: string;
  fechas: string[];
  observaciones: string;
  /**
   * Solo flujo supervisor comedor «Registro personal»:
   * el backend debe resolver el beneficiario desde la sesión (`target_user_id` omitido).
   */
  supervisorSelfRegistration?: boolean;
};

export type ComedorWeekPlannerStatus = "borrador" | "publicado";
import type { ComedorMenuDiaDetalle } from "./menuDayDetalle.ts";

export type ComedorWeekPlannerDayKey =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export type ComedorWeekPlannerDay = {
  key: ComedorWeekPlannerDayKey;
  label: string;
  fechaIso: string;
  fechaCorta: string;
  menuNormal: string;
  menuDieta: string;
  /** Complementos importados o capturados; no se persisten aún en API de publicación. */
  detalle: ComedorMenuDiaDetalle;
  visibleEmpleados: boolean;
};

export type ComedorWeekPlanner = {
  weekStartIso: string;
  weekEndIso: string;
  weekLabel: string;
  status: ComedorWeekPlannerStatus;
  dias: ComedorWeekPlannerDay[];
};
