import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";
import type { EmpleadoPendingRequestType } from "../empleado/types.ts";

/** Métricas personales del líder (mismo significado que dashboard empleado). */
export type LiderPersonalStats = {
  vacation_available_days: number | null;
  retardos_anio: number | null;
  pending_requests: number | null;
  pending_request_types: EmpleadoPendingRequestType[];
};

/** Métricas agregadas del equipo a cargo. */
export type LiderTeamStats = {
  team_active_incidents: number | null;
  team_pending_vacation_requests: number | null;
  /**
   * Retardos del año en el alcance del líder, de `/faltas-retardos/estadisticas`:
   * misma fuente y mismo scope que la página Incidencias, así que el número
   * coincide con el que ve al abrirla. `null` = no se pudo consultar.
   */
  team_retardos_anio: number | null;
  team_collaborators_count: number | null;
};

export type LiderApprovalRequestType =
  | "vacation"
  | "home_office"
  | "permiso_sin_goce"
  | "goce_sueldo"
  | "permiso"
  | "incidencia";

export type LiderApprovalRequestRow = {
  id: string;
  collaborator_name: string;
  collaborator_initials: string | null;
  request_type: LiderApprovalRequestType;
  date_range: string;
  detail: string;
  status: string;
};

export type TeamCalendarEventKind =
  | "meal"
  | "vacation"
  | "home_office"
  | "permiso_sin_goce"
  | "goce_sueldo"
  | "incident";

export type TeamCalendarLine = {
  kind: TeamCalendarEventKind;
  text: string;
  /** Solo para comidas: nombre corto del colaborador con reserva. */
  meal_employee_name?: string;
  /** Solo para comidas: tipo de comida ya formateado para UI. */
  meal_type_label?: string;
  /** Solo para comidas: hora de registro (HH:mm) cuando existe. */
  meal_time_label?: string;
  /** Solo para comidas: id del empleado (solo visual; comparar con sesión para propio vs equipo). */
  meal_empleado_id?: string;
  /** Solo para solicitudes: estado canónico API (`approved` / `pending`). */
  request_status?: "approved" | "pending";
  /** Código de tipo (`vacaciones`, `permiso_sin_goce_sueldo`, etc.). */
  request_tipo?: RhSolicitudTipoCodigo;
  /** Dueño de la solicitud (comparado con usuario en sesión). */
  owner_id?: string;
  owner_name?: string;
};

export type TeamCalendarDayEntry = {
  lines: TeamCalendarLine[];
};

export type LiderDashboardPayload = {
  personal: LiderPersonalStats;
  team: LiderTeamStats;
  approval_requests: LiderApprovalRequestRow[];
  /** Gráfica de incidencias por colaborador (solo rol supervisor). */
  supervisor_incidencias_chart: SupervisorIncidenciasChartData | null;
  /** Home office por día laboral (solo rol supervisor). */
  supervisor_ho_weekday_chart: SupervisorHomeOfficeWeekdayChartData | null;
  team_calendar: {
    initial_year: number;
    initial_month_index: number;
    day_entries: Record<string, TeamCalendarDayEntry>;
    selected_iso_date: string | null;
  };
};

/** Fila agregada para la gráfica de incidencias del supervisor. */
export type SupervisorIncidenciasChartRow = {
  empleado_id: string;
  no_empleado?: string | null;
  empleado_nombre: string;
  /** Etiqueta breve para eje X / tabla. */
  empleado_nombre_corto: string;
  total: number;
  byTipo: Record<string, number>;
};

export type SupervisorIncidenciasChartView = "bars" | "heatmap";

export type SupervisorIncidenciasChartData = {
  rows: SupervisorIncidenciasChartRow[];
  /** Tipos visibles en leyenda (máx. 6; puede incluir `otros`). */
  tipos: string[];
  /** Barras verticales (≤15 colaboradores) o tabla heatmap (>15). */
  view: SupervisorIncidenciasChartView;
  /** Total de incidencias en alcance antes de recortar a top N (p. ej. gerente). */
  total_incidencias?: number;
  /** Colaboradores con al menos una incidencia antes del recorte. */
  total_colaboradores?: number;
  /** Cantidad mostrada cuando solo se listan los N con más incidencias. */
  top_n?: number;
};

export type SupervisorHomeOfficeWeekdaySlot = {
  /** 1 = lunes … 5 = viernes */
  weekday: 1 | 2 | 3 | 4 | 5;
  label: string;
  count: number;
};

export type SupervisorHomeOfficeWeekdayChartData = {
  days: SupervisorHomeOfficeWeekdaySlot[];
  /** Total de días laborales (lun–vie) con HO aprobado. */
  total_dias_ho: number;
  /** Número de solicitudes HO aprobadas del equipo. */
  solicitudes_ho: number;
  /** Etiqueta del día con más días HO (p. ej. «Jueves»). */
  dia_mas_solicitado: string | null;
  /** Porcentaje de días HO en el día principal. */
  concentracion_dia_principal_pct: number | null;
};
