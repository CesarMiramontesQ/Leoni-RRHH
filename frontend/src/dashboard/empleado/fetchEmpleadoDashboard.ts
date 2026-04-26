import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import { emptyEmpleadoDashboardPayload } from "./mock.ts";
import { SOLICITUD_ESTADO_API } from "./solicitudCalendarioConsts.ts";
import type { EmpleadoCalendarDayEntry, EmpleadoDashboardPayload, SolicitudEstadoCalendarioEmpleado } from "./types.ts";

/** Días locales YYYY-MM-DD desde fecha_inicio hasta fecha_fin (inclusive), mismo criterio que el grid del calendario. */
function eachIsoDayInclusive(fechaInicio: string, fechaFin: string): string[] {
  const a = fechaInicio.slice(0, 10);
  const b = fechaFin.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return [];
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const start = new Date(y1!, m1! - 1, d1!);
  const end = new Date(y2!, m2! - 1, d2!);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    out.push(rhIsoLocalDate(cur));
  }
  return out;
}

/**
 * Dashboard personal (rol `empleado`): KPIs siguen sin endpoint dedicado;
 * el calendario marca solicitudes propias pendientes (amarillo) y aprobadas (verde).
 */
export async function fetchEmpleadoDashboard(): Promise<EmpleadoDashboardPayload | null> {
  if (getRolFromAccessToken() !== "empleado") return null;

  const now = new Date();
  const base = emptyEmpleadoDashboardPayload(now);
  const myId = getEmpleadoIdFromAccessToken();

  try {
    const rows = await getSolicitudesRows(100);
    const relevant = rows.filter((r) => {
      if (r.estado !== SOLICITUD_ESTADO_API.APROBADO && r.estado !== SOLICITUD_ESTADO_API.PENDIENTE) return false;
      if (myId != null && r.empleado_id !== myId) return false;
      return true;
    });

    const day_entries: Record<string, EmpleadoCalendarDayEntry> = { ...base.calendar.day_entries };
    for (const row of relevant) {
      const estado: SolicitudEstadoCalendarioEmpleado =
        row.estado === SOLICITUD_ESTADO_API.APROBADO ? SOLICITUD_ESTADO_API.APROBADO : SOLICITUD_ESTADO_API.PENDIENTE;
      for (const iso of eachIsoDayInclusive(row.fecha_inicio, row.fecha_fin)) {
        const prev = day_entries[iso]?.solicitudes_empleado ?? [];
        if (prev.some((e) => e.solicitud_id === row.id)) continue;
        day_entries[iso] = {
          ...day_entries[iso],
          solicitudes_empleado: [...prev, { solicitud_id: row.id, estado, tipo: row.tipo }],
        };
      }
    }

    return {
      ...base,
      calendar: {
        ...base.calendar,
        day_entries,
      },
    };
  } catch {
    return null;
  }
}
