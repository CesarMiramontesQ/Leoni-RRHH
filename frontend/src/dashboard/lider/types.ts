import type { EmpleadoPendingRequestType } from "../empleado/types.ts";

/** Métricas personales del líder (mismo significado que dashboard empleado). */
export type LiderPersonalStats = {
  vacation_available_days: number | null;
  vacation_used_days: number | null;
  home_office_this_month: number | null;
  pending_requests: number | null;
  pending_request_types: EmpleadoPendingRequestType[];
};

/** Métricas agregadas del equipo a cargo. */
export type LiderTeamStats = {
  team_active_incidents: number | null;
  team_pending_vacation_requests: number | null;
  team_pending_home_office_requests: number | null;
  team_collaborators_count: number | null;
};

export type LiderApprovalRequestType = "vacation" | "home_office" | "permiso" | "incidencia";

export type LiderApprovalRequestRow = {
  id: string;
  collaborator_name: string;
  collaborator_initials: string | null;
  request_type: LiderApprovalRequestType;
  date_range: string;
  detail: string;
  status: string;
};

export type TeamCalendarEventKind = "meal" | "vacation" | "home_office" | "incident";

export type TeamCalendarLine = {
  kind: TeamCalendarEventKind;
  text: string;
  /** Solo para comidas: nombre corto del colaborador con reserva. */
  meal_employee_name?: string;
  /** Solo para comidas: tipo de comida ya formateado para UI. */
  meal_type_label?: string;
  /** Solo para comidas: hora de registro (HH:mm) cuando existe. */
  meal_time_label?: string;
  /** Solo para solicitudes: estado canónico API (`approved` / `pending`). */
  request_status?: "approved" | "pending";
  /** Solo para solicitudes: tipo de solicitud para etiqueta. */
  request_type?: "vacation" | "home_office";
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
  team_calendar: {
    initial_year: number;
    initial_month_index: number;
    day_entries: Record<string, TeamCalendarDayEntry>;
    selected_iso_date: string | null;
  };
};
