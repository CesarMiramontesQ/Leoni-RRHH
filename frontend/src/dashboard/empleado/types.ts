/**
 * Contrato listo para API del dashboard personal (rol empleado).
 */

export type EmpleadoPendingRequestType = "vacation" | "homeOffice";

export type EmpleadoCalendarDayEntry = {
  meal?: boolean;
  vacation?: boolean;
  home_office?: boolean;
};

export type EmpleadoDashboardPayload = {
  vacation_available_days: number | null;
  vacation_used_days: number | null;
  home_office_this_month: number | null;
  pending_requests: number | null;
  pending_request_types: EmpleadoPendingRequestType[];
  calendar: {
    initial_year: number;
    initial_month_index: number;
    day_entries: Record<string, EmpleadoCalendarDayEntry>;
    selected_iso_date: string | null;
  };
};
