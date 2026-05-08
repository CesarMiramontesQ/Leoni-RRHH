import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getComedorMisReservasMes } from "../../api/comedor.ts";
import { getEmpleadoVista360 } from "../../api/vista360.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { etiquetaTipoComida } from "../../utils/comedorReservaFechas.ts";
import { rhIsoLocalDate, rhWeekdayByStart } from "../rh/calendarMonthGrid.ts";
import { emptyEmpleadoDashboardPayload } from "./mock.ts";
import { esSolicitudTipoCalendarioDashboard, SOLICITUD_ESTADO_API } from "./solicitudCalendarioConsts.ts";
import type { EmpleadoCalendarDayEntry, EmpleadoDashboardPayload, SolicitudEstadoCalendarioEmpleado } from "./types.ts";

type CalendarMonthFetchTarget = {
  year: number;
  monthIndex: number;
  visibleStartIso?: string;
  visibleEndIso?: string;
  weekStartsOn?: 0 | 1;
};

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

/**
 * Dashboard personal (rol `empleado`): KPIs siguen sin endpoint dedicado;
 * el calendario marca solicitudes propias pendientes (amarillo) y aprobadas (verde).
 */
export async function fetchEmpleadoDashboard(target?: CalendarMonthFetchTarget): Promise<EmpleadoDashboardPayload | null> {
  if (getRolFromAccessToken() !== "empleado") return null;

  const now = new Date();
  const referenceDate =
    target ? new Date(target.year, target.monthIndex, 1) : now;
  const base = emptyEmpleadoDashboardPayload(referenceDate);
  const myId = getEmpleadoIdFromAccessToken();
  const myIdNum = myId !== null ? Number(myId) : null;
  const myVista360Id = myIdNum !== null && Number.isFinite(myIdNum) ? myIdNum : null;
  const visibleRange = computeVisibleRange(
    base.calendar.initial_year,
    base.calendar.initial_month_index,
    target?.weekStartsOn ?? 1,
  );
  const rangeStartIso = target?.visibleStartIso ?? visibleRange.startIso;
  const rangeEndIso = target?.visibleEndIso ?? visibleRange.endIso;
  const monthsToLoad = monthsCoveredByIsoRange(rangeStartIso, rangeEndIso);

  try {
    const [rows, reservasPorMes, vista360] = await Promise.all([
      getSolicitudesRows(100),
      Promise.all(
        monthsToLoad.map(({ year, month }) => getComedorMisReservasMes(year, month).catch(() => [])),
      ),
      myVista360Id !== null ? getEmpleadoVista360(myVista360Id).catch(() => null) : Promise.resolve(null),
    ]);
    const comedorReservas = reservasPorMes
      .flat()
      .filter((reserva) => {
        if (reserva.estado_acceso.trim().toUpperCase() === "EXPIRADO") return false;
        const iso = reserva.fecha_servicio.slice(0, 10);
        return iso >= rangeStartIso && iso <= rangeEndIso;
      });
    const relevant = rows.filter((r) => {
      if (!esSolicitudTipoCalendarioDashboard(r.tipo)) return false;
      if (r.estado !== SOLICITUD_ESTADO_API.APROBADO && r.estado !== SOLICITUD_ESTADO_API.PENDIENTE) return false;
      if (myId != null && r.empleado_id !== myId) return false;
      const startIso = r.fecha_inicio.slice(0, 10);
      const endIso = r.fecha_fin.slice(0, 10);
      if (endIso < rangeStartIso || startIso > rangeEndIso) return false;
      return true;
    });

    const todayIso = rhIsoLocalDate(now);
    const vacationUsedDays = rows
      .filter(
        (r) =>
          r.tipo === "vacaciones" &&
          r.estado === SOLICITUD_ESTADO_API.APROBADO &&
          (myId == null || r.empleado_id === myId) &&
          r.fecha_fin.slice(0, 10) < todayIso,
      )
      .reduce((acc, r) => acc + calcVacationDaysInclusive(r.fecha_inicio, r.fecha_fin), 0);

    const day_entries: Record<string, EmpleadoCalendarDayEntry> = { ...base.calendar.day_entries };
    for (const reserva of comedorReservas) {
      const iso = reserva.fecha_servicio.slice(0, 10);
      day_entries[iso] = {
        ...day_entries[iso],
        meal: etiquetaTipoComida(reserva.tipo_comida),
      };
    }
    for (const row of relevant) {
      const estado: SolicitudEstadoCalendarioEmpleado =
        row.estado === SOLICITUD_ESTADO_API.APROBADO ? SOLICITUD_ESTADO_API.APROBADO : SOLICITUD_ESTADO_API.PENDIENTE;
      for (const iso of eachIsoDayInclusive(row.fecha_inicio, row.fecha_fin)) {
        if (iso < rangeStartIso || iso > rangeEndIso) continue;
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
      vacation_available_days: vista360?.saldo_vacaciones ?? base.vacation_available_days,
      vacation_used_days: vacationUsedDays,
      calendar: {
        ...base.calendar,
        day_entries,
      },
    };
  } catch {
    return null;
  }
}
