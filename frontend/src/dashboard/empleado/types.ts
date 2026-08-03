/**
 * Contrato listo para API del dashboard personal (rol empleado).
 */

import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";

export type EmpleadoPendingRequestType =
  | "vacation"
  | "homeOffice"
  | "permiso_sin_goce"
  | "goce_sueldo";

/** Estados de solicitud mostrados en el calendario del empleado (valores API). */
export type SolicitudEstadoCalendarioEmpleado = "approved" | "pending";

/** Marca de solicitud propia en el calendario (solo se rellena para rol `empleado`). */
export type EmpleadoSolicitudCalendarioEvento = {
  solicitud_id: number;
  estado: SolicitudEstadoCalendarioEmpleado;
  tipo: RhSolicitudTipoCodigo;
};

export type EmpleadoCalendarDayEntry = {
  meal?: boolean | string;
  vacation?: boolean;
  home_office?: boolean;
  /** Solicitudes propias (pendiente / aprobada), solo dashboard empleado. */
  solicitudes_empleado?: EmpleadoSolicitudCalendarioEvento[];
};

export type EmpleadoDashboardPayload = {
  /** Días de gozo pendientes en TRESS (todos los aniversarios). `null` = sin dato. */
  vacation_available_days: number | null;
  /** Días ya gozados del aniversario vigente en TRESS. */
  vacation_used_days: number | null;
  /** Días de home office registrados en TRESS en el año en curso. */
  home_office_dias_anio: number | null;
  pending_requests: number | null;
  pending_request_types: EmpleadoPendingRequestType[];
  calendar: {
    initial_year: number;
    initial_month_index: number;
    day_entries: Record<string, EmpleadoCalendarDayEntry>;
    selected_iso_date: string | null;
  };
};
