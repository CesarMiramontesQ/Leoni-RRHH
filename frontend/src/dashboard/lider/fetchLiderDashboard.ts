import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getComedorEquipoReservasMes, type ComedorEquipoReservaApiItem } from "../../api/comedor.ts";
import { getEmpleadosResumen } from "../../api/empleados.ts";
import { getIncidenciasRows } from "../../api/incidencias.ts";
import { getEmpleadoVista360 } from "../../api/vista360.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import type { RhIncidenciaTablaFila } from "../../incidencias/rh/types.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import { rhIsoLocalDate, rhWeekdayByStart } from "../rh/calendarMonthGrid.ts";
import { emptyLiderDashboardPayload } from "./mock.ts";
import { buildSupervisorIncidenciasChart } from "./buildSupervisorIncidenciasChart.ts";
import { buildSupervisorHomeOfficeWeekdayChart } from "./buildSupervisorHomeOfficeWeekday.ts";
import {
  esSolicitudTipoCalendarioDashboard,
  SOLICITUD_ESTADO_API,
} from "../empleado/solicitudCalendarioConsts.ts";
import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";
import type { EmpleadoPendingRequestType } from "../empleado/types.ts";
import type {
  LiderApprovalRequestType,
  LiderDashboardPayload,
  TeamCalendarDayEntry,
  TeamCalendarEventKind,
  TeamCalendarLine,
} from "./types.ts";
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

function tipoSolicitudToTeamKind(tipo: RhSolicitudTipoCodigo): TeamCalendarEventKind {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  return "goce_sueldo";
}

function textoCortoTipoSolicitud(tipo: RhSolicitudTipoCodigo): string {
  if (tipo === "vacaciones") return "Vacaciones";
  if (tipo === "home_office") return "Home Office";
  if (tipo === "permiso_sin_goce_sueldo") return "Permiso sin goce";
  if (tipo === "matrimonio") return "Matrimonio (goce)";
  if (tipo === "incapacidad_interna") return "Incap. interna (goce)";
  if (tipo === "defuncion") return "Defunción (goce)";
  if (tipo === "paternidad") return "Paternidad (goce)";
  return "Con goce";
}

function toTeamCalendarLine(
  tipo: RhSolicitudTipoCodigo,
  estado: "approved" | "pending",
  ownerId: string,
  ownerNameRaw: string,
): TeamCalendarLine {
  return {
    kind: tipoSolicitudToTeamKind(tipo),
    text: textoCortoTipoSolicitud(tipo),
    request_status: estado,
    request_tipo: tipo,
    owner_id: ownerId,
    owner_name: ownerNameRaw.trim() || `Empleado ${ownerId}`,
  };
}

function mapSolicitudTipoToApprovalUi(tipo: RhSolicitudTipoCodigo): LiderApprovalRequestType {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  if (tipo === "matrimonio" || tipo === "incapacidad_interna" || tipo === "defuncion" || tipo === "paternidad") {
    return "goce_sueldo";
  }
  return "permiso";
}

function mapTipoPendientePersonal(tipo: RhSolicitudTipoCodigo): EmpleadoPendingRequestType {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "homeOffice";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  if (tipo === "matrimonio" || tipo === "incapacidad_interna" || tipo === "defuncion" || tipo === "paternidad") {
    return "goce_sueldo";
  }
  return "vacation";
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
    meal_empleado_id: String(reserva.empleado_id),
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

/** Igual que dashboard empleado: días calendario entre inicio y fin (inclusive). */
function parseIsoDateAsUtcDay(isoDate: string): number | null {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return Date.UTC(year, month - 1, day);
}

function calcVacationDaysInclusive(fechaInicio: string, fechaFin: string): number {
  const startUtc = parseIsoDateAsUtcDay(fechaInicio.slice(0, 10));
  const endUtc = parseIsoDateAsUtcDay(fechaFin.slice(0, 10));
  if (startUtc === null || endUtc === null || endUtc < startUtc) return 0;
  return (endUtc - startUtc) / (24 * 60 * 60 * 1000) + 1;
}

/** Primer y último día del mes civil de `ref` (YYYY-MM-DD locales). */
function monthIsoRange(ref: Date): { monthStartIso: string; monthEndIso: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    monthStartIso: `${y}-${pad2(m + 1)}-01`,
    monthEndIso: `${y}-${pad2(m + 1)}-${pad2(lastDay)}`,
  };
}

/** Días distintos del mes en que aplica HO aprobado propio (mismo criterio que “este mes”). */
function countApprovedHomeOfficeDaysInMonth(
  rows: RhSolicitudTablaFila[],
  myId: string | null,
  monthStartIso: string,
  monthEndIso: string,
): number {
  if (!myId) return 0;
  const days = new Set<string>();
  for (const r of rows) {
    if (r.tipo !== "home_office" || r.estado !== SOLICITUD_ESTADO_API.APROBADO) continue;
    if (r.empleado_id !== myId) continue;
    for (const iso of eachIsoDayInclusive(r.fecha_inicio, r.fecha_fin)) {
      if (iso >= monthStartIso && iso <= monthEndIso) days.add(iso);
    }
  }
  return days.size;
}

/** Incidencias “activas” para KPI (no cerradas), según filas ya filtradas por rol en API. */
function countIncidenciasActivas(filas: RhIncidenciaTablaFila[]): number {
  return filas.reduce((n, r) => (r.estado !== "cerrado" ? n + 1 : n), 0);
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
  const myIdNum = myId !== null ? Number(myId) : null;
  const myVista360Id = myIdNum !== null && Number.isFinite(myIdNum) ? myIdNum : null;
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
    const [rows, mealRowsByMonth, empleadosResumen, vista360, incidenciasFilas] = await Promise.all([
      getSolicitudesRows(100),
      role === "supervisor"
        ? Promise.all(mealMonths.map(({ year, month }) => getComedorEquipoReservasMes(year, month)))
        : Promise.resolve([]),
      getEmpleadosResumen().catch(() => null),
      myVista360Id !== null ? getEmpleadoVista360(myVista360Id).catch(() => null) : Promise.resolve(null),
      getIncidenciasRows(100).catch(() => []),
    ]);
    const todayIso = rhIsoLocalDate(now);
    const { monthStartIso, monthEndIso } = monthIsoRange(now);

    const vacationUsedDays = rows
      .filter(
        (r) =>
          r.tipo === "vacaciones" &&
          r.estado === SOLICITUD_ESTADO_API.APROBADO &&
          (myId == null || r.empleado_id === myId) &&
          r.fecha_fin.slice(0, 10) < todayIso,
      )
      .reduce((acc, r) => acc + calcVacationDaysInclusive(r.fecha_inicio, r.fecha_fin), 0);

    const homeOfficeThisMonth = countApprovedHomeOfficeDaysInMonth(rows, myId, monthStartIso, monthEndIso);
    const solicitudesGestion = rows.filter(
      (r) =>
        esSolicitudTipoCalendarioDashboard(r.tipo) &&
        (r.estado === SOLICITUD_ESTADO_API.APROBADO || r.estado === SOLICITUD_ESTADO_API.PENDIENTE),
    );

    const solicitudesCalendario = solicitudesGestion.filter(
      (r) =>
        !(r.fecha_fin.slice(0, 10) < rangeStartIso || r.fecha_inicio.slice(0, 10) > rangeEndIso),
    );

    const day_entries: Record<string, TeamCalendarDayEntry> = {};
    for (const r of solicitudesCalendario) {
      const estado = r.estado === SOLICITUD_ESTADO_API.APROBADO ? "approved" : "pending";
      const line = toTeamCalendarLine(r.tipo, estado, r.empleado_id, r.empleado_nombre_raw);
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
    /** `colaboradores_total` del resumen = activos en alcance del rol (incluye al líder); la tarjeta cuenta solo colaboradores. */
    const fallbackTeamCount = new Set(teamRows.map((r) => r.empleado_id)).size;
    const teamCollaboratorsCount =
      empleadosResumen != null
        ? Math.max(0, (empleadosResumen.colaboradores_total ?? 0) - 1)
        : fallbackTeamCount;
    const teamActiveIncidents = countIncidenciasActivas(incidenciasFilas);
    const supervisorIncidenciasChart =
      role === "supervisor" ? buildSupervisorIncidenciasChart(incidenciasFilas, myId) : null;
    const hoTeamRows = teamRows.filter(
      (r) => r.tipo === "home_office" && r.estado === SOLICITUD_ESTADO_API.APROBADO,
    );
    const supervisorHoWeekdayChart =
      role === "supervisor" ? buildSupervisorHomeOfficeWeekdayChart(hoTeamRows) : null;
    const approvalRequests = teamPendingRows
      .map((r) => {
        const tipo = mapSolicitudTipoToApprovalUi(r.tipo);
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
        vacation_available_days: vista360?.saldo_vacaciones ?? base.personal.vacation_available_days,
        vacation_used_days: vacationUsedDays,
        home_office_this_month: homeOfficeThisMonth,
        pending_requests: ownRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE).length,
        pending_request_types: Array.from(
          new Set(
            ownRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE).map((r) => mapTipoPendientePersonal(r.tipo)),
          ),
        ),
      },
      team: {
        ...base.team,
        team_active_incidents: teamActiveIncidents,
        team_pending_vacation_requests: teamRows.filter(
          (r) => r.tipo === "vacaciones" && r.estado === SOLICITUD_ESTADO_API.PENDIENTE,
        ).length,
        team_pending_home_office_requests: teamRows.filter(
          (r) => r.tipo === "home_office" && r.estado === SOLICITUD_ESTADO_API.PENDIENTE,
        ).length,
        team_collaborators_count: teamCollaboratorsCount,
      },
      approval_requests: approvalRequests,
      supervisor_incidencias_chart: supervisorIncidenciasChart,
      supervisor_ho_weekday_chart: supervisorHoWeekdayChart,
      team_calendar: {
        ...base.team_calendar,
        initial_year: initialYear,
        initial_month_index: initialMonth,
        day_entries,
        selected_iso_date: todayIso,
      },
    };
  } catch {
    return null;
  }
}
