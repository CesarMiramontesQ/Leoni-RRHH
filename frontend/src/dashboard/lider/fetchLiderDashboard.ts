import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getComedorEquipoReservasMes, type ComedorEquipoReservaApiItem } from "../../api/comedor.ts";
import { getEmpleadosPage } from "../../api/empleados.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { rhIsoLocalDate, rhWeekdayByStart } from "../rh/calendarMonthGrid.ts";
import { emptyLiderDashboardPayload } from "./mock.ts";
import { SOLICITUD_ESTADO_API } from "../empleado/solicitudCalendarioConsts.ts";
import type { LiderDashboardPayload, TeamCalendarDayEntry, TeamCalendarLine } from "./types.ts";
import { etiquetaTipoComida } from "../../utils/comedorReservaFechas.ts";
import { extraerPrimerNombreApellido } from "../../utils/comedorNombreCorto.ts";

type CalendarMonthFetchTarget = {
  year: number;
  monthIndex: number;
  visibleStartIso?: string;
  visibleEndIso?: string;
  weekStartsOn?: 0 | 1;
};

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function computeVisibleRange(
  year: number,
  monthIndex: number,
  weekStartsOn: 0 | 1 = 1,
): { startIso: string; endIso: string } {
  const first = new Date(year, monthIndex, 1);
  const startOffset = rhWeekdayByStart(first, weekStartsOn);
  const start = new Date(year, monthIndex, 1 - startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return {
    startIso: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    endIso: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function monthsCoveredByIsoRange(startIso: string, endIso: string): Array<{ year: number; month: number }> {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [];
  const out: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
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

function hourLabelFromIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(dt);
}

function mealLineFromReserva(reserva: ComedorEquipoReservaApiItem): TeamCalendarLine {
  const employeeName =
    reserva.empleado_nombre_corto?.trim() || extraerPrimerNombreApellido(reserva.empleado_nombre || "");
  const tipoComida = etiquetaTipoComida(reserva.tipo_comida || "");
  const hour = (
    hourLabelFromIso((reserva as { fecha_registro?: string | null }).fecha_registro) ||
    hourLabelFromIso((reserva as { created_at?: string | null }).created_at)
  ) ?? "Sin hora";
  return {
    kind: "meal",
    text: `Comida ${employeeName} · ${tipoComida}`,
    meal_employee_name: employeeName,
    meal_type_label: tipoComida,
    meal_time_label: hour,
  };
}

function capitalizeFirst(raw: string): string {
  if (!raw) return "";
  return `${raw.slice(0, 1).toUpperCase()}${raw.slice(1)}`;
}

function formatApprovalDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };
  if (startIso === endIso) return fmt(startIso);
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

/**
 * Dashboard de supervisor/gerente:
 * construye el calendario de equipo con solicitudes propias+equipo (API scoped por rol).
 */
export async function fetchLiderDashboard(target?: CalendarMonthFetchTarget): Promise<LiderDashboardPayload | null> {
  const role = getRolFromAccessToken();
  if (role !== "supervisor" && role !== "gerente") return null;

  const now = new Date();
  const referenceDate =
    target ? new Date(target.year, target.monthIndex, 1) : now;
  const base = emptyLiderDashboardPayload(referenceDate);
  const myId = getEmpleadoIdFromAccessToken();
  const visibleRange = computeVisibleRange(
    base.team_calendar.initial_year,
    base.team_calendar.initial_month_index,
    target?.weekStartsOn ?? 1,
  );
  const rangeStartIso = target?.visibleStartIso ?? visibleRange.startIso;
  const rangeEndIso = target?.visibleEndIso ?? visibleRange.endIso;

  try {
    // API `/api/v1/solicitudes` admite máximo `limit=100`.
    const mealMonths = monthsCoveredByIsoRange(rangeStartIso, rangeEndIso);
    const [rows, mealRowsByMonth, empleadosPage] = await Promise.all([
      getSolicitudesRows(100),
      role === "supervisor"
        ? Promise.all(mealMonths.map(({ year, month }) => getComedorEquipoReservasMes(year, month)))
        : Promise.resolve([]),
      getEmpleadosPage({ page: 1, page_size: 1, activo: true }).catch(() => null),
    ]);
    const solicitudesGestion = rows.filter(
      (r) =>
        (r.tipo === "vacaciones" || r.tipo === "home_office") &&
        (r.estado === SOLICITUD_ESTADO_API.APROBADO || r.estado === SOLICITUD_ESTADO_API.PENDIENTE),
    );

    const solicitudesCalendario = solicitudesGestion.filter(
      (r) =>
        !(r.fecha_fin.slice(0, 10) < rangeStartIso || r.fecha_inicio.slice(0, 10) > rangeEndIso),
    );

    const day_entries: Record<string, TeamCalendarDayEntry> = {};
    for (const r of solicitudesCalendario) {
      const estado = r.estado === SOLICITUD_ESTADO_API.APROBADO ? "approved" : "pending";
      const tipoCalendario = r.tipo === "vacaciones" ? "vacaciones" : "home_office";
      const line = toTeamCalendarLine(tipoCalendario, estado, r.empleado_id, r.empleado_nombre_raw);
      for (const iso of eachIsoDayInclusive(r.fecha_inicio, r.fecha_fin)) {
        if (iso < rangeStartIso || iso > rangeEndIso) continue;
        const prev = day_entries[iso]?.lines ?? [];
        day_entries[iso] = { lines: [...prev, line] };
      }
    }

    if (role === "supervisor") {
      const mealRows = mealRowsByMonth.flat();
      for (const reserva of mealRows) {
        const iso = reserva.fecha_servicio?.slice(0, 10);
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < rangeStartIso || iso > rangeEndIso) continue;
        const prev = day_entries[iso]?.lines ?? [];
        day_entries[iso] = { lines: [...prev, mealLineFromReserva(reserva)] };
      }
    }

    const ownRows = myId ? solicitudesGestion.filter((r) => r.empleado_id === myId) : [];
    const teamRows = myId ? solicitudesGestion.filter((r) => r.empleado_id !== myId) : solicitudesGestion;
    const teamPendingRows = teamRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE);
    const fallbackTeamCount = new Set(teamRows.map((r) => r.empleado_id)).size;
    const teamCollaboratorsCount = empleadosPage
      ? Math.max(0, (empleadosPage.total ?? 0) - 1)
      : fallbackTeamCount;
    const approvalRequests = teamPendingRows
      .map((r) => {
        const tipo = r.tipo === "vacaciones" ? "vacation" : "home_office";
        const name = r.empleado_nombre_raw.trim() || `Empleado ${r.empleado_id}`;
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0] ?? "")
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return {
          id: String(r.id),
          collaborator_name: name,
          collaborator_initials: initials || null,
          request_type: tipo,
          date_range: formatApprovalDateRange(r.fecha_inicio, r.fecha_fin),
          detail: (r.comentarios ?? "").trim() || `${capitalizeFirst(r.tipo.replace("_", " "))} pendiente`,
          status: "Pendiente",
        } satisfies LiderDashboardPayload["approval_requests"][number];
      })
      .sort((a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10));

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
        team_collaborators_count: teamCollaboratorsCount,
      },
      approval_requests: approvalRequests,
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
