import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import { emptyLiderDashboardPayload } from "./mock.ts";
import { SOLICITUD_ESTADO_API } from "../empleado/solicitudCalendarioConsts.ts";
import type { LiderDashboardPayload, TeamCalendarDayEntry, TeamCalendarLine } from "./types.ts";

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
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) out.push(rhIsoLocalDate(cur));
  return out;
}

function toTeamCalendarLine(
  tipo: "vacaciones" | "home_office",
  estado: "approved" | "pending",
  ownerId: string,
  ownerNameRaw: string,
): TeamCalendarLine {
  return {
    kind: tipo === "vacaciones" ? "vacation" : "home_office",
    text: tipo === "vacaciones" ? "Vacaciones" : "Home Office",
    request_type: tipo === "vacaciones" ? "vacation" : "home_office",
    request_status: estado,
    owner_id: ownerId,
    owner_name: ownerNameRaw.trim() || `Empleado ${ownerId}`,
  };
}

/**
 * Dashboard de supervisor/gerente:
 * construye el calendario de equipo con solicitudes propias+equipo (API scoped por rol).
 */
export async function fetchLiderDashboard(): Promise<LiderDashboardPayload | null> {
  const role = getRolFromAccessToken();
  if (role !== "supervisor" && role !== "gerente") return null;

  const now = new Date();
  const base = emptyLiderDashboardPayload(now);
  const myId = getEmpleadoIdFromAccessToken();

  try {
    // API `/api/v1/solicitudes` admite máximo `limit=100`.
    const rows = await getSolicitudesRows(100);
    const solicitudesCalendario = rows.filter(
      (r) =>
        (r.tipo === "vacaciones" || r.tipo === "home_office") &&
        (r.estado === SOLICITUD_ESTADO_API.APROBADO || r.estado === SOLICITUD_ESTADO_API.PENDIENTE),
    );

    const day_entries: Record<string, TeamCalendarDayEntry> = {};
    for (const r of solicitudesCalendario) {
      const estado = r.estado === SOLICITUD_ESTADO_API.APROBADO ? "approved" : "pending";
      const line = toTeamCalendarLine(r.tipo, estado, r.empleado_id, r.empleado_nombre_raw);
      for (const iso of eachIsoDayInclusive(r.fecha_inicio, r.fecha_fin)) {
        const prev = day_entries[iso]?.lines ?? [];
        day_entries[iso] = { lines: [...prev, line] };
      }
    }

    const ownRows = myId ? solicitudesCalendario.filter((r) => r.empleado_id === myId) : [];
    const teamRows = myId ? solicitudesCalendario.filter((r) => r.empleado_id !== myId) : solicitudesCalendario;

    const initial = solicitudesCalendario
      .map((r) => r.fecha_inicio.slice(0, 10))
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
      .sort()[0] ?? null;
    const initDate = initial ? new Date(`${initial}T00:00:00`) : now;
    const initialYear = Number.isNaN(initDate.getTime()) ? now.getFullYear() : initDate.getFullYear();
    const initialMonth = Number.isNaN(initDate.getTime()) ? now.getMonth() : initDate.getMonth();

    return {
      ...base,
      personal: {
        ...base.personal,
        pending_requests: ownRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE).length,
        pending_request_types: ownRows
          .filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE)
          .map((r) => (r.tipo === "vacaciones" ? "vacation" : "homeOffice")),
      },
      team: {
        ...base.team,
        team_pending_vacation_requests: teamRows.filter(
          (r) => r.tipo === "vacaciones" && r.estado === SOLICITUD_ESTADO_API.PENDIENTE,
        ).length,
        team_pending_home_office_requests: teamRows.filter(
          (r) => r.tipo === "home_office" && r.estado === SOLICITUD_ESTADO_API.PENDIENTE,
        ).length,
      },
      team_calendar: {
        ...base.team_calendar,
        initial_year: initialYear,
        initial_month_index: initialMonth,
        day_entries,
        selected_iso_date: rhIsoLocalDate(now),
      },
    };
  } catch {
    return null;
  }
}
